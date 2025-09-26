"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

type Option = { value: string; label: string }

export type ClarifyQuestion = {
  id: string
  key: string
  label: string
  type: "text" | "textarea" | "single_select" | "multi_select" | "number" | "date" | "file"
  options?: Option[]
  required: boolean
  placeholder?: string
  help?: string
  reason?: string
}

export type ClarifyCardProps = {
  sessionId: string
  questions: ClarifyQuestion[]
  canFinalize: boolean
  onSubmit: (answers: { questionId: string; value: unknown }[]) => Promise<void>
  onFinalize: () => Promise<void>
  allowSkip?: boolean
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delay: number) {
  const timeout = useRef<NodeJS.Timeout | null>(null)
  return (...args: Parameters<T>) => {
    if (timeout.current) clearTimeout(timeout.current)
    timeout.current = setTimeout(() => fn(...args), delay)
  }
}

export function ClarifyCard({ sessionId, questions, onSubmit, onFinalize, canFinalize, allowSkip }: ClarifyCardProps) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set())

  const requiredUnanswered = useMemo(() => {
    return questions.filter((q) => q.required && (values[q.id] === undefined || values[q.id] === null || values[q.id] === ""))
  }, [questions, values])

  const debouncedSubmit = useDebouncedCallback(async (payload: { questionId: string; value: unknown }[]) => {
    setSaving(true)
    try {
      await onSubmit(payload)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
    } catch (error) {
      console.error('Failed to submit answer:', error)
      // Don't reset the value on error - keep user's selection
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }, 200) // Reduced debounce time for faster response

  const handleChange = (q: ClarifyQuestion, value: any) => {
    setValues((prev) => ({ ...prev, [q.id]: value }))
    debouncedSubmit([{ questionId: q.id, value }])
  }

  const handleFinalize = async () => {
    if (finalizing) return // Prevent multiple clicks
    
    try {
      setFinalizing(true)
      await onFinalize()
    } catch (error) {
      console.error('Failed to finalize:', error)
      setFinalizing(false) // Reset on error only
    }
    // Don't reset finalizing on success - parent component handles state transition
  }

  const handleSkipAll = async () => {
    if (!allowSkip) return
    await onFinalize()
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpandedReasons(new Set())
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  return (
    <Card className="bg-card/95 backdrop-blur-sm border-border/50 rounded-2xl">
      <CardContent className="space-y-4 p-4">
        {questions.map((q, idx) => (
          <div key={q.id} className="space-y-2" aria-live="polite">
            <div className="flex items-center justify-between">
              <Label htmlFor={`q_${q.id}`} className="text-sm font-medium">
                {q.label}
              </Label>
              {q.reason && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  aria-expanded={expandedReasons.has(q.id)}
                  onClick={() => {
                    const newExpanded = new Set(expandedReasons)
                    if (newExpanded.has(q.id)) {
                      newExpanded.delete(q.id)
                    } else {
                      newExpanded.add(q.id)
                    }
                    setExpandedReasons(newExpanded)
                  }}
                >
                  Why this?
                </button>
              )}
            </div>
            {expandedReasons.has(q.id) && q.reason && (
              <div className="text-xs text-muted-foreground" role="note">{q.reason}</div>
            )}

            {q.type === "text" && (
              <Input id={`q_${q.id}`} value={values[q.id] || ""} placeholder={q.placeholder} onChange={(e) => handleChange(q, e.target.value)} aria-required={q.required} />
            )}
            {q.type === "textarea" && (
              <Textarea id={`q_${q.id}`} value={values[q.id] || ""} placeholder={q.placeholder} onChange={(e) => handleChange(q, e.target.value)} aria-required={q.required} />
            )}
            {q.type === "number" && (
              <Input id={`q_${q.id}`} value={values[q.id] || ""} type="number" placeholder={q.placeholder} onChange={(e) => handleChange(q, Number(e.target.value))} aria-required={q.required} />
            )}
            {q.type === "date" && (
              <Input id={`q_${q.id}`} value={values[q.id] || ""} type="date" onChange={(e) => handleChange(q, e.target.value)} aria-required={q.required} />
            )}
            {q.type === "single_select" && (
              <Select value={values[q.id] || ""} onValueChange={(v) => handleChange(q, v)}>
                <SelectTrigger id={`q_${q.id}`}>
                  <SelectValue placeholder={q.placeholder || "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {(q.options || []).map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {q.type === "multi_select" && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={q.label}>
                {(q.options || []).map((o) => {
                  const selected: string[] = values[q.id] || []
                  const active = selected.includes(o.value)
                  return (
                    <Button
                      key={o.value}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      aria-pressed={active}
                      onClick={() => {
                        const next = active ? selected.filter((v) => v !== o.value) : [...selected, o.value]
                        handleChange(q, next)
                      }}
                    >
                      {o.label}
                    </Button>
                  )
                })}
              </div>
            )}

            {q.help && <div className="text-xs text-muted-foreground">{q.help}</div>}
            {idx < questions.length - 1 && <Separator />}
          </div>
        ))}
        <div className="flex items-center gap-2">
          <Button type="button" onClick={handleFinalize} disabled={(requiredUnanswered.length > 0 && !canFinalize) || finalizing} aria-disabled={(requiredUnanswered.length > 0 && !canFinalize) || finalizing}>
            {finalizing ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent mr-2" />
                Generating Thesis...
              </>
            ) : saving ? "Saving..." : "Finish"}
          </Button>
          {allowSkip && (
            <Button type="button" variant="outline" onClick={handleSkipAll}>Skip all for now</Button>
          )}
          {requiredUnanswered.length > 0 && !canFinalize && (
            <span className="text-xs text-muted-foreground">Fill required fields or wait until completeness allows finishing.</span>
          )}
        </div>
      </CardContent>
      {saving && (
        <div className="px-4 pb-3 text-xs text-muted-foreground" aria-live="polite">Saving…</div>
      )}
      {saved && !saving && (
        <div className="px-4 pb-3 text-xs text-emerald-600" aria-live="polite">Saved ✓</div>
      )}
    </Card>
  )
}


