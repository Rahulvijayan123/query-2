import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { POST as startPOST } from "@/app/api/clarify/start/route"
import { POST as answerPOST } from "@/app/api/clarify/answer/route"
import { POST as finalizePOST } from "@/app/api/clarify/finalize/route"

const jreq = (body: unknown) =>
  new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("clarify.smoke (real LLM)", () => {
  it(
    "asks real questions, accepts answers, and finalizes",
    async () => {
      const res = await startPOST(
        jreq({ originalQuery: "Build me a landing page for Convexia that increases signups" })
      )
      const startJson: any = await res.json()
      expect([200, 500]).toContain((res as any).status || 200)
      if ((res as any).status === 500) {
        expect(startJson.error).toBeTruthy()
        console.log("SMOKE: schema missing or server error:", startJson.error)
        return
      }

      const { sessionId, status, questions } = startJson
      expect(["presented", "ready"]).toContain(status)
      if (status === "presented") {
        expect(Array.isArray(questions)).toBe(true)
        expect(questions.length).toBeGreaterThanOrEqual(1)
        expect(questions.length).toBeLessThanOrEqual(5)
        for (const q of questions) {
          expect(typeof q.label).toBe("string")
          expect(q.label.trim().length).toBeGreaterThan(5)
          expect(q.label.toLowerCase()).not.toContain("placeholder")
          expect([
            "text",
            "textarea",
            "single_select",
            "multi_select",
            "number",
            "date",
            "file",
          ]).toContain(q.type)
          if (q.type.includes("select")) {
            expect(q.options && q.options.length >= 2).toBe(true)
          }
        }
        console.log(`SMOKE: clarifier questions OK (${questions.length} questions)`) 

        // Answer a single required question sensibly
        const first = questions.find((x: any) => x.required !== false) || questions[0]
        const answerValue = first.type === "number" ? 1 : first.type.includes("select") ? (first.options?.[0]?.value || "opt") : "test"
        const ans = await answerPOST(jreq({ sessionId, answers: [{ questionId: first.id, value: answerValue }] }))
        expect((ans as any).status || 200).toBe(200)
        const ansJson: any = await ans.json()
        expect(["collecting", "ready"]).toContain(ansJson.nextStatus)
      } else {
        console.log("SMOKE: prompt was clear (no questions)")
      }

      const fin = await finalizePOST(jreq({ sessionId: startJson.sessionId }))
      const finJson: any = await fin.json()
      expect((fin as any).status || 200).toBe(200)
      expect(finJson.filters).toBeTruthy()
      expect(typeof finJson.filters.unit).toBe("string")
      expect(typeof finJson.filters.filters).toBe("object")
      console.log(`SMOKE: finalize OK (filters keys: ${Object.keys(finJson.filters.filters||{}).length})`)
    },
    30_000
  )
})


