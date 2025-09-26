import { describe, it, expect } from 'vitest'
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

describe('resume API', () => {
  it('handles unknown sessionId gracefully', async () => {
    const res = await fetch(`${BASE}/api/research/resume`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: '00000000-0000-0000-0000-000000000000' }) })
    expect([200,204,404]).toContain(res.status)
  })

  it('answers endpoint accepts answers', async () => {
    const res = await fetch(`${BASE}/api/research/answers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: '00000000-0000-0000-0000-000000000000', answers: [{ id: 'q1', text: 'example' }] }) })
    expect([200,204]).toContain(res.status)
  })
})


