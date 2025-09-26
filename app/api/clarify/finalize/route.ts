import { createAdminClient } from "@/lib/supabase/admin"
import { buildEnriched } from "@/lib/llm/enricher"
import { assertClarifySchema } from "@/lib/supabase/guard"

export async function POST(req: Request) {
  const rid = Math.random().toString(36).slice(2)
  let sessionId: string
  try {
    const body = await req.json()
    sessionId = body.sessionId
  } catch (e: any) {
    console.error(`[finalize] rid=${rid} body-parse-error:`, e?.message)
    return new Response(JSON.stringify({ error: "invalid body" }), { status: 400 })
  }
  const supabase = createAdminClient()
  try {
    await assertClarifySchema()
  } catch (e: any) {
    console.error(`[finalize] rid=${rid} schema-error:`, e?.message)
    return new Response(JSON.stringify({ error: e.message || "Clarify schema missing" }), { status: 500 })
  }

  const { data: session, error: sErr } = await supabase
    .from("clarification_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()
  if (sErr || !session) {
    console.error(`[finalize] rid=${rid} session-error:`, sErr?.message || "not found")
    return new Response(JSON.stringify({ error: sErr?.message || "session not found" }), { status: 404 })
  }

  const { data: questions } = await supabase
    .from("clarification_questions")
    .select("*")
    .eq("session_id", sessionId)
    .order("order_index")
  const { data: answers } = await supabase
    .from("clarification_answers")
    .select("*")
    .eq("session_id", sessionId)

  const answersJson = (questions ?? []).reduce((acc: any, q: any) => {
    const a = (answers ?? []).find((x: any) => x.question_id === q.id)
    acc[q.key] = a?.value ?? null
    return acc
  }, {} as Record<string, unknown>)

  // Try to infer submitter email from the linked query_id
  let submitterEmail: string | undefined
  try {
    const queryId = (session?.metadata as any)?.query_id
    if (queryId) {
      const { data: q } = await supabase.from("queries").select("email").eq("id", queryId).single()
      submitterEmail = q?.email || undefined
    }
  } catch {}

  // Build filters JSON (deterministic, low temp, ≤10s)
  const filtersJsonStr = await buildEnriched({ originalQuery: session.original_query, answersJson, email: submitterEmail })
  let filters: any = null
  try {
    filters = JSON.parse(filtersJsonStr)
  } catch (e: any) {
    console.error(`[finalize] rid=${rid} parse-filters-error:`, e?.message)
    return new Response(JSON.stringify({ error: "LLM returned non-JSON filters" }), { status: 500 })
  }

  // Persist result; reuse 'enriched_prompt' column to store filters JSON string for now
  const { error: upErr } = await supabase.from("clarification_sessions").update({ status: "complete", enriched_prompt: JSON.stringify(filters) }).eq("id", sessionId)
  if (upErr) {
    console.error(`[finalize] rid=${rid} update-session-error:`, upErr.message)
    return new Response(JSON.stringify({ error: upErr.message }), { status: 500 })
  }
  const { error: evErr } = await supabase.from("clarification_events").insert({ session_id: sessionId, type: "finalized", payload: { filters } })
  if (evErr) {
    console.error(`[finalize] rid=${rid} insert-event-error:`, evErr.message)
  }

  return Response.json({ sessionId, filters, status: "complete" })
}


