import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, vi, expect } from "vitest"
import { ClarifyCard, type ClarifyQuestion } from "@/components/clarify-card"

function questions(): ClarifyQuestion[] {
  return [
    { id: "q1", key: "audience", label: "Primary audience?", type: "single_select", options: [{ value: "devs", label: "Developers" }, { value: "marketers", label: "Marketers" }], required: true },
    { id: "q2", key: "cta", label: "Primary CTA?", type: "single_select", options: [{ value: "signup", label: "Sign up" }, { value: "demo", label: "Book a demo" }], required: true, reason: "Guides design" },
    { id: "q3", key: "brand", label: "Brand/voice", type: "textarea", required: false },
  ]
}

describe("ClarifyCard", () => {
  it("renders questions and toggles reason, accepts textarea input", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    const onFinalize = vi.fn().mockResolvedValue(undefined)
    render(<ClarifyCard sessionId="s1" questions={questions()} onSubmit={onSubmit} onFinalize={onFinalize} canFinalize={false} />)

    expect(screen.getByText(/Primary audience/i)).toBeInTheDocument()

    // Toggle reason
    fireEvent.click(screen.getByRole("button", { name: /Why this\?/i }))
    // Enter textarea content triggers debounced submit
    fireEvent.change(screen.getByLabelText(/Brand\/voice/i), { target: { value: "Friendly" } })
    await new Promise((r) => setTimeout(r, 500))
    expect(onSubmit).toHaveBeenCalledWith([{ questionId: "q3", value: "Friendly" }])
  })
})


