/**
 * ProfileSidebar.jsx — Profile buttons, color-coded per spec.
 * Default=slate · Performance=blue · Max=purple · Hyper=red
 */
import React, { useState } from 'react'
import ProfileModal from './ProfileModal.jsx'

const PROFILES = [
  {
    name: 'default',
    label: '🔄 Default',
    desc: 'Restore Apple defaults',
    cls: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border-slate-600',
  },
  {
    name: 'performance',
    label: '⚡ Performance',
    desc: 'Safe background service cuts',
    cls: 'bg-blue-900/60 hover:bg-blue-800/80 text-blue-200 border-blue-800',
  },
  {
    name: 'max',
    label: '🚀 Max',
    desc: 'Performance + power mode',
    cls: 'bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border-purple-800',
  },
  {
    name: 'hyper',
    label: '☢️ Hyper',
    desc: 'Max + mDNS off — breaks AirDrop',
    cls: 'bg-red-950/60 hover:bg-red-900/80 text-red-300 border-red-900',
  },
]

export default function ProfileSidebar({ targetId, onApplied }) {
  const [selected, setSelected] = useState(null)

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold px-1 mb-0.5">
          Profiles
        </p>
        {PROFILES.map(p => (
          <button
            key={p.name}
            onClick={() => setSelected(p.name)}
            disabled={!targetId}
            className={[
              'w-full text-left px-3 py-2 rounded border text-sm font-medium',
              'transition-colors duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              p.cls,
            ].join(' ')}
          >
            <span className="block leading-tight">{p.label}</span>
            <span className="block text-xs opacity-60 font-normal mt-0.5">{p.desc}</span>
          </button>
        ))}
      </div>

      {selected && targetId && (
        <ProfileModal
          profileName={selected}
          targetId={targetId}
          onClose={() => setSelected(null)}
          onApplied={() => { onApplied?.() }}
        />
      )}
    </>
  )
}
