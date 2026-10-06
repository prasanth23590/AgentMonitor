import { useEffect, useRef, useState } from 'react'
import type { AgentSession } from './types'

export function useSSE(url: string): { sessions: AgentSession[]; connected: boolean } {
  const [sessions, setSessions] = useState<AgentSession[]>([])
  const [connected, setConnected] = useState(true)
  const esRef = useRef<EventSource | null>(null)
  const errorCountRef = useRef(0)

  useEffect(() => {
    const es = new EventSource(url)
    esRef.current = es

    es.onmessage = (e) => {
      errorCountRef.current = 0
      setConnected(true)
      try {
        setSessions(JSON.parse(e.data))
      } catch {
        // malformed frame — skip
      }
    }

    es.onerror = () => {
      errorCountRef.current += 1
      if (errorCountRef.current >= 3) setConnected(false)
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [url])

  return { sessions, connected }
}
