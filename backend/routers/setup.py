"""
routers/setup.py — SSH connection test and passwordless sudo test.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlmodel import Session
from pydantic import BaseModel
from datetime import datetime

from backend.database import get_session, Target
from backend.executor import SSHExecutor, async_run, async_test_connection
from backend import ssh_identity

router = APIRouter(prefix="/api", tags=["setup"])


class TestConnectionBody(BaseModel):
    target_id: int


class TestSudoBody(BaseModel):
    target_id: int


def _make_executor(target: Target) -> SSHExecutor:
    return SSHExecutor(
        host=target.host,
        username=target.username,
        key_path=ssh_identity.KEY_PATH,
        port=target.port,
    )


@router.get("/identity/public-key", response_class=PlainTextResponse)
async def identity_public_key():
    """Return Smoggle's managed SSH public key (for display in the UI)."""
    return ssh_identity.get_public_key()


@router.get("/enroll.sh", response_class=PlainTextResponse)
async def enroll_script():
    """A shell script the user runs on a target Mac to authorise Smoggle.

    Appends the app's managed public key to ~/.ssh/authorized_keys (idempotent),
    creating the .ssh dir with correct permissions if needed. No secret leaves
    the backend — only the public key is embedded.
    """
    pubkey = ssh_identity.get_public_key()
    # Single-quote the key for the shell; it contains no single quotes.
    script = f"""#!/bin/sh
set -e
KEY='{pubkey}'
mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
if grep -qF "$KEY" "$HOME/.ssh/authorized_keys"; then
  echo "Smoggle key already authorised."
else
  echo "$KEY" >> "$HOME/.ssh/authorized_keys"
  echo "Smoggle key authorised. You can now Test SSH from the dashboard."
fi
"""
    return script


@router.post("/test-connection")
async def test_connection(body: TestConnectionBody, session: Session = Depends(get_session)):
    """Test SSH reachability and key auth for a target Mac."""
    target = session.get(Target, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(target)
    ok = await async_test_connection(executor)

    if ok:
        # Opportunistically refresh macOS version and last_seen
        try:
            stdout, _, code = await async_run(executor, "sw_vers -productVersion")
            if code == 0 and stdout.strip():
                target.macos_version = stdout.strip()
        except Exception:
            pass
        target.last_seen = datetime.utcnow()
        session.add(target)
        session.commit()

    return {
        "success": ok,
        "message": "SSH connection successful" if ok else "SSH connection failed — check host, key path, and username",
        "target_id": body.target_id,
        "host": target.host,
        "macos_version": target.macos_version,
    }


@router.post("/test-sudo")
async def test_sudo(body: TestSudoBody, session: Session = Depends(get_session)):
    """Test that passwordless sudo works for all required commands."""
    target = session.get(Target, body.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")

    executor = _make_executor(target)

    # Test each required binary with sudo -n (non-interactive — fails if password needed)
    required_cmds = [
        ("mdutil",         "sudo -n mdutil -h 2>&1; echo $?"),
        ("tmutil",         "sudo -n tmutil help 2>&1; echo $?"),
        ("pmset",          "sudo -n pmset -g 2>&1 | head -1; echo $?"),
        ("softwareupdate", "sudo -n softwareupdate --schedule 2>&1; echo $?"),
        ("launchctl",      "sudo -n launchctl list 2>&1 | head -1; echo $?"),
        ("defaults",       "sudo -n defaults write com.smoggle.test ping ok 2>&1 && sudo -n defaults delete com.smoggle.test 2>&1; echo $?"),
    ]

    results = []
    all_ok = True

    for label, cmd in required_cmds:
        stdout, stderr, exit_code = await async_run(executor, cmd)
        # sudo -n exits 1 if password required, last line is exit code from echo $?
        lines = stdout.strip().splitlines()
        inner_exit = int(lines[-1]) if lines and lines[-1].isdigit() else exit_code
        # sudo "requires a password" stderr indicates failure
        sudo_denied = "password" in stderr.lower() or "sudoers" in stderr.lower()
        ok = not sudo_denied and inner_exit != 1
        results.append({"command": label, "success": ok, "stderr": stderr[:120] if not ok else None})
        if not ok:
            all_ok = False

    return {
        "success": all_ok,
        "message": "All sudo commands available" if all_ok else "Some sudo commands denied — check /etc/sudoers.d/smoggle",
        "target_id": body.target_id,
        "results": results,
    }
