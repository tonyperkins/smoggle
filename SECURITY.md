# Security

Smoggle controls and runs privileged operations over SSH on every Mac it manages.
This document describes the intended deployment, the trust boundaries, what the
dashboard is capable of, and how to operate it safely.

## Intended deployment & trust boundary

**Smoggle is intended for a private network only** — a home/office LAN or a
private overlay (e.g. Tailscale/WireGuard). It is **not** designed to be exposed
directly to the public internet. If you must reach it remotely, put it behind a
private network/VPN or an authenticating reverse proxy with TLS.

Trust assumptions:

- Anyone who can reach the dashboard **and** authenticate can change settings on
  every enrolled Mac. Network reachability is the first line of defence.
- The Smoggle host (container + its data volume) is trusted. It holds the SSH
  identity key and the admin password hash.
- Each enrolled Mac trusts Smoggle's SSH key and, if the privileged helper is
  installed, allows Smoggle's specific root operations.

## Capability surface — what the dashboard can do to a Mac

- **User-level (always, over SSH):** read/apply the user-level toggles (Spotlight
  per-user prefs, Photos analysis, iCloud, Siri, etc.) and **terminate processes**
  by PID (a protected-process list blocks system-critical daemons).
- **Privileged (only if the helper is installed):** exactly the root operations in
  the generated allowlist — `mdutil`, `tmutil`, `pmset`, `softwareupdate`,
  `locationd`/`mDNSResponder` prefs. Nothing else. The Mac grants `NOPASSWD` sudo
  on the single `smoggle-helper` script, **not** broad sudo. See
  [`backend/helper.py`](backend/helper.py).

Some toggles **reduce a Mac's security posture** when turned off (e.g. Automatic
Software Updates, Location Services). The UI flags these; treat them deliberately.

## Authentication

- **Dashboard:** HTTP Basic Auth on all `/api` routes ([`backend/auth.py`](backend/auth.py)).
  `/health` and the static SPA are open. Credentials come from
  `SMOGGLE_AUTH_USER` + `SMOGGLE_AUTH_PASSWORD_HASH` (bcrypt), or a random
  password is generated on first boot and printed **once** to the container log.
  Failed logins are rate-limited per IP.
- **Mac host keys:** pinned trust-on-first-use; a changed key is rejected as a
  possible MITM ([`backend/executor.py`](backend/executor.py)).
- Basic Auth protects the edge only. On an untrusted network, add TLS and ideally
  a second factor at a reverse proxy — the backend itself trusts any
  authenticated request.

## Hardening in place

- App runs as a **non-root** user in the container; `no-new-privileges`,
  `cap_drop: ALL` (minimal add-back for the ownership-fixing entrypoint).
- CORS is locked to `SMOGGLE_ORIGINS` (default: same-origin only).
- SSH identity key and auth file are stored `0600` in the data volume.
- Input on target host/username/port is validated; process kills are by PID only.
- Toggle changes are attributed to the authenticated user in the history log.

## Operating safely

**Secrets & backups.** The data volume (`smoggle_data` → `/app/data`) holds the
SQLite DB, the SSH identity key (`id_smoggle`), and the admin password hash
(`auth`). Back it up securely; anyone with it can authenticate to every enrolled
Mac.

**Rotate the admin password:** set `SMOGGLE_AUTH_PASSWORD_HASH` (a bcrypt hash) and
restart, or delete `/app/data/auth` to force regeneration on next boot.

**Rotate the SSH identity key:** delete `/app/data/id_smoggle*` and restart to
generate a new keypair, then re-run enrollment on each Mac. Remove the old key
from each Mac's `~/.ssh/authorized_keys`.

**Re-trust a Mac host key** (after a legitimate reinstall): clear the target's
stored `host_key_fingerprint` so the next connection re-pins.

## Known issues / tracked follow-ups

CI runs `pip-audit`, `npm audit` (via `audit-ci`), `bandit`, and `gitleaks` on
every PR. A few dependency advisories are deliberately allowlisted there because
their only fix is a breaking major upgrade or no fix exists yet. All are low
real-world risk given the private-network trust boundary, and each is tracked:

- **FastAPI / starlette** (several CVEs): fixed only by a FastAPI major upgrade.
  Re-audit after bumping. ([#7](../../issues/7))
- **react-router** (`GHSA-2j2x-hqr9-3h42`, open redirect): fixed in react-router
  v7 (breaking). ([#8](../../issues/8))
- **vite** (`GHSA-fx2h-pf6j-xcff`): fixed in vite v8 (breaking). Build-time-only
  devDependency — not in the shipped static bundle, so no production exposure.
  ([#9](../../issues/9))
- **paramiko** (`CVE-2026-44405`): no fixed version published yet. Revisit when
  upstream ships a fix. ([#10](../../issues/10))

### Architecture follow-ups

Deferred hardening, tracked as issues:

- Serve enrollment over HTTPS / add an integrity check — the `curl | sudo sh`
  step is MITM-able over plain HTTP. ([#11](../../issues/11))
- App-level auth defense-in-depth, replacing the Basic Auth stopgap (OIDC /
  Tailscale / signed forward-auth header). ([#12](../../issues/12))
- Container `read_only` root filesystem. ([#13](../../issues/13))
- Honor `X-Forwarded-For` for client IP in rate limiting behind a proxy.
  ([#14](../../issues/14))
- **Phase C (future epic):** a signed macOS agent for confined privilege +
  mutual auth, superseding the SSH-key + helper model. ([#15](../../issues/15))

## Reporting a vulnerability

This is a personal/hobby project. Please open a private report (or email the
maintainer) rather than a public issue for anything exploitable.
