/**
 * ProfileModal.jsx — Diff preview, restart/danger warnings, Hyper confirmation.
 *
 * Hyper gate: Apply button is disabled until confirmInput === 'HYPER' exactly
 * (case-sensitive, no trim — must be the exact string "HYPER").
 */
import React, { useState, useEffect, useRef } from 'react'
import { X, Zap, ShieldAlert, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

const PROFILE_META = {
  default:     { label: '🔄 Default',      btnCls: 'bg-slate-600 hover:bg-slate-500' },
  performance: { label: '⚡ Performance',   btnCls: 'bg-blue-700  hover:bg-blue-600'  },
  max:         { label: '🚀 Max',           btnCls: 'bg-purple-700 hover:bg-purple-600' },
  hyper:       { label: '☢️ Hyper',         btnCls: 'bg-red-700   hover:bg-red-600'   },
}

// Toggles that danger=2 break things visibly — surfaced as red warning lines
const DANGER2_BREAKS = {
  mdns: 'Breaks AirDrop, AirPlay to this Mac, some HomeKit',
}

export default function ProfileModal({ profileName, targetId, onClose, onApplied }) {
  const [confirmInput, setConfirmInput] = useState('')
  const [applying, setApplying]         = useState(false)
  const [done, setDone]                 = useState(false)
  const [results, setResults]           = useState([])
  const [error, setError]               = useState(null)
  const confirmRef = useRef(null)

  const isHyper = profileName === 'hyper'
  const meta     = PROFILE_META[profileName] ?? PROFILE_META.default

  // Hyper gate: exact case-sensitive match for "HYPER"
  const hyperConfirmed = !isHyper || confirmInput === 'HYPER'
  const canApply = hyperConfirmed && !applying && !done

  // Auto-focus confirm input when modal opens for hyper
  useEffect(() => {
    if (isHyper) confirmRef.current?.focus()
  }, [isHyper])

  // Close on Escape — only when not yet done (after apply, must use Close button)
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape' && !done) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, done])

  async function handleApply() {
    if (!canApply) return
    setApplying(true)
    setError(null)
    try {
      const res = await fetch(`/api/profiles/${profileName}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: targetId,
          confirm: isHyper ? confirmInput : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail))
      }
      const data = await res.json()
      setResults(data.results ?? [])
      setDone(true)
      onApplied?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setApplying(false)
    }
  }

  const hasRestartRequired = results.some(r => r.requires_restart)
  const failCount = results.filter(r => !r.success).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !done) onClose() }}
    >
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg mx-4 shadow-2xl
                      transition-all duration-200 animate-in fade-in slide-in-from-bottom-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold text-base">
            Apply {meta.label} Profile
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4 max-h-[480px] overflow-y-auto">

          {/* Hyper danger notice */}
          {isHyper && !done && (
            <div className="bg-red-950/60 border border-red-800 rounded-lg p-3 space-y-1.5">
              <p className="text-red-300 font-semibold text-sm flex items-center gap-2">
                <ShieldAlert size={14} className="flex-shrink-0" />
                Hyper mode — destructive side effects
              </p>
              <ul className="space-y-0.5">
                {Object.values(DANGER2_BREAKS).map((msg, i) => (
                  <li key={i} className="text-xs text-red-400 flex items-start gap-1.5">
                    <span className="mt-0.5 flex-shrink-0">🔴</span>{msg}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Max confirmation note */}
          {profileName === 'max' && !done && (
            <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-3">
              <p className="text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle size={13} className="flex-shrink-0" />
                May affect AirPlay receiving and location features.
              </p>
            </div>
          )}

          {/* Progress / results */}
          {results.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-2">
                {done
                  ? failCount === 0 ? '✓ All toggles applied' : `${failCount} toggle(s) failed`
                  : 'Applying…'}
              </p>
              {results.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  {r.success
                    ? <CheckCircle2 size={13} className="text-green-400 flex-shrink-0 mt-0.5" />
                    : <XCircle      size={13} className="text-red-400    flex-shrink-0 mt-0.5" />
                  }
                  <span className={r.success ? 'text-slate-300' : 'text-red-300'}>
                    {r.name ?? r.toggle_id}
                  </span>
                  {r.old_state && (
                    <span className="text-slate-600 ml-auto flex-shrink-0">
                      {r.old_state} → {r.new_state}
                    </span>
                  )}
                  {!r.success && r.stderr && (
                    <span className="text-red-500 font-mono truncate block">{r.stderr}</span>
                  )}
                </div>
              ))}
              {hasRestartRequired && (
                <p className="text-xs text-yellow-400 flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-700">
                  <Zap size={11} />
                  Some changes require app/session restarts to take full effect.
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded px-3 py-2 font-mono">
              {error}
            </p>
          )}

          {/* Hyper confirmation input — exact case-sensitive "HYPER" required */}
          {isHyper && !done && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-medium">
                Type <code className="bg-slate-700 px-1 rounded text-red-300">HYPER</code> to enable the Apply button:
              </label>
              <input
                ref={confirmRef}
                type="text"
                value={confirmInput}
                onChange={e => setConfirmInput(e.target.value)}
                placeholder="HYPER"
                autoComplete="off"
                spellCheck={false}
                className={[
                  'w-full bg-slate-900 border rounded px-3 py-2 text-sm font-mono',
                  'focus:outline-none transition-colors duration-150',
                  confirmInput === 'HYPER'
                    ? 'border-red-500 text-red-300'
                    : confirmInput.length > 0
                      ? 'border-slate-600 text-slate-400'
                      : 'border-slate-700 text-slate-100',
                ].join(' ')}
              />
              {confirmInput.length > 0 && confirmInput !== 'HYPER' && (
                <p className="text-xs text-slate-500">
                  Must be exactly <span className="text-red-400 font-mono">HYPER</span> — case-sensitive
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded hover:bg-slate-700"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleApply}
              disabled={!canApply}
              title={isHyper && !hyperConfirmed ? 'Type HYPER to confirm' : undefined}
              className={[
                'px-4 py-1.5 text-sm font-semibold rounded text-white',
                'transition-colors duration-150',
                meta.btnCls,
                !canApply ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {applying ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
