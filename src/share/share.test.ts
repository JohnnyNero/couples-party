import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { roster } from '../engine/roster'
import { dayIndex } from '../daily/dates'
import { dailyNumber, dailySeed } from './daily'
import { cardText, summarise, tierFor } from './card'
import { PER_GAME } from '../engine/standing'

const joined = (s: SessionState) => {
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const STATEMENTS = Array.from({ length: 20 }, (_, i) => `statement ${i}`)

describe('Tonight, the same for everyone', () => {
  it('is numbered from its first day, one a day', () => {
    expect(dailyNumber(dayIndex('2026-09-27'))).toBe(1)
    expect(dailyNumber(dayIndex('2026-10-06'))).toBe(10)
  })
  it('is the same set, with the same content, for every couple that day', () => {
    const day = dayIndex('2026-10-01')
    const one = joined(initialState(dailySeed(day), 'tonight', { fingerStatements: STATEMENTS }, day))
    const two = joined(initialState(dailySeed(day), 'tonight', { fingerStatements: STATEMENTS }, day))
    expect(one).toEqual(two)
    expect(roster('tonight', day)).toEqual(roster(one.game, one.night))
  })
  it('reads as "Tonight #N" on the card, and a replay says so', () => {
    const day = dayIndex('2026-09-29')
    const s = { ...joined(initialState(dailySeed(day), 'tonight', { fingerStatements: STATEMENTS }, day)), phase: 'DONE' as const }
    expect(summarise(s).label).toBe('Tonight #3')
    expect(summarise(s, { replay: true }).label).toBe('Tonight #3 · replay')
    expect(cardText(summarise(s)).split('\n')[0]).toBe('Coupled · Tonight #3')
  })
})

describe('the share card', () => {
  it('names every together score kindly', () => {
    expect(tierFor(PER_GAME.us * 2 * 1.6, 2)).toBe('Frighteningly us')
    expect(tierFor(PER_GAME.us * 2, 2)).toBe('In sync')
    expect(tierFor(0, 2)).toBe('Beautifully different')
    expect(tierFor(10, 0)).toBe(null)
  })
  it('gives nothing away: names, scores and coloured squares, never an answer', () => {
    let s = joined(initialState(3, 'finger', { fingerStatements: ['I once ate a whole cake'] }))
    s = { ...s, phase: 'DONE' }
    const text = cardText(summarise(s, { date: new Date('2026-09-27T20:00:00') }))
    expect(text).toContain('Sam')
    expect(text).toContain('Alex')
    expect(text).not.toContain('cake')
    expect(text.split('\n').length).toBeLessThanOrEqual(6)
  })
})
