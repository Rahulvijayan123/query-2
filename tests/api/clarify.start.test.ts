import { describe, it, expect, vi } from "vitest"
import { POST as startPOST } from "@/app/api/clarify/start/route"

vi.mock("@/lib/supabase/admin", async () => await import("./__mocks__/supabase-admin.mock"))
vi.mock("@/lib/llm/clarifier", async () => await import("./__mocks__/llm.mock"))

const jreq = (body: unknown) => new Request('http://local', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

describe("/api/clarify/start", () => {
  it("creates session and questions for ambiguous prompt synchronously", async () => {
    const res = await startPOST(jreq({ originalQuery: 'Build me a landing page for Convexia' }))
    expect(res.ok).toBe(true)
    const json: any = await res.json()
    expect(["presented", "ready"]).toContain(json.status)
    if (json.status === "presented") {
      expect(json.questions.length).toBeGreaterThanOrEqual(1)
      expect(json.questions.length).toBeLessThanOrEqual(5)
      for (const q of json.questions) {
        expect(typeof q.label).toBe("string")
        expect(q.label.toLowerCase()).not.toContain("placeholder")
      }
    }
  })
})


