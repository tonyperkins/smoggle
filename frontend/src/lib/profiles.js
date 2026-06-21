/**
 * profiles.js — Frontend mirror of profiles_registry.py.
 * Used by ProfileModal to show a pre-apply diff preview.
 *
 * Each toggle entry has: { id, name, from, to }
 * 'from' is the assumed current state (Apple default), 'to' is what the profile sets.
 */

const ALL_TOGGLES = [
  { id: 'spotlight',           name: 'Spotlight Indexing',           default: 'on' },
  { id: 'timemachine',         name: 'Time Machine Backups',         default: 'on' },
  { id: 'photos_analysis',     name: 'Photos ML Analysis',           default: 'on' },
  { id: 'icloud_sync',         name: 'iCloud Drive Sync',            default: 'on' },
  { id: 'siri',                name: 'Siri & Suggestions',           default: 'on' },
  { id: 'auto_updates',        name: 'Automatic Software Updates',   default: 'on' },
  { id: 'power_nap',           name: 'Power Nap',                    default: 'on' },
  { id: 'handoff',             name: 'Handoff & Continuity',         default: 'on' },
  { id: 'location_services',   name: 'Location Services',            default: 'on' },
  { id: 'mail_fetch',          name: 'Mail Background Fetch',        default: 'on' },
  { id: 'analytics',           name: 'Apple Analytics & Diagnostics',default: 'on' },
  { id: 'airplay_receiver',    name: 'AirPlay Receiver',             default: 'on' },
  { id: 'ollama',              name: 'Ollama Service',               default: 'on' },
  { id: 'app_nap',             name: 'App Nap',                      default: 'on' },
  { id: 'high_power_mode',     name: 'High Power Mode',              default: 'off', hardwareDependent: true },
  { id: 'notification_center', name: 'Notification Center',          default: 'on' },
  { id: 'mdns',                name: 'mDNS / Bonjour',               default: 'on' },
]

const BY_ID = Object.fromEntries(ALL_TOGGLES.map(t => [t.id, t]))

function profileToggle(id, desiredState) {
  const t = BY_ID[id]
  if (!t) return null
  return { id: t.id, name: t.name, from: t.default, to: desiredState }
}

const PERFORMANCE_IDS = [
  'spotlight', 'timemachine', 'photos_analysis', 'icloud_sync', 'siri',
  'auto_updates', 'power_nap', 'handoff', 'mail_fetch', 'analytics',
]

const MAX_IDS = [
  ...PERFORMANCE_IDS,
  'ollama', 'app_nap', 'high_power_mode', 'location_services', 'airplay_receiver',
]

const HYPER_IDS = [...MAX_IDS, 'notification_center', 'mdns']

function buildProfileToggles(ids) {
  return ids
    .map(id => {
      const t = BY_ID[id]
      if (!t) return null
      // default=off means the profile turns it ON; default=on means the profile turns it OFF
      const to = t.default === 'off' ? 'on' : 'off'
      return { id: t.id, name: t.name, from: t.default, to }
    })
    .filter(Boolean)
}

export const PROFILES_FRONTEND = {
  default: {
    description: 'Restore Apple defaults for all toggles',
    toggles: ALL_TOGGLES
      .filter(t => !t.hardwareDependent)
      .map(t => ({ id: t.id, name: t.name, from: '—', to: t.default })),
  },
  performance: {
    description: 'Safe background service cuts — recommended for daily inference use',
    toggles: buildProfileToggles(PERFORMANCE_IDS),
  },
  max: {
    description: 'Performance + Ollama, App Nap, High Power Mode, Location, AirPlay',
    toggles: buildProfileToggles(MAX_IDS),
  },
  hyper: {
    description: 'All Max + Notification Center, mDNS — breaks AirDrop / AirPlay',
    toggles: buildProfileToggles(HYPER_IDS),
  },
}

/**
 * Best-effort: which profile (if any) the current live toggle states match.
 * Display-only — used to mark a profile ACTIVE. Toggles whose live state is
 * unknown/unsupported are ignored. Most-specific profile wins. `liveById`
 * maps toggle id -> 'on' | 'off' | other.
 */
export function detectActiveProfile(liveById) {
  for (const name of ['hyper', 'max', 'performance', 'default']) {
    const matches = PROFILES_FRONTEND[name].toggles.every(t => {
      const s = liveById[t.id]
      if (s !== 'on' && s !== 'off') return true
      return s === t.to
    })
    if (matches) return name
  }
  return null
}
