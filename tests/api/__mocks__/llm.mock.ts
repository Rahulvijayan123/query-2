export async function askClarifier({ originalQuery }: { originalQuery: string }) {
  if (/orders last 30 days/i.test(originalQuery)) {
    return { completeness: 0.95, questions: [] }
  }
  return {
    completeness: 0.4,
    questions: [
      { key: 'audience', label: 'Primary audience?', type: 'single_select', options: [{ value: 'devs', label: 'Developers' }, { value: 'marketers', label: 'Marketers' }], required: true, reason: 'Tailors tone' },
      { key: 'cta', label: 'Primary CTA?', type: 'single_select', options: [{ value: 'signup', label: 'Sign up' }, { value: 'demo', label: 'Book a demo' }], required: true },
      { key: 'brand', label: 'Brand/voice constraints', type: 'textarea', required: false }
    ]
  }
}

export async function buildEnriched({ originalQuery, answersJson }: { originalQuery: string; answersJson: any }) {
  // Return filters JSON (mock) deterministically
  return JSON.stringify({
    unit: 'assets',
    filters: {
      target: answersJson?.target ? [answersJson.target] : null,
      indication: answersJson?.indication ? [answersJson.indication] : null,
      modality: answersJson?.modality ? [answersJson.modality] : null,
      geography: answersJson?.geography ? [answersJson.geography] : null,
      stage: answersJson?.stage ? [answersJson.stage] : null,
      sponsor_class: null,
      trial_attributes: null,
      time_window: { type: 'last_n_years', years: 5, from: null, to: null },
      exclusions: null,
    },
    assumptions: ["mock"],
  })
}



