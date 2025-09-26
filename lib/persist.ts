import { useMemoryStore } from '@/lib/runtime'
import { createAdminClient } from '@/lib/supabase/admin'

export type PersistEvent = { seq: number; type: string; payload: any; at: string; version?: number }

const mem = {
  sessions: new Map<string, { user_id: string; user_query: string; status: string }>(),
  events: new Map<string, PersistEvent[]>(),
  versions: new Map<string, any[]>(),
  seqBySessionVersion: new Map<string, number>(), // key `${sessionId}:v${version}`
  emittedFlags: new Map<string, Set<string>>(), // key `${sessionId}:v${version}:clarifying`
  emittedQIDs: new Set<string>(), // keys like `${sessionId}:v${version}:${questionId}`
}

export async function nextSeq(sessionId: string, version: number = 1) {
  const key = `${sessionId}:v${version}`
  const cur = mem.seqBySessionVersion.get(key) ?? 0
  const nxt = cur + 1
  mem.seqBySessionVersion.set(key, nxt)
  return nxt
}

export async function createSession(userId: string, query: string): Promise<string> {
  if (useMemoryStore()) {
    const id = crypto.randomUUID()
    mem.sessions.set(id, { user_id: userId, user_query: query, status: 'active' })
    mem.events.set(id, [])
    mem.versions.set(id, [])
    return id
  }
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.from('research_session').insert({ user_id: userId, user_query: query, status: 'active' }).select('id').single()
    if (error || !data) throw new Error(error?.message || 'session create failed')
    return data.id
  } catch {
    // Fallback to in-memory session if DB is unavailable or schema missing
    const id = crypto.randomUUID()
    mem.sessions.set(id, { user_id: userId, user_query: query, status: 'active' })
    mem.events.set(id, [])
    mem.versions.set(id, [])
    return id
  }
}

export async function saveEvent(sessionId: string, type: string, payload: any, version: number = 1): Promise<PersistEvent> {
  const ev: PersistEvent = { seq: await nextSeq(sessionId, version), type, payload, at: new Date().toISOString(), version }
  if (useMemoryStore()) {
    const list = mem.events.get(sessionId) || []
    list.push(ev)
    mem.events.set(sessionId, list)
    return ev
  }
  const supabase = createAdminClient()
  await supabase.from('event_log').insert({ session_id: sessionId, type, payload })
  return ev
}

export async function saveThesisVersion(sessionId: string, version: number, content: any, status: string): Promise<void> {
  if (useMemoryStore()) {
    const list = mem.versions.get(sessionId) || []
    list.push({ version, content, status })
    mem.versions.set(sessionId, list)
    return
  }
  const supabase = createAdminClient()
  await supabase.from('thesis_version').insert({ session_id: sessionId, version, content, status })
}

export async function getSessionQuery(sessionId: string): Promise<string | null> {
  if (useMemoryStore()) {
    const s = mem.sessions.get(sessionId)
    return s?.user_query || null
  }
  try {
    const supabase = createAdminClient()
    const { data } = await supabase.from('research_session').select('user_query').eq('id', sessionId).single()
    if (data?.user_query) return data.user_query
    // Fallback to memory if DB row not found
    const s = mem.sessions.get(sessionId)
    return s?.user_query || null
  } catch {
    const s = mem.sessions.get(sessionId)
    return s?.user_query || null
  }
}

export async function hasEmittedClarifying(sessionId: string, version: number) {
  const key = `${sessionId}:v${version}:clarifying`
  return mem.emittedFlags.has(key)
}
export async function markEmittedClarifying(sessionId: string, version: number) {
  const key = `${sessionId}:v${version}:clarifying`
  mem.emittedFlags.set(key, new Set(['clarifying']))
}

export function hasEmittedQuestion(sessionId: string, version: number, questionId: string): boolean {
  return mem.emittedQIDs.has(`${sessionId}:v${version}:${questionId}`)
}
export function markEmittedQuestion(sessionId: string, version: number, questionId: string): void {
  mem.emittedQIDs.add(`${sessionId}:v${version}:${questionId}`)
}


