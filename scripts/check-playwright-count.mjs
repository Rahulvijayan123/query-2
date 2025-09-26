import fs from 'fs'
const r = JSON.parse(fs.readFileSync('pw-report.json','utf8'))
const tcs = r.suites?.flatMap(s=>s.suites??[]).flatMap(s=>s.specs??[]) ?? []
const total = tcs.length
const passed = tcs.filter(s=>s.ok).length
if (total < 4) {
  console.error(`Expected >=4 Playwright tests, got ${total}.`)
  process.exit(1)
}
if (passed < total) {
  console.error(`Some Playwright tests failed: ${passed}/${total} passed.`)
  process.exit(1)
}
console.log(`Playwright OK: ${passed}/${total}`)

