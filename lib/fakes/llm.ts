function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function* fakeResearchStream(sessionId: string, query: string) {
  const d = 350
  yield { type: 'progress', payload: { stage: 'plan', message: 'Planning verification and retrieval', at: new Date().toISOString() } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'search', message: 'Querying primary sources', at: new Date().toISOString() } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'extract', message: 'Extracting key facts', at: new Date().toISOString() } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'synthesize', message: 'Synthesizing interim hypotheses', at: new Date().toISOString() } }
  await delay(d)
  const questions = Array.from({ length: 6 }).map((_, i) => ({ id: `q${i + 1}`, text: `Q${i + 1} about ${query}?`, why: 'Narrows scope' }))
  const proposedQueries = ['Option A — narrow by stage', 'Option B — narrow by geography']
  yield { type: 'clarifying_questions', payload: { questions, proposedQueries } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'question', message: 'Questions presented', at: new Date().toISOString() } }
  await delay(d)
  yield { type: 'thesis_draft', payload: { version: 'v1', executive: ['Working thesis line 1', 'Working thesis line 2'], archetype: 'Archetype', stageTempo: 'Tempo', filters: ['F1'], capability: 'Cap', evidence: [], risks: ['R1'], scenarios: ['S1'], nextActions: ['N1'] } }
  await delay(d)
  yield { type: 'sources', payload: { items: [
    { id: '1', title: 'Source One', publisher: 'Publisher', url: 'https://example.com/s1', date: '2024-01-15', point: 'Key point' },
    { id: '2', title: 'Source Two', publisher: 'Publisher', url: 'https://example.com/s2', date: '2024-01-15', point: 'Key point' },
  ] } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'validate', message: 'Validating outputs', at: new Date().toISOString() } }
  await delay(d)
  yield { type: 'progress', payload: { stage: 'ready', message: 'Ready for feedback', at: new Date().toISOString() } }
}


