import fs from 'fs'
const r = JSON.parse(fs.readFileSync('vitest-report.json','utf8'))
const total = r?.numTotalTests ?? 0
const passed = r?.numPassedTests ?? 0
if (total < 6) {
  console.error(`Expected >=6 vitest tests, got ${total}.`)
  process.exit(1)
}
if (passed < total) {
  console.error(`Some vitest tests failed: ${passed}/${total} passed.`)
  process.exit(1)
}
console.log(`Vitest OK: ${passed}/${total}`)

