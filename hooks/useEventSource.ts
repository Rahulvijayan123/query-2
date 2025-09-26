"use client"
import { useEffect, useRef, useState } from 'react'

export function useEventSource(url: string | null) {
  const [events, setEvents] = useState<any[]>([])
  const esRef = useRef<EventSource | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!url) return
    const es = new EventSource(url)
    esRef.current = es
    const onMessage = (e: MessageEvent) => {
      try {
        const id = (e as any).lastEventId || ''
        if (id && seenIdsRef.current.has(id)) return
        if (id) seenIdsRef.current.add(id)
        const parsed = JSON.parse(e.data)
        setEvents((prev) => [...prev, parsed])
      } catch {}
    }
    es.addEventListener('message', onMessage)
    es.addEventListener('error', () => {})
    return () => { es.close(); seenIdsRef.current.clear() }
  }, [url])

  return { events }
}


