import { NextResponse } from 'next/server'
import { saveEvent } from '@/lib/persist'

export async function POST(req: Request) {
  const { sessionId, answers } = await req.json() as { sessionId?: string, answers?: { id: string, text: string }[] }
  if (!sessionId || !Array.isArray(answers) || answers.length === 0) {
    return NextResponse.json({ error: 'sessionId and answers required' }, { status: 400 })
  }
  await saveEvent(sessionId, 'answers_submitted', { answers })
  return NextResponse.json({ ok: true })
}


