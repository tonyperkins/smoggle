/**
 * ConnectionBadge.jsx — Green/red/amber dot with hover tooltip.
 * status: 'connected' | 'disconnected' | 'checking'
 */
import React from 'react'

const STATUS = {
  connected:    { dot: 'bg-green-500',            label: 'Connected' },
  disconnected: { dot: 'bg-red-500',              label: 'Disconnected' },
  checking:     { dot: 'bg-amber-400 animate-pulse', label: 'Checking connection…' },
}

export default function ConnectionBadge({ status = 'checking', className = '' }) {
  const s = STATUS[status] ?? STATUS.checking
  return (
    <span className={`relative group inline-flex items-center cursor-default ${className}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
      <span
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                   px-2 py-1 text-xs rounded bg-slate-700 border border-slate-600 text-slate-200
                   whitespace-nowrap shadow-lg
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
      >
        {s.label}
      </span>
    </span>
  )
}
