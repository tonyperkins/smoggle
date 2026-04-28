"""
profiles_registry.py — Profile definitions mapping names to toggle id lists.
Matches SPEC.md exactly.
"""

PROFILES = {
    "default": [],  # Restores every toggle to default_state — computed at runtime

    "performance": [
        "spotlight",
        "timemachine",
        "photos_analysis",
        "icloud_sync",
        "siri",
        "auto_updates",
        "power_nap",
        "handoff",
        "mail_fetch",
        "analytics",
    ],

    "max": [
        "spotlight",
        "timemachine",
        "photos_analysis",
        "icloud_sync",
        "siri",
        "auto_updates",
        "power_nap",
        "handoff",
        "mail_fetch",
        "analytics",
        "ollama",
        "app_nap",
        "high_power_mode",
        "location_services",
        "airplay_receiver",
    ],

    "hyper": [
        "spotlight",
        "timemachine",
        "photos_analysis",
        "icloud_sync",
        "siri",
        "auto_updates",
        "power_nap",
        "handoff",
        "mail_fetch",
        "analytics",
        "ollama",
        "app_nap",
        "high_power_mode",
        "location_services",
        "airplay_receiver",
        "notification_center",
        "mdns",
    ],
}

PROFILE_META = {
    "default": {
        "label": "Default",
        "emoji": "🔄",
        "description": "Reset to Apple Defaults",
        "color": "slate",
        "requires_confirm": False,
        "confirm_word": None,
    },
    "performance": {
        "label": "Performance",
        "emoji": "⚡",
        "description": "Safe only. Recommended for daily inference use.",
        "color": "blue",
        "requires_confirm": False,
        "confirm_word": None,
    },
    "max": {
        "label": "Max",
        "emoji": "🚀",
        "description": "All Performance + ollama, app_nap, high_power_mode, location, airplay",
        "color": "purple",
        "requires_confirm": True,
        "confirm_word": None,
    },
    "hyper": {
        "label": "Hyper",
        "emoji": "☢️",
        "description": "All Max + notification_center, mDNS. Breaks AirDrop/AirPlay/HomeKit.",
        "color": "red",
        "requires_confirm": True,
        "confirm_word": "HYPER",
    },
}
