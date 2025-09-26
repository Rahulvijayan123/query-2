"use client"

import { useEffect, useState } from "react"
import { ClarifyCard, ClarifyQuestion } from "@/components/clarify-card"
import { ThesisDisplay } from "@/components/thesis-display"

type StartResponse = {
  sessionId: string
  completeness: number
  questions: any[]
  status: "presented" | "ready"
}

export function ClarifyFlow({ originalQuery, queryId, email, facets }: { originalQuery?: string; queryId?: string; email?: string; facets?: Record<string, any> }) {
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "presented"; sessionId: string; questions: ClarifyQuestion[]; completeness: number }
    | { phase: "finalizing"; sessionId: string }
    | { phase: "complete"; sessionId: string; enrichedPrompt: string }
  >({ phase: "loading" })
  const [placeholderVisible, setPlaceholderVisible] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [lastQuery, setLastQuery] = useState<string | undefined>()

  useEffect(() => {
    // Reset initialization flag when query changes
    if (originalQuery !== lastQuery) {
      console.log("🔄 New query detected - resetting initialization", { 
        newQuery: originalQuery, 
        lastQuery 
      })
      setHasInitialized(false)
      setLastQuery(originalQuery)
    }
  }, [originalQuery, lastQuery])

  useEffect(() => {
    // Prevent multiple initializations - only run once per unique query
    if (hasInitialized) {
      console.log("🛑 Skipping question generation - already initialized")
      return
    }
    
    // Prevent running if no query provided
    if (!originalQuery && !queryId) {
      console.log("🛑 No query provided - skipping initialization")
      return
    }
    
    const start = async () => {
      console.log("🚀 Starting question generation", { originalQuery, queryId })
      
      const payload: any = queryId ? { query_id: queryId } : { text: originalQuery, facets, email }
      if (!payload.text && !payload.query_id) return
      
      try {
        setState(prev => ({ ...prev, phase: "loading" }))
        
        const res = await fetch("/api/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        const data: any = await res.json()
        if (!res.ok) {
          console.error("/api/query error", data)
          setState(prev => ({ ...prev, phase: "error", error: data.error || "Failed to generate questions" }))
          return
        }
        
        // Ensure we get all questions at once and they don't change
        const questionsRaw: ClarifyQuestion[] = (Array.isArray(data.questions) ? data.questions : []).map((q: any, index: number) => ({
          id: q.id || `q_${index}_${Date.now()}`, // Stable IDs
          key: q.key,
          label: q.label,
          type: q.type,
          options: q.options || [],
          required: q.required ?? true,
          placeholder: q.placeholder || undefined,
          help: q.help || undefined,
          reason: q.reason || undefined,
        }))
        
        // Deduplicate by label+key to avoid repeated rendering
        const seen = new Set<string>()
        const questions = questionsRaw.filter((q) => {
          const k = `${q.key || ''}|${q.label || ''}`
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        
        console.log("✅ Questions generated", { count: questions.length, sessionId: data.session_id })
        console.log("📝 Final questions:", questions.map(q => ({ id: q.id, type: q.type, label: q.label.slice(0, 50) + '...' })))
        
        setState({ 
          phase: "presented", 
          sessionId: data.session_id, 
          questions, 
          completeness: data.completeness ?? 0,
          error: undefined
        })
        setPlaceholderVisible(false)
        setHasInitialized(true) // Mark as initialized to prevent re-runs
        
      } catch (error) {
        console.error("❌ Failed to generate questions:", error)
      }
    }
    
    start()
  }, [originalQuery, queryId, facets, hasInitialized])

  async function submitAnswers(payload: { questionId: string; value: unknown }[]) {
    if (state.phase !== "presented") return
    for (const p of payload) {
      await fetch("/api/clarify/answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: state.sessionId, answers: [{ questionId: p.questionId, value: p.value }] }) })
    }
  }

  const [isProcessing, setIsProcessing] = useState(false)
  
  async function finalizeNow() {
    if (state.phase !== "presented" || isProcessing) {
      console.log("Finalize blocked:", { phase: state.phase, isProcessing })
      return
    }
    
    try {
      console.log("Starting finalization process")
      setIsProcessing(true)
      
      // Immediately transition to finalizing state
      setState({ phase: "finalizing", sessionId: state.sessionId })
      
      const res = await fetch("/api/clarify/finalize", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ sessionId: state.sessionId }) 
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error("API request failed:", res.status, errorText)
        throw new Error(`API request failed: ${res.status} - ${errorText}`)
      }
      
      const out = await res.json()
      console.log("Thesis API response:", out)
      
      if (!out.enrichedPrompt && !out.filters) {
        throw new Error("No thesis data received from server")
      }
      
      setState({ 
        phase: "complete", 
        sessionId: state.sessionId, 
        enrichedPrompt: out.enrichedPrompt || JSON.stringify(out.filters, null, 2) 
      })
      
      console.log("Finalization completed successfully")
      
    } catch (error) {
      console.error("Failed to finalize:", error)
      setIsProcessing(false) // Reset processing flag on error
      
      // Reset to presented state to allow user to try again
      setState((prevState) => 
        prevState.phase === "finalizing" 
          ? { ...prevState, phase: "presented" } 
          : prevState
      )
      
      alert("Failed to generate thesis. Please try again.")
    }
  }

  if (state.phase === "loading") {
    return (
      <div className="rounded-lg border p-4 bg-card text-foreground">
        <div className="font-medium">Preparing clarifying questions…</div>
        <div className="text-sm text-muted-foreground">We’ll ask a few targeted questions to tailor the thesis and search criteria. You can skip any question.</div>
      </div>
    )
  }
  if (state.phase === "presented") {
    return (
      <>
        {/* Removed UI placeholder; only render when we have real questions or allow immediate finalize */}
        <ClarifyCard
          sessionId={state.sessionId}
          questions={state.questions}
          canFinalize={state.completeness >= 0.85 || state.questions.length === 0}
          onSubmit={submitAnswers}
          onFinalize={finalizeNow}
          allowSkip={state.questions.length < 5} // Don't allow skipping for broad queries (5+ questions)
        />
      </>
    )
  }
  if (state.phase === "finalizing") {
    return (
      <div className="rounded-lg border p-4 bg-card text-foreground flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" aria-hidden="true" />
        <div>
          <div className="font-medium">Synthesizing filters…</div>
          <div className="text-sm text-muted-foreground">This should only take a few seconds.</div>
        </div>
      </div>
    )
  }
  if (state.phase === "complete") {
    return <ThesisDisplay thesis={state.enrichedPrompt} sessionId={state.sessionId} />
  }
  return null
}


