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
    <div className="relative group bg-slate-950 border border-slate-700 rounded-lg p-3 pr-10">
      <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">{code}</pre>
      <button
        onClick={copy}
        className="absolute top-2.5 right-2.5 p-1.5 rounded
                   bg-slate-700 hover:bg-slate-600
                   text-slate-400 hover:text-slate-200
                   opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy to clipboard"
      >
        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      </button>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-800 text-blue-200
                      text-sm font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 space-y-2.5 min-w-0">
        <h3 className="text-slate-100 font-semibold text-sm">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function TestRow({ label, result, onTest }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-sm text-slate-300 min-w-[120px]">{label}</span>
      <button
        onClick={onTest}
        disabled={result?.loading}
        className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600
                   text-slate-200 text-xs rounded-lg disabled:opacity-50 transition-colors"
      >
        {result?.loading
          ? <Loader2 size={12} className="animate-spin" />
          : <Wifi size={12} />
        }
        Test SSH
      </button>
      {result && !result.loading && (
        <span className={`flex items-center gap-1 text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}>
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
      <span className="text-sm text-slate-300 min-w-[120px]">{label}</span>
      <button
        onClick={onTest}
        disabled={result?.loading}
        className="flex items-center gap-1.5 px-3 py-1 bg-slate-700 hover:bg-slate-600
                   text-slate-200 text-xs rounded-lg disabled:opacity-50 transition-colors"
      >
        {result?.loading
          ? <Loader2 size={12} className="animate-spin" />
          : <ShieldCheck size={12} />
        }
        Test Sudo
      </button>
      {result && !result.loading && (
        <span className={`flex items-center gap-1 text-xs ${result.success ? 'text-green-400' : 'text-red-400'}`}>
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
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="flex items-center gap-3 px-4 py-3 bg-slate-800 border-b border-slate-700 sticky top-0 z-30">
        <Link to="/" className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200">
          <ArrowLeft size={18} />
        </Link>
        <span className="font-bold text-lg tracking-tight">Setup Guide</span>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-9">

        <Step n={1} title="Enable SSH on the target Mac">
          <CodeBlock code="sudo systemsetup -setremotelogin on" />
          <CodeBlock code="sudo lsof -i :22" />
        </Step>

        <Step n={2} title="Generate a dedicated SSH key on your Docker/Linux host (one-time per Mac)">
          <CodeBlock code={`ssh-keygen -t ed25519 -C "smoggle" -f ~/.ssh/smoggle_ed25519`} />
        </Step>

        <Step n={3} title="Install the public key on each target Mac">
          <CodeBlock code="ssh-copy-id -i ~/.ssh/smoggle_ed25519.pub <YOUR_USERNAME>@<MAC_IP>" />
          <p className="text-slate-500 text-xs">Verify it works:</p>
          <CodeBlock code={`ssh -i ~/.ssh/smoggle_ed25519 <YOUR_USERNAME>@<MAC_IP> echo "Smoggle connection OK"`} />
        </Step>

        <Step n={4} title="Set up passwordless sudo on each target Mac">
          <CodeBlock code="sudo visudo -f /etc/sudoers.d/smoggle" />
          <p className="text-slate-400 text-xs">Add this line (replace username if needed):</p>
          <CodeBlock code="<YOUR_USERNAME> ALL=(ALL) NOPASSWD: /usr/sbin/mdutil, /usr/bin/tmutil, /usr/bin/pmset, /usr/sbin/softwareupdate, /bin/launchctl, /usr/bin/defaults" />
        </Step>

        <Step n={5} title="Add the target Mac in Settings">
          <p className="text-slate-400 text-sm">
            Go to <Link to="/settings" className="text-blue-400 hover:underline">Settings</Link> and click{' '}
            <strong className="text-slate-300">Add Mac</strong> with the hostname, username, and key path.
            macOS version will be auto-detected on first connection.
          </p>
        </Step>

        <Step n={6} title="Test the connection and sudo access">
          {targets.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Add a Mac in <Link to="/settings" className="text-blue-400 hover:underline">Settings</Link> first.
            </p>
          ) : (
            <div className="space-y-3">
              {targets.map(t => (
                <div key={t.id} className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-300">{t.name}
                    <span className="text-slate-500 font-normal ml-2 font-mono">{t.host}</span>
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
                    <div className="pl-3 space-y-0.5 border-l border-slate-700">
                      {sudoResults[t.id].results.map((r, i) => (
                        <p key={i} className={`text-xs ${r.success ? 'text-slate-500' : 'text-red-400'}`}>
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
