import { describe, it, expect, vi } from 'vitest'
import { POST as startPOST } from '@/app/api/clarify/start/route'
import { POST as answerPOST } from '@/app/api/clarify/answer/route'
import { POST as finalizePOST } from '@/app/api/clarify/finalize/route'
import { __fakeSupabase } from './__mocks__/supabase-admin.mock'

vi.mock('@/lib/supabase/admin', async () => await import('./__mocks__/supabase-admin.mock'))
vi.mock('@/lib/llm/clarifier', async () => await import('./__mocks__/llm.mock'))
vi.mock('@/lib/llm/enricher', async () => await import('./__mocks__/llm.mock'))

const jreq = (body: unknown) => new Request('http://local', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('/api/clarify/finalize', () => {
  it('builds filters JSON and records finalized event', async () => {
    const startRes = await startPOST(jreq({ originalQuery: 'Build me a landing page for Convexia' }))
    const startJson: any = await startRes.json()
    const sessionId = startJson.sessionId

    const reqQs = __fakeSupabase.store.clarification_questions.filter(q => q.session_id === sessionId && q.required !== false)
    for (const q of reqQs) {
      await answerPOST(jreq({ sessionId, answers: [{ questionId: q.id, value: q.key === 'audience' ? 'devs' : 'signup' }] }))
    }

    const finRes = await finalizePOST(jreq({ sessionId }))
    const finJson: any = await finRes.json()
    expect(finRes.ok).toBe(true)
    expect(finJson.filters).toBeTruthy()
    expect(finJson.filters.unit).toBeDefined()
    expect(finJson.filters.filters).toBeDefined()

    const session = __fakeSupabase.store.clarification_sessions.find(s => s.id === sessionId)
    expect(session?.enriched_prompt).toBeTruthy()
    const finalized = __fakeSupabase.store.clarification_events.find(e => e.session_id === sessionId && e.type === 'finalized')
    expect(finalized).toBeTruthy()
  })
})



