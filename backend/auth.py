# backend/auth.py
# TODO: Implement authentication in v2
# Planned: Basic Auth via Caddy reverse proxy
# No application-level auth in v1 — deploy on trusted internal network only


async def get_current_user():
    """Auth stub — always returns anonymous user in v1."""
    return {"user": "anonymous", "authenticated": True}
