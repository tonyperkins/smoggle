import { describe, it, expect } from 'vitest'
import { cn } from '../src/lib/utils.js'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('base', false && 'no', true && 'yes')).toBe('base yes')
  })

  it('handles undefined and null', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('deduplicates tailwind classes (twMerge)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
