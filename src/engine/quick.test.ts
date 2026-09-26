import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { roster } from './roster'

// A quick game: dealt fresh each time, three games and a filler, no Lights Out.

describe('a quick game', () => {
  it('deals three different games with a filler before the last, and no question at the end', () => {
    for (let seed = 1; seed < 40; seed++) {
      const r = roster('quick', seed).map((e) => e.key)
      expect(r).toHaveLength(4)
      expect(['circle', 'clock']).toContain(r[2])
      const games = [r[0], r[1], r[3]]
      expect(new Set(games).size).toBe(3)
      for (const g of games) expect(['circle', 'clock', 'lights', 'list', 'likely']).not.toContain(g)
    }
  })
  it('is a different mix from one game to the next', () => {
    const mixes = new Set(Array.from({ length: 20 }, (_, i) => roster('quick', 1000 + i * 7919).map((e) => e.key).join(',')))
    expect(mixes.size).toBeGreaterThan(8)
  })
  it('deals from its own seed, so both phones agree on it', () => {
    const s = initialState(4242, 'quick')
    expect(s.night).toBe(4242)
    expect(roster(s.game, s.night)).toEqual(roster('quick', 4242))
  })
  it('ends on its last scoreboard, never Lights Out', () => {
    let s: SessionState = initialState(7, 'quick', { lightsQuestions: ['Goodnight?'] })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    const seen = new Set<string>()
    for (let i = 0; i < 200 && s.phase !== 'DONE'; i++) {
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
