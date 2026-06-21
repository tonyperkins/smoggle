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
      <p className="text-xs text-ink-faint uppercase tracking-wider font-semibold px-1">
        Snapshots
      </p>

      {/* Save form */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="Name this snapshot…"
          disabled={!targetId}
          className="flex-1 min-w-0 bg-surface border border-line rounded-lg px-2.5 py-1.5
                     text-xs text-ink placeholder-ink-faint
                     focus:outline-none focus:border-accent
                     disabled:opacity-40"
        />
        <button
          onClick={save}
          disabled={saving || !newName.trim() || !targetId}
          title="Save snapshot"
          className="flex-shrink-0 p-2 rounded-lg bg-surface border border-line hover:bg-surface-2
                     text-ink-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving
            ? <Loader2 size={14} className="animate-spin" />
            : <Camera size={14} />
          }
        </button>
      </div>

      {/* Snapshot list */}
      {snapshots.length === 0 && (
        <p className="text-xs text-ink-faint px-1">No snapshots yet</p>
      )}
      <div className="space-y-1.5">
        {snapshots.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-1 bg-surface border border-line rounded-lg px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink truncate font-medium">{s.name}</p>
              <p className="text-xs text-ink-faint">{fmt(s.created_at)}</p>
            </div>
            <button
              onClick={() => restore(s.id)}
              disabled={!!restoring}
              title="Restore"
              className="px-2 py-1 rounded-md text-xs font-medium text-ink-muted hover:text-accent-ink
                         hover:bg-accent-soft disabled:opacity-40 transition-colors inline-flex items-center gap-1"
            >
              {restoring === s.id
                ? <Loader2 size={12} className="animate-spin" />
                : <RotateCcw size={12} />
              }
              Restore
            </button>
            <button
              onClick={() => del(s.id)}
              title="Delete"
              className="p-1 text-ink-faint hover:text-danger transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
