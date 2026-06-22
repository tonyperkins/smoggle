/**
 * History.jsx — Toggle change log with filters by toggle ID, profile, target.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Filter, CheckCircle2, XCircle, Loader2, RefreshCw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react'
import { useTarget } from '../App.jsx'

function StateBadge({ state }) {
  if (!state) return <span className="text-ink-faint font-mono text-xs">?</span>
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
      state === 'on'
        ? 'bg-accent-soft border-accent/40 text-accent-ink'
        : 'bg-surface-2 border-line text-ink-muted'
    }`}>
      {state}
    </span>
  )
}

function ProfileTag({ profile }) {
  if (!profile) return null
  const color = profile === 'hyper'       ? 'text-danger'
              : profile === 'max'         ? 'text-ink-muted'
              : profile === 'performance' ? 'text-accent-ink'
              : profile === 'default'     ? 'text-ink-muted'
              : 'text-ink-faint'
  return (
    <span className={`text-xs italic ${color}`}>via {profile}</span>
  )
}

export default function History() {
  const { activeTargetId, targets } = useTarget()
  const [history, setHistory]         = useState([])
  const [loading, setLoading]         = useState(false)
  const [toggleFilter, setToggleFilter] = useState('')
  const [profileFilter, setProfileFilter] = useState('')
  const [expandedIds, setExpandedIds] = useState(new Set())

  function toggleExpand(id) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const load = useCallback(() => {
    if (!activeTargetId) return
    setLoading(true)
    const params = new URLSearchParams({ target_id: activeTargetId })
    if (toggleFilter.trim()) params.set('toggle_id', toggleFilter.trim())
    if (profileFilter.trim()) params.set('profile', profileFilter.trim())
    fetch(`/api/history?${params}`)
      .then(r => r.json())
      .then(data => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [activeTargetId, toggleFilter, profileFilter])

  useEffect(() => { load() }, [load])

  const targetName = targets.find(t => t.id === activeTargetId)?.name

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-line sticky top-0 z-30">
        <Link to="/" className="p-1.5 rounded hover:bg-surface-2 text-ink-muted hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-bold text-lg tracking-tight">History</span>
        {targetName && (
          <span className="text-ink-faint text-sm">— {targetName}</span>
        )}
        <button
          onClick={load}
          className="ml-auto p-1.5 rounded hover:bg-surface-2 text-ink-muted hover:text-ink"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-ink-faint flex-shrink-0" />
          <input
            type="text"
            value={toggleFilter}
            onChange={e => setToggleFilter(e.target.value)}
            placeholder="Toggle ID (e.g. spotlight)"
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink
                       placeholder-ink-faint focus:outline-none focus:border-accent w-44"
          />
          <input
            type="text"
            value={profileFilter}
            onChange={e => setProfileFilter(e.target.value)}
            placeholder="Profile (e.g. max)"
            className="bg-surface border border-line rounded-lg px-3 py-1.5 text-xs text-ink
                       placeholder-ink-faint focus:outline-none focus:border-accent w-36"
          />
          {(toggleFilter || profileFilter) && (
            <button
              onClick={() => { setToggleFilter(''); setProfileFilter('') }}
              className="text-xs text-ink-faint hover:text-ink-muted px-2 py-1.5 rounded hover:bg-surface-2"
            >
              Clear
            </button>
          )}
        </div>

        {/* States */}
        {!activeTargetId && (
          <p className="text-ink-faint text-sm">Select a target Mac to view history.</p>
        )}

        {activeTargetId && loading && (
          <div className="flex items-center gap-2 text-ink-faint text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {activeTargetId && !loading && history.length === 0 && (
          <p className="text-ink-faint text-sm">
            {toggleFilter || profileFilter ? 'No entries matching filters.' : 'No toggle changes recorded yet for this target.'}
          </p>
        )}

        {/* Entry list */}
        <div className="space-y-2">
          {history.map(h => {
            const hasDetail = !!h.stderr
            const isExpanded = expandedIds.has(h.id)
            const isFailure = !h.success
            const isWarning = h.success && h.stderr
            return (
              <div
                key={h.id}
                className={[
                  'bg-surface border rounded-xl overflow-hidden',
                  isFailure  ? 'border-danger/40/60' :
                  isWarning  ? 'border-warn/40' :
                               'border-line',
                ].join(' ')}
              >
                {/* Summary row — click anywhere to expand if there's detail */}
                <div
                  className={`px-4 py-3 flex items-start justify-between gap-3 ${hasDetail ? 'cursor-pointer select-none hover:bg-surface-2' : ''}`}
                  onClick={() => hasDetail && toggleExpand(h.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    {isFailure
                      ? <XCircle        size={14} className="text-danger    flex-shrink-0" />
                      : isWarning
                        ? <AlertTriangle size={14} className="text-warn flex-shrink-0" />
                        : <CheckCircle2  size={14} className="text-accent flex-shrink-0" />
                    }
                    <span className="font-medium text-ink text-sm">{h.toggle_name ?? h.toggle_id}</span>
                    {h.toggle_name && h.toggle_name !== h.toggle_id && (
                      <span className="text-ink-faint text-xs font-mono">{h.toggle_id}</span>
                    )}
                    <span className="text-ink-faint text-xs">→</span>
                    <StateBadge state={h.old_state} />
                    <span className="text-ink-faint text-xs">→</span>
                    <StateBadge state={h.new_state} />
                    <ProfileTag profile={h.profile} />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {h.actor && (
                      <span className="text-xs text-ink-faint whitespace-nowrap">by {h.actor}</span>
                    )}
                    <span className="text-xs text-ink-faint whitespace-nowrap">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                    {hasDetail && (
                      <span className="text-ink-faint">
                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      </span>
                    )}
                  </div>
                </div>

                {/* Expanded stderr detail */}
                {hasDetail && isExpanded && (
                  <div className={`border-t px-4 py-3 ${
                    isFailure ? 'border-danger/40/40 bg-danger-soft/20' : 'border-warn/40 bg-warn-soft'
                  }`}>
                    <p className={`text-xs font-semibold mb-1.5 ${
                      isFailure ? 'text-danger' : 'text-warn'
                    }`}>
                      {isFailure ? 'Error output' : 'Warning output'}
                    </p>
                    <pre className={`text-xs font-mono whitespace-pre-wrap break-all leading-relaxed ${
                      isFailure ? 'text-danger' : 'text-warn'
                    }`}>
                      {h.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
