"""
compat.py — declared macOS support matrix and version checks.

Smoggle drives macOS via shell commands whose behaviour and output can change
between OS releases (e.g. a toggle's status string). We only verify against
versions we can actually test; anything else is best-effort and flagged to the
user at runtime so silent drift becomes visible.
"""
from typing import Optional

# Major macOS versions Smoggle is tested/supported on — the major component of
# `sw_vers -productVersion` (e.g. "14" for Sonoma 14.x).
SUPPORTED_MACOS_MAJORS = ("14",)
TESTED_MACOS_LABEL = "macOS 14 (Sonoma)"


def macos_major(version: Optional[str]) -> Optional[str]:
    """Return the major-version component of a macOS version string, or None."""
    if not version:
        return None
    major = version.split(".")[0].strip()
    return major or None


def is_supported_macos(version: Optional[str]) -> bool:
    """True if the given macOS version is in the tested support matrix."""
    return macos_major(version) in SUPPORTED_MACOS_MAJORS
