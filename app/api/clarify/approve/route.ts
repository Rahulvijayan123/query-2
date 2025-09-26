import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { assertClarifySchema } from "@/lib/supabase/guard"

const Body = z.object({
  sessionId: z.string().uuid(),
  filters: z.any(),
})

export async function POST(req: Request) {
  const { sessionId, filters } = Body.parse(await req.json())
  const supabase = createAdminClient()
  try {
    await assertClarifySchema()
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || "Clarify schema missing" }), { status: 500 })
  }

  await supabase.from("clarification_events").insert({ session_id: sessionId, type: "approved_filters", payload: { filters } })
  await supabase.from("clarification_sessions").update({ status: "approved" }).eq("id", sessionId)
  return Response.json({ ok: true })
}


