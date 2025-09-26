"use client"
import { useState } from 'react'
import { ClarifyFlow } from '@/components/clarify-flow'

export default function Research() {
  const [sessionId, setSessionId] = useState<string|null>(null)
  const [query, setQuery] = useState('')
  const [started, setStarted] = useState(false)

  const start = async () => {
    if (!query) return
    setStarted(true)
  }


  return (
    <div className="p-6 space-y-4 text-foreground">
      <div className="flex gap-2">
        <input 
          className="border p-2 flex-1 bg-background text-foreground placeholder:text-muted-foreground" 
          value={query} 
          onChange={(e)=>setQuery(e.target.value)} 
          placeholder="Type your research query…" 
        />
        <button 
          className="border px-3 py-2 bg-primary text-primary-foreground" 
          onClick={start} 
          disabled={!query || started}
        >
          {started ? 'Processing...' : 'Start'}
        </button>
      </div>

      {started && (
        <div className="mt-6">
          <ClarifyFlow
            originalQuery={query}
            email="research@example.com"
            facets={{}}
          />
        </div>
      )}
    </div>
  )
}


