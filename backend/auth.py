"""
auth.py — HTTP Basic Auth for the Smoggle dashboard.

Smoggle is deployed on a trusted private network, but the API still must not be
wide open: anyone who reaches it can reconfigure every enrolled Mac. This module
provides a single-admin Basic Auth gate applied to all /api routers (see
main.py). /health and the static SPA are intentionally left open.

Credentials, in order of precedence:
  1. SMOGGLE_AUTH_USER + SMOGGLE_AUTH_PASSWORD_HASH (bcrypt) env vars.
  2. A bootstrap file at SMOGGLE_AUTH_FILE (default /app/data/auth) holding a
     bcrypt hash. If neither is set, a random password is generated on first
     boot, its hash stored (0600), and the plaintext printed ONCE to the log.

Verification is constant-time (hmac.compare_digest on the username, bcrypt.checkpw
on the password) and never short-circuits, to avoid user-enumeration timing.
"""
import hmac
import os
import secrets

import bcrypt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBasic, HTTPBasicCredentials

from backend.ratelimit import auth_failures, client_ip

_security = HTTPBasic(auto_error=False)

AUTH_USER = os.getenv("SMOGGLE_AUTH_USER", "admin")

_default_auth_file = os.path.join(os.path.dirname(__file__), "..", "data", "auth")
AUTH_FILE = os.path.abspath(os.getenv("SMOGGLE_AUTH_FILE", _default_auth_file))

# A bcrypt hash of a value that cannot match any real password — used as a
# constant-time decoy when no credentials are configured, so the verify path
# always does the same work whether or not a user exists.
_DUMMY_HASH = bcrypt.hashpw(b"smoggle-no-credential-configured", bcrypt.gensalt())


def _password_hash() -> bytes:
    """Return the configured bcrypt password hash, bootstrapping one if needed."""
    env_hash = os.getenv("SMOGGLE_AUTH_PASSWORD_HASH")
    if env_hash:
        return env_hash.encode("utf-8")

    if os.path.exists(AUTH_FILE):
        with open(AUTH_FILE, "rb") as f:
            stored = f.read().strip()
            if stored:
                return stored

    # First boot with no configured credential — generate one and persist it.
    password = secrets.token_urlsafe(18)
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    os.makedirs(os.path.dirname(AUTH_FILE), exist_ok=True)
    fd = os.open(AUTH_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(hashed)
    print(
        "\n"
        "============================================================\n"
        "  Smoggle generated an admin password (first boot).\n"
        f"    username: {AUTH_USER}\n"
        f"    password: {password}\n"
        "  Store it now — it is shown only once. Override via\n"
        "  SMOGGLE_AUTH_USER / SMOGGLE_AUTH_PASSWORD_HASH.\n"
        "============================================================\n",
        flush=True,
    )
    return hashed


def ensure_credentials() -> None:
    """Resolve (and if needed bootstrap+log) the admin credential at startup,
    so the generated password appears in the boot logs rather than lazily on
    the first request."""
    _password_hash()


def require_auth(
    request: Request,
    creds: HTTPBasicCredentials = Depends(_security),
) -> str:
    """FastAPI dependency: enforce Basic Auth, return the authenticated username."""
    supplied_user = creds.username if creds else ""
    supplied_pass = (creds.password if creds else "").encode("utf-8")

    expected_hash = _password_hash()
    user_ok = hmac.compare_digest(supplied_user, AUTH_USER)
    # Always run bcrypt against a real hash (or the decoy) so timing is uniform.
    pass_ok = bcrypt.checkpw(supplied_pass, expected_hash if user_ok else _DUMMY_HASH)

    if not (user_ok and pass_ok):
        # Throttle brute force: each failed attempt consumes a token per IP.
        if not auth_failures.allow(client_ip(request)):
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed attempts — try again later.",
                headers={"WWW-Authenticate": "Basic"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Basic"},
        )
    return supplied_user
