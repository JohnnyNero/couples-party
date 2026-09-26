import { beforeEach, describe, expect, it } from 'vitest'
import { localDate } from './dates'
import { pinned, settle } from './pins'

// No browser here: a stand-in localStorage.
const mem = new Map<string, string>()
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage

describe('pinned set-screen questions', () => {
  const day = localDate(1)
  beforeEach(() => localStorage.clear())

  it('keeps the first question shown, whatever the day works out to next time', () => {
    expect(settle(day, 'word', undefined, () => ({ prompt: 'first' }))).toEqual({ prompt: 'first' })
    expect(settle(day, 'word', undefined, () => ({ prompt: 'second' }))).toEqual({ prompt: 'first' })
  })
  it("switches to the one your partner already set, and keeps that", () => {
    settle(day, 'word', undefined, () => ({ prompt: 'mine' }))
    expect(settle(day, 'word', { prompt: 'theirs' }, () => ({ prompt: 'mine' }))).toEqual({ prompt: 'theirs' })
    expect(settle(day, 'word', undefined, () => ({ prompt: 'other' }))).toEqual({ prompt: 'theirs' })
  })
  it("keeps The Dial's mark yours, even on your partner's scale", () => {
    const first = settle(day, 'dial', undefined, () => ({ prompt: 'Cold | Hot', target: 30 }))
    expect(first).toEqual({ prompt: 'Cold | Hot', target: 30 })
    expect(settle(day, 'dial', { prompt: 'Quiet | Loud' }, () => ({ prompt: 'x', target: 90 }))).toEqual({ prompt: 'Quiet | Loud', target: 30 })
  })
  it("doesn't pin nothing when the content hadn't loaded", () => {
    settle(day, 'numbers', undefined, () => ({ questions: [] }))
    expect(pinned(day, 'numbers')).toBeNull()
    expect(settle(day, 'numbers', undefined, () => ({ questions: ['q'] }))).toEqual({ questions: ['q'] })
  })
})
