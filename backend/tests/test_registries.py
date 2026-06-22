"""
test_registries.py — integrity tests for the toggle and profile registries.

These verify the static data is well-formed and internally consistent, which
is critical since the helper script generation and profile application both
depend on it.
"""
from backend.toggles_registry import TOGGLES, TOGGLES_BY_ID
from backend.profiles_registry import PROFILES, PROFILE_META
from backend.helper import generate_helper_script, needs_helper


def test_all_toggles_have_unique_ids():
    ids = [t["id"] for t in TOGGLES]
    assert len(ids) == len(set(ids)), "Duplicate toggle IDs found"


def test_all_toggles_have_required_fields():
    required = {"id", "name", "description", "default_state", "cmd_on", "cmd_off", "cmd_status"}
    for t in TOGGLES:
        missing = required - set(t.keys())
        assert not missing, f"Toggle {t.get('id', '?')} missing fields: {missing}"


def test_all_toggles_have_valid_default_state():
    for t in TOGGLES:
        assert t["default_state"] in ("on", "off"), f"{t['id']} has invalid default_state: {t['default_state']}"


def test_toggles_by_id_matches_list():
    assert len(TOGGLES_BY_ID) == len(TOGGLES)
    for t in TOGGLES:
        assert TOGGLES_BY_ID[t["id"]] is t


def test_all_profile_toggle_ids_exist():
    for name, toggle_ids in PROFILES.items():
        if name == "default":
            continue
        for tid in toggle_ids:
            assert tid in TOGGLES_BY_ID, f"Profile '{name}' references unknown toggle '{tid}'"


def test_all_profiles_have_meta():
    for name in PROFILES:
        assert name in PROFILE_META, f"Profile '{name}' missing metadata"


def test_profile_meta_fields():
    for name, meta in PROFILE_META.items():
        assert "label" in meta
        assert "emoji" in meta
        assert "color" in meta
        assert "requires_confirm" in meta
        assert "confirm_word" in meta


def test_hyper_requires_confirm_word():
    assert PROFILE_META["hyper"]["confirm_word"] == "HYPER"
    assert PROFILE_META["hyper"]["requires_confirm"] is True


def test_default_profile_empty_list():
    """The 'default' profile is computed at runtime — its toggle list is empty."""
    assert PROFILES["default"] == []


def test_performance_subset_of_max():
    assert set(PROFILES["performance"]).issubset(set(PROFILES["max"]))


def test_max_subset_of_hyper():
    assert set(PROFILES["max"]).issubset(set(PROFILES["hyper"]))


def test_helper_script_generation():
    """The generated helper script should contain all sudo commands and the
    fallback case, and should NOT contain the literal 'sudo ' prefix (the
    script runs as root already)."""
    script = generate_helper_script()
    assert script.startswith("#!/bin/sh")
    assert "case" in script
    assert "esac" in script
    assert "not permitted" in script
    # No sudo prefix should remain in the generated script bodies
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.endswith(";;") and not stripped.startswith("#"):
            assert "sudo " not in stripped, f"Helper script line still has sudo: {stripped}"


def test_needs_helper_detection():
    """Verify needs_helper correctly identifies sudo vs non-sudo commands."""
    for toggle in TOGGLES:
        for action in ("on", "off", "status"):
            cmd = toggle.get(f"cmd_{action}", "")
            assert needs_helper(toggle, action) == ("sudo " in cmd)
