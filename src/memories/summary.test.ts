import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { sessionMemory, worthKeeping } from './summary'

const CONTENT = {
  mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?'],
  drawPrompts: [{ id: 'd01', text: 'dream pet' }],
  lightsQuestions: ['What made you laugh today?'],
}

// Tonight on night 4 (the clock, Mr & Mrs, Draw), played for real where it matters.
function playNight(): SessionState {
  let s = initialState(7, 'tonight', CONTENT, 4)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
  for (let i = 1; i < 300 && s.phase !== 'DONE'; i++) {
    const t = i * 1000
    if (s.phase === 'MM_ANSWER') {
      s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'lasagne', predict: 'curry' }, t)
      s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'B', answer: 'curry', predict: 'lasagne' }, t)
    } else if (s.phase === 'MM_JUDGE') {
      s = reduce(s, { type: 'JUDGE', player: 'A', correct: true }, t)
      s = reduce(s, { type: 'JUDGE', player: 'B', correct: true }, t)
      s = reduce(s, { type: 'TIMEOUT' }, t)
    } else if (s.phase === 'DRAW_SKETCH') {
      for (const drawer of ['A', 'B'] as const) {
        s = reduce(s, { type: 'SUBMIT_DRAWING', player: drawer, answer: 'otter', strokes: [[[0.12345, 0.6789], [0.5, 0.5]]] }, t)
      }
    } else if (s.phase === 'DRAW_GUESS') {
      const guesser = s.draw!.rounds[s.draw!.current].drawer === 'A' ? 'B' : 'A'
      s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: guesser, text: 'otter' }, t)
    } else if (s.phase.endsWith('_RESULT') || s.phase === 'LIGHTS_OUT') {
      s = reduce(s, { type: 'CONTINUE', player: 'A' }, t)
    } else s = reduce(s, { type: 'TIMEOUT' }, t)
  }
  return s
}

describe('sessionMemory', () => {
  it('keeps nothing before a game has been played', () => {
    let s = initialState(7, 'tonight', CONTENT, 4)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
    expect(worthKeeping(sessionMemory(s))).toBe(false)
  })
  it('keeps the answers worth looking back on, with names written in', () => {
    const s = playNight()
    expect(worthKeeping(sessionMemory(s))).toBe(true)
    const m = sessionMemory(s)
    expect(m.players).toEqual({ A: 'Sam', B: 'Alex' })
    expect(m.game).toBe('tonight')
    expect(m.mrmrs).toHaveLength(2)
    expect(m.mrmrs![0]).toMatchObject({ question: expect.any(String), answer: { A: 'lasagne', B: 'curry' }, verdict: { A: true, B: true } })
    expect(m.draw).toHaveLength(2)
    expect(m.draw![0]).toMatchObject({ question: 'dream pet', answer: 'otter', guess: 'otter', correct: true })
    expect(m.draw![0].strokes).toEqual([[[0.123, 0.679], [0.5, 0.5]]]) // rounded to keep it small
    expect(m.lights).toBe('What made you laugh today?')
    expect(m.games.map((g) => g.label)).toContain('Mr & Mrs')
    expect(m.score.A + m.score.B).toBeGreaterThan(0)
    // Games that never got content don't turn up as empty sections.
    expect(m.wave).toBeUndefined()
    expect(m.chain).toBeUndefined()
  })
})
