import { describe, it, expect } from 'vitest'
import { computeRecords } from './records'
import type { RecordRow } from '../daily/api'

const row = (over: Partial<RecordRow>): RecordRow => ({
  playedOn: '2026-09-20', game: 'tonight', players: { A: 'Johnny', B: 'Roxx' }, score: { A: 10, B: 5 }, team: 20, finished: true, ...over,
})

describe('records', () => {
  it('finds you by name, whichever seat you were in', () => {
    const r = computeRecords([
      row({ score: { A: 10, B: 5 } }), // Johnny wins
      row({ players: { A: 'Roxx', B: 'Johnny' }, score: { A: 12, B: 3 } }), // Roxx wins
      row({ players: { A: 'Roxx', B: 'Johnny' }, score: { A: 2, B: 9 } }), // Johnny wins
    ], 'Johnny', '2026-09-26')
    expect(r.wins).toEqual({ you: 2, them: 1, level: 0 })
    expect(r.bestNight.tonight.you?.value).toBe(10)
    expect(r.bestNight.tonight.them?.value).toBe(12)
    expect(r.bestNight.full.you).toBeNull()
  })
  it('keeps Tonight and full-session bests apart, and only counts finished nights', () => {
    const r = computeRecords([
      row({ team: 30 }),
      row({ team: 45, finished: false }),
      row({ game: 'full', team: 80, playedOn: '2026-09-22' }),
      row({ game: 'wave', team: 99 }), // a single game isn't a night
    ], 'Johnny', '2026-09-26')
    expect(r.together.tonight).toEqual({ value: 30, on: '2026-09-20' })
    expect(r.together.full).toEqual({ value: 80, on: '2026-09-22' })
    expect(r.wins.you + r.wins.them + r.wins.level).toBe(2)
    // This week (from Monday the 21st): only the full session; the rest are the 20th.
    expect(r.together.thisWeek).toBe(80)
  })
  it('takes the best team score per game from anywhere, and the longest chain', () => {
    const r = computeRecords([
      row({ games: [{ label: 'Mind Meld', points: { A: 0, B: 0 }, team: 12 }], longestChain: 8 }),
      row({ games: [{ label: 'Mind Meld', points: { A: 0, B: 0 }, team: 18 }, { label: 'Tiebreaker', points: { A: 1, B: 0 }, team: 0 }], longestChain: 14 }),
      row({ team: null, games: [{ label: 'Wavelength', points: { A: 3, B: 4 } }] }), // before team points
    ], 'Johnny', '2026-09-26')
    expect(r.games).toEqual([{ label: 'Mind Meld', best: { value: 18, on: '2026-09-20' } }])
    expect(r.longestChain?.value).toBe(14)
  })
})
