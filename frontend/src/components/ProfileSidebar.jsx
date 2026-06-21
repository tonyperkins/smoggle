/**
 * ProfileSidebar.jsx — one-click performance presets. The card matching the
 * current live toggle states is marked ACTIVE (best-effort, display-only).
 */
import React from 'react'
import { RotateCcw, Zap, ChevronsUp, AlertTriangle } from 'lucide-react'
import { detectActiveProfile } from '../lib/profiles.js'

const PROFILES = [
  { name: 'default',     icon: RotateCcw,     label: 'Default',     desc: 'Restore Apple defaults' },
  { name: 'performance', icon: Zap,           label: 'Performance', desc: 'Trim 10 safe background services' },
  { name: 'max',         icon: ChevronsUp,    label: 'Max',         desc: 'Performance + High Power Mode' },
  { name: 'hyper',       icon: AlertTriangle, label: 'Hyper',       desc: 'Max + mDNS off · breaks AirDrop' },
]

export default function ProfileSidebar({ targetId, toggles = [], onPick }) {
  const liveById = Object.fromEntries(toggles.map(t => [t.id, t.live_state]))
  const active = toggles.length ? detectActiveProfile(liveById) : null

  return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-ink-faint uppercase tracking-wider font-semibold px-1 mb-0.5">
          Profiles
        </p>
        {PROFILES.map(p => {
          const isActive = active === p.name
          const Icon = p.icon
          return (
            <button
              key={p.name}
              onClick={() => !isActive && onPick?.(p.name)}
              disabled={!targetId}
              aria-current={isActive ? 'true' : undefined}
              title={isActive ? 'Already active' : `Apply ${p.label} profile`}
              className={[
                'w-full text-left rounded-xl border px-3 py-2.5 transition-colors',
                'flex items-center gap-2.5',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                isActive
                  ? 'border-accent/50 bg-accent-soft cursor-default'
                  : 'border-line bg-surface hover:bg-surface-2',
              ].join(' ')}
            >
              <Icon size={16} className={isActive ? 'text-accent-ink flex-shrink-0' : 'text-ink-muted flex-shrink-0'} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink leading-tight">{p.label}</span>
                <span className="block text-xs text-ink-muted mt-0.5 leading-tight">{p.desc}</span>
              </span>
              {isActive && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-ink flex-shrink-0">
                  Active
                </span>
              )}
            </button>
          )
        })}
      </div>
  )
}
