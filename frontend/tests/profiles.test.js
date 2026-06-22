import { describe, it, expect } from 'vitest'
import { PROFILES_FRONTEND, detectActiveProfile } from '../src/lib/profiles.js'

describe('PROFILES_FRONTEND', () => {
  it('has all four profiles', () => {
    expect(Object.keys(PROFILES_FRONTEND).sort()).toEqual(['default', 'hyper', 'max', 'performance'])
  })

  it('performance has 10 toggles', () => {
    expect(PROFILES_FRONTEND.performance.toggles).toHaveLength(10)
  })

  it('max has 15 toggles', () => {
    expect(PROFILES_FRONTEND.max.toggles).toHaveLength(15)
  })

  it('hyper has 17 toggles', () => {
    expect(PROFILES_FRONTEND.hyper.toggles).toHaveLength(17)
  })

  it('performance toggles all turn off', () => {
    for (const t of PROFILES_FRONTEND.performance.toggles) {
      expect(t.to).toBe('off')
    }
  })

  it('max includes high_power_mode turned ON', () => {
    const hpm = PROFILES_FRONTEND.max.toggles.find(t => t.id === 'high_power_mode')
    expect(hpm).toBeDefined()
    expect(hpm.to).toBe('on')
    expect(hpm.from).toBe('off')
  })

  it('hyper includes notification_center and mdns', () => {
    const ids = PROFILES_FRONTEND.hyper.toggles.map(t => t.id)
    expect(ids).toContain('notification_center')
    expect(ids).toContain('mdns')
  })

  it('default profile restores all toggles to their default state', () => {
    for (const t of PROFILES_FRONTEND.default.toggles) {
      const expected = t.id === 'high_power_mode' ? 'off' : 'on'
      expect(t.to).toBe(expected)
    }
  })

  it('default profile excludes hardware-dependent toggles', () => {
    const ids = PROFILES_FRONTEND.default.toggles.map(t => t.id)
    expect(ids).not.toContain('high_power_mode')
  })
})

describe('detectActiveProfile', () => {
  // detectActiveProfile checks most-specific first (hyper → max → performance → default)
  // and treats unknown/missing toggle states as matching (returns true).
  // So to detect a less-specific profile, the more-specific toggles must be
  // explicitly set to a NON-matching state.

  it('returns hyper when all hyper toggles match their target', () => {
    const live = {}
    for (const t of PROFILES_FRONTEND.hyper.toggles) {
      live[t.id] = t.to
    }
    expect(detectActiveProfile(live)).toBe('hyper')
  })

  it('detects max when max toggles match and hyper-only toggles do NOT match', () => {
    const live = {}
    for (const t of PROFILES_FRONTEND.max.toggles) {
      live[t.id] = t.to
    }
    // Set hyper-only toggles to their default (non-matching) state
    live['notification_center'] = 'on'  // hyper wants off, so this breaks hyper match
    live['mdns'] = 'on'                 // hyper wants off, so this breaks hyper match
    expect(detectActiveProfile(live)).toBe('max')
  })

  it('detects performance when performance toggles match and max-only toggles do NOT', () => {
    const live = {}
    for (const t of PROFILES_FRONTEND.performance.toggles) {
      live[t.id] = t.to
    }
    // Set max-only toggles to non-matching states
    live['ollama'] = 'on'              // max wants off
    live['app_nap'] = 'on'             // max wants off
    live['location_services'] = 'on'   // max wants off
    live['airplay_receiver'] = 'on'    // max wants off
    expect(detectActiveProfile(live)).toBe('performance')
  })

  it('returns null when toggles do not match any profile', () => {
    // spotlight=on breaks performance/max/hyper (they want off)
    // notification_center=off breaks default (it wants on)
    const live = { spotlight: 'on', notification_center: 'off' }
    expect(detectActiveProfile(live)).toBeNull()
  })

  it('ignores unknown/unsupported toggle states', () => {
    const live = {}
    for (const t of PROFILES_FRONTEND.hyper.toggles) {
      live[t.id] = t.to
    }
    live.some_unknown_toggle = 'unknown'
    expect(detectActiveProfile(live)).toBe('hyper')
  })

  it('prefers most-specific profile (hyper over max over performance)', () => {
    const live = {}
    for (const t of PROFILES_FRONTEND.hyper.toggles) {
      live[t.id] = t.to
    }
    expect(detectActiveProfile(live)).toBe('hyper')
  })

  it('treats all-unknown as hyper (since unknown states are ignored/match)', () => {
    // This is the documented behavior: unknown/unsupported toggles are ignored,
    // so an empty liveById means every profile "matches" — most-specific wins.
    expect(detectActiveProfile({})).toBe('hyper')
  })
})
