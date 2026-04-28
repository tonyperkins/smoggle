/**
 * Dashboard.jsx — Main layout: sticky ResourceStrip + toggle grid.
 *
 * Layout: top navbar → [left sidebar | main content]
 * SSH error: red banner shown when SSE connection drops, auto-hides on reconnect.
 */
import React, { useRef, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Settings, BookOpen, History as HistoryIcon, AlertCircle, Loader2, PauseCircle, PlayCircle } from 'lucide-react'
import { useTarget } from '../App.jsx'
import MacSelector from '../components/MacSelector.jsx'
import ConnectionBadge from '../components/ConnectionBadge.jsx'
import ResourceStrip from '../components/ResourceStrip.jsx'
import ToggleCard from '../components/ToggleCard.jsx'
import ProfileSidebar from '../components/ProfileSidebar.jsx'
import SnapshotPanel from '../components/SnapshotPanel.jsx'
import { useSSE } from '../hooks/useSSE.js'
import { useToggles } from '../hooks/useToggles.js'

export default function Dashboard() {
  const { activeTargetId } = useTarget()
  const [paused, setPaused] = useState(false)
  const sseStats = useSSE(activeTargetId, paused)
  const { toggles, loading, error: toggleError, applyToggle, refetch } = useToggles(activeTargetId)

  async function handlePauseToggle() {
    if (!paused) {
      // Pause: close SSE (handled by useSSE) and drop the SSH pool connection
      setPaused(true)
      if (activeTargetId) {
        fetch(`/api/targets/${activeTargetId}/disconnect`, { method: 'POST' }).catch(() => {})
      }
    } else {
      // Resume: re-enable SSE and refetch toggle states
      setPaused(false)
      refetch()
    }
  }

  // CPU sparkline: rolling 60-point history
  const cpuHistoryRef = useRef([])
  if (typeof sseStats.cpu_percent === 'number') {
    cpuHistoryRef.current = [...cpuHistoryRef.current.slice(-59), sseStats.cpu_percent]
  }

  // SSE connection status → navbar badge
  const connStatus = activeTargetId
    ? (sseStats.connected ? 'connected' : sseStats.error ? 'disconnected' : 'checking')
    : 'checking'

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">

      {/* ── Navbar ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 sticky top-0 z-30 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold text-base tracking-tight text-white flex-shrink-0">Smoggle</span>
          <MacSelector />
          <ConnectionBadge status={connStatus} />
        </div>
        <nav className="flex items-center gap-1 flex-shrink-0">
          {activeTargetId && (
            <button
              onClick={handlePauseToggle}
              title={paused ? 'Resume SSH connection' : 'Pause — disconnect SSH and stop all polling'}
              className={[
                'p-1.5 rounded transition-colors',
                paused
                  ? 'text-amber-400 hover:text-amber-300 hover:bg-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700',
              ].join(' ')}
            >
              {paused ? <PlayCircle size={17} /> : <PauseCircle size={17} />}
            </button>
          )}
          <Link to="/history" title="History"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <HistoryIcon size={17} />
          </Link>
          <Link to="/setup" title="Setup Guide"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <BookOpen size={17} />
          </Link>
          <Link to="/settings" title="Settings"
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
            <Settings size={17} />
          </Link>
        </nav>
      </header>

      {/* ── SSH error banner ── */}
      {paused && activeTargetId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-950/60 border-b border-amber-800 text-amber-300 text-xs">
          <PauseCircle size={14} className="flex-shrink-0" />
          Paused — SSH disconnected. Click <PlayCircle size={12} className="inline mx-1" /> to resume.
        </div>
      )}
      {!paused && sseStats.error && activeTargetId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-950 border-b border-red-800 text-red-300 text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          SSH connection lost — retrying…
          <Link to="/setup" className="underline ml-1 hover:text-red-200">Setup Guide</Link>
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Left sidebar ── */}
        <aside className="w-52 flex-shrink-0 bg-slate-800 border-r border-slate-700
                          flex flex-col gap-5 p-3 overflow-y-auto">
          <ProfileSidebar targetId={activeTargetId} onApplied={refetch} />
          <div className="border-t border-slate-700" />
          <SnapshotPanel targetId={activeTargetId} />
          <div className="mt-auto border-t border-slate-700 pt-3 flex flex-col gap-0.5">
            <Link to="/settings"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-400
                         hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <Settings size={14} /> Settings
            </Link>
            <Link to="/setup"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-400
                         hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <BookOpen size={14} /> Setup Guide
            </Link>
            <Link to="/history"
              className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-slate-400
                         hover:bg-slate-700 hover:text-slate-200 transition-colors">
              <HistoryIcon size={14} /> History
            </Link>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto flex flex-col min-w-0">

          {/* Resource strip — sticky inside main scroll area */}
          <div className="sticky top-0 z-20 bg-slate-900 px-4 pt-3 pb-2 border-b border-slate-800">
            <ResourceStrip stats={{ ...sseStats, cpuHistory: cpuHistoryRef.current }} />
          </div>

          {/* Toggle grid */}
          <div className="p-4 flex flex-col gap-3 flex-1">
            {!activeTargetId && (
              <p className="text-slate-500 text-sm">Select a target Mac to view toggles.</p>
            )}

            {activeTargetId && loading && (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 size={15} className="animate-spin" /> Loading toggle states…
              </div>
            )}

            {activeTargetId && !loading && toggleError && (
              <div className="flex items-center gap-2 text-red-400 text-sm">
                <AlertCircle size={15} /> {toggleError}
              </div>
            )}

            {activeTargetId && !loading && !toggleError && toggles.length === 0 && (
              <p className="text-slate-500 text-sm">
                No toggle data returned. Check SSH connection in{' '}
                <Link to="/setup" className="text-blue-400 hover:underline">Setup Guide</Link>.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {toggles.map(t => (
                <ToggleCard key={t.id} toggle={t} onApply={applyToggle} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
