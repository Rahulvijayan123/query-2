import { describe, it, expect } from 'vitest'

const BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

async function postJSON(path: string, body: any) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  return { status: res.status, json }
}

describe('stream API', () => {
  it('POST returns { sessionId, sseUrl }', async () => {
    const { status, json } = await postJSON('/api/research/stream', { sessionId: null, userQuery: 'API smoke', mode: 'auto', resume: false })
    expect(status).toBe(200)
    expect(json.sessionId).toBeTruthy()
    expect(json.sseUrl).toMatch(/^\/api\/research\/stream\?sessionId=/)
  })

  it('GET sseUrl yields clarifying_questions and thesis_draft (within window)', async () => {
    const { json } = await postJSON('/api/research/stream', { sessionId: null, userQuery: 'API smoke 2', mode: 'auto', resume: false })
    const url = `${BASE}${json.sseUrl}`
    const res: any = await fetch(url)
    const reader = res.body.getReader()
    let buf = ''
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const chunk = await reader.read()
      if (chunk.done) break
      buf += new TextDecoder().decode(chunk.value)
      if (buf.includes('"type":"clarifying_questions"') && buf.includes('"type":"thesis_draft"')) break
    }
    expect(buf).toContain('"type":"clarifying_questions"')
    expect(buf).toContain('"type":"thesis_draft"')
  })
})


