import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { useMemoryStore } from "@/lib/runtime"

const Body = z.object({ sessionId: z.string().uuid() })

export async function POST(req: Request) {
  const { sessionId } = Body.parse(await req.json())
  if (useMemoryStore()) return Response.json({ ok: true, lastEvent: null })
  const supabase = createAdminClient()
  const { data: lastEvent } = await (await supabase)
    .from("event_log")
    .select("type, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()
  return Response.json({ ok: true, lastEvent: lastEvent || null })
}


