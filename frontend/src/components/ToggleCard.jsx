/**
 * ToggleCard.jsx — a background-service card.
 *
 * De-noised: an impact meter + clean ON/OFF state lead, with restart / security /
 * "breaks X" shown as small flags only when they apply. Ollama gets a Required
 * chip, High Power Mode a Boost chip. Toggle switch is optimistic and reverts
 * on failure.
 */
import React, { useState } from 'react'
import { RotateCw, Shield, AlertTriangle } from 'lucide-react'

// Toggles whose OFF state weakens the Mac's security posture.
const SECURITY_REDUCING = new Set(['auto_updates', 'location_services'])
// Per-toggle consequence notes worth flagging on the card.
const BREAK_NOTE = { mdns: 'Breaks AirDrop', app_nap: 'May stall apps' }

// impact string -> a 3-segment meter + plain label
function impactMeter(impact = '') {
  const i = impact.toUpperCase()
  if (i.startsWith('HIGH') || i.startsWith('CRITICAL')) return { segments: 3, label: 'High impact' }
  if (i.startsWith('MEDIUM') || i.startsWith('LOW-MED')) return { segments: 2, label: 'Medium impact' }
  return { segments: 1, label: 'Low impact' }
}

function ImpactMeter({ impact }) {
  const { segments, label } = impactMeter(impact)
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map(n => (
          <span
            key={n}
            className={`w-3.5 h-1.5 rounded-sm ${n < segments ? 'bg-accent' : 'bg-line'}`}
          />
        ))}
      </span>
      <span className="text-xs text-ink-muted">{label}</span>
    </span>
  )
}

function Flag({ icon: Icon, label, tone = 'muted', title }) {
  const cls = tone === 'warn' ? 'text-warn' : 'text-ink-muted'
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${cls}`} title={title}>
      <Icon size={11} className="flex-shrink-0" />
      {label}
    </span>
  )
}

function Chip({ label }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                     bg-accent-soft text-accent-ink">
      {label}
    </span>
  )
}

function ToggleSwitch({ isOn, pending, disabled, onToggle, name }) {
  return (
    <button
      onClick={onToggle}
      disabled={pending || disabled}
      aria-label={`${isOn ? 'Disable' : 'Enable'} ${name}`}
      className={[
        'relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-150',
        isOn ? 'bg-accent' : 'bg-surface-3',
        (pending || disabled) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        className={[
          'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm',
          'transition-transform duration-150',
          isOn ? 'translate-x-5' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  )
}

export default function ToggleCard({ toggle, onApply }) {
  const [pending, setPending] = useState(false)
  const [toast, setToast] = useState(null)

  const liveState = toggle.live_state
  const isOn = liveState === 'on'
  const isUnsupported = liveState === 'unsupported'
  const isUnknown = !liveState || liveState === 'unknown' || liveState === 'error'
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

  const flags = []
  if (toggle.requires_restart) {
    flags.push({ icon: RotateCw, label: 'Restart', tone: 'muted', title: toggle.restart_note || undefined })
  }
  if (reducesSecurity) {
    flags.push({ icon: Shield, label: 'Security', tone: 'warn',
      title: "Turning this off reduces this Mac's security" })
  }
  if (BREAK_NOTE[toggle.id]) {
    flags.push({ icon: AlertTriangle, label: BREAK_NOTE[toggle.id], tone: 'warn' })
  }

  const stateLabel = isUnsupported ? 'N/A' : isUnknown ? '? unknown' : isOn ? 'ON' : 'OFF'
  const stateCls = isUnsupported || isUnknown
    ? 'text-ink-faint italic'
    : isOn ? 'text-accent-ink' : 'text-ink-faint'

  return (
    <div className={[
      'rounded-xl border bg-surface p-4 flex flex-col gap-3 transition-colors',
      isUnsupported ? 'border-line/60 opacity-60' : 'border-line',
    ].join(' ')}>

      {/* Title + switch */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink text-sm leading-tight">{toggle.name}</p>
            <code className="font-mono text-[11px] text-ink-faint bg-surface-2 rounded px-1.5 py-0.5">
              {toggle.id}
            </code>
          </div>
          <p className="text-xs text-ink-muted mt-1 leading-relaxed">{toggle.description}</p>
        </div>
        <ToggleSwitch
          isOn={isOn}
          pending={pending}
          disabled={isUnknown || isUnsupported}
          onToggle={handleToggle}
          name={toggle.name}
        />
      </div>

      {/* Meter / chip + flags + state */}
      <div className="flex items-end justify-between gap-3 mt-auto pt-1">
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap min-w-0">
          {toggle.id === 'ollama' ? <Chip label="Required" />
            : toggle.id === 'high_power_mode' ? <Chip label="Boost" />
            : <ImpactMeter impact={toggle.impact} />}
          {flags.map((f, i) => <Flag key={i} {...f} />)}
        </div>
        <span
          title={isUnknown && !isUnsupported
            ? "Couldn't read this toggle's state — it may behave differently on this macOS version"
            : undefined}
          className={`text-xs font-bold flex-shrink-0 ${stateCls}`}
        >
          {stateLabel}
        </span>
      </div>

      {/* Security caution when disabled */}
      {reducesSecurity && !isOn && !isUnsupported && !isUnknown && (
        <p className="text-xs text-warn bg-warn-soft border border-warn/30 rounded-lg px-2 py-1 flex items-start gap-1.5">
          <Shield size={12} className="flex-shrink-0 mt-0.5" />
          This is off — it reduces this Mac's security. Re-enable unless you mean to keep it disabled.
        </p>
      )}

      {/* Error toast */}
      {toast && (
        <p className="text-xs text-danger bg-danger-soft border border-danger/30 rounded-lg px-2 py-1 font-mono truncate">
          {toast}
        </p>
      )}
    </div>
  )
}
