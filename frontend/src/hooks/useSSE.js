/**
 * useSSE.js — Connects to /api/status/stream and exposes real-time resource stats.
 * Uses Server-Sent Events — no polling.
 */
import { useState, useEffect, useRef } from 'react'

const DEFAULT_STATE = {
  cpu_percent: 0,
  cpu_user: 0,
  cpu_sys: 0,
  cpu_idle: 100,
  memory_used_gb: 0,
  memory_total_gb: 0,
  memory_active_gb: 0,
  memory_wired_gb: 0,
  memory_compressed_gb: 0,
  memory_inactive_gb: 0,
  memory_free_gb: 0,
  swap_used_gb: 0,
  top_procs_by_rss: [],
  top_procs_by_cpu: [],
  inference_servers: [],
}

export function useSSE(targetId, paused = false) {
  const [stats, setStats] = useState(DEFAULT_STATE)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState(null)
  const esRef = useRef(null)

  useEffect(() => {
    if (!targetId || paused) {
      // Close any existing connection when paused or no target
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      setConnected(false)
      return
    }

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
  }, [targetId, paused])

  return { ...stats, connected, error }
}
