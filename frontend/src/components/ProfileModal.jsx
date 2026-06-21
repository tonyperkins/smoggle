/**
 * ProfileModal.jsx — Pre-apply diff preview + results, Hyper confirmation gate.
 *
 * Phases:
 *   1. Preview — shows which toggles will change, warnings, optional HYPER gate
 *   2. Applying — spinner + live result rows as they complete (all arrive at once)
 *   3. Done — full results list persists until user clicks Close
 */
import React, { useState, useEffect, useRef } from 'react'
import { X, Zap, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react'
import { PROFILES_FRONTEND } from '../lib/profiles.js'

const PROFILE_META = {
  default:     { label: 'Default',     emoji: '🔄', btnCls: 'bg-surface-3 hover:opacity-90 text-ink', headerCls: 'border-line' },
  performance: { label: 'Performance', emoji: '⚡', btnCls: 'bg-accent hover:opacity-90 text-white',  headerCls: 'border-accent/40' },
  max:         { label: 'Max',         emoji: '🚀', btnCls: 'bg-accent hover:opacity-90 text-white',  headerCls: 'border-accent/40' },
  hyper:       { label: 'Hyper',       emoji: '☢️', btnCls: 'bg-danger hover:opacity-90 text-white',  headerCls: 'border-danger/40' },
}

export default function ProfileModal({ profileName, targetId, onClose, onApplied }) {
  const [confirmInput, setConfirmInput] = useState('')
  const [applying, setApplying]         = useState(false)
  const [done, setDone]                 = useState(false)
  const [results, setResults]           = useState([])
  const [error, setError]               = useState(null)
  const confirmRef = useRef(null)

  const isHyper = profileName === 'hyper'
  const meta    = PROFILE_META[profileName] ?? PROFILE_META.default

  // What this profile will do — from the frontend registry
  const profileDef = PROFILES_FRONTEND[profileName] ?? { toggles: [], description: '' }

  const hyperConfirmed = !isHyper || confirmInput === 'HYPER'
  const canApply = hyperConfirmed && !applying && !done

  useEffect(() => {
    if (isHyper) confirmRef.current?.focus()
  }, [isHyper])

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

  const activeResults      = results.filter(r => !r.skipped)
  const failCount          = activeResults.filter(r => !r.success).length
  const hasRestartRequired = activeResults.some(r => r.requires_restart)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !done) onClose() }}
    >
      <div className={[
        'bg-bg border rounded-xl w-full max-w-md mx-4 shadow-2xl flex flex-col',
        'transition-all duration-200',
        meta.headerCls,
      ].join(' ')}>

        {/* ── Header ── */}
        <div className={['flex items-center justify-between px-5 py-3.5 border-b', meta.headerCls].join(' ')}>
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{meta.emoji}</span>
            <div>
              <h2 className="text-ink font-semibold text-sm leading-tight">
                {meta.label} Profile
              </h2>
              {profileDef.description && !done && (
                <p className="text-xs text-ink-faint mt-0.5">{profileDef.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="px-5 py-4 space-y-4 max-h-[420px] overflow-y-auto">

          {/* ── PRE-APPLY: diff preview ── */}
          {!applying && !done && (
            <>
              {/* Hyper danger notice */}
              {isHyper && (
                <div className="bg-danger-soft/50 border border-danger/40 rounded-lg p-3 space-y-1">
                  <p className="text-danger font-semibold text-xs flex items-center gap-1.5">
                    <ShieldAlert size={13} className="flex-shrink-0" />
                    Destructive side effects
                  </p>
                  <p className="text-xs text-danger/80">Disables mDNS — breaks AirDrop, AirPlay receiving, some HomeKit.</p>
                </div>
              )}

              {/* Max warning */}
              {profileName === 'max' && (
                <div className="bg-warn-soft border border-warn/40 rounded-lg p-3">
                  <p className="text-warn/90 text-xs flex items-center gap-1.5">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    May affect AirPlay receiving and location features.
                  </p>
                </div>
              )}

              {/* Toggle list */}
              {profileDef.toggles.length > 0 && (
                <div>
                  <p className="text-xs text-ink-faint uppercase tracking-wider font-semibold mb-2">
                    {profileName === 'default' ? 'Restores defaults for' : 'Will change'} ({profileDef.toggles.length})
                  </p>
                  <div className="space-y-1">
                    {profileDef.toggles.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-line last:border-0">
                        <span className="text-ink-muted">{t.name}</span>
                        <span className="flex items-center gap-1 text-ink-faint flex-shrink-0">
                          <span className={t.from === 'on' ? 'text-accent-ink' : 'text-ink-faint'}>{t.from}</span>
                          <ArrowRight size={10} />
                          <span className={t.to === 'on' ? 'text-accent-ink' : 'text-ink-muted'}>{t.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hyper confirmation input */}
              {isHyper && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-ink-muted">
                    Type <code className="bg-surface px-1.5 py-0.5 rounded text-danger font-mono">HYPER</code> to unlock Apply:
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
                      'w-full bg-surface border rounded-lg px-3 py-2 text-sm font-mono',
                      'focus:outline-none transition-colors duration-150',
                      confirmInput === 'HYPER'
                        ? 'border-danger text-danger'
                        : confirmInput.length > 0
                          ? 'border-line text-ink-muted'
                          : 'border-line text-ink',
                    ].join(' ')}
                  />
                </div>
              )}
            </>
          )}

          {/* ── APPLYING: spinner ── */}
          {applying && (
            <div className="flex items-center justify-center gap-3 py-6 text-ink-muted">
              <Loader2 size={18} className="animate-spin text-accent-ink" />
              <span className="text-sm">Applying {meta.label} profile…</span>
            </div>
          )}

          {/* ── DONE: results list ── */}
          {done && results.length > 0 && (
            <div className="space-y-0.5">
              {/* Summary header */}
              <div className={[
                'flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-sm font-medium',
                failCount === 0
                  ? 'bg-accent-soft/50 border border-accent/40 text-accent-ink'
                  : 'bg-danger-soft/50 border border-danger/40 text-danger',
              ].join(' ')}>
                {failCount === 0
                  ? <><CheckCircle2 size={14} /> All {activeResults.length} toggles applied successfully</>
                  : <><XCircle size={14} /> {failCount} of {activeResults.length} failed</>
                }
              </div>

              {/* Individual results — skip unsupported hardware toggles */}
              {activeResults.map((r, i) => (
                <div key={i} className={[
                  'flex items-center gap-2 text-xs px-2 py-1.5 rounded',
                  !r.success ? 'bg-danger-soft/30' : '',
                ].join(' ')}>
                  {r.success
                    ? <CheckCircle2 size={12} className="text-accent flex-shrink-0" />
                    : <XCircle      size={12} className="text-danger flex-shrink-0" />
                  }
                  <span className={r.success ? 'text-ink-muted flex-1' : 'text-danger flex-1'}>
                    {r.name ?? r.toggle_id}
                  </span>
                  {r.old_state && (
                    <span className="text-ink-faint flex-shrink-0 flex items-center gap-1">
                      <span className={r.old_state === 'on' ? 'text-accent/60' : 'text-ink-faint'}>{r.old_state}</span>
                      <ArrowRight size={9} className="text-ink-faint" />
                      <span className={r.new_state === 'on' ? 'text-accent-ink' : 'text-ink-muted'}>{r.new_state}</span>
                    </span>
                  )}
                </div>
              ))}

              {hasRestartRequired && (
                <p className="text-xs text-warn flex items-center gap-1.5 mt-3 pt-3 border-t border-line">
                  <Zap size={11} /> Some changes need a logout/restart to fully take effect.
                </p>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-danger-soft/50 border border-danger/40 rounded-lg px-3 py-2">
              <p className="text-xs text-danger font-mono break-all">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-line">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-ink-muted hover:text-ink rounded-lg hover:bg-surface transition-colors"
          >
            {done ? 'Close' : 'Cancel'}
          </button>
          {!done && (
            <button
              onClick={handleApply}
              disabled={!canApply}
              title={isHyper && !hyperConfirmed ? 'Type HYPER to confirm' : undefined}
              className={[
                'px-4 py-1.5 text-sm font-semibold rounded-lg text-white',
                'transition-opacity duration-150 flex items-center gap-2',
                isHyper ? 'bg-danger hover:opacity-90' : 'bg-accent hover:opacity-90',
                !canApply ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {applying && <Loader2 size={13} className="animate-spin" />}
              {applying ? 'Applying…' : 'Apply'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
