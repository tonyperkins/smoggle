"""
test_auth.py — tests for HTTP Basic Auth enforcement on API routes.
"""


def test_api_requires_auth(client):
    r = client.get("/api/targets")
    assert r.status_code == 401
    assert "WWW-Authenticate" in r.headers


def test_api_with_valid_auth(client, auth_headers):
    r = client.get("/api/targets", headers=auth_headers)
    assert r.status_code == 200


def test_api_with_wrong_password(client):
    import base64
    cred = base64.b64encode(b"admin:wrongpass").decode("ascii")
    r = client.get("/api/targets", headers={"Authorization": f"Basic {cred}"})
    assert r.status_code == 401


def test_api_with_wrong_username(client):
    import base64
    cred = base64.b64encode(b"root:testpass").decode("ascii")
    r = client.get("/api/targets", headers={"Authorization": f"Basic {cred}"})
    assert r.status_code == 401


def test_health_no_auth_needed(client):
    """/health is intentionally left open — no auth required."""
    r = client.get("/health")
    assert r.status_code == 200
