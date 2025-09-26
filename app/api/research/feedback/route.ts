import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { useMemoryStore } from "@/lib/runtime"
import { saveEvent } from "@/lib/persist"

const Body = z.object({
  sessionId: z.string().uuid(),
  thesisVersion: z.number().int().positive(),
  decision: z.enum(["accept", "reject"]),
  reason: z.string().optional(),
  changeRequests: z.string().optional(),
})

export async function POST(req: Request) {
  const { sessionId, thesisVersion, decision, reason, changeRequests } = Body.parse(await req.json())
  const supabase = createAdminClient()

  if (decision === "accept") {
    if (useMemoryStore()) {
      await saveEvent(sessionId, 'final_thesis', { version: thesisVersion, acceptedAt: new Date().toISOString() })
      return Response.json({ ok: true })
    }
    await (await supabase).from("thesis_version").update({ status: "accepted" }).eq("session_id", sessionId).eq("version", thesisVersion)
    await saveEvent(sessionId, 'final_thesis', { version: thesisVersion, acceptedAt: new Date().toISOString() })
    return Response.json({ ok: true })
  }

  if (!reason || !changeRequests || changeRequests.trim().length < 20) {
    return new Response(JSON.stringify({ error: "reject requires reason and changeRequests (>=20 chars)" }), { status: 400 })
  }

  if (!useMemoryStore()) await (await supabase).from("feedback").insert({ session_id: sessionId, thesis_version: thesisVersion, decision, reason, change_requests: changeRequests })
  return Response.json({ ok: true })
}


