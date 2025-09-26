import assert from "node:assert"

async function caseRun(base: string, text: string, answerText = "In vitro cell-based assay") {
  const qRes = await fetch(`${base}/api/query`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) })
  assert(qRes.ok, `query API failed: ${qRes.status}`)
  const qJson: any = await qRes.json()
  assert(qJson.query_id, "missing query_id")
  assert(Array.isArray(qJson.questions), "questions not array")

  // Post one answer if any question exists
  if (qJson.questions[0]) {
    const aRes = await fetch(`${base}/api/answers`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question_id: qJson.questions[0].id, answer: answerText }) })
    assert(aRes.ok, `answers API failed: ${aRes.status}`)
  }

  // Confirm session linkage
  const gRes = await fetch(`${base}/api/questions?query_id=${qJson.query_id}`)
  assert(gRes.ok, `questions API failed: ${gRes.status}`)
  const gJson: any = await gRes.json()
  assert(gJson.session_id, "missing session_id in questions response")

  // Check llm_events existence
  const eRes = await fetch(`${base}/api/debug/llm-events?query_id=${qJson.query_id}`)
  assert(eRes.ok, `llm events API failed: ${eRes.status}`)
  const eJson: any = await eRes.json()
  assert(eJson.count >= 1, "expected at least one llm_event")

  return { query_id: qJson.query_id, session_id: gJson.session_id, num_questions: qJson.questions.length, llm_event_count: eJson.count }
}

async function main() {
  const base = process.env.BASE_URL || "http://localhost:3000"

  // Case A: specific query, expect 0..N (often 0)
  const specific = "Export GLP-1 receptor agonist sales by region (US, EU5, JP, CN) for 2024; include price x volume reconciliation."
  const resA = await caseRun(base, specific, "N/A")

  // Case B: vague query, expect ≥1
  const vague = "Help me with a biotech analysis"
  const resB = await caseRun(base, vague, "Developers")

  console.log("PASS smoke:llm-flow", { A: resA, B: resB })
}

main().catch((e) => {
  console.error("FAIL smoke:llm-flow", e)
  process.exit(1)
})


