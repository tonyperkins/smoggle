/**
 * SnapshotPanel.jsx — Save current toggle state as a named snapshot,
 * restore from snapshot, or delete. Listed in sidebar.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Camera, RotateCcw, Trash2, Loader2 } from 'lucide-react'

function fmt(dateStr) {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch { return dateStr }
}

export default function SnapshotPanel({ targetId }) {
  const [snapshots, setSnapshots]   = useState([])
  const [newName, setNewName]       = useState('')
  const [saving, setSaving]         = useState(false)
  const [restoring, setRestoring]   = useState(null)  // snapshot id being restored

  const load = useCallback(() => {
    if (!targetId) return
    fetch(`/api/snapshots?target=${targetId}`)
      .then(r => r.json())
      .then(data => setSnapshots(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [targetId])

  useEffect(() => { load() }, [load])

  async function save() {
    if (!newName.trim() || saving || !targetId) return
    setSaving(true)
    try {
      const res = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: targetId, name: newName.trim() }),
      })
      if (res.ok) { setNewName(''); load() }
    } catch {}
    setSaving(false)
  }

  async function restore(id) {
    if (restoring) return
    setRestoring(id)
    try {
      await fetch(`/api/snapshots/${id}/restore`, { method: 'POST' })
    } catch {}
    setRestoring(null)
  }

  async function del(id) {
    if (!confirm('Delete this snapshot?')) return
    await fetch(`/api/snapshots/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold px-1">
        Snapshots
      </p>

      {/* Save form */}
      <div className="flex gap-1">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Name…"
          disabled={!targetId}
          className="flex-1 min-w-0 bg-slate-700 border border-slate-600 rounded px-2 py-1
                     text-xs text-slate-100 placeholder-slate-500
                     focus:outline-none focus:border-blue-500
                     disabled:opacity-40"
        />
        <button
          onClick={save}
          disabled={saving || !newName.trim() || !targetId}
          title="Save snapshot"
          className="flex-shrink-0 p-1.5 rounded bg-slate-700 hover:bg-slate-600
                     text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving
            ? <Loader2 size={13} className="animate-spin" />
            : <Camera size={13} />
          }
        </button>
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0 && (
        <p className="text-xs text-slate-600 px-1">No snapshots yet</p>
      )}
      <div className="space-y-1">
        {snapshots.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-1 bg-slate-700/60 border border-slate-700 rounded px-2 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-200 truncate font-medium">{s.name}</p>
              <p className="text-xs text-slate-500">{fmt(s.created_at)}</p>
            </div>
            <button
              onClick={() => restore(s.id)}
              disabled={!!restoring}
              title="Restore"
              className="p-1 text-slate-400 hover:text-green-400 disabled:opacity-40"
            >
              {restoring === s.id
                ? <Loader2 size={13} className="animate-spin" />
                : <RotateCcw size={13} />
              }
            </button>
            <button
              onClick={() => del(s.id)}
              title="Delete"
              className="p-1 text-slate-400 hover:text-red-400"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
