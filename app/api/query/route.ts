import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { askClarifier } from "@/lib/llm/clarifier"
import { assertServerSecrets } from "@/lib/config"
import { inferQuestionType } from "@/lib/clarify/fallback"

const Body = z.object({
  text: z.string().min(1).optional(),
  query_id: z.string().uuid().optional(),
  email: z.string().email().optional(),
  maxQuestions: z.number().int().min(1).max(10).optional(),
  facets: z.record(z.any()).optional(),
})

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"

const optionHasDefault = (opts: any[]): boolean => Array.isArray(opts) && opts.some((o) => o?.is_default)

const normalizeOptions = (opts: any[] | undefined | null): any[] | null => {
  if (!Array.isArray(opts) || opts.length === 0) return null
  const normalized = opts.map((opt: any, idx: number) => ({
    value: String(opt?.value ?? idx),
    label: opt?.label || String(opt?.value ?? `Option ${idx + 1}`),
    is_default: Boolean(opt?.is_default),
  }))
  if (!optionHasDefault(normalized)) {
    normalized[0] = { ...normalized[0], is_default: true }
  }
  return normalized
}

const buildAutoReason = (queryText: string, q: any, facets: any): string => {
  if (q?.reason && typeof q.reason === "string" && q.reason.trim().length > 0) return q.reason
  const key = (q?.key || q?.label || "scope").toString().toLowerCase()
  if (key.includes("stage")) return "Stage alignment changes inclusion/exclusion for pivotal evidence."
  if (key.includes("geo")) return "Geography affects regulatory pathways and accessible cohorts."
  if (key.includes("modal")) return "Modality choices alter mechanism relevance and comparable benchmarks."
  if (key.includes("scope")) return "Clarifies breadth vs depth so downstream retrieval stays on target."
  if (key.includes("unit")) return "Unit selection shifts which entities are retrieved (assets vs trials etc.)."
  return `Needed to balance breadth vs specificity for "${queryText}".`
}

export async function POST(req: Request) {
  const rid = Math.random().toString(36).slice(2)
  const startTime = Date.now()
  const logPrefix = `[API-QUERY]`
  
  console.log(`${logPrefix} New query request started`, {
    requestId: rid,
    timestamp: new Date().toISOString()
  })
  const t0 = Date.now()
  let body: z.infer<typeof Body>
  try {
    body = Body.parse(await req.json())
  } catch (e: any) {
    console.error(`[query] rid=${rid} body-parse-error:`, e?.message)
    return new Response(JSON.stringify({ error: "invalid body" }), { status: 400 })
  }
  try {
    await assertServerSecrets()
  } catch (e: any) {
    console.error(`[query] rid=${rid} secrets-error:`, e?.message)
    return new Response(JSON.stringify({ error: e?.message || "secrets error" }), { status: 500 })
  }
  const supabase = createAdminClient()
  console.log(`[query] rid=${rid} start textLen=${(body.text||'').length} hasQueryId=${!!body.query_id} hasFacets=${!!body.facets}`)

  // 1) Ensure a query row exists
  let queryId = body.query_id as string | undefined
  if (!queryId) {
    if (!body.text) return new Response(JSON.stringify({ error: "text or query_id required" }), { status: 400 })
    const { data: queryRow, error: qErr } = await supabase
      .from("queries")
      .insert({
        user_id: DEMO_USER_ID,
        email: body.email ?? null,
        query_text: body.text,
        facets: body.facets ? JSON.stringify(body.facets) : "{}",
      })
      .select("id")
      .single()
    if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 })
    queryId = queryRow.id
  }
  console.log(`[query] rid=${rid} created query id=${queryId}`)

  // 2) Create a clarification session linked to this query
  const { data: session, error: sErr } = await supabase
    .from("clarification_sessions")
    .insert({ user_id: DEMO_USER_ID, original_query: body.text ?? "", status: "generating", metadata: { query_id: queryId } })
    .select("id")
    .single()
  if (sErr) {
    console.error(`[query] rid=${rid} create-session-error:`, sErr.message)
    return new Response(JSON.stringify({ error: sErr.message }), { status: 500 })
  }
  console.log(`[query] rid=${rid} created session id=${session.id}`)

  // 3) Load query row to supply Supabase inputs to the clarifier
  const { data: qRow2, error: gErr2 } = await supabase.from("queries").select("query_text, email, facets").eq("id", queryId).single()
  if (gErr2 || !qRow2) return new Response(JSON.stringify({ error: gErr2?.message || "query not found" }), { status: 404 })
  const queryText = body.text || qRow2.query_text || ""
  let facets: any = null
  try { facets = qRow2.facets ? JSON.parse(qRow2.facets) : null } catch { facets = null }
  const email = qRow2.email || body.email || null
  const emailDomain = email ? (email.split("@")[1] || null) : null

  // 4) Call clarifier synchronously (≤30s budget) with Supabase inputs to maximize specificity
  let clarifier: { completeness: number; questions: any[]; debug?: any } = { completeness: 0, questions: [] }
  
  console.log(`${logPrefix} Starting clarification process`, {
    requestId: rid,
    query: queryText,
    maxQuestions: Math.min(4, body.maxQuestions ?? 2),
    domain: emailDomain
  })
  
  try {
    clarifier = await askClarifier({
      originalQuery: queryText,
      maxQuestions: body.maxQuestions ?? 10, // Allow up to 10 questions for broad queries
      context: {
        timeoutMs: 30000,
        domain: emailDomain || "other",
        supabase: { query_id: queryId, email, facets },
        forceQuestion: false,
      },
    })
    
    console.log(`${logPrefix} Clarification completed`, {
      requestId: rid,
      questionCount: clarifier.questions?.length || 0,
      completeness: clarifier.completeness,
      hasDebugInfo: !!clarifier.debug
    })
  } catch (e: any) {
    console.error(`${logPrefix} Clarifier error - providing fallback`, {
      requestId: rid,
      error: e?.message || e,
      query: queryText
    })
    clarifier = { 
      completeness: 0.1, // LOW completeness to trigger questions 
      questions: [],
      debug: { error: e?.message || "Unknown error", fallback: true }
    }
  }

  let llmQs = Array.isArray(clarifier.questions) ? clarifier.questions : []

  // Anti-loop logic: Normalize outputs and ensure each question is closed-ended with defaults
  if (!Array.isArray(clarifier.questions) || clarifier.questions.length === 0) {
    console.warn(`${logPrefix} No questions generated - this is expected for complete queries`, {
      requestId: rid,
      completeness: clarifier.completeness,
      hasDebug: !!clarifier.debug
    })
  } else {
    console.log(`${logPrefix} Questions generated successfully`, {
      requestId: rid,
      questionCount: clarifier.questions.length,
      firstQuestionPreview: clarifier.questions[0]?.label?.slice(0, 50) + '...'
    })
  }
  llmQs = llmQs
    .map((raw: any, idx: number) => {
      const type = inferQuestionType(raw)
      const options = type.includes("select") ? (raw.options || [
        { value: "yes", label: "Yes", is_default: false },
        { value: "no", label: "No", is_default: true }
      ]) : undefined
      return {
        key: raw.key || `q_${idx + 1}`,
        label: raw.label || raw.text || `Question ${idx + 1}`,
        type,
        options,
        required: raw.required !== false,
        placeholder: raw.placeholder ?? null,
        help: raw.help ?? null,
        reason: raw.reason || buildAutoReason(queryText, raw, facets),
      }
    })
    .filter(Boolean)

  // Enforce limit only; no fallback questions.
  llmQs = llmQs.slice(0, Math.min(4, body.maxQuestions ?? 3))

  const { error: iqErr } = await supabase
    .from("clarification_questions")
    .insert(
      llmQs.map((q: any, i: number) => ({
        session_id: session.id,
        order_index: i,
        key: q.key,
        label: q.label,
        type: q.type,
        options: q.options ?? null,
        required: q.required,
        placeholder: q.placeholder,
        help: q.help,
        reason: q.reason,
      }))
    )
  if (iqErr) {
    console.error(`[query] rid=${rid} insert-questions-error:`, iqErr.message)
    return new Response(JSON.stringify({ error: iqErr.message }), { status: 500 })
  }

  // 5) Read back inserted questions to get IDs
  const { data: dbQs, error: selErr } = await supabase
    .from("clarification_questions")
    .select("id, order_index, key, label, type, options, required, placeholder, help, reason")
    .eq("session_id", session.id)
    .order("order_index")
  if (selErr) {
    console.error(`[query] rid=${rid} select-questions-error:`, selErr.message)
    return new Response(JSON.stringify({ error: selErr.message }), { status: 500 })
  }

  await supabase
    .from("clarification_sessions")
    .update({ status: dbQs && dbQs.length ? "presented" : "ready", completeness: clarifier.completeness })
    .eq("id", session.id)

  console.log(`[query] rid=${rid} done totalMs=${Date.now()-t0} qCount=${dbQs?.length||0}`)
  return Response.json({
    query_id: queryId,
    session_id: session.id,
    questions: dbQs ?? [],
    status: dbQs && dbQs.length ? "presented" : "ready",
    completeness: clarifier.completeness,
    // debug: clarifier.debug // Remove debug info for production
  })
}


