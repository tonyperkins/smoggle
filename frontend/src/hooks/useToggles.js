/**
 * useToggles.js — Fetches toggle list with live state, manages optimistic updates.
 */
import { useState, useEffect, useCallback } from 'react'

export function useToggles(targetId) {
  const [toggles, setToggles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchToggles = useCallback(() => {
    if (!targetId) return
    setLoading(true)
    fetch(`/api/toggles?target=${targetId}`)
      .then(r => r.json())
      .then(data => {
        setToggles(data)
        setError(null)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [targetId])

  useEffect(() => {
    fetchToggles()
  }, [fetchToggles])

  const applyToggle = useCallback(async (toggleId, newState) => {
    // Capture original state before optimistic update so we can revert exactly
    let originalState = null
    setToggles(prev => {
      const t = prev.find(t => t.id === toggleId)
      if (t) originalState = t.live_state
      return prev.map(t => t.id === toggleId ? { ...t, live_state: newState, optimistic: true } : t)
    })
    try {
      const res = await fetch(`/api/toggles/${toggleId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, state: newState }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail ?? 'Apply failed')
      }
      const result = await res.json()
      setToggles(prev =>
        prev.map(t => t.id === toggleId ? { ...t, ...result, optimistic: false } : t)
      )
      return { success: true }
    } catch (err) {
      // Revert to original state captured before the optimistic update
      setToggles(prev =>
        prev.map(t => t.id === toggleId ? { ...t, live_state: originalState, optimistic: false } : t)
      )
      return { success: false, error: err.message }
    }
  }, [targetId])

  return { toggles, loading, error, refetch: fetchToggles, applyToggle }
}
