"""
test_targets.py — tests for target Mac CRUD endpoints.

SSH-dependent operations (auto-detect macOS version, test SSH) are not tested
here since they require a live Mac. We test validation, CRUD, and error cases.
"""
from unittest.mock import patch


def _create_target(client, auth_headers, name="Test Mac", host="192.168.1.100", port=22, username="alice"):
    return client.post(
        "/api/targets",
        json={"name": name, "host": host, "port": port, "username": username},
        headers=auth_headers,
    )


def test_list_targets_empty(client, auth_headers):
    r = client.get("/api/targets", headers=auth_headers)
    assert r.status_code == 200
    assert r.json() == []


def test_create_target_success(client, auth_headers):
    # Mock SSH so create doesn't try to connect
    with patch("backend.routers.targets._make_executor") as mock_exec:
        mock_exec.side_effect = Exception("no SSH in tests")
        r = _create_target(client, auth_headers)
    assert r.status_code == 201
    body = r.json()
    assert body["name"] == "Test Mac"
    assert body["host"] == "192.168.1.100"
    assert body["port"] == 22
    assert body["username"] == "alice"
    assert "id" in body


def test_create_target_invalid_host(client, auth_headers):
    r = client.post(
        "/api/targets",
        json={"name": "Mac", "host": "bad host!", "port": 22, "username": "alice"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_create_target_invalid_username(client, auth_headers):
    r = client.post(
        "/api/targets",
        json={"name": "Mac", "host": "192.168.1.1", "port": 22, "username": "Alice!"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_create_target_invalid_port(client, auth_headers):
    r = client.post(
        "/api/targets",
        json={"name": "Mac", "host": "192.168.1.1", "port": 99999, "username": "alice"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_create_target_negative_port(client, auth_headers):
    r = client.post(
        "/api/targets",
        json={"name": "Mac", "host": "192.168.1.1", "port": -1, "username": "alice"},
        headers=auth_headers,
    )
    assert r.status_code == 422


def test_update_target(client, auth_headers):
    with patch("backend.routers.targets._make_executor") as mock_exec:
        mock_exec.side_effect = Exception("no SSH in tests")
        r = _create_target(client, auth_headers)
    target_id = r.json()["id"]

    r = client.patch(
        f"/api/targets/{target_id}",
        json={"name": "Renamed Mac"},
        headers=auth_headers,
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Renamed Mac"


def test_update_target_not_found(client, auth_headers):
    r = client.patch("/api/targets/9999", json={"name": "Nope"}, headers=auth_headers)
    assert r.status_code == 404


def test_delete_target(client, auth_headers):
    with patch("backend.routers.targets._make_executor") as mock_exec:
        mock_exec.side_effect = Exception("no SSH in tests")
        r = _create_target(client, auth_headers)
    target_id = r.json()["id"]

    r = client.delete(f"/api/targets/{target_id}", headers=auth_headers)
    assert r.status_code == 204

    # Verify it's gone
    r = client.get("/api/targets", headers=auth_headers)
    assert r.json() == []


def test_delete_target_not_found(client, auth_headers):
    r = client.delete("/api/targets/9999", headers=auth_headers)
    assert r.status_code == 404
