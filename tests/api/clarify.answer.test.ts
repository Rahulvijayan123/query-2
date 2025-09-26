import { describe, it, expect, vi } from 'vitest'
import { POST as startPOST } from '@/app/api/clarify/start/route'
import { POST as answerPOST } from '@/app/api/clarify/answer/route'
import { __fakeSupabase } from './__mocks__/supabase-admin.mock'

vi.mock('@/lib/supabase/admin', async () => await import('./__mocks__/supabase-admin.mock'))
vi.mock('@/lib/llm/clarifier', async () => await import('./__mocks__/llm.mock'))

const jreq = (body: unknown) => new Request('http://local', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe('/api/clarify/answer', () => {
  it('upserts answers and increases completeness', async () => {
    const startRes = await startPOST(jreq({ originalQuery: 'Build me a landing page for Convexia' }))
    const startJson: any = await startRes.json()

    expect(startJson.questions?.length ?? 0).toBeGreaterThan(0)
    const sessionId = startJson.sessionId
    const qRow = __fakeSupabase.store.clarification_questions.find(q => q.session_id === sessionId && q.required !== false)
    expect(qRow).toBeTruthy()

    const ansRes = await answerPOST(jreq({ sessionId, answers: [{ questionId: qRow!.id, value: 'devs' }] }))
    const ansJson: any = await ansRes.json()
    expect(['collecting', 'ready']).toContain(ansJson.nextStatus)

    const saved = __fakeSupabase.store.clarification_answers.find(a => a.session_id === sessionId && a.question_id === qRow!.id)
    expect(saved?.value).toBe('devs')
  })
})



