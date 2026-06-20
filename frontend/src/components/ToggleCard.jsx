/**
 * ToggleCard.jsx — Full toggle card per SPEC.md.
 *
 * Badges: ON/OFF chip · impact (HIGH/MEDIUM/LOW/POSITIVE) · danger (CAUTION/DANGER)
 *         Apple default chip · ⚡ Restart Required with restart_note tooltip text
 * Toggle switch: optimistic, 150ms transition, reverts on failure
 */
import React, { useState } from 'react'
import { Zap, AlertTriangle, ShieldAlert } from 'lucide-react'

// ── Impact badge helpers ──────────────────────────────────────────────────────
function impactMeta(impact = '') {
  if (impact.startsWith('HIGH'))     return { label: 'HIGH',     cls: 'bg-red-950   border-red-800   text-red-300'   }
  if (impact.startsWith('CRITICAL')) return { label: 'CRITICAL', cls: 'bg-red-950   border-red-800   text-red-300'   }
  if (impact.startsWith('LOW-MED') || impact.startsWith('LOW-MEDIUM'))
                                     return { label: 'LOW‑MED', cls: 'bg-amber-950 border-amber-800 text-amber-300' }
  if (impact.startsWith('MEDIUM'))   return { label: 'MEDIUM',   cls: 'bg-amber-950 border-amber-800 text-amber-300' }
  if (impact.startsWith('POSITIVE')) return { label: 'POSITIVE', cls: 'bg-green-950 border-green-800 text-green-300' }
  if (impact.startsWith('LOW'))      return { label: 'LOW',      cls: 'bg-blue-950  border-blue-800  text-blue-300'  }
  return                                    { label: impact.slice(0, 8), cls: 'bg-slate-700 border-slate-600 text-slate-300' }
}

// ── Restart Required badge with tooltip showing full restart_note text ────────
function RestartBadge({ note }) {
  return (
    <span className="relative group inline-flex items-center gap-1 cursor-help">
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border
                       bg-yellow-950 border-yellow-700 text-yellow-400 text-xs font-medium">
        <Zap size={10} className="flex-shrink-0" />
        Restart required
      </span>
      {/* Tooltip — contains the full restart_note text from the toggle definition */}
      <span
        className="pointer-events-none absolute bottom-full left-0 mb-2 z-20
                   w-56 px-3 py-2 text-xs rounded-lg shadow-xl
                   bg-slate-700 border border-slate-600 text-slate-200 leading-relaxed
                   opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        {note || 'Restart required for this change to take effect.'}
      </span>
    </span>
  )
}

// ── Toggle switch ─────────────────────────────────────────────────────────────
function ToggleSwitch({ isOn, pending, onToggle, name }) {
  return (
    <button
      onClick={onToggle}
      disabled={pending}
      aria-label={`${isOn ? 'Disable' : 'Enable'} ${name}`}
      className={[
        'relative flex-shrink-0 w-11 h-6 rounded-full overflow-hidden',
        'transition-colors duration-150 focus:outline-none',
        isOn ? 'bg-green-500' : 'bg-slate-600',
        pending ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow',
          'transition-transform duration-150',
          isOn ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
// Toggles whose OFF state weakens the Mac's security posture. Flagged in the UI
// so disabling them is a deliberate choice. (The registry's impact/danger fields
// describe performance, not security, so this is tracked here.)
const SECURITY_REDUCING = new Set(['auto_updates', 'location_services'])

export default function ToggleCard({ toggle, onApply }) {
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState(null)

  const liveState = toggle.live_state
  const isOn = liveState === 'on'
  const isUnsupported = liveState === 'unsupported'
  const isUnknown = !liveState || liveState === 'unknown' || liveState === 'error'
  const impact = impactMeta(toggle.impact ?? '')
  const reducesSecurity = SECURITY_REDUCING.has(toggle.id)

  async function handleToggle() {
    if (pending || isUnknown || isUnsupported) return
    setPending(true)
    const result = await onApply(toggle.id, isOn ? 'off' : 'on')
    if (!result.success) {
      setToast(result.error ?? 'Toggle failed')
      setTimeout(() => setToast(null), 4000)
    }
    setPending(false)
  }

  return (
    <div className={[
      'bg-slate-800 border rounded-lg p-4 flex flex-col gap-3',
      'transition-all duration-150',
      isUnsupported ? 'border-slate-700/40 opacity-50' :
      toggle.danger === 2 ? 'border-red-900/60' : 'border-slate-700',
    ].join(' ')}>

      {/* ── Top row: name + toggle switch ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-100 text-sm leading-tight">{toggle.name}</p>
          <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{toggle.description}</p>
        </div>
        <div className="flex-shrink-0">
          <ToggleSwitch isOn={isOn} pending={pending || isUnknown || isUnsupported} onToggle={handleToggle} name={toggle.name} />
        </div>
      </div>

      {/* ── Badge row ── */}
      <div className="flex items-center gap-1.5 flex-wrap">

        {/* ON / OFF state chip */}
        <span
          title={isUnknown && !isUnsupported
            ? "Couldn't read this toggle's state — it may behave differently on this macOS version"
            : undefined}
          className={[
            'text-xs font-bold px-2 py-0.5 rounded border',
            isUnsupported ? 'bg-slate-700 border-slate-700 text-slate-600 italic' :
            isUnknown     ? 'bg-slate-700 border-slate-600 text-slate-500 italic'
              : isOn      ? 'bg-green-950 border-green-700 text-green-300'
                          : 'bg-slate-700 border-slate-600 text-slate-400',
          ].join(' ')}
        >
          {isUnsupported ? 'N/A' : isUnknown ? '? unknown' : isOn ? 'ON' : 'OFF'}
        </span>

        {/* Impact badge */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded border ${impact.cls}`}>
          {impact.label}
        </span>

        {/* Danger badge */}
        {toggle.danger === 1 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border
                           bg-amber-950 border-amber-700 text-amber-300">
            <AlertTriangle size={10} className="flex-shrink-0" />
            CAUTION
          </span>
        )}
        {toggle.danger === 2 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border
                           bg-red-950 border-red-700 text-red-300">
            <ShieldAlert size={10} className="flex-shrink-0" />
            DANGER
          </span>
        )}

        {/* Security-reducing badge */}
        {reducesSecurity && (
          <span
            title="Turning this off reduces this Mac's security"
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border
                       bg-orange-950 border-orange-700 text-orange-300"
          >
            <ShieldAlert size={10} className="flex-shrink-0" />
            SECURITY
          </span>
        )}

        {/* Apple default chip */}
        <span className="text-xs text-slate-500 border border-slate-700 px-2 py-0.5 rounded">
          Default: {(toggle.default_state ?? 'on').toUpperCase()}
        </span>

        {/* ⚡ Restart Required — tooltip contains full restart_note text */}
        {toggle.requires_restart && toggle.restart_note && (
          <RestartBadge note={toggle.restart_note} />
        )}
      </div>

      {/* ── Security caution when currently disabled ── */}
      {reducesSecurity && !isOn && !isUnsupported && !isUnknown && (
        <p className="text-xs text-orange-300/90 bg-orange-950/40 border border-orange-900 rounded px-2 py-1 flex items-start gap-1.5">
          <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
          This is off — it reduces this Mac's security. Re-enable unless you intend to keep it disabled.
        </p>
      )}

      {/* ── Error toast ── */}
      {toast && (
        <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-2 py-1 font-mono truncate">
          {toast}
        </p>
      )}

      {/* ── Last changed ── */}
      {toggle.last_changed && (
        <p className="text-xs text-slate-600">Changed {toggle.last_changed}</p>
      )}
    </div>
  )
}
