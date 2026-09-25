import { describe, it, expect } from 'vitest'
import { freshen, noteShown, shownIn, unseen } from './seen'
import { initialState, type Content } from '../engine/state'
import { reduce } from '../engine/reducer'

const id = (t: string) => t

describe('unseen', () => {
  it('drops what has been seen, in the pool’s own order', () => {
    expect(unseen(['a', 'b', 'c', 'd', 'e'], id, ['b', 'd'], 2)).toEqual(['a', 'c', 'e'])
  })
  it('brings back the longest-ago seen when too few are left', () => {
    // Seen oldest first: e, then a, then c. Need 3, only b is unseen → e and a return.
    expect(unseen(['a', 'b', 'c', 'e'], id, ['e', 'a', 'c'], 3)).toEqual(['a', 'b', 'e'])
  })
  it('never shrinks a pool that is already too small', () => {
    expect(unseen(['a', 'b'], id, ['a', 'b'], 5)).toEqual(['a', 'b'])
  })
  it('ignores seen items no longer in the content file', () => {
    expect(unseen(['a', 'b'], id, ['gone', 'a'], 1)).toEqual(['b'])
  })
})

const CONTENT: Content = {
  themes: [],
  fingerStatements: [],
  spectrums: [],
  drawPrompts: [],
  likelyStatements: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10'],
  mrmrsQuestions: [],
  lightsQuestions: ['q1', 'q2', 'q3'],
}

describe('freshen', () => {
  it('keeps enough of each pool for the longest session', () => {
    const out = freshen(CONTENT, { likely: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] })
    expect(out.likelyStatements).toHaveLength(6) // the full night asks for six
    expect(out.likelyStatements).toEqual(['s1', 's2', 's3', 's4', 's9', 's10'])
  })
  it('walks a one-a-night pool without repeating until it has to', () => {
    expect(freshen(CONTENT, { lights: ['q1', 'q3'] }).lightsQuestions).toEqual(['q2'])
    expect(freshen(CONTENT, { lights: ['q3', 'q2', 'q1'] }).lightsQuestions).toEqual(['q3'])
  })
})

describe('shownIn / noteShown', () => {
  const started = () => {
    let s = initialState(1, 'likely', CONTENT)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
  }
  it('only counts rounds you have reached, not ones drawn for later', () => {
    const s = started()
    expect(s.likely!.rounds.length).toBeGreaterThan(1)
    expect(shownIn(s).likely).toEqual([s.likely!.rounds[0].statement])
  })
  it('moves a re-shown item to the recent end, and reports no change for items already logged', () => {
    const logged = new Set<string>()
    const log = { likely: ['x', 'y'] }
    const shown = { likely: ['x'], finger: [], mrmrs: [], lights: [], wave: [], draw: [], list: [] }
    const next = noteShown(log, shown, logged)
    expect(next.likely).toEqual(['y', 'x'])
    expect(noteShown(next, shown, logged)).toBe(next)
  })
})
