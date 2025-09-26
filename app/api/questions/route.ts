import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

const Params = z.object({ query_id: z.string().uuid() })

export async function GET(req: Request) {
  const url = new URL(req.url)
  const query_id = url.searchParams.get("query_id")
  const { query_id: qid } = Params.parse({ query_id })
  const supabase = createAdminClient()

  // Find latest session for this query
  const { data: sessions, error: sErr } = await supabase
    .from("clarification_sessions")
    .select("id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(5)
  if (sErr) return new Response(JSON.stringify({ error: sErr.message }), { status: 500 })

  const session = (sessions || []).find((s: any) => (s.metadata?.query_id ?? null) === qid)
  if (!session) return Response.json({ questions: [] })

  const { data: qs, error: qErr } = await supabase
    .from("clarification_questions")
    .select("id, order_index, key, label, type, options, required, placeholder, help, reason")
    .eq("session_id", session.id)
    .order("order_index")
  if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500 })

  return Response.json({ session_id: session.id, questions: qs ?? [] })
}


