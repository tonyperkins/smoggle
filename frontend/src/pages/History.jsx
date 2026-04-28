/**
 * History.jsx — Toggle change log with filters by toggle ID, profile, target.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Filter, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import { useTarget } from '../App.jsx'

function StateBadge({ state }) {
  if (!state) return <span className="text-slate-600 font-mono text-xs">?</span>
  return (
    <span className={`font-mono text-xs px-1.5 py-0.5 rounded border ${
      state === 'on'
        ? 'bg-green-950 border-green-800 text-green-300'
        : 'bg-slate-700 border-slate-600 text-slate-400'
    }`}>
      {state}
    </span>
  )
}

function ProfileTag({ profile }) {
  if (!profile) return null
  const color = profile === 'hyper'       ? 'text-red-400'
              : profile === 'max'         ? 'text-purple-400'
              : profile === 'performance' ? 'text-blue-400'
              : profile === 'default'     ? 'text-slate-400'
              : 'text-slate-500'
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 sticky top-0 z-30">
        <Link to="/" className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-bold text-lg tracking-tight">History</span>
        {targetName && (
          <span className="text-slate-500 text-sm">— {targetName}</span>
        )}
        <button
          onClick={load}
          className="ml-auto p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
          title="Refresh"
        >
          <RefreshCw size={15} />
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-slate-500 flex-shrink-0" />
          <input
            type="text"
            value={toggleFilter}
            onChange={e => setToggleFilter(e.target.value)}
            placeholder="Toggle ID (e.g. spotlight)"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200
                       placeholder-slate-600 focus:outline-none focus:border-blue-500 w-44"
          />
          <input
            type="text"
            value={profileFilter}
            onChange={e => setProfileFilter(e.target.value)}
            placeholder="Profile (e.g. max)"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200
                       placeholder-slate-600 focus:outline-none focus:border-blue-500 w-36"
          />
          {(toggleFilter || profileFilter) && (
            <button
              onClick={() => { setToggleFilter(''); setProfileFilter('') }}
              className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1.5 rounded hover:bg-slate-700"
            >
              Clear
            </button>
          )}
        </div>

        {/* States */}
        {!activeTargetId && (
          <p className="text-slate-500 text-sm">Select a target Mac to view history.</p>
        )}

        {activeTargetId && loading && (
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        )}

        {activeTargetId && !loading && history.length === 0 && (
          <p className="text-slate-500 text-sm">
            {toggleFilter || profileFilter ? 'No entries matching filters.' : 'No toggle changes recorded yet for this target.'}
          </p>
        )}

        {/* Entry list */}
        <div className="space-y-2">
          {history.map(h => (
            <div
              key={h.id}
              className={[
                'bg-slate-800 border rounded-xl px-4 py-3',
                h.success ? 'border-slate-700' : 'border-red-900/60',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {h.success
                    ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    : <XCircle     size={14} className="text-red-500   flex-shrink-0" />
                  }
                  <span className="font-medium text-slate-200 text-sm">{h.toggle_name ?? h.toggle_id}</span>
                  {h.toggle_name && h.toggle_name !== h.toggle_id && (
                    <span className="text-slate-600 text-xs font-mono">{h.toggle_id}</span>
                  )}
                  <span className="text-slate-600 text-xs">→</span>
                  <StateBadge state={h.old_state} />
                  <span className="text-slate-600 text-xs">→</span>
                  <StateBadge state={h.new_state} />
                  <ProfileTag profile={h.profile} />
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
                  {new Date(h.timestamp).toLocaleString()}
                </span>
              </div>
              {!h.success && h.stderr && (
                <p className="text-red-400 text-xs mt-2 font-mono bg-red-950/40 rounded px-2 py-1 truncate">
                  {h.stderr}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
