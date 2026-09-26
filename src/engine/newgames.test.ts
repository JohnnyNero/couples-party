import { describe, it, expect } from 'vitest'
import { initialState, type Content, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { roster, roundsFor } from './roster'
import { SCORING, likelyPoints, mrmrsPoints, shown, standing } from './standing'

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
    const right = shown(s, 'mrmrs', SCORING.mrmrsRight)
    expect(standing(s)).toEqual({ A: right * 5, B: right * 5 })
  })
})

// ---------------------------------------------------------------- Tonight and the roster

describe('tonight', () => {
  it('plays four of the head-to-head games each night, a different set out each night, with a filler after the second', () => {
    const pool = ['finger', 'wave', 'mrmrs', 'draw', 'clash', 'chain', 'bluff', 'meld']
    const out: string[] = []
    for (let night = 0; night < pool.length; night++) {
      const keys = roster('tonight', night).map((e) => e.key)
      expect(keys).toHaveLength(6)
      expect(keys[2]).toBe(night % 2 === 0 ? 'clock' : 'circle')
      expect(keys[5]).toBe('lights')
      out.push(...pool.filter((k) => !keys.includes(k as never)))
    }
    // Over as many nights as there are games, each sits out the same number of times.
    for (const k of pool) expect(out.filter((o) => o === k)).toHaveLength(pool.length - 4)
    expect(roster('tonight', -3)).toEqual(roster('tonight', -3 + 8 * 2)) // negative day numbers too
  })
  const playThrough = (state: SessionState) => {
    let s = state
    const seen: string[] = []
    for (let i = 0; i < 300 && s.phase !== 'DONE'; i++) {
      if (!seen.includes(s.phase)) seen.push(s.phase)
      if (s.phase.endsWith('_RESULT') || s.phase === 'LIGHTS_OUT') s = cont(s)
      else if (s.phase === 'DRAW_SKETCH') {
        s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'A', answer: 'noodles', strokes: [] }, 1000 * i)
        s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'B', answer: 'noodles', strokes: [] }, 1000 * i)
      } else s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    }
    return { s, seen }
  }
  it('runs its line-up in order, breaks a level night, and ends on Lights Out', () => {
    const { s, seen } = playThrough(start('tonight', CONTENT, 4))
    expect(s.phase).toBe('DONE')
    // Night 4 sits Category Clash, Word Chain and Two Lies out: Finger Down and
    // Wavelength (both skipped — no statements or spectrums in this content), the clock,
    // then Mr & Mrs and Draw. Nobody taps and nobody scores, so the night is level and
    // goes to a tiebreaker.
    expect(seen).toEqual([
      'CLOCK_READY', 'CLOCK_RUN', 'CLOCK_REVEAL', 'CLOCK_RESULT',
      'MM_ANSWER', 'MM_JUDGE', 'MM_RESULT',
      'DRAW_SKETCH', 'DRAW_GUESS', 'DRAW_REVEAL', 'DRAW_RESULT',
      'DECIDER_READY', 'DECIDER_RUN', 'DECIDER_REVEAL',
      'LIGHTS_OUT',
    ])
    expect(s.clock?.rounds).toHaveLength(5) // best of 3, both dead heats replayed
    expect(s.mrmrs?.rounds).toHaveLength(2)
    expect(s.draw?.rounds.map((r) => r.drawer)).toEqual(['A', 'B']) // one drawing each
    expect(s.decider?.rounds).toHaveLength(3) // sudden death gives up after three dead heats
    expect(s.lights?.question).toBe('What made you laugh today?')
  })
  it('skips a game the content file gave nothing to, rather than opening it empty', () => {
    const t = start('tonight', CONTENT, 5) // night 5: Wavelength plays first, with nothing to play
    expect(roster('tonight', 5)[0].key).toBe('wave')
    expect(t.phase).toBe('MM_ANSWER')
    expect(t.wave).toBe(null)
  })
  it('still plays the filler with no content at all, then ends without Lights Out', () => {
    const { s, seen } = playThrough(start('tonight', { lightsQuestions: [] }))
    expect(s.phase).toBe('DONE')
    expect(seen[0]).toBe('CLOCK_READY')
    expect(seen).not.toContain('LIGHTS_OUT')
  })
})
