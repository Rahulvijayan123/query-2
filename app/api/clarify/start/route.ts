import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { askClarifier } from "@/lib/llm/clarifier"
import { assertClarifySchema } from "@/lib/supabase/guard"

const Body = z.object({
  originalQuery: z.string().min(1),
  context: z
    .object({
      domain: z.enum(["code", "analysis", "docs", "qa", "other"]).optional(),
      projectId: z.string().optional(),
      defaults: z.record(z.any()).optional(),
    })
    .optional(),
  maxQuestions: z.number().int().positive().max(10).optional(),
  completenessThreshold: z.number().min(0).max(1).optional(),
})

export async function POST(req: Request) {
  const body = Body.parse(await req.json())
  const supabase = createAdminClient()
  try {
    await assertClarifySchema()
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Clarify schema missing" }), { status: 500 })
  }

  const { data: session, error: insertErr } = await supabase
    .from("clarification_sessions")
    .insert({
      user_id: "00000000-0000-0000-0000-000000000001",
      original_query: body.originalQuery,
      status: "generating",
      metadata: { context: body.context },
    })
    .select("*")
    .single()

  if (insertErr) return new Response(JSON.stringify({ error: insertErr.message }), { status: 500 })

  const clarifier = await askClarifier({
    originalQuery: body.originalQuery,
    context: body.context,
    maxQuestions: body.maxQuestions ?? 5,
  })

  const questions = (clarifier.questions ?? []).slice(0, body.maxQuestions ?? 5)
  const status = questions.length ? "presented" : "ready"

  await supabase
    .from("clarification_sessions")
    .update({ status, completeness: clarifier.completeness })
    .eq("id", session.id)

  if (questions.length) {
    const { error: qErr } = await supabase.from("clarification_questions").insert(
      questions.map((q: any, i: number) => ({
        session_id: session.id,
        order_index: i,
        key: q.key,
        label: q.label,
        type: q.type,
        options: q.options ?? null,
        required: q.required ?? true,
        placeholder: q.placeholder ?? null,
        help: q.help ?? null,
        reason: q.reason ?? null,
      }))
    )
    if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 })
    await supabase.from("clarification_events").insert({ session_id: session.id, type: "asked", payload: { count: questions.length } })
    const { data: dbQuestions, error: selErr } = await supabase
      .from("clarification_questions")
      .select("id, order_index, key, label, type, options, required, placeholder, help, reason")
      .eq("session_id", session.id)
      .order("order_index")
    if (selErr) return new Response(JSON.stringify({ error: selErr.message }), { status: 500 })
    return Response.json({ sessionId: session.id, completeness: clarifier.completeness, questions: dbQuestions, status })
  }

  return Response.json({ sessionId: session.id, completeness: clarifier.completeness, questions: [], status })
}


