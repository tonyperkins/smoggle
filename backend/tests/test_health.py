"""
test_health.py — tests for the /health endpoint (no auth required).
"""


def test_health_ok(client):
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["service"] == "smoggle"
