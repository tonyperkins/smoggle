/**
 * ResourceStrip.jsx — Pinned resource monitor strip fed by SSE data.
 *
 * Inference server pills:
 *   - "Ollama ●" green  / "Ollama ○" gray
 *   - "MLX ●"   green  / "MLX ○"   gray
 *   - Amber ⚠ warning pill when BOTH ollama.running AND mlx_lm.running are true
 */
import React from 'react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'
import { AlertTriangle } from 'lucide-react'

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

export default function ResourceStrip({ stats }) {
  const {
    cpu_percent = 0,
    memory_used_gb = 0,
    memory_total_gb = 0,
    swap_used_gb = 0,
    inference_servers = [],
    cpuHistory = [],
  } = stats ?? {}

  const ollama = inference_servers.find(s => s.name === 'ollama')
  const mlx    = inference_servers.find(s => s.name === 'mlx_lm')

  // Amber warning fires only when BOTH are running simultaneously
  const bothRunning = ollama?.running === true && mlx?.running === true

  const chartData = cpuHistory.map((v, i) => ({ i, v }))

  return (
    <div className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 flex-wrap">

      {/* CPU + sparkline */}
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">CPU</span>
        <span className="font-mono text-slate-100 text-sm w-12 text-right">
          {cpu_percent.toFixed(1)}%
        </span>
        <div className="w-20 h-7">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 1, right: 0, left: 0, bottom: 1 }}>
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke="#3b82f6"
                fill="url(#cpuGrad)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
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
          <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, (memory_used_gb / memory_total_gb) * 100).toFixed(1)}%` }}
            />
          </div>
        )}
      </div>

      <Divider />

      {/* Swap — red if any swap in use, green if zero */}
      <div className="flex items-center gap-1.5">
        <span className="text-slate-400 text-xs font-medium uppercase tracking-wide">SWAP</span>
        <span className={`font-mono text-sm ${swap_used_gb > 0 ? 'text-red-400 font-semibold' : 'text-green-400'}`}>
          {swap_used_gb > 0 ? `${swap_used_gb.toFixed(2)} GB` : '0'}
        </span>
        {swap_used_gb > 0 && (
          <span className="text-xs text-red-400 font-medium">⚠</span>
        )}
      </div>

      <Divider />

      {/* Inference servers */}
      <div className="flex items-center gap-2 flex-wrap">
        <ServerPill name="Ollama" running={ollama?.running ?? false} pid={ollama?.pid} />
        <ServerPill name="MLX"    running={mlx?.running   ?? false} pid={mlx?.pid}    />

        {/* Amber warning — only shown when BOTH are simultaneously running */}
        {bothRunning && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold
                           bg-amber-950 border border-amber-700 text-amber-300">
            <AlertTriangle size={11} className="flex-shrink-0" />
            Memory pressure — both servers running
          </span>
        )}
      </div>

    </div>
  )
}
