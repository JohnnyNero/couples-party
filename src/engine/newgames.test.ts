import { describe, it, expect } from 'vitest'
import { initialState, type Content, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { roster, roundsFor } from './roster'
import { SCORING, likelyPoints, mrmrsPoints, standing } from './standing'

const CONTENT: Partial<Content> = {
  likelyStatements: ['cry at an advert', 'fall asleep first', 'burn dinner', 'snore', 'get lost', 'go viral'],
  mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?', 'Your first gig?', 'Your worst habit?', 'Your dream job?'],
  drawPrompts: [{ id: 'd01', text: 'comfort food' }, { id: 'd02', text: 'dream pet' }],
  lightsQuestions: ['What made you laugh today?'],
}

const start = (game: Game, content: Partial<Content> = CONTENT, night = 0) => {
  let s = initialState(1, game, content, night)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const cont = (s: SessionState) => reduce(s, { type: 'CONTINUE', player: 'A' }, 9000)

// ---------------------------------------------------------------- Who's More Likely

describe("who's more likely", () => {
  it('opens on the first statement with nobody picked', () => {
    const s = start('likely')
    expect(s.phase).toBe('LIKELY_ROUND')
    expect(s.likely?.rounds).toHaveLength(roundsFor(s, 'likely'))
    expect(s.likely?.rounds[0].picks).toEqual({ A: null, B: null })
  })
  it('reveals once both have picked, and pays you both for agreeing', () => {
    let s = start('likely')
    s = reduce(s, { type: 'PICK_LIKELY', player: 'A', pick: 'B' }, 2000)
    expect(s.phase).toBe('LIKELY_ROUND') // still waiting on Alex
    s = reduce(s, { type: 'PICK_LIKELY', player: 'B', pick: 'B' }, 2000)
    expect(s.phase).toBe('LIKELY_REVEAL')
    expect(likelyPoints(s.likely)).toEqual({ A: SCORING.likelyAgree, B: SCORING.likelyAgree })
  })
  it('pays nobody for disagreeing', () => {
    let s = start('likely')
    s = reduce(s, { type: 'PICK_LIKELY', player: 'A', pick: 'A' }, 2000)
    s = reduce(s, { type: 'PICK_LIKELY', player: 'B', pick: 'B' }, 2000)
    expect(likelyPoints(s.likely)).toEqual({ A: 0, B: 0 })
  })
  it('will not let you change your pick', () => {
    let s = start('likely')
    s = reduce(s, { type: 'PICK_LIKELY', player: 'A', pick: 'A' }, 2000)
    expect(reduce(s, { type: 'PICK_LIKELY', player: 'A', pick: 'B' }, 2100)).toBe(s)
  })
  it('a round nobody finished counts as no agreement', () => {
    let s = start('likely')
    s = reduce(s, { type: 'PICK_LIKELY', player: 'A', pick: 'A' }, 2000)
    s = reduce(s, { type: 'TIMEOUT' }, 20000)
    expect(s.phase).toBe('LIKELY_REVEAL')
    expect(likelyPoints(s.likely)).toEqual({ A: 0, B: 0 })
  })
  it('ends on its scoreboard after the last statement', () => {
    let s = start('likely')
    for (let i = 0; i < 20 && s.phase !== 'LIKELY_RESULT'; i++) s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    expect(s.phase).toBe('LIKELY_RESULT')
    expect(s.likely?.current).toBe(roundsFor(s, 'likely') - 1)
  })
})

// ---------------------------------------------------------------- Mr & Mrs

const bothAnswer = (s: SessionState, a: [string, string], b: [string, string]) => {
  s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: a[0], predict: a[1] }, 2000)
  return reduce(s, { type: 'SUBMIT_MRMRS', player: 'B', answer: b[0], predict: b[1] }, 2000)
}

describe('mr & mrs', () => {
  it('waits for both of you before revealing anything', () => {
    let s = start('mrmrs')
    expect(s.phase).toBe('MM_ANSWER')
    s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'pizza', predict: 'curry' }, 2000)
    expect(s.phase).toBe('MM_ANSWER')
  })
  it('calls the obvious ones itself: word-for-word is right, anything else is left to the owner', () => {
    // Sam guesses Alex's exactly; Alex's guess at Sam is only close.
    const s = bothAnswer(start('mrmrs'), ['pizza', 'Chips'], ['chips', 'a pizza'])
    expect(s.phase).toBe('MM_JUDGE')
    const round = s.mrmrs!.rounds[0]
    expect(round.verdict.A).toBe(true) // Sam's guess, auto-matched
    expect(round.verdict.B).toBe(null) // Alex's guess, waiting on Sam to rule
    expect(s.phaseEndsAt).toBe(null) // nothing moves until Sam has ruled
  })
  it('the person an answer belongs to rules on the guess about them', () => {
    let s = bothAnswer(start('mrmrs'), ['pizza', 'Chips'], ['chips', 'a pizza'])
    // Alex can't rule on their own guess — it's Sam's answer.
    expect(reduce(s, { type: 'JUDGE', player: 'B', correct: true }, 3000).mrmrs!.rounds[0].verdict.B).toBe(null)
    s = reduce(s, { type: 'JUDGE', player: 'A', correct: true }, 3000)
    expect(s.mrmrs!.rounds[0].verdict.B).toBe(true)
    expect(mrmrsPoints(s.mrmrs)).toEqual({ A: SCORING.mrmrsRight, B: SCORING.mrmrsRight })
    expect(s.phaseEndsAt).toBe(3000 + 5000) // now it lingers, then moves on
  })
  it('refuses a blank answer of your own', () => {
    const s = start('mrmrs')
    expect(reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: '  ', predict: 'x' }, 2000)).toBe(s)
  })
  it('a guess about an answer that never came in simply misses', () => {
    let s = start('mrmrs')
    s = reduce(s, { type: 'SUBMIT_MRMRS', player: 'A', answer: 'pizza', predict: 'curry' }, 2000)
    s = reduce(s, { type: 'TIMEOUT' }, 50000) // Alex never answered
    const round = s.mrmrs!.rounds[0]
    expect(round.verdict.A).toBe(false) // Sam guessed at nothing
    expect(round.verdict.B).toBe(false) // Alex guessed nothing
  })
  it('ends on its scoreboard after the last question', () => {
    let s = start('mrmrs')
    for (let i = 0; i < 40 && s.phase !== 'MM_RESULT'; i++) {
      if (s.phase === 'MM_ANSWER') s = bothAnswer(s, ['a', 'b'], ['b', 'a'])
      else s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    }
    expect(s.phase).toBe('MM_RESULT')
    expect(standing(s)).toEqual({ A: SCORING.mrmrsRight * 5, B: SCORING.mrmrsRight * 5 })
  })
})

// ---------------------------------------------------------------- Tonight and the roster

describe('tonight', () => {
  it('plays the four quick head-to-head games, then Lights Out', () => {
    for (const night of [0, 1, 2, 3, 4, -3]) {
      expect(roster('tonight', night).map((e) => e.key)).toEqual(['finger', 'wave', 'mrmrs', 'draw', 'lights'])
    }
  })
  it('runs its line-up in order and ends on Lights Out', () => {
    let s = start('tonight')
    const seen: string[] = []
    for (let i = 0; i < 200 && s.phase !== 'DONE'; i++) {
      if (!seen.includes(s.phase)) seen.push(s.phase)
      if (s.phase.endsWith('_RESULT') || s.phase === 'LIGHTS_OUT') s = cont(s)
      else if (s.phase === 'DRAW_SKETCH') {
        const drawer = s.draw!.rounds[s.draw!.current].drawer
        s = reduce(s, { type: 'SUBMIT_DRAWING', player: drawer, answer: 'noodles', strokes: [] }, 1000 * i)
      } else s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    }
    expect(s.phase).toBe('DONE')
    // No finger statements or spectrums in this content, so those two are skipped.
    expect(seen).toEqual([
      'MM_ANSWER', 'MM_JUDGE', 'MM_RESULT',
      'DRAW_SKETCH', 'DRAW_GUESS', 'DRAW_REVEAL', 'DRAW_RESULT',
      'LIGHTS_OUT',
    ])
    expect(s.mrmrs?.rounds).toHaveLength(2)
    expect(s.draw?.rounds.map((r) => r.drawer)).toEqual(['A', 'B']) // one drawing each
    expect(s.lights?.question).toBe('What made you laugh today?')
  })
  it('skips a game the content file gave nothing to, rather than opening it empty', () => {
    const s = start('tonight')
    expect(s.phase).toBe('MM_ANSWER')
    expect(s.finger).toBe(null)
    expect(s.wave).toBe(null)
  })
  it('goes straight to the end if there is nothing to end on', () => {
    let s = start('tonight', { lightsQuestions: [] })
    expect(s.phase).toBe('DONE') // nothing in any of Tonight's pools
    s = start('tonight', { ...CONTENT, lightsQuestions: [] })
    expect(s.phase).toBe('MM_ANSWER')
  })
})
