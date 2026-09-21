import { describe, it, expect } from 'vitest'
import { initialState, type ListAct } from '../engine/state'
import { themeText, rankerOf } from './list'

const act: ListAct = {
  author: 'A', themeId: 't001', items: [], placeIndex: 0, displacement: null,
}

describe('themeText', () => {
  const base = () => {
    const s = initialState(1, undefined, [{ id: 't001', text: 'seven things {name} would miss', pool: [] }])
    s.players.A.name = 'Sam'
    return s
  }
  it('substitutes the author\'s name', () => {
    expect(themeText(base(), act)).toBe('seven things Sam would miss')
  })
  it('falls back to the player id when no name has arrived', () => {
    const s = base()
    s.players.A.name = ''
    expect(themeText(s, act)).toBe('seven things A would miss')
  })
  it('never leaves a raw placeholder on screen when the theme is missing', () => {
    const s = base()
    expect(themeText(s, { ...act, themeId: 'nope' })).not.toContain('{name}')
  })
})

describe('rankerOf', () => {
  it('is the player who did not write the list', () => {
    expect(rankerOf(act)).toBe('B')
    expect(rankerOf({ ...act, author: 'B' })).toBe('A')
  })
})
