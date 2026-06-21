/**
 * StatusHero.jsx — leads the dashboard with the answer to "am I optimized?":
 * how many background services are trimmed, an estimate of memory reclaimed for
 * inference, and which inference servers are live. All values are derived from
 * existing toggle/resource data — display only.
 */
import React from 'react'

// Rough per-service memory weight (GB) by impact, for the "reclaimed" estimate.
function weight(impact = '') {
  const i = impact.toUpperCase()
  if (i.startsWith('HIGH') || i.startsWith('CRITICAL')) return 0.6
  if (i.startsWith('MEDIUM') || i.startsWith('LOW-MED')) return 0.25
  return 0.1
}

const HEADLINE = {
  default: 'Apple defaults restored',
  performance: 'Performance profile active',
  max: 'Max profile active',
  hyper: 'Hyper profile active',
}

function ServerChip({ name, running }) {
  return (
    <span className={[
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
      running ? 'border-accent/40 bg-accent-soft text-accent-ink' : 'border-line text-ink-faint',
    ].join(' ')}>
      <span className={`w-1.5 h-1.5 rounded-full ${running ? 'bg-accent' : 'border border-ink-faint'}`} />
      {name} · {running ? 'live' : 'idle'}
    </span>
  )
}

export default function StatusHero({ toggles = [], stats = {}, activeTarget, activeProfile, onRestoreDefaults }) {
  // "Background services" = the things that are on by default and can be trimmed.
  const services = toggles.filter(t => t.default_state === 'on' && t.live_state !== 'unsupported')
  const trimmed = services.filter(t => t.live_state === 'off')
  const total = services.length
  const trimmedCount = trimmed.length

  const reclaimed = trimmed.reduce((sum, t) => sum + weight(t.impact), 0)
  const maxReclaim = services.reduce((sum, t) => sum + weight(t.impact), 0) || 1
  const reclaimPct = Math.min(100, (reclaimed / maxReclaim) * 100)

  const highPower = toggles.find(t => t.id === 'high_power_mode')?.live_state === 'on'
  const powerLabel = highPower ? 'high power' : 'standard power'

  const eyebrow = trimmedCount === 0 ? 'Baseline' : (activeProfile ? `${activeProfile} profile` : 'Custom tuning')
  const headline = (activeProfile && HEADLINE[activeProfile]) ||
    (trimmedCount === 0 ? 'Apple defaults restored' : 'Tuned for inference')

  const servers = stats.inference_servers ?? []
  const ollama = servers.find(s => s.name === 'ollama')
  const mlx = servers.find(s => s.name === 'mlx_lm')
  const ramGb = stats.memory_total_gb ? Math.round(stats.memory_total_gb) : null

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-accent" />
            {eyebrow}
          </p>
          <h1 className="text-2xl font-bold text-ink mt-1.5 tracking-tight">{headline}</h1>
          <p className="text-sm text-ink-muted mt-1">
            {trimmedCount} of {total} background services trimmed · {powerLabel}
          </p>
        </div>
        {(activeTarget?.macos_version || ramGb) && (
          <p className="text-xs text-ink-faint font-mono whitespace-nowrap flex-shrink-0">
            {activeTarget?.macos_version ? `macOS ${activeTarget.macos_version}` : ''}
            {activeTarget?.macos_version && ramGb ? ' · ' : ''}
            {ramGb ? `${ramGb} GB` : ''}
          </p>
        )}
      </div>

      {/* Reclaimed-for-inference meter */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-ink-muted">Reclaimed for inference</span>
          <span className="font-mono font-semibold text-accent-ink">~{reclaimed.toFixed(1)} GB</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div className="h-full rounded-full bg-accent transition-all duration-500"
               style={{ width: `${reclaimPct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <ServerChip name="Ollama" running={ollama?.running ?? false} />
          <ServerChip name="MLX" running={mlx?.running ?? false} />
        </div>
        <button
          onClick={onRestoreDefaults}
          disabled={!onRestoreDefaults}
          className="text-sm font-medium px-3.5 py-1.5 rounded-lg border border-line bg-surface
                     hover:bg-surface-2 text-ink transition-colors disabled:opacity-40"
        >
          Restore defaults
        </button>
      </div>
    </section>
  )
}
