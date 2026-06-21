/**
 * Dashboard.jsx — header → [profiles/snapshots sidebar | status hero + live
 * resources + background-services grid].
 */
import React, { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Settings, BookOpen, History as HistoryIcon, AlertCircle, Loader2,
  PauseCircle, PlayCircle, Sun, Moon, Search, Zap,
} from 'lucide-react'
import { useTarget } from '../App.jsx'
import MacSelector from '../components/MacSelector.jsx'
import ResourceStrip from '../components/ResourceStrip.jsx'
import ToggleCard from '../components/ToggleCard.jsx'
import ProfileSidebar from '../components/ProfileSidebar.jsx'
import SnapshotPanel from '../components/SnapshotPanel.jsx'
import StatusHero from '../components/StatusHero.jsx'
import ProfileModal from '../components/ProfileModal.jsx'
import { useSSE } from '../hooks/useSSE.js'
import { useToggles } from '../hooks/useToggles.js'
import { detectActiveProfile } from '../lib/profiles.js'

function IconBtn({ children, onClick, title, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'p-2 rounded-lg border border-line transition-colors',
        active ? 'text-warn bg-surface-2' : 'text-ink-muted hover:text-ink hover:bg-surface-2',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export default function Dashboard() {
  const { activeTargetId, targets, isMacosSupported, supportedMacos, theme, toggleTheme } = useTarget()
  const activeTarget = targets.find(t => t.id === activeTargetId)
  const macosUnsupported =
    activeTarget?.macos_version && !isMacosSupported(activeTarget.macos_version)
  const [paused, setPaused] = useState(false)
  const [filter, setFilter] = useState('')
  const [profileToApply, setProfileToApply] = useState(null)
  const sseStats = useSSE(activeTargetId, paused)
  const { toggles, loading, error: toggleError, applyToggle, refetch } = useToggles(activeTargetId)

  async function handlePauseToggle() {
    if (!paused) {
      setPaused(true)
      if (activeTargetId) {
        fetch(`/api/targets/${activeTargetId}/disconnect`, { method: 'POST' }).catch(() => {})
      }
    } else {
      setPaused(false)
      refetch()
    }
  }

  const cpuHistoryRef = useRef([])
  if (typeof sseStats.cpu_percent === 'number') {
    cpuHistoryRef.current = [...cpuHistoryRef.current.slice(-59), sseStats.cpu_percent]
  }

  const liveById = Object.fromEntries(toggles.map(t => [t.id, t.live_state]))
  const activeProfile = toggles.length ? detectActiveProfile(liveById) : null

  const services = toggles.filter(t => t.default_state === 'on' && t.live_state !== 'unsupported')
  const trimmedCount = services.filter(t => t.live_state === 'off').length

  const q = filter.trim().toLowerCase()
  const visibleToggles = q
    ? toggles.filter(t => t.name.toLowerCase().includes(q) || t.id.includes(q))
    : toggles

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">

      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-bg border-b border-line sticky top-0 z-30 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-2 flex-shrink-0">
            <span className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
              <Zap size={16} className="text-white" fill="currentColor" />
            </span>
            <span className="font-bold text-base tracking-tight text-ink">Smoggle</span>
          </span>
          <MacSelector />
        </div>
        <nav className="flex items-center gap-1.5 flex-shrink-0">
          <IconBtn onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </IconBtn>
          {activeTargetId && (
            <IconBtn onClick={handlePauseToggle} active={paused}
              title={paused ? 'Resume SSH connection' : 'Pause — disconnect SSH and stop polling'}>
              {paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            </IconBtn>
          )}
          <Link to="/history" title="History"><IconBtn><HistoryIcon size={16} /></IconBtn></Link>
          <Link to="/setup" title="Setup Guide"><IconBtn><BookOpen size={16} /></IconBtn></Link>
          <Link to="/settings" title="Settings"><IconBtn><Settings size={16} /></IconBtn></Link>
        </nav>
      </header>

      {/* ── Banners ── */}
      {paused && activeTargetId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warn-soft border-b border-warn/40 text-warn text-xs">
          <PauseCircle size={14} className="flex-shrink-0" />
          Paused — SSH disconnected. Resume to continue.
        </div>
      )}
      {!paused && sseStats.error && activeTargetId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-danger-soft border-b border-danger/40 text-danger text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          SSH connection lost — retrying…
          <Link to="/setup" className="underline ml-1">Setup Guide</Link>
        </div>
      )}
      {macosUnsupported && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warn-soft border-b border-warn/40 text-warn text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          macOS {activeTarget.macos_version} is outside Smoggle's tested range
          ({supportedMacos?.tested_macos_label || 'macOS 14 (Sonoma)'}). Toggles may report state incorrectly.
        </div>
      )}

      <div className="flex flex-1 min-h-0">

        {/* ── Sidebar ── */}
        <aside className="w-56 flex-shrink-0 border-r border-line flex flex-col gap-5 p-3 overflow-y-auto">
          <ProfileSidebar targetId={activeTargetId} toggles={toggles} onPick={setProfileToApply} />
          <SnapshotPanel targetId={activeTargetId} />
        </aside>

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto min-w-0 p-4 flex flex-col gap-4">

          {/* Hero + resources */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-3">
              <StatusHero
                toggles={toggles}
                stats={sseStats}
                activeTarget={activeTarget}
                activeProfile={activeProfile}
                onRestoreDefaults={activeTargetId ? () => setProfileToApply('default') : undefined}
              />
            </div>
            <div className="lg:col-span-2">
              <ResourceStrip stats={{ ...sseStats, cpuHistory: cpuHistoryRef.current }} targetId={activeTargetId} />
            </div>
          </div>

          {/* Services */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-base font-bold text-ink flex items-center gap-2">
              Background Services
              {services.length > 0 && (
                <span className="text-xs font-medium text-ink-faint">{trimmedCount}/{services.length} trimmed</span>
              )}
            </h2>
            {toggles.length > 0 && (
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  value={filter}
                  onChange={e => setFilter(e.target.value)}
                  placeholder="Filter services"
                  className="bg-surface border border-line rounded-lg pl-8 pr-3 py-1.5 text-sm text-ink
                             placeholder-ink-faint focus:outline-none focus:border-accent w-48"
                />
              </div>
            )}
          </div>

          {!activeTargetId && (
            <p className="text-ink-faint text-sm">Select a target Mac to view services.</p>
          )}
          {activeTargetId && loading && (
            <div className="flex items-center gap-2 text-ink-faint text-sm">
              <Loader2 size={15} className="animate-spin" /> Loading service states…
            </div>
          )}
          {activeTargetId && !loading && toggleError && (
            <div className="flex items-center gap-2 text-danger text-sm">
              <AlertCircle size={15} /> {toggleError}
            </div>
          )}
          {activeTargetId && !loading && !toggleError && toggles.length === 0 && (
            <p className="text-ink-faint text-sm">
              No service data returned. Check the SSH connection in{' '}
              <Link to="/setup" className="text-accent-ink hover:underline">Setup Guide</Link>.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleToggles.map(t => (
              <ToggleCard key={t.id} toggle={t} onApply={applyToggle} />
            ))}
          </div>
        </main>
      </div>

      {profileToApply && activeTargetId && (
        <ProfileModal
          profileName={profileToApply}
          targetId={activeTargetId}
          onClose={() => setProfileToApply(null)}
          onApplied={() => refetch()}
        />
      )}
    </div>
  )
}
