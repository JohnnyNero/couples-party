import { describe, it, expect, beforeEach } from 'vitest'
import { getLeaderboard, recordSession } from './leaderboard'

// Node has no global localStorage; a tiny in-memory polyfill is enough to exercise the
// real read/write/parse paths.
function fakeStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => { data.set(k, v) },
    removeItem: (k: string) => { data.delete(k) },
    clear: () => data.clear(),
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage(), configurable: true })
})

const MONDAY = new Date('2026-09-21T12:00:00Z')
const NEXT_MONDAY = new Date('2026-09-28T12:00:00Z')

describe('leaderboard', () => {
  it('starts empty', () => {
    const board = getLeaderboard(MONDAY)
    expect(board.weekly).toEqual({})
    expect(board.allTime).toEqual({})
  })

  it('accumulates points per name into both weekly and all-time', () => {
    recordSession({ Sam: 3, Alex: 1 }, MONDAY)
    recordSession({ Sam: 1, Alex: 0 }, MONDAY)
    const board = getLeaderboard(MONDAY)
    expect(board.weekly).toEqual({ Sam: 4, Alex: 1 })
    expect(board.allTime).toEqual({ Sam: 4, Alex: 1 })
  })

  it('ignores zero-point entries and blank names', () => {
    recordSession({ Sam: 0, '': 5 }, MONDAY)
    const board = getLeaderboard(MONDAY)
    expect(board.weekly).toEqual({})
    expect(board.allTime).toEqual({})
  })

  it('rolls the weekly bucket over on a new week, keeping all-time', () => {
    recordSession({ Sam: 3 }, MONDAY)
    const board = getLeaderboard(NEXT_MONDAY)
    expect(board.weekly).toEqual({})
    expect(board.allTime).toEqual({ Sam: 3 })
  })

  it('survives a broken localStorage without throwing', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem() { throw new Error('blocked') },
        setItem() { throw new Error('blocked') },
      },
      configurable: true,
    })
    expect(() => recordSession({ Sam: 1 }, MONDAY)).not.toThrow()
    expect(() => getLeaderboard(MONDAY)).not.toThrow()
  })

  it('survives corrupt JSON in storage', () => {
    localStorage.setItem('couples-party:leaderboard', '{not json')
    const board = getLeaderboard(MONDAY)
    expect(board.weekly).toEqual({})
    expect(board.allTime).toEqual({})
  })
})
