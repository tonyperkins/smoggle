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
  default:     { label: 'Default',     emoji: '🔄', btnCls: 'bg-slate-600 hover:bg-slate-500',   headerCls: 'border-slate-700' },
  performance: { label: 'Performance', emoji: '⚡', btnCls: 'bg-blue-700  hover:bg-blue-600',    headerCls: 'border-blue-900/60' },
  max:         { label: 'Max',         emoji: '🚀', btnCls: 'bg-purple-700 hover:bg-purple-600', headerCls: 'border-purple-900/60' },
  hyper:       { label: 'Hyper',       emoji: '☢️', btnCls: 'bg-red-700   hover:bg-red-600',     headerCls: 'border-red-900/60' },
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
        'bg-slate-900 border rounded-xl w-full max-w-md mx-4 shadow-2xl flex flex-col',
        'transition-all duration-200',
        meta.headerCls,
      ].join(' ')}>

        {/* ── Header ── */}
        <div className={['flex items-center justify-between px-5 py-3.5 border-b', meta.headerCls].join(' ')}>
          <div className="flex items-center gap-2">
            <span className="text-lg leading-none">{meta.emoji}</span>
            <div>
              <h2 className="text-slate-100 font-semibold text-sm leading-tight">
                {meta.label} Profile
              </h2>
              {profileDef.description && !done && (
                <p className="text-xs text-slate-500 mt-0.5">{profileDef.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-700 transition-colors"
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
                <div className="bg-red-950/50 border border-red-900 rounded-lg p-3 space-y-1">
                  <p className="text-red-300 font-semibold text-xs flex items-center gap-1.5">
                    <ShieldAlert size={13} className="flex-shrink-0" />
                    Destructive side effects
                  </p>
                  <p className="text-xs text-red-400/80">Disables mDNS — breaks AirDrop, AirPlay receiving, some HomeKit.</p>
                </div>
              )}

              {/* Max warning */}
              {profileName === 'max' && (
                <div className="bg-amber-950/40 border border-amber-900/60 rounded-lg p-3">
                  <p className="text-amber-300/90 text-xs flex items-center gap-1.5">
                    <AlertTriangle size={12} className="flex-shrink-0" />
                    May affect AirPlay receiving and location features.
                  </p>
                </div>
              )}

              {/* Toggle list */}
              {profileDef.toggles.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">
                    {profileName === 'default' ? 'Restores defaults for' : 'Will change'} ({profileDef.toggles.length})
                  </p>
                  <div className="space-y-1">
                    {profileDef.toggles.map(t => (
                      <div key={t.id} className="flex items-center justify-between text-xs py-1 border-b border-slate-800 last:border-0">
                        <span className="text-slate-300">{t.name}</span>
                        <span className="flex items-center gap-1 text-slate-500 flex-shrink-0">
                          <span className={t.from === 'on' ? 'text-green-400' : 'text-slate-500'}>{t.from}</span>
                          <ArrowRight size={10} />
                          <span className={t.to === 'on' ? 'text-green-400' : 'text-slate-400'}>{t.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Hyper confirmation input */}
              {isHyper && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs text-slate-400">
                    Type <code className="bg-slate-800 px-1.5 py-0.5 rounded text-red-300 font-mono">HYPER</code> to unlock Apply:
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
                      'w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm font-mono',
                      'focus:outline-none transition-colors duration-150',
                      confirmInput === 'HYPER'
                        ? 'border-red-600 text-red-300'
                        : confirmInput.length > 0
                          ? 'border-slate-600 text-slate-400'
                          : 'border-slate-700 text-slate-100',
                    ].join(' ')}
                  />
                </div>
              )}
            </>
          )}

          {/* ── APPLYING: spinner ── */}
          {applying && (
            <div className="flex items-center justify-center gap-3 py-6 text-slate-400">
              <Loader2 size={18} className="animate-spin text-blue-400" />
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
                  ? 'bg-green-950/50 border border-green-900 text-green-300'
                  : 'bg-red-950/50 border border-red-900 text-red-300',
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
                  !r.success ? 'bg-red-950/30' : '',
                ].join(' ')}>
                  {r.success
                    ? <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                    : <XCircle      size={12} className="text-red-400 flex-shrink-0" />
                  }
                  <span className={r.success ? 'text-slate-300 flex-1' : 'text-red-300 flex-1'}>
                    {r.name ?? r.toggle_id}
                  </span>
                  {r.old_state && (
                    <span className="text-slate-600 flex-shrink-0 flex items-center gap-1">
                      <span className={r.old_state === 'on' ? 'text-green-500/60' : 'text-slate-600'}>{r.old_state}</span>
                      <ArrowRight size={9} className="text-slate-700" />
                      <span className={r.new_state === 'on' ? 'text-green-400' : 'text-slate-400'}>{r.new_state}</span>
                    </span>
                  )}
                </div>
              ))}

              {hasRestartRequired && (
                <p className="text-xs text-yellow-400/80 flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800">
                  <Zap size={11} /> Some changes need a logout/restart to fully take effect.
                </p>
              )}
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400 font-mono break-all">{error}</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
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
                'transition-colors duration-150 flex items-center gap-2',
                meta.btnCls,
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
