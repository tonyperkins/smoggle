/**
 * SetupGuide.jsx — Numbered setup steps with copy-to-clipboard and live test buttons.
 */
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check, Wifi, ShieldCheck, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { useTarget } from '../App.jsx'

function CodeBlock({ code }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="relative group bg-surface-2 border border-line rounded-lg p-3 pr-10">
      <pre className="text-xs font-mono text-ink-muted whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 p-1.5 rounded
                   bg-surface-2 hover:bg-surface-3
                   text-ink-muted hover:text-ink
                   opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copied ? <Check size={12} className="text-accent-ink" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-accent text-white
                      text-sm font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        <h3 className="text-ink font-semibold text-sm">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function TestRow({ label, result, onTest }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-ink-muted min-w-[120px]">{label}</span>
      <button
        onClick={onTest}
        disabled={result?.loading}
        className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3
                   text-ink text-xs rounded-lg disabled:opacity-50 transition-colors"
      >
        {result?.loading
          ? <Loader2 size={12} className="animate-spin" />
          : <Wifi size={12} />
        }
        Test SSH
      </button>
      {result && !result.loading && (
        <span className={`flex items-center gap-1 text-xs ${result.success ? 'text-accent-ink' : 'text-danger'}`}>
          {result.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {result.message}
        </span>
      )}
    </div>
  )
}

function SudoRow({ label, result, onTest }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-ink-muted min-w-[120px]">{label}</span>
      <button
        onClick={onTest}
        disabled={result?.loading}
        className="flex items-center gap-1.5 px-3 py-1 bg-surface-2 hover:bg-surface-3
                   text-ink text-xs rounded-lg disabled:opacity-50 transition-colors"
      >
        {result?.loading
          ? <Loader2 size={12} className="animate-spin" />
          : <ShieldCheck size={12} />
        }
        Test Sudo
      </button>
      {result && !result.loading && (
        <span className={`flex items-center gap-1 text-xs ${result.success ? 'text-accent-ink' : 'text-danger'}`}>
          {result.success ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
          {result.message}
        </span>
      )}
    </div>
  )
}

export default function SetupGuide() {
  const { targets } = useTarget()
  // { [targetId]: result }
  const [connResults, setConnResults] = useState({})
  const [sudoResults, setSudoResults] = useState({})

  async function testConn(id) {
    setConnResults(r => ({ ...r, [id]: { loading: true } }))
    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: id }),
      })
      let data
      try { data = await res.json() } catch { data = { success: false, message: 'Request failed' } }
      setConnResults(r => ({ ...r, [id]: data }))
    } catch {
      setConnResults(r => ({ ...r, [id]: { success: false, message: 'Network error' } }))
    }
  }

  async function testSudo(id) {
    setSudoResults(r => ({ ...r, [id]: { loading: true } }))
    try {
      const res = await fetch('/api/test-sudo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: id }),
      })
      let data
      try { data = await res.json() } catch { data = { success: false, message: 'Request failed' } }
      setSudoResults(r => ({ ...r, [id]: data }))
    } catch {
      setSudoResults(r => ({ ...r, [id]: { success: false, message: 'Network error' } }))
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-line sticky top-0 z-30">
        <Link to="/" className="p-1.5 rounded hover:bg-surface-2 text-ink-muted hover:text-ink">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-bold text-lg tracking-tight">Setup Guide</span>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-9">

        <Step n={1} title="Enable SSH on the target Mac">
          <CodeBlock code="sudo systemsetup -setremotelogin on" />
          <CodeBlock code="sudo lsof -i :22" />
        </Step>

        <Step n={2} title="Add the target Mac in Settings">
          <p className="text-ink-muted text-sm">
            Go to <Link to="/settings" className="text-accent-ink hover:underline">Settings</Link> and click{' '}
            <strong className="text-ink-muted">Add Mac</strong> with just the hostname and username.
            Smoggle manages its own SSH key — there's nothing to generate or place yourself.
          </p>
        </Step>

        <Step n={3} title="Authorise Smoggle on the Mac">
          <p className="text-ink-muted text-sm">
            Expand the Mac's card in Settings and copy the one-line command shown there, then run it in{' '}
            <strong className="text-ink-muted">Terminal on the Mac</strong>. Run with{' '}
            <strong className="text-ink-muted">sudo</strong> it authorises Smoggle's SSH key{' '}
            <em>and</em> installs a small root-owned <code className="text-ink-muted">smoggle-helper</code>{' '}
            that allows <em>only</em> Smoggle's exact privileged operations (no broad sudo):
          </p>
          <CodeBlock code="curl -fsSL http://<SMOGGLE_HOST>:7420/api/enroll.sh | sudo sh" />
          <p className="text-ink-faint text-xs">
            Don't need the privileged toggles (Spotlight, Time Machine, software updates, etc.)?
            Run it without <code className="text-ink-muted">sudo</code> to install the SSH key only:
          </p>
          <CodeBlock code="curl -fsSL http://<SMOGGLE_HOST>:7420/api/enroll.sh | sh" />
        </Step>

        <Step n={4} title="Test the connection and sudo access">
          {targets.length === 0 ? (
            <p className="text-ink-faint text-sm">
              Add a Mac in <Link to="/settings" className="text-accent-ink hover:underline">Settings</Link> first.
            </p>
          ) : (
            <div className="space-y-3">
              {targets.map(t => (
                <div key={t.id} className="bg-surface border border-line rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-ink-muted">{t.name}
                    <span className="text-ink-faint font-normal ml-2 font-mono">{t.host}</span>
                  </p>
                  <TestRow
                    label="SSH connection"
                    result={connResults[t.id]}
                    onTest={() => testConn(t.id)}
                  />
                  <SudoRow
                    label="Sudo access"
                    result={sudoResults[t.id]}
                    onTest={() => testSudo(t.id)}
                  />
                  {/* Per-command sudo results */}
                  {sudoResults[t.id] && !sudoResults[t.id].loading && sudoResults[t.id].results && (
                    <div className="pl-3 space-y-0.5 border-l border-line">
                      {sudoResults[t.id].results.map((r, i) => (
                        <p key={i} className={`text-xs ${r.success ? 'text-ink-faint' : 'text-danger'}`}>
                          {r.success ? '✓' : '✗'} {r.command}
                          {!r.success && r.stderr ? ` — ${r.stderr}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Step>

      </div>
    </div>
  )
}
