import { describe, it, expect } from 'vitest'
import { resolveBot, resolveMode } from './mode'

describe('resolveMode', () => {
  it('returns screen for ?mode=screen', () => expect(resolveMode('?mode=screen')).toBe('screen'))
  it('returns duo for ?mode=duo', () => expect(resolveMode('?mode=duo')).toBe('duo'))
  it('returns null when the param is absent', () => expect(resolveMode('')).toBe(null))
  it('returns null for an unknown value', () => expect(resolveMode('?mode=xyz')).toBe(null))
  it('finds mode alongside other params (e.g. a shared link)', () =>
    expect(resolveMode('?debug=1&mode=duo')).toBe('duo'))
})

describe('resolveBot', () => {
  it('is on for ?bot=1', () => expect(resolveBot('?mode=duo&bot=1')).toBe(true))
  it('is off when absent or anything else', () => {
    expect(resolveBot('?mode=duo')).toBe(false)
    expect(resolveBot('?bot=0')).toBe(false)
  })
})
