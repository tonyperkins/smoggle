"""
test_setup.py — tests for the enrollment script and checksum endpoints.
"""
import hashlib


def test_enroll_script_renders(client):
    """The enrollment script should render with all tokens substituted."""
    r = client.get("/api/enroll.sh")
    assert r.status_code == 200
    text = r.text
    assert text.startswith("#!/bin/sh")
    # No unsubstituted tokens should remain
    assert "@@KEY@@" not in text
    assert "@@HELPER_SCRIPT@@" not in text
    assert "@@HELPER_PATH@@" not in text
    assert "@@SUDOERS_PATH@@" not in text
    # Should contain the public key
    assert "ssh-ed25519" in text


def test_enroll_checksum_matches(client):
    """The checksum endpoint should return the correct SHA-256 of the script."""
    script = client.get("/api/enroll.sh").text
    expected = hashlib.sha256(script.encode("utf-8")).hexdigest()
    r = client.get("/api/enroll.sh.sha256")
    assert r.status_code == 200
    assert r.text.strip() == expected


def test_enroll_checksum_is_hex(client):
    """The checksum should be a valid 64-char hex string."""
    r = client.get("/api/enroll.sh.sha256")
    assert r.status_code == 200
    checksum = r.text.strip()
    assert len(checksum) == 64
    int(checksum, 16)  # raises if not hex


def test_enroll_script_no_auth_required(client):
    """The enrollment endpoints are public — no auth needed."""
    r = client.get("/api/enroll.sh")
    assert r.status_code == 200
    r = client.get("/api/enroll.sh.sha256")
    assert r.status_code == 200
