/**
 * App.jsx — React root: TargetContext, routing, first-run redirect.
 *
 * First-run: if /api/targets returns an empty list on initial load,
 * the user is redirected to /setup automatically.
 *
 * TargetContext exposes:
 *   targets         — array of Target objects from the backend
 *   setTargets      — setter (used by Settings after add/remove)
 *   activeTargetId  — currently selected target ID (int | null)
 *   setActiveTargetId
 *   isMacosSupported(version) — true if a macOS version is in the tested matrix
 */
import React, { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard  from './pages/Dashboard.jsx'
import Settings   from './pages/Settings.jsx'
import SetupGuide from './pages/SetupGuide.jsx'
import History    from './pages/History.jsx'

const TargetContext = createContext(null)
export function useTarget() { return useContext(TargetContext) }

function Spinner() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <span className="text-ink-faint text-sm animate-pulse">Loading Smoggle…</span>
    </div>
  )
}

export default function App() {
  const [targets, setTargets]             = useState([])
  const [activeTargetId, setActiveTargetId] = useState(null)
  const [loaded, setLoaded]               = useState(false)
  // Declared macOS support matrix (from the backend); empty => assume supported.
  const [supportedMacos, setSupportedMacos] = useState(null)

  // Light/dark theme — applied to <html> and persisted. Default dark (cockpit).
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('smoggle-theme') === 'light' ? 'light' : 'dark' }
    catch { return 'dark' }
  })
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    try { localStorage.setItem('smoggle-theme', theme) } catch {}
  }, [theme])
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  // Load target list once on mount
  useEffect(() => {
    fetch('/api/targets')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setTargets(list)
        if (list.length > 0) setActiveTargetId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  // Load the macOS support matrix once
  useEffect(() => {
    fetch('/api/compat')
      .then(r => r.json())
      .then(setSupportedMacos)
      .catch(() => {})
  }, [])

  // True if a macOS version string is in the tested matrix. Unknown/missing
  // matrix => don't warn (assume supported) rather than nag spuriously.
  function isMacosSupported(version) {
    const majors = supportedMacos?.supported_macos_majors
    if (!majors || !version) return true
    return majors.includes(String(version).split('.')[0])
  }

  // Sync activeTargetId if targets list changes (e.g. after add/remove in Settings)
  useEffect(() => {
    if (targets.length > 0 && !targets.find(t => t.id === activeTargetId)) {
      setActiveTargetId(targets[0].id)
    }
    if (targets.length === 0) {
      setActiveTargetId(null)
    }
  }, [targets])

  if (!loaded) return <Spinner />

  return (
    <TargetContext.Provider value={{ targets, setTargets, activeTargetId, setActiveTargetId, supportedMacos, isMacosSupported, theme, toggleTheme }}>
      <BrowserRouter>
        <Routes>
          {/* First-run: redirect to /setup if no targets configured */}
          <Route
            path="/"
            element={targets.length === 0 ? <Navigate to="/setup" replace /> : <Dashboard />}
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="/setup"    element={<SetupGuide />} />
          <Route path="/history"  element={<History />} />
          <Route path="*"         element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </TargetContext.Provider>
  )
}
