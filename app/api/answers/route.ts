import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

const Body = z.object({
  question_id: z.string().uuid(),
  answer: z.any(),
})

export async function POST(req: Request) {
  const body = Body.parse(await req.json())
  const supabase = createAdminClient()

  // Get session from question
  const { data: qRow, error: qErr } = await supabase
    .from("clarification_questions")
    .select("id, session_id")
    .eq("id", body.question_id)
    .single()
  if (qErr || !qRow) return new Response(JSON.stringify({ error: qErr?.message || "question not found" }), { status: 404 })

  const upsert = { session_id: qRow.session_id, question_id: qRow.id, value: body.answer }
  const { error: aErr } = await supabase.from("clarification_answers").upsert(upsert)
  if (aErr) return new Response(JSON.stringify({ error: aErr.message }), { status: 500 })

  // Update completeness
  const { data: qs } = await supabase.from("clarification_questions").select("id, required").eq("session_id", qRow.session_id)
  const { data: as } = await supabase.from("clarification_answers").select("question_id").eq("session_id", qRow.session_id)
  const requiredCount = (qs ?? []).filter((q) => q.required).length
  const answeredRequired = (qs ?? []).filter((q) => q.required && (as ?? []).some((a) => a.question_id === q.id)).length
  const completeness = requiredCount ? answeredRequired / requiredCount : 1
  await supabase.from("clarification_sessions").update({ completeness, status: completeness >= 1 ? "ready" : "collecting" }).eq("id", qRow.session_id)

  // Optional follow-up: If there are unanswered required questions, we could trigger another clarifier pass here.
  // Keeping minimal per constraints; server can add logic later.

  return Response.json({ ok: true, session_id: qRow.session_id, completeness })
}


