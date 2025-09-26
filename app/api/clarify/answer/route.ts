import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertClarifySchema } from "@/lib/supabase/guard"

const Body = z.object({
  sessionId: z.string().uuid(),
  answers: z.array(z.object({ questionId: z.string().uuid(), value: z.any() })),
})

export async function POST(req: Request) {
  const { sessionId, answers } = Body.parse(await req.json())
  const supabase = createAdminClient()
  try {
    await assertClarifySchema()
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Clarify schema missing" }), { status: 500 })
  }

  const upserts = answers.map((a) => ({ session_id: sessionId, question_id: a.questionId, value: a.value }))
  const { error: upErr } = await supabase.from("clarification_answers").upsert(upserts)
  if (upErr) return new Response(JSON.stringify({ error: upErr.message }), { status: 500 })

  await supabase.from("clarification_events").insert({ session_id: sessionId, type: "answered", payload: { count: answers.length } })

  const { data: qs } = await supabase.from("clarification_questions").select("id, required").eq("session_id", sessionId)
  const { data: as } = await supabase.from("clarification_answers").select("question_id").eq("session_id", sessionId)
  const requiredCount = (qs ?? []).filter((q) => q.required).length
  const answeredRequired = (qs ?? []).filter((q) => q.required && (as ?? []).some((a) => a.question_id === q.id)).length
  const completeness = requiredCount ? answeredRequired / requiredCount : 1
  const nextStatus = completeness >= 1 ? "ready" : "collecting"

  await supabase.from("clarification_sessions").update({ completeness }).eq("id", sessionId)

  return Response.json({ sessionId, nextStatus, completeness })
}


