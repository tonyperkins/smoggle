"""
test_compat.py — tests for the macOS compatibility module.
"""
from backend.compat import macos_major, is_supported_macos, SUPPORTED_MACOS_MAJORS


def test_macos_major_extracts_major():
    assert macos_major("14.5") == "14"
    assert macos_major("13") == "13"
    assert macos_major("15.0.1") == "15"


def test_macos_major_none():
    assert macos_major(None) is None
    assert macos_major("") is None


def test_is_supported_macos_sonoma():
    assert is_supported_macos("14.0") is True
    assert is_supported_macos("14.6.1") is True


def test_is_supported_macos_ventura():
    assert is_supported_macos("13.6") is False


def test_is_supported_macos_none():
    assert is_supported_macos(None) is False


def test_supported_majors_contains_14():
    assert "14" in SUPPORTED_MACOS_MAJORS
