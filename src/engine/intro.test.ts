import { describe, it, expect } from 'vitest'
import { initialState, type Content, type Game } from './state'
import { reduce } from './reducer'
import { DURATIONS } from './phases'

const CONTENT: Partial<Content> = {
  mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?'],
  lightsQuestions: ['What made you laugh today?'],
}
const start = (game: Game, intros = true) => {
  let s = { ...initialState(1, game, CONTENT, 0), intros }
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('title cards', () => {
  it('put a card in front of a game, with the game already set up underneath', () => {
    const s = start('mrmrs')
    expect(s.phase).toBe('INTRO')
    expect(s.intro).toMatchObject({ key: 'mrmrs', ready: { A: false, B: false }, resume: 'MM_ANSWER' })
    expect(s.mrmrs?.rounds).toHaveLength(2) // as many as the content has
    expect(s.phaseEndsAt).toBe(1000 + DURATIONS.INTRO!)
  })
  it('moves on once you are both ready, with the first round’s clock full', () => {
    let s = start('mrmrs')
    s = reduce(s, { type: 'READY', player: 'A' }, 3000)
    expect(s.phase).toBe('INTRO')
    expect(reduce(s, { type: 'READY', player: 'A' }, 3100)).toBe(s) // once each
    s = reduce(s, { type: 'READY', player: 'B' }, 5000)
    expect(s.phase).toBe('MM_ANSWER')
    expect(s.intro).toBe(null)
    expect(s.phaseEndsAt).toBe(5000 + DURATIONS.MM_ANSWER!)
  })
  it('moves on by itself when its clock runs out', () => {
    const s = reduce(start('mrmrs'), { type: 'TIMEOUT' }, 20000)
    expect(s.phase).toBe('MM_ANSWER')
    expect(s.phaseEndsAt).toBe(20000 + DURATIONS.MM_ANSWER!)
  })
  it('never shows for a game with nothing to play, nor for Lights Out', () => {
    let s = start('tonight') // night 0: Mr & Mrs is the first game with content here
    expect(s.intro?.key).toBe('mrmrs')
    s = reduce(s, { type: 'TIMEOUT' }, 2000)
    for (let i = 0; i < 100 && s.phase !== 'LIGHTS_OUT' && s.phase !== 'DONE'; i++) {
      expect(s.intro?.key).not.toBe('lights')
      s = s.phase.endsWith('_RESULT') ? reduce(s, { type: 'CONTINUE', player: 'A' }, 3000 + i) : reduce(s, { type: 'TIMEOUT' }, 3000 + i * 100000)
    }
    expect(s.phase).toBe('LIGHTS_OUT')
  })
  it('stays off unless the session asks for them', () => {
    expect(start('mrmrs', false).phase).toBe('MM_ANSWER')
  })
})
