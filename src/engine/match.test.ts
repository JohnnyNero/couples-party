import { describe, it, expect } from 'vitest'
import { normalize, isMatch } from './match'

describe('normalize', () => {
  it('lowercases and trims', () => { expect(normalize('  Cat ')).toBe('cat') })
  it('folds simple plurals', () => { expect(normalize('cats')).toBe('cat') })
  it('does not fold -ss', () => { expect(normalize('glass')).toBe('glass') })
  it('does not fold short words', () => { expect(normalize('is')).toBe('is') })
})

describe('isMatch', () => {
  it('matches case/space/plural variants', () => {
    expect(isMatch('Cats', ' cat ')).toBe(true)
  })
  it('does not match different words', () => {
    expect(isMatch('cat', 'dog')).toBe(false)
  })
  it('null never matches (strict)', () => {
    expect(isMatch(null, 'cat')).toBe(false)
    expect(isMatch('cat', null)).toBe(false)
    expect(isMatch(null, null)).toBe(false)
  })
  it('empty strings never match', () => {
    expect(isMatch('', '')).toBe(false)
  })
})
