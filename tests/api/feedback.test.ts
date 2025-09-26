import { describe, it, expect } from 'vitest'
const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

async function postJSON(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let json: any = {}
  try { json = await res.json() } catch {}
  return { status: res.status, json }
}

describe('feedback API', () => {
  it('reject requires reason + ≥20 chars', async () => {
    const { status } = await postJSON('/api/research/feedback', { sessionId: '00000000-0000-0000-0000-000000000000', thesisVersion: 1, decision: 'reject', reason: '', changeRequests: 'short' })
    expect([400, 422]).toContain(status)
  })

  it('accept returns OK', async () => {
    const { status } = await postJSON('/api/research/feedback', { sessionId: '00000000-0000-0000-0000-000000000000', thesisVersion: 1, decision: 'accept' })
    expect([200, 204]).toContain(status)
  })
})


