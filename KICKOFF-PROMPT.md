# Smoggle — Project Kickoff Prompt

Use this as your initial prompt to Claude Code / Windsurf. Paste it in full.

---

## Prompt

I want to build a project called **Smoggle** — a web-based dashboard for remotely toggling macOS system services on Apple Silicon Macs to maximize AI inference performance. The full specification is in `SPEC.md` in this repository. Read it completely before writing any code.

Please build this project in the following order. Complete each phase fully before moving to the next. After each phase, tell me what was built, what decisions were made, and what comes next.

---

### Phase 1 — Project Scaffold

Create the full directory structure from the spec:

```
smoggle/
├── backend/
│   ├── main.py
│   ├── auth.py
│   ├── executor.py
│   ├── toggles_registry.py
│   ├── profiles_registry.py
│   ├── database.py
│   ├── routers/
│   │   ├── toggles.py
│   │   ├── profiles.py
│   │   ├── targets.py
│   │   ├── snapshots.py
│   │   ├── status.py
│   │   └── setup.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── docker-compose.yml
├── Dockerfile
├── SPEC.md
└── README.md
```

All files should exist with correct imports and stubs — nothing should be completely empty. The project must be importable and runnable (even if features aren't implemented yet) at the end of Phase 1.

---

### Phase 2 — Backend Core

Build the backend fully in this order:

1. **`database.py`** — SQLModel models:
   - `Target` (id, name, host, port, username, key_path, macos_version, last_seen)
   - `ToggleHistory` (id, target_id, toggle_id, old_state, new_state, profile, success, stderr, timestamp)
   - `Snapshot` (id, target_id, name, state_json, created_at)
   - Database init function, engine setup

2. **`executor.py`** — Full abstraction:
   - `BaseExecutor` ABC with `run()` returning `(stdout, stderr, exit_code)`
   - `SSHExecutor` fully implemented with Paramiko
     - Key-based auth only
     - Configurable timeout (default 10s)
     - Connection pooling (reuse connections per target)
     - Proper cleanup on disconnect
   - `LocalExecutor` stub raising `NotImplementedError`

3. **`auth.py`** — Stub only, as specified in SPEC.md

4. **`toggles_registry.py`** — Full `TOGGLES` list exactly as defined in SPEC.md. Do not abbreviate or summarize — include every toggle with all fields.

5. **`profiles_registry.py`** — `PROFILES` dict mapping profile names to their toggle id lists as defined in SPEC.md.

6. **All routers** — Implement every endpoint from the API spec:
   - `targets.py` — CRUD for target Macs, auto-detect macOS version on add
   - `toggles.py` — live state read, apply with optimistic pattern
   - `profiles.py` — sequential apply, Hyper confirmation enforcement
   - `snapshots.py` — save/restore/delete
   - `status.py` — SSE stream with inference server detection (Ollama + mlx_lm both checked)
   - `setup.py` — SSH connection test, sudo test

7. **`main.py`** — FastAPI app, router registration, CORS, lifespan handler for DB init, `/health` endpoint

---

### Phase 3 — Frontend Core

Build the React frontend fully:

1. **Vite + React + Tailwind + shadcn/ui setup** — fully configured, dark mode default

2. **`useSSE.js` hook** — connects to `/api/status/stream`, parses inference_servers array, exposes cpu/memory/swap/servers state

3. **`useToggles.js` hook** — fetches toggle list, manages optimistic state, handles revert on failure

4. **Components:**
   - `MacSelector.jsx` — dropdown showing all configured Macs with per-Mac connection status dot
   - `ConnectionBadge.jsx` — green/red/amber dot with tooltip
   - `ResourceStrip.jsx` — CPU sparkline, memory, swap (red if >0), inference server pills (Ollama ● / MLX ● / None ○, amber warning if both active)
   - `ToggleCard.jsx` — full card per spec: name, description, ON/OFF chip, impact badge, danger badge, Apple default chip, ⚡ restart required badge with tooltip, toggle switch, last changed timestamp
   - `ProfileSidebar.jsx` — Default/Performance/Max/Hyper buttons, color coded per spec
   - `ProfileModal.jsx` — diff preview, restart warnings, danger warnings, Hyper confirmation input
   - `SnapshotPanel.jsx` — save/restore/delete snapshots

5. **Pages:**
   - `Dashboard.jsx` — ResourceStrip + ToggleCard grid
   - `Settings.jsx` — target Mac management, add wizard, connection/sudo test
   - `SetupGuide.jsx` — numbered steps, copy-to-clipboard, live test buttons
   - `History.jsx` — toggle change log with filters

6. **`App.jsx`** — routing, global target context, first-run redirect to SetupGuide if no targets configured

---

### Phase 4 — Docker & Deployment

1. **`Dockerfile`** — multi-stage: build React frontend, serve static files from FastAPI
2. **`docker-compose.yml`** — exactly as in SPEC.md (smoggle container, port 7420, SSH keys mounted read-only, smoggle_data volume)
3. **`README.md`** — setup instructions covering:
   - Clone and build
   - SSH key setup on Milo
   - SSH + sudo setup on target Macs
   - Docker Compose deployment
   - Caddy config snippet (`smoggle.perkinslab.com`)
   - First-run walkthrough

---

### Constraints Throughout

- **Apple Silicon only** — no Intel Mac code paths, no GPU switching toggles
- **No localStorage** — all persistent state in SQLite via backend
- **Auth stubbed** — `auth.py` exists with TODO comments, no login UI, all routes open in v1
- **Local mode stubbed** — `LocalExecutor` raises `NotImplementedError`, no local mode UI
- **SSE not polling** — resource monitor uses Server-Sent Events, client never polls `/api/status`
- **Sequential profile apply** — never parallel launchctl calls
- **Optimistic UI** — toggle switches immediately, reverts on SSH failure
- **Status commands** — always return "1" or "0" only, use exit code pattern not grep -c
- **Toggle registry** — must match SPEC.md exactly, do not invent or modify toggles
- **Dark mode default** — slate-900 background, slate-800 cards, shadcn/ui components only

---

### After Each Phase

Tell me:
1. What was built
2. Any decisions or assumptions made that weren't explicit in the spec
3. Any issues or gaps discovered
4. Exact commands to run/test what was just built

Start with Phase 1 now.