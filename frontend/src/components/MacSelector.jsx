/**
 * MacSelector.jsx — Custom dropdown showing all configured Macs with
 * per-Mac connection status dot (probed independently for every target).
 */
import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTarget } from '../App.jsx'

function StatusDot({ status }) {
  const colors = {
    connected:    'bg-green-500',
    disconnected: 'bg-red-500',
    checking:     'bg-amber-400 animate-pulse',
  }
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status] ?? colors.checking}`} />
  )
}

export default function MacSelector() {
  const { targets, activeTargetId, setActiveTargetId } = useTarget()
  const [open, setOpen] = useState(false)
  // { [targetId]: 'checking' | 'connected' | 'disconnected' }
  const [statuses, setStatuses] = useState({})
  const ref = useRef(null)

  // Probe each target once on mount and when target list changes
  useEffect(() => {
    if (targets.length === 0) return
    targets.forEach(t => {
      setStatuses(s => ({ ...s, [t.id]: 'checking' }))
      fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: t.id }),
      })
        .then(r => r.json())
        .then(data => setStatuses(s => ({ ...s, [t.id]: data.success ? 'connected' : 'disconnected' })))
        .catch(() => setStatuses(s => ({ ...s, [t.id]: 'disconnected' })))
    })
  }, [targets])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const active = targets.find(t => t.id === activeTargetId)

  if (targets.length === 0) {
    return (
      <span className="text-xs text-slate-500 px-2">No Macs configured</span>
    )
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded px-2.5 py-1 text-sm text-slate-100 focus:outline-none"
      >
        {active && <StatusDot status={statuses[active.id] ?? 'checking'} />}
        <span className="max-w-[160px] truncate">{active?.name ?? 'Select Mac'}</span>
        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {targets.map(t => (
            <button
              key={t.id}
              onClick={() => { setActiveTargetId(t.id); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-slate-700 transition-colors ${
                t.id === activeTargetId ? 'bg-slate-700 text-slate-100' : 'text-slate-300'
              }`}
            >
              <StatusDot status={statuses[t.id] ?? 'checking'} />
              <span className="flex-1 truncate">{t.name}</span>
              <span className="text-xs text-slate-500 truncate max-w-[80px]">{t.host}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
