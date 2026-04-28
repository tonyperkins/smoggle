/**
 * useSSE.js — Connects to /api/status/stream and exposes real-time resource stats.
 * Uses Server-Sent Events — no polling.
 */
import { useState, useEffect, useRef } from 'react'

const DEFAULT_STATE = {
  cpu_percent: 0,
  memory_used_gb: 0,
  memory_total_gb: 0,
  swap_used_gb: 0,
  inference_servers: [],
}

export function useSSE(targetId) {
  const [stats, setStats] = useState(DEFAULT_STATE)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  useEffect(() => {
    if (!targetId) return

    const url = `/api/status/stream?target=${targetId}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setStats(data)
      } catch {
        // malformed event — ignore
      }
    }

    es.onerror = () => {
      setConnected(false)
      setError('SSE connection lost')
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [targetId])

  return { ...stats, connected, error }
}
