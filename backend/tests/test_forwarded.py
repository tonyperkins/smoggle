"""
test_forwarded.py — tests for X-Forwarded-For support in client_ip().
"""
from unittest.mock import MagicMock

import backend.ratelimit as ratelimit


def _mock_request(host="10.0.0.1", headers=None):
    req = MagicMock()
    req.client = MagicMock()
    req.client.host = host
    req.headers = headers or {}
    return req


def test_client_ip_default_uses_direct_connection():
    """Without SMOGGLE_TRUST_FORWARDED, client_ip returns the direct connection IP."""
    ratelimit._TRUST_FORWARDED = False
    req = _mock_request(host="10.0.0.1", headers={"x-forwarded-for": "192.168.1.50"})
    assert ratelimit.client_ip(req) == "10.0.0.1"


def test_client_ip_trust_forwarded_uses_xff():
    """With SMOGGLE_TRUST_FORWARDED, client_ip reads X-Forwarded-For."""
    ratelimit._TRUST_FORWARDED = True
    req = _mock_request(host="10.0.0.1", headers={"x-forwarded-for": "192.168.1.50"})
    assert ratelimit.client_ip(req) == "192.168.1.50"


def test_client_ip_trust_forwarded_multiple_hops():
    """With multiple hops, the leftmost (original client) IP is used."""
    ratelimit._TRUST_FORWARDED = True
    req = _mock_request(host="10.0.0.1", headers={"x-forwarded-for": "192.168.1.50, 10.0.0.2, 10.0.0.3"})
    assert ratelimit.client_ip(req) == "192.168.1.50"


def test_client_ip_trust_forwarded_no_header_falls_back():
    """With trust enabled but no X-Forwarded-For header, falls back to direct IP."""
    ratelimit._TRUST_FORWARDED = True
    req = _mock_request(host="10.0.0.1", headers={})
    assert ratelimit.client_ip(req) == "10.0.0.1"


def test_client_ip_no_request():
    """None request returns 'unknown'."""
    ratelimit._TRUST_FORWARDED = False
    assert ratelimit.client_ip(None) == "unknown"
