import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

const Params = z.object({ query_id: z.string().uuid() })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query_id = url.searchParams.get("query_id")
  const { query_id: qid } = Params.parse({ query_id })
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from("llm_events")
    .select("id, provider, model, request, response, created_at")
    .eq("query_id", qid)
    .order("created_at", { ascending: false })

  if (!error) {
    return Response.json({ count: (data || []).length, latest: (data || [])[0] || null })
  }

  // Fallback: if llm_events table is missing, approximate via clarification_events joined by sessions with this query_id
  const isMissing = /llm_events.*does not exist/i.test(error.message) || /relation .*llm_events/i.test(error.message)
  if (!isMissing) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const { data: sessions } = await supabase
    .from("clarification_sessions")
    .select("id, metadata")
    .order("created_at", { ascending: false })
    .limit(20)
  const sessionIds = (sessions || [])
    .filter((s: any) => (s.metadata?.query_id ?? null) === qid)
    .map((s: any) => s.id)
  if (sessionIds.length === 0) return Response.json({ count: 0, latest: null, fallback: "clarification_events" })

  const { data: events } = await supabase
    .from("clarification_events")
    .select("id, type, payload, created_at, session_id")
    .in("session_id", sessionIds)
    .order("created_at", { ascending: false })
  return Response.json({ count: (events || []).length, latest: (events || [])[0] || null, fallback: "clarification_events" })
}


