/**
 * ResourceStrip.jsx — "Live Resources" panel fed by SSE data.
 * Collapsed: CPU / Memory / Swap rows. Detail: CPU + memory-pressure breakdown
 * and a killable top-processes table.
 */
import React, { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { ChevronDown, ChevronUp, X, Skull } from 'lucide-react'

const SPARK = '#2FBF71'

function Bar({ value, max, tone = 'accent' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  const fill = tone === 'warn' ? 'bg-warn' : tone === 'danger' ? 'bg-danger' : 'bg-accent'
  return (
    <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
      <div className={`h-full ${fill} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MemRow({ label, value, total, tone = 'accent' }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-faint text-xs w-24 flex-shrink-0">{label}</span>
      <Bar value={value} max={total} tone={tone} />
      <span className="font-mono text-xs text-ink-muted w-14 text-right flex-shrink-0">{value.toFixed(1)} GB</span>
    </div>
  )
}

function CpuBar({ label, value }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-faint text-xs w-10 flex-shrink-0">{label}</span>
      <Bar value={value} max={100} />
      <span className="font-mono text-xs text-ink-muted w-12 text-right flex-shrink-0">{value.toFixed(1)}%</span>
    </div>
  )
}

const PROTECTED = new Set([
  'kernel_task','launchd','WindowServer','loginwindow','sshd',
  'mds','mds_stores','mDNSResponder','configd','coreaudiod',
  'coreaudiolicensed','opendirectoryd','diskarbitrationd',
  'securityd','trustd','logd','notifyd','watchdogd',
  'SystemUIServer','Dock','Finder',
])

export default function ResourceStrip({ stats, targetId }) {
  const [expanded, setExpanded]   = useState(false)
  const [sortBy, setSortBy]       = useState('rss')
  const [killing, setKilling]     = useState(null)
  const [killError, setKillError] = useState(null)
  const [killSuccess, setKillSuccess] = useState(null)

  const {
    cpu_percent = 0, cpu_user = 0, cpu_sys = 0, cpu_idle = 100,
    memory_used_gb = 0, memory_total_gb = 0,
    memory_active_gb = 0, memory_wired_gb = 0, memory_compressed_gb = 0,
    memory_inactive_gb = 0, memory_free_gb = 0,
    swap_used_gb = 0,
    top_procs_by_rss = [], top_procs_by_cpu = [],
    cpuHistory = [],
  } = stats ?? {}

  const top_procs = sortBy === 'rss' ? top_procs_by_rss : top_procs_by_cpu

  async function killProc(pid, force = false) {
    if (!targetId) return
    setKilling(pid); setKillError(null); setKillSuccess(null)
    try {
      const res = await fetch(`/api/targets/${targetId}/kill/${pid}?force=${force}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) setKillError(body.detail ?? 'Kill failed')
      else {
        setKillSuccess(`Sent ${body.signal} to ${body.process} (PID ${body.pid})`)
        setTimeout(() => setKillSuccess(null), 4000)
      }
    } catch { setKillError('Network error') }
    finally { setKilling(null) }
  }

  const chartData = cpuHistory.map((v, i) => ({ i, v }))

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Live Resources</p>
        <button
          onClick={() => setExpanded(e => !e)}
          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition-colors"
        >
          Detail {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* CPU */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-muted w-16 flex-shrink-0">CPU</span>
        <Bar value={cpu_percent} max={100} />
        <div className="w-16 h-6 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={SPARK} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={SPARK} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={SPARK} fill="url(#cpuGrad)"
                strokeWidth={1.5} dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <span className="font-mono text-sm text-ink w-14 text-right flex-shrink-0">{cpu_percent.toFixed(1)}%</span>
      </div>

      {/* Memory */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-muted w-16 flex-shrink-0">Memory</span>
        <Bar value={memory_used_gb} max={memory_total_gb} />
        <span className="font-mono text-sm text-ink w-[5.5rem] text-right flex-shrink-0">
          {memory_used_gb.toFixed(1)}
          <span className="text-ink-faint"> / {memory_total_gb.toFixed(0)} GB</span>
        </span>
      </div>

      {/* Swap */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-ink-muted w-16 flex-shrink-0 inline-flex items-center gap-1">
          Swap {swap_used_gb > 0 && <span className="text-warn">⚠</span>}
        </span>
        <Bar value={swap_used_gb} max={Math.max(memory_total_gb * 0.25, swap_used_gb, 1)} tone={swap_used_gb > 0 ? 'warn' : 'accent'} />
        <span className={`font-mono text-sm w-[5.5rem] text-right flex-shrink-0 ${swap_used_gb > 0 ? 'text-warn font-semibold' : 'text-ink-faint'}`}>
          {swap_used_gb > 0 ? `${swap_used_gb.toFixed(2)} GB` : '0'}
        </span>
      </div>

      {/* Detail */}
      {expanded && (
        <div className="border-t border-line pt-3.5 mt-1 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* CPU + memory pressure */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">CPU</p>
              <CpuBar label="User" value={cpu_user} />
              <CpuBar label="Sys"  value={cpu_sys} />
              <CpuBar label="Idle" value={cpu_idle} />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-1">Memory pressure</p>
              <MemRow label="Active"     value={memory_active_gb}     total={memory_total_gb} />
              <MemRow label="Wired"      value={memory_wired_gb}      total={memory_total_gb} />
              <MemRow label="Compressed" value={memory_compressed_gb} total={memory_total_gb} tone="warn" />
              <MemRow label="Inactive"   value={memory_inactive_gb}   total={memory_total_gb} />
              <MemRow label="Free"       value={memory_free_gb}       total={memory_total_gb} />
            </div>
          </div>

          {/* Top processes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-muted uppercase tracking-wider">Top processes</p>
              <div className="flex items-center gap-0.5 bg-surface-2 rounded-md p-0.5">
                {['rss', 'cpu'].map(k => (
                  <button key={k} onClick={() => setSortBy(k)}
                    className={`text-xs px-2 py-0.5 rounded transition-colors ${sortBy === k ? 'bg-surface text-ink' : 'text-ink-faint hover:text-ink-muted'}`}
                  >{k.toUpperCase()}</button>
                ))}
              </div>
            </div>
            {killSuccess && <p className="text-accent-ink text-xs mb-1.5 font-mono">✓ {killSuccess}</p>}
            {killError && <p className="text-danger text-xs mb-1.5 font-mono">{killError}</p>}
            {top_procs.length === 0 ? (
              <p className="text-ink-faint text-xs">No data</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-faint">
                    <th className="text-left font-medium pb-1 pr-2">Process</th>
                    <th className="text-right font-medium pb-1 pr-2 w-12">CPU%</th>
                    <th className="text-right font-medium pb-1 w-14">RSS</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {top_procs.map((p) => {
                    const isProtected = PROTECTED.has(p.name)
                    const isKilling = killing === p.pid
                    return (
                      <tr key={p.pid} className="border-t border-line group">
                        <td className="py-0.5 pr-2 font-mono text-ink-muted max-w-[110px]" title={`PID ${p.pid}`}>
                          <span className="truncate block">{p.name}</span>
                          {p.children > 0 && <span className="text-ink-faint text-[10px] leading-none">+{p.children}</span>}
                        </td>
                        <td className={`py-0.5 pr-2 text-right font-mono tabular-nums ${p.cpu > 20 ? 'text-warn' : p.cpu > 5 ? 'text-ink' : 'text-ink-faint'}`}>
                          {p.cpu.toFixed(1)}
                        </td>
                        <td className="py-0.5 pr-1 text-right font-mono tabular-nums text-ink-muted">
                          {p.rss_mb >= 1024 ? `${(p.rss_mb / 1024).toFixed(1)}G` : `${p.rss_mb.toFixed(0)}M`}
                        </td>
                        <td className="py-0.5 text-right">
                          {!isProtected && targetId && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                              <button onClick={() => killProc(p.pid, false)} disabled={isKilling}
                                title={`Quit ${p.name}`}
                                className="p-0.5 rounded text-ink-faint hover:text-warn transition-colors disabled:opacity-50">
                                {isKilling ? <Skull size={11} className="animate-pulse text-danger" /> : <X size={11} />}
                              </button>
                              <button onClick={() => killProc(p.pid, true)} disabled={isKilling}
                                title={`Force kill ${p.name}`}
                                className="p-0.5 rounded text-ink-faint hover:text-danger transition-colors disabled:opacity-50">
                                <Skull size={11} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
