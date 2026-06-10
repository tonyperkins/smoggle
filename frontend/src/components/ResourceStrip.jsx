/**
 * ResourceStrip.jsx — Pinned resource monitor strip fed by SSE data.
 * Collapsed: CPU sparkline, MEM bar, SWAP, inference server pills.
 * Expanded: CPU user/sys/idle breakdown, memory pressure breakdown, top processes.
 */
import React, { useState } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { AlertTriangle, ChevronDown, ChevronUp, X, Skull } from 'lucide-react'

function Divider() {
  return <div className="w-px h-5 bg-slate-700 flex-shrink-0" />
}

function ServerPill({ name, running, pid }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border
        ${running
          ? 'bg-green-950 border-green-800 text-green-300'
          : 'bg-slate-800 border-slate-700 text-slate-500'
        }`}
      title={running && pid ? `PID ${pid}` : undefined}
    >
      {running
        ? <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
        : <span className="w-1.5 h-1.5 rounded-full border border-slate-500 flex-shrink-0" />
      }
      {name}
    </span>
  )
}

function MiniBar({ value, max, color = 'bg-blue-500', className = '' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={`h-1.5 bg-slate-700 rounded-full overflow-hidden ${className}`}>
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function MemRow({ label, value, total, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs w-24 flex-shrink-0">{label}</span>
      <MiniBar value={value} max={total} color={color} className="flex-1" />
      <span className="font-mono text-xs text-slate-300 w-14 text-right flex-shrink-0">{value.toFixed(1)} GB</span>
    </div>
  )
}

function CpuBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 text-xs w-10 flex-shrink-0">{label}</span>
      <MiniBar value={value} max={100} color={color} className="flex-1" />
      <span className="font-mono text-xs text-slate-300 w-12 text-right flex-shrink-0">{value.toFixed(1)}%</span>
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
  const [sortBy, setSortBy]       = useState('rss')   // 'rss' | 'cpu'
  const [killing, setKilling]     = useState(null)     // pid being killed
  const [killError, setKillError] = useState(null)
  const [killSuccess, setKillSuccess] = useState(null)  // last killed proc name

  const {
    cpu_percent = 0,
    cpu_user = 0,
    cpu_sys = 0,
    cpu_idle = 100,
    memory_used_gb = 0,
    memory_total_gb = 0,
    memory_active_gb = 0,
    memory_wired_gb = 0,
    memory_compressed_gb = 0,
    memory_inactive_gb = 0,
    memory_free_gb = 0,
    swap_used_gb = 0,
    top_procs_by_rss = [],
    top_procs_by_cpu = [],
    inference_servers = [],
    cpuHistory = [],
  } = stats ?? {}

  const top_procs = sortBy === 'rss' ? top_procs_by_rss : top_procs_by_cpu

  async function killProc(pid, force = false) {
    if (!targetId) return
    setKilling(pid)
    setKillError(null)
    setKillSuccess(null)
    try {
      const res = await fetch(`/api/targets/${targetId}/kill/${pid}?force=${force}`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        setKillError(body.detail ?? 'Kill failed')
      } else {
        setKillSuccess(`Sent ${body.signal} to ${body.process} (PID ${body.pid})`)
        setTimeout(() => setKillSuccess(null), 4000)
      }
    } catch {
      setKillError('Network error')
    } finally {
      setKilling(null)
    }
  }

  const ollama = inference_servers.find(s => s.name === 'ollama')
  const mlx    = inference_servers.find(s => s.name === 'mlx_lm')
  const bothRunning = ollama?.running === true && mlx?.running === true
  const chartData = cpuHistory.map((v, i) => ({ i, v }))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">

      {/* ── Collapsed summary row ── */}
      <div className="flex items-center gap-3 px-4 py-2 flex-wrap">

        {/* CPU + sparkline */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">CPU</span>
          <span className="font-mono text-slate-100 text-sm w-12 text-right">{cpu_percent.toFixed(1)}%</span>
          <div className="w-20 h-7">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
                <defs>
                  <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="#3b82f6" fill="url(#cpuGrad)"
                  strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <Divider />

        {/* Memory */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">MEM</span>
          <span className="font-mono text-sm text-slate-100">
            {memory_used_gb.toFixed(1)}
            <span className="text-slate-500 text-xs">/{memory_total_gb.toFixed(0)} GB</span>
          </span>
          {memory_total_gb > 0 && (
            <MiniBar value={memory_used_gb} max={memory_total_gb} className="w-16" />
          )}
        </div>

        <Divider />

        {/* Swap */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">SWAP</span>
          <span className={`font-mono text-sm ${swap_used_gb > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}`}>
            {swap_used_gb > 0 ? `${swap_used_gb.toFixed(2)} GB` : '0'}
          </span>
          {swap_used_gb > 0 && <span className="text-xs text-red-400">⚠</span>}
        </div>

        <Divider />

        {/* Inference server pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <ServerPill name="Ollama" running={ollama?.running ?? false} pid={ollama?.pid} />
          <ServerPill name="MLX"    running={mlx?.running   ?? false} pid={mlx?.pid}    />
          {bothRunning && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                             bg-amber-950 border border-amber-700 text-amber-300">
              <AlertTriangle size={11} className="flex-shrink-0" />
              Both servers running
            </span>
          )}
        </div>

        {/* Expand toggle — pushed to the right */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="ml-auto p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors flex-shrink-0"
          title={expanded ? 'Hide details' : 'Show details'}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* CPU breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">CPU</p>
            <CpuBar label="User" value={cpu_user} color="bg-blue-500" />
            <CpuBar label="Sys"  value={cpu_sys}  color="bg-violet-500" />
            <CpuBar label="Idle" value={cpu_idle} color="bg-slate-600" />
          </div>

          {/* Memory pressure breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Memory Pressure</p>
            <MemRow label="Active"     value={memory_active_gb}     total={memory_total_gb} color="bg-blue-500" />
            <MemRow label="Wired"      value={memory_wired_gb}      total={memory_total_gb} color="bg-violet-500" />
            <MemRow label="Compressed" value={memory_compressed_gb} total={memory_total_gb} color="bg-amber-500" />
            <MemRow label="Inactive"   value={memory_inactive_gb}   total={memory_total_gb} color="bg-slate-500" />
            <MemRow label="Free"       value={memory_free_gb}       total={memory_total_gb} color="bg-green-600" />
            {swap_used_gb > 0 && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-700">
                <span className="text-red-400 text-xs font-medium">⚠ Swap in use:</span>
                <span className="font-mono text-xs text-red-300">{swap_used_gb.toFixed(2)} GB</span>
              </div>
            )}
          </div>

          {/* Top processes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Top Processes</p>
              <div className="flex items-center gap-1 bg-slate-700/60 rounded p-0.5">
                <button
                  onClick={() => setSortBy('rss')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${sortBy === 'rss' ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                >RSS</button>
                <button
                  onClick={() => setSortBy('cpu')}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${sortBy === 'cpu' ? 'bg-slate-600 text-slate-100' : 'text-slate-500 hover:text-slate-300'}`}
                >CPU</button>
              </div>
            </div>
            {killSuccess && (
              <p className="text-green-400 text-xs mb-1.5 font-mono">✓ {killSuccess}</p>
            )}
            {killError && (
              <p className="text-red-400 text-xs mb-1.5 font-mono">{killError}</p>
            )}
            {top_procs.length === 0 ? (
              <p className="text-slate-600 text-xs">No data</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-500">
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
                      <tr key={p.pid} className="border-t border-slate-700/50 group">
                        <td className="py-0.5 pr-2 font-mono text-slate-300 max-w-[110px]" title={`PID ${p.pid}${p.children ? ` + ${p.children} children` : ''}`}>
                          <span className="truncate block">{p.name}</span>
                          {p.children > 0 && (
                            <span className="text-slate-600 text-[10px] leading-none">+{p.children}</span>
                          )}
                        </td>
                        <td className={`py-0.5 pr-2 text-right font-mono tabular-nums ${p.cpu > 20 ? 'text-amber-400' : p.cpu > 5 ? 'text-slate-200' : 'text-slate-500'}`}>
                          {p.cpu.toFixed(1)}
                        </td>
                        <td className="py-0.5 pr-1 text-right font-mono tabular-nums text-slate-400">
                          {p.rss_mb >= 1024
                            ? `${(p.rss_mb / 1024).toFixed(1)}G`
                            : `${p.rss_mb.toFixed(0)}M`}
                        </td>
                        <td className="py-0.5 text-right">
                          {!isProtected && targetId && (
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-all">
                              <button
                                onClick={() => killProc(p.pid, false)}
                                disabled={isKilling}
                                title={`Quit ${p.name} (graceful)`}
                                className="p-0.5 rounded text-slate-500 hover:text-amber-400 hover:bg-amber-950/40 transition-colors disabled:opacity-50"
                              >
                                {isKilling ? <Skull size={11} className="animate-pulse text-red-400" /> : <X size={11} />}
                              </button>
                              <button
                                onClick={() => killProc(p.pid, true)}
                                disabled={isKilling}
                                title={`Force kill ${p.name} (SIGKILL — cannot be ignored)`}
                                className="p-0.5 rounded text-slate-500 hover:text-red-500 hover:bg-red-950/60 transition-colors disabled:opacity-50"
                              >
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
    </div>
  )
}
