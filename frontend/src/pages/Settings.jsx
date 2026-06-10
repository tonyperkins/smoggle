/**
 * Settings.jsx — Target Mac management: add wizard, remove, connection/sudo test.
 */
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Wifi, ShieldCheck, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Pencil } from 'lucide-react'
import { useTarget } from '../App.jsx'

const FIELD_DEFS = [
  { key: 'name',     label: 'Friendly Name', type: 'text',   placeholder: "My Mac Studio"           },
  { key: 'host',     label: 'Host / IP',     type: 'text',   placeholder: '192.168.1.100'           },
  { key: 'port',     label: 'SSH Port',      type: 'number', placeholder: '22'                      },
  { key: 'username', label: 'SSH Username',  type: 'text',   placeholder: 'your_username'           },
  { key: 'key_path', label: 'SSH Key Path',  type: 'text',   placeholder: '/root/.ssh/smoggle_ed25519 (absolute path inside container)' },
]

function AddMacForm({ onAdded, onCancel }) {
  const [form, setForm]   = useState({ name: '', host: '', port: 22, username: '', key_path: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? 'Failed to add Mac')
      }
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
      <h3 className="text-slate-100 font-semibold">Add Target Mac</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELD_DEFS.map(({ key, label, type, placeholder }) => (
          <div key={key} className={`flex flex-col gap-1 ${key === 'key_path' ? 'sm:col-span-2' : ''}`}>
            <label className="text-xs text-slate-400 font-medium">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
              placeholder={placeholder}
              required={key !== 'port'}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100
                         placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600
                     text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {saving ? 'Adding…' : 'Add Mac'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditMacForm({ target, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name: target.name,
    host: target.host,
    port: target.port,
    username: target.username,
    key_path: target.key_path,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/targets/${target.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? 'Failed to save')
      }
      const updated = await res.json()
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-slate-700 bg-slate-800/60 px-4 py-4 space-y-3">
      <h4 className="text-slate-300 text-xs font-semibold uppercase tracking-wide">Edit</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELD_DEFS.map(({ key, label, type, placeholder }) => (
          <div key={key} className={`flex flex-col gap-1 ${key === 'key_path' ? 'sm:col-span-2' : ''}`}>
            <label className="text-xs text-slate-400 font-medium">{label}</label>
            <input
              type={type}
              value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
              placeholder={placeholder}
              required={key !== 'port'}
              className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100
                         placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="text-red-400 text-xs bg-red-950 border border-red-800 rounded px-3 py-2">{error}</p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600
                     text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-700"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function TestResultRow({ result }) {
  if (!result) return null
  if (result.loading) return (
    <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
      <Loader2 size={12} className="animate-spin" /> Testing…
    </div>
  )
  return (
    <div className={`text-xs pt-1 space-y-1 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
      <p className="flex items-center gap-1.5">
        {result.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
        {result.message}
      </p>
      {result.results && result.results.map((r, i) => (
        <p key={i} className={`pl-5 text-xs ${r.success ? 'text-slate-400' : 'text-red-400'}`}>
          {r.success ? '✓' : '✗'} {r.command}
          {!r.success && r.stderr ? ` — ${r.stderr}` : ''}
        </p>
      ))}
      {result.macos_version && (
        <p className="pl-5 text-slate-400">macOS {result.macos_version}</p>
      )}
    </div>
  )
}

export default function Settings() {
  const { targets, setTargets } = useTarget()
  const [showAdd, setShowAdd]     = useState(false)
  const [testResults, setTestResults] = useState({})
  const [expanded, setExpanded]   = useState({})
  const [editingId, setEditingId] = useState(null)

  async function removeMac(id) {
    if (!confirm('Remove this Mac? This cannot be undone.')) return
    await fetch(`/api/targets/${id}`, { method: 'DELETE' })
    setTargets(ts => ts.filter(t => t.id !== id))
  }

  async function runTest(endpoint, id) {
    setTestResults(r => ({ ...r, [`${id}:${endpoint}`]: { loading: true } }))
    try {
      const res = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: id }),
      })
      const data = await res.json().catch(() => ({ success: false, message: 'Request failed' }))
      setTestResults(r => ({ ...r, [`${id}:${endpoint}`]: data }))
    } catch {
      setTestResults(r => ({ ...r, [`${id}:${endpoint}`]: { success: false, message: 'Network error' } }))
    }
  }

  function onAdded() {
    setShowAdd(false)
    fetch('/api/targets').then(r => r.json()).then(setTargets).catch(() => {})
  }

  function onSaved(updated) {
    setTargets(ts => ts.map(t => t.id === updated.id ? updated : t))
    setEditingId(null)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 sticky top-0 z-30">
        <Link to="/" className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-bold text-lg tracking-tight">Settings</span>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-5">

        {/* Header row */}
        <div className="flex items-center justify-between">
          <h2 className="text-slate-200 font-semibold text-base">Target Macs</h2>
          {!showAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600
                         text-white text-sm rounded-lg transition-colors"
            >
              <Plus size={14} /> Add Mac
            </button>
          )}
        </div>

        {showAdd && <AddMacForm onAdded={onAdded} onCancel={() => setShowAdd(false)} />}

        {targets.length === 0 && !showAdd && (
          <div className="text-center py-12 text-slate-500">
            <p className="text-sm">No Macs configured yet.</p>
            <p className="text-xs mt-1">
              See the{' '}
              <Link to="/setup" className="text-blue-400 hover:underline">Setup Guide</Link>
              {' '}for SSH key and sudo setup instructions.
            </p>
          </div>
        )}

        {targets.map(t => {
          const connResult = testResults[`${t.id}:test-connection`]
          const sudoResult = testResults[`${t.id}:test-sudo`]
          const isExpanded = expanded[t.id]
          return (
            <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
              {/* Mac header */}
              <div className="flex items-start justify-between p-4 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-slate-100 font-semibold">{t.name}</p>
                  <p className="text-slate-400 text-sm font-mono mt-0.5">
                    {t.username}@{t.host}:{t.port}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5 font-mono truncate" title={t.key_path}>
                    {t.key_path}
                  </p>
                  {t.macos_version && (
                    <p className="text-slate-500 text-xs mt-0.5">macOS {t.macos_version}</p>
                  )}
                  {t.last_seen && (
                    <p className="text-slate-600 text-xs mt-0.5">
                      Last seen {new Date(t.last_seen).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [t.id]: !e[t.id] }))}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    title="Test connection"
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => setEditingId(id => id === t.id ? null : t.id)}
                    className={`p-1.5 rounded hover:bg-slate-700 ${
                      editingId === t.id ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeMac(t.id)}
                    className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700"
                    title="Remove Mac"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === t.id && (
                <EditMacForm
                  target={t}
                  onSaved={onSaved}
                  onCancel={() => setEditingId(null)}
                />
              )}

              {/* Expanded test panel */}
              {isExpanded && (
                <div className="border-t border-slate-700 px-4 py-3 space-y-2 bg-slate-800/60">
                  <div className="flex gap-2">
                    <button
                      onClick={() => runTest('test-connection', t.id)}
                      disabled={connResult?.loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                                 text-slate-200 text-xs rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {connResult?.loading ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                      Test SSH
                    </button>
                    <button
                      onClick={() => runTest('test-sudo', t.id)}
                      disabled={sudoResult?.loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600
                                 text-slate-200 text-xs rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {sudoResult?.loading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                      Test Sudo
                    </button>
                  </div>
                  <TestResultRow result={connResult} />
                  <TestResultRow result={sudoResult} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
