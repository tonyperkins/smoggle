"""
routers/setup.py — SSH connection test and passwordless sudo test.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlmodel import Session
from pydantic import BaseModel
from datetime import datetime

from backend.database import get_session, Target
from backend.executor import build_executor as _make_executor, async_run
from backend import ssh_identity
from backend.helper import HELPER_PATH, SUDOERS_PATH, generate_helper_script
from backend.ratelimit import limit_probes

router = APIRouter(prefix="/api", tags=["setup"])

# Endpoints that must be reachable WITHOUT dashboard auth: the enrollment script
# is fetched by `curl … | sudo sh` on the target Mac (which has no dashboard
# credentials), and the public-key endpoint just echoes a public key. Neither
# exposes a secret — enroll.sh embeds the app's *public* key and the helper
# command allowlist. main.py includes this router without the auth dependency.
public_router = APIRouter(prefix="/api", tags=["setup"])


class TestConnectionBody(BaseModel):
    target_id: int


class TestSudoBody(BaseModel):
    target_id: int


@public_router.get("/identity/public-key", response_class=PlainTextResponse)
async def identity_public_key():
    """Return Smoggle's managed SSH public key (for display in the UI)."""
    return ssh_identity.get_public_key()


# Single onboarding script. Run plain (`| sh`) it authorises Smoggle's SSH key
# for the current user. Run with sudo (`| sudo sh`) it ALSO installs the
# root-owned smoggle-helper and a narrow sudoers grant, enabling privileged
# toggles. $SUDO_USER lets the sudo path target the real user, not root.
# Tokens (@@…@@) are substituted server-side; shell ${…} stays literal.
_ENROLL_TEMPLATE = """#!/bin/sh
set -e

USER_NAME="${SUDO_USER:-$(id -un)}"
USER_HOME=$(eval echo "~$USER_NAME")
KEY='@@KEY@@'

# 1) Always: authorise Smoggle's SSH key for that user (idempotent).
mkdir -p "$USER_HOME/.ssh"
chmod 700 "$USER_HOME/.ssh"
touch "$USER_HOME/.ssh/authorized_keys"
chmod 600 "$USER_HOME/.ssh/authorized_keys"
if [ "$(id -u)" -eq 0 ]; then
  # sshd's StrictModes rejects an authorized_keys not owned by the user.
  chown "$USER_NAME" "$USER_HOME/.ssh" "$USER_HOME/.ssh/authorized_keys"
fi
if grep -qF "$KEY" "$USER_HOME/.ssh/authorized_keys"; then
  echo "Smoggle key already authorised for $USER_NAME."
else
  echo "$KEY" >> "$USER_HOME/.ssh/authorized_keys"
  echo "Smoggle key authorised for $USER_NAME."
fi

# 2) If root: install the privileged helper + a narrow sudoers grant.
if [ "$(id -u)" -eq 0 ]; then
  cat > '@@HELPER_PATH@@' <<'SMOGGLE_HELPER_EOF'
@@HELPER_SCRIPT@@
SMOGGLE_HELPER_EOF
  chmod 0755 '@@HELPER_PATH@@'
  chown root:wheel '@@HELPER_PATH@@'

  printf '%s ALL=(root) NOPASSWD: %s\\n' "$USER_NAME" '@@HELPER_PATH@@' > '@@SUDOERS_PATH@@.tmp'
  chmod 0440 '@@SUDOERS_PATH@@.tmp'
  if visudo -cf '@@SUDOERS_PATH@@.tmp' >/dev/null 2>&1; then
    mv '@@SUDOERS_PATH@@.tmp' '@@SUDOERS_PATH@@'
    echo "smoggle-helper installed; passwordless sudo granted for $USER_NAME."
    echo "Enrollment complete — run Test SSH and Test Sudo from the dashboard."
  else
    rm -f '@@SUDOERS_PATH@@.tmp'
    echo "ERROR: generated sudoers failed validation; not installed." >&2
    exit 1
  fi
else
  echo ""
  echo "SSH key installed. To enable privileged toggles (Spotlight, Time"
  echo "Machine, software updates, etc.), re-run this with sudo:"
  echo "  curl -fsSL <smoggle-url>/api/enroll.sh | sudo sh"
fi
"""


@public_router.get("/enroll.sh", response_class=PlainTextResponse)
async def enroll_script():
    """Single onboarding script for a target Mac.

    Run as the user it authorises Smoggle's managed SSH public key. Run with
    sudo it additionally installs the root-owned smoggle-helper allowlist and a
    sudoers grant for it. No secret leaves the backend — only the public key and
    the (non-sensitive) helper allowlist are embedded.
    """
    return (
        _ENROLL_TEMPLATE
        .replace("@@KEY@@", ssh_identity.get_public_key())
        .replace("@@HELPER_SCRIPT@@", generate_helper_script().rstrip("\n"))
        .replace("@@HELPER_PATH@@", HELPER_PATH)
        .replace("@@SUDOERS_PATH@@", SUDOERS_PATH)
    )


@router.post("/test-connection", dependencies=[Depends(limit_probes)])
async def test_connection(body: TestConnectionBody, session: Session = Depends(get_session)):
    """Test SSH reachability and key auth for a target Mac."""
    target = session.get(Target, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(target)
    # Run a probe directly (rather than the bool-only test_connection) so we can
    # inspect stderr — a pinned-host-key mismatch surfaces there.
    stdout, stderr, code = await async_run(executor, "echo ok")
    ok = code == 0 and stdout.strip() == "ok"

    if ok:
        # Opportunistically refresh macOS version and last_seen
        try:
            v_out, _, v_code = await async_run(executor, "sw_vers -productVersion")
            if v_code == 0 and v_out.strip():
                target.macos_version = v_out.strip()
        except Exception:
            pass
        # Pin the host key on first contact (trust-on-first-use)
        if executor.captured_fingerprint and not target.host_key_fingerprint:
            target.host_key_fingerprint = executor.captured_fingerprint
        target.last_seen = datetime.utcnow()
        session.add(target)
        session.commit()

    if ok:
        message = "SSH connection successful"
    elif "host key changed" in stderr.lower():
        message = (
            "Host key changed — possible MITM, or the Mac was reinstalled. "
            "Clear the stored fingerprint to re-trust this host."
        )
    else:
        message = "SSH connection failed — check host, key path, and username"

    return {
        "success": ok,
        "message": message,
        "target_id": body.target_id,
        "host": target.host,
        "macos_version": target.macos_version,
    }


@router.post("/test-sudo", dependencies=[Depends(limit_probes)])
async def test_sudo(body: TestSudoBody, session: Session = Depends(get_session)):
    """Verify passwordless sudo for the smoggle-helper wrapper is configured.

    Privileged operations all go through one root-owned allowlist script
    (see helper.py), so we only need to confirm `sudo -n smoggle-helper` runs
    without a password. We invoke a deliberately-unknown action: if the helper
    executes (as root, no prompt) it prints 'not permitted' and exits 1 — that
    output is proof the sudoers grant and the script are both in place.
    """
    target = session.get(Target, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(target)

    probe = f"sudo -n {HELPER_PATH} __selftest__ status 2>&1; echo __exit__$?"
    stdout, stderr, _ = await async_run(executor, probe)
    combined = f"{stdout}\n{stderr}"
    lower = combined.lower()

    # The helper's default arm prints exactly this — only reachable if sudo -n
    # ran it as root without a password.
    helper_ran = "smoggle-helper: not permitted" in combined

    if helper_ran:
        message = "Passwordless sudo for smoggle-helper is configured."
    elif "password" in lower or "sudoers" in lower:
        message = (
            "sudo requires a password — re-run the enrollment command with "
            "sudo to install /etc/sudoers.d/smoggle."
        )
    elif "command not found" in lower or "no such file" in lower:
        message = (
            "smoggle-helper is not installed — run the enrollment command "
            "with sudo on the Mac."
        )
    else:
        message = "Could not verify smoggle-helper sudo access."

    results = [{
        "command": "smoggle-helper",
        "success": helper_ran,
        "stderr": None if helper_ran else combined.strip()[:160],
    }]

    return {
        "success": helper_ran,
        "message": message,
        "target_id": body.target_id,
        "results": results,
    }
