import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { DEFAULT_SIZE, isFiller, kindOf, roster, SIZES, sizeOf } from './roster'

// Game night: dealt fresh each time, as long as you like, dealt again if you don't fancy
// it, and started from the lobby once you're both in. No Lights Out.

const joined = (seed = 7) => {
  let s: SessionState = initialState(seed, 'quick', { lightsQuestions: ['Goodnight?'] })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const keys = (s: SessionState) => roster(s.game, s.night).map((e) => e.key)

describe('game night', () => {
  it('deals each length right: the games take turns between the kinds, a filler after every second, never last', () => {
    for (let seed = 1; seed < 60; seed++) {
      SIZES.forEach((size, i) => {
        const r = roster('quick', seed * SIZES.length + i).map((e) => e.key)
        const games = r.filter((k) => !isFiller(k))
        expect(games).toHaveLength(size.games)
        expect(new Set(games).size).toBe(size.games)
        expect(r.filter(isFiller)).toHaveLength(size.fillers)
        expect(new Set(r.filter(isFiller)).size).toBe(size.fillers)
        expect(isFiller(r[r.length - 1])).toBe(false)
        expect(r).not.toContain('lights')
        for (let g = 1; g < games.length; g++) expect(kindOf(games[g])).not.toBe(kindOf(games[g - 1]))
        r.forEach((k, j) => { if (isFiller(k)) expect(r.slice(0, j).filter((x) => !isFiller(x)).length % 2).toBe(0) })
      })
    }
  })

  it('opens at the usual length, deals from its own seed, and is a different mix from one night to the next', () => {
    const s = initialState(4242, 'quick')
    expect(sizeOf(s.night)).toBe(DEFAULT_SIZE)
    expect(roster(s.game, s.night)).toEqual(roster('quick', s.night))
    const mixes = new Set(Array.from({ length: 20 }, (_, i) => keys(initialState(1000 + i * 7919, 'quick')).join()))
    expect(mixes.size).toBeGreaterThan(15)
  })

  it('waits in the lobby once you are both in, for one of you to start it', () => {
    let s = joined()
    expect(s.phase).toBe('JOIN')
    s = reduce(s, { type: 'START', player: 'B' }, 2000)
    expect(s.phase).not.toBe('JOIN')
  })

  it('can’t start with only one of you there', () => {
    let s = initialState(7, 'quick')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    expect(reduce(s, { type: 'START', player: 'A' }, 2000)).toBe(s)
  })

  it('changes length in the lobby, keeping the deal; rerolls to a different line-up of the same length', () => {
    let s = joined()
    const deal = Math.floor(s.night / SIZES.length)
    s = reduce(s, { type: 'SET_SIZE', player: 'A', size: 2 }, 2000)
    expect(sizeOf(s.night)).toBe(2)
    expect(Math.floor(s.night / SIZES.length)).toBe(deal)
    expect(keys(s).filter((k) => !isFiller(k))).toHaveLength(SIZES[2].games)
    const before = keys(s).join()
    for (let i = 0; i < 5; i++) {
      const was = keys(s).join()
      s = reduce(s, { type: 'REROLL', player: 'B' }, 2000)
      expect(keys(s).join()).not.toBe(was)
      expect(sizeOf(s.night)).toBe(2)
    }
    expect(keys(s).join()).not.toBe(before)
    expect(reduce(s, { type: 'SET_SIZE', player: 'A', size: 9 }, 2000)).toBe(s) // no such length
  })

  it('leaves the set-up alone once it has started, and other sessions never wait for it', () => {
    let s = reduce(joined(), { type: 'START', player: 'A' }, 2000)
    expect(reduce(s, { type: 'REROLL', player: 'A' }, 3000)).toBe(s)
    expect(reduce(s, { type: 'SET_SIZE', player: 'A', size: 0 }, 3000)).toBe(s)
    let t = initialState(3, 'tonight', { lightsQuestions: ['Goodnight?'] })
    t = reduce(t, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    t = reduce(t, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(t.phase).not.toBe('JOIN')
    expect(reduce(t, { type: 'REROLL', player: 'A' }, 2000)).toBe(t)
  })

  it('ends on its last scoreboard, never Lights Out', () => {
    let s = reduce(reduce(joined(), { type: 'SET_SIZE', player: 'A', size: 0 }, 1500), { type: 'START', player: 'A' }, 2000)
    const seen = new Set<string>()
    for (let i = 0; i < 300 && s.phase !== 'DONE'; i++) {
      seen.add(s.phase)
      s = s.phase.endsWith('_RESULT') || s.phase === 'INTRO'
        ? reduce(s, { type: s.phase === 'INTRO' ? 'READY' : 'CONTINUE', player: 'A' }, 1000 * i)
        : reduce(s, { type: 'TIMEOUT' }, 1e6 * (i + 1))
      if (s.phase === 'INTRO') s = reduce(s, { type: 'READY', player: 'B' }, 1000 * i)
    }
    expect(s.phase).toBe('DONE')
    expect(seen.has('LIGHTS_OUT')).toBe(false)
  })
})
