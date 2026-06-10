# Smoggle

AI Performance Toggle Dashboard for macOS Apple Silicon.

Remotely toggle macOS system services via SSH to maximize MLX/Ollama inference performance. Runs on a Linux/Docker host and controls target Macs over SSH.

---

## Quick Start

### 1. Clone

```bash
git clone <repo> smoggle
cd smoggle
```

### 2. SSH Key Setup (on your Docker/Linux host — one time per Mac)

```bash
ssh-keygen -t ed25519 -C "smoggle" -f ~/.ssh/smoggle_ed25519
ssh-copy-id -i ~/.ssh/smoggle_ed25519.pub <YOUR_USERNAME>@<MAC_IP>
ssh -i ~/.ssh/smoggle_ed25519 <YOUR_USERNAME>@<MAC_IP> echo "Smoggle connection OK"
```

### 3. Passwordless sudo on each target Mac

```bash
sudo visudo -f /etc/sudoers.d/smoggle
```

Add:
```
<YOUR_USERNAME> ALL=(ALL) NOPASSWD: /usr/sbin/mdutil, /usr/bin/tmutil, /usr/bin/pmset, /usr/sbin/softwareupdate, /bin/launchctl, /usr/bin/defaults
```

### 4. Build and Deploy

```bash
docker compose up -d --build
```

Smoggle runs on port **7420**.

Health check: `curl http://localhost:7420/health`

### 5. Caddy Reverse Proxy (optional)

Add to your Caddyfile:

```
smoggle.yourdomain.com {
    # TODO v2: uncomment to enable Basic Auth
    # basicauth {
    #     youruser <bcrypt_hash>   # generate: caddy hash-password
    # }
    reverse_proxy smoggle:7420
}
```

Reload Caddy: `caddy reload`

### 6. First Run

1. Open `http://localhost:7420` (or your Caddy domain)
2. You'll be redirected to the **Setup Guide** page
3. Follow the numbered steps to verify SSH and sudo access
4. Add your target Mac(s) in **Settings**
5. Return to the Dashboard — toggle cards will load with live state

---

## Development (without Docker)

### Backend

```bash
cd smoggle
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
PYTHONPATH=. uvicorn backend.main:app --reload --port 7420
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173 — proxies /api to :7420
```

---

## Architecture

```
[Browser / Phone]
      |
      ▼
[Caddy on Docker host] ──► smoggle.yourdomain.com
      |
      ▼
[Smoggle FastAPI :7420]
      |
      ├──► SSH ──► Mac 1 (<IP>)
      └──► SSH ──► Mac 2 (<IP>)
```

- **Backend**: FastAPI + SQLModel (SQLite) + Paramiko SSH
- **Frontend**: React 18 + Vite + Tailwind CSS
- **SSE**: Resource monitor pushed every 3s — no polling
- **Auth**: Stubbed in v1 — deploy on trusted internal network

---

## Toggle Profiles

| Profile | Color | Toggles | Confirmation |
|---|---|---|---|
| 🔄 Default | Slate | Restore all Apple defaults | None |
| ⚡ Performance | Blue | 10 safe toggles | None |
| 🚀 Max | Purple | Performance + 5 more | Single dialog |
| ☢️ Hyper | Red | Max + mDNS + Notifications | Type `HYPER` |

---

## Notes

- Apple Silicon only — no Intel Mac support
- No localStorage — all state in SQLite
- Auth stubbed — v2 will add Basic Auth via Caddy
- Local mode stubbed — `LocalExecutor` raises `NotImplementedError`
