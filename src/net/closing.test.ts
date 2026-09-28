import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from '../engine/state'
import { freshMemo, isLeftover, shown } from './closing'

const at = (seed: number, phase: SessionState['phase']): SessionState => ({ ...initialState(seed, 'follow'), phase })

describe('a finished game', () => {
  it('stays on the end screen of the game you played, whatever the room does next', () => {
    const memo = freshMemo()
    expect(shown(memo, at(7, 'JOIN')).phase).toBe('JOIN')
    expect(shown(memo, at(7, 'FOLLOW_PLAY')).phase).toBe('FOLLOW_PLAY')
    const end = shown(memo, at(7, 'DONE'))
    expect(end.phase).toBe('DONE')
    // Your partner starts something new in the room: you still see your end screen.
    expect(shown(memo, at(99, 'JOIN'))).toBe(end)
    expect(shown(memo, at(99, 'TWIST_SAY'))).toBe(end)
  })
  it('is not yours to keep when you only arrived to find it there', () => {
    const memo = freshMemo()
    expect(shown(memo, at(7, 'DONE')).phase).toBe('DONE') // the last game's leftovers
    expect(shown(memo, at(99, 'JOIN')).seed).toBe(99) // replaced by your new one
    expect(shown(memo, at(99, 'TWIST_SAY')).phase).toBe('TWIST_SAY')
  })
  it('tells a leftover from a game still going', () => {
    expect(isLeftover(at(7, 'DONE'))).toBe(true)
    expect(isLeftover(at(7, 'FOLLOW_PLAY'))).toBe(false)
    expect(isLeftover(undefined)).toBe(false)
  })
})
