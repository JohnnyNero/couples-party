import { describe, it, expect } from 'vitest'
import { initialState, type Content, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { roundsFor } from './roster'
import { guessBothClose, guessWinner, hlAnswer, hlAwards, SCORING, twistWinner } from './standing'
import { DURATIONS } from './phases'

// Tongue Twisters, Higher or Lower and Guesstimate.
const CONTENT: Partial<Content> = {
  twisters: [
    ...['Red lorry', 'Toy boat', 'Truly rural'].map((text) => ({ level: 1, text })),
    ...['She sells seashells', 'Irish wristwatch', 'Thin sticks'].map((text) => ({ level: 2, text })),
    ...['Rural juror', 'Peggy Babcock', 'Six Czech cricket critics'].map((text) => ({ level: 3, text })),
  ],
  higherLower: Array.from({ length: 10 }, (_, i) => ({ question: 'Which is taller?', a: `A${i}`, av: 10 + i, b: `B${i}`, bv: 5, unit: 'm' })),
  guesstimates: Array.from({ length: 10 }, (_, i) => ({ question: `How many ${i}?`, answer: 100 })),
}
const start = (game: Game) => {
  let s = initialState(1, game, CONTENT)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('Tongue Twisters', () => {
  const round = (s: SessionState) => s.twist!.rounds[s.twist!.current]
  it('deals easy first and hard last, and swaps who goes first each round', () => {
    const s = start('twist')
    expect(s.phase).toBe('TWIST_SAY')
    const rounds = s.twist!.rounds
    expect(rounds).toHaveLength(roundsFor(s, 'twist'))
    const level = (t: string) => CONTENT.twisters!.find((x) => x.text === t)!.level
    expect(level(rounds[0].text)).toBe(1)
    expect(level(rounds[rounds.length - 1].text)).toBe(3)
    expect(rounds[1].first).not.toBe(rounds[0].first)
  })
  it('the listener judges, never the speaker; one trip and one nail takes it', () => {
    let s = start('twist')
    const speaker = round(s).turn
    const judge = speaker === 'A' ? 'B' : 'A'
    expect(reduce(s, { type: 'TWIST_JUDGE', player: speaker, nailed: true }, 2000)).toBe(s)
    s = reduce(s, { type: 'TWIST_JUDGE', player: judge, nailed: false }, 2000)
    expect(s.phase).toBe('TWIST_SAY')
    expect(round(s).turn).toBe(judge)
    s = reduce(s, { type: 'TWIST_JUDGE', player: speaker, nailed: true }, 3000)
    expect(s.phase).toBe('TWIST_REVEAL')
    expect(twistWinner(round(s))).toBe(judge)
  })
  it('a judge who never rules lets the go stand', () => {
    let s = start('twist')
    const speaker = round(s).turn
    s = reduce(s, { type: 'TIMEOUT' }, 1000 + DURATIONS.TWIST_SAY!)
    expect(round(s).said[speaker]).toBe(true)
  })
})

describe('Higher or Lower', () => {
  const round = (s: SessionState) => s.higher!.rounds[s.higher!.current]
  it('reveals once you have both picked; right scores, quickest right scores more', () => {
    let s = start('higher')
    expect(s.phase).toBe('HL_PICK')
    expect(s.higher!.rounds).toHaveLength(roundsFor(s, 'higher'))
    s = reduce(s, { type: 'HL_PICK', player: 'A', pick: 'a', ms: 1500 }, 2000)
    expect(reduce(s, { type: 'HL_PICK', player: 'A', pick: 'b', ms: 100 }, 2000)).toBe(s) // no changing your mind
    s = reduce(s, { type: 'HL_PICK', player: 'B', pick: 'a', ms: 2500 }, 2000)
    expect(s.phase).toBe('HL_REVEAL')
    const awards = hlAwards(round(s))
    const total = (p: 'A' | 'B') => awards.filter((a) => a!.player === p).reduce((n, a) => n + a!.points, 0)
    expect(total('A')).toBe(SCORING.hlRight + SCORING.hlQuickest)
    expect(total('B')).toBe(SCORING.hlRight)
  })
  it('"which came first" wants the smaller number', () => {
    expect(hlAnswer({ question: 'Which came first?', a: 'Jaws', av: 1975, b: 'Star Wars', bv: 1977, unit: 'year' })).toBe('a')
    expect(hlAnswer({ question: 'Which is taller?', a: 'x', av: 5, b: 'y', bv: 9, unit: 'm' })).toBe('b')
  })
})

describe('Guesstimate', () => {
  const round = (s: SessionState) => s.guess!.rounds[s.guess!.current]
  it('closest guess wins; both near it earns the team point', () => {
    let s = start('guess')
    expect(s.phase).toBe('GUESS_WRITE')
    expect(reduce(s, { type: 'GUESS_SUBMIT', player: 'A', value: -4 }, 2000)).toBe(s)
    s = reduce(s, { type: 'GUESS_SUBMIT', player: 'A', value: 90 }, 2000)
    s = reduce(s, { type: 'GUESS_SUBMIT', player: 'B', value: 120.4 }, 2000)
    expect(s.phase).toBe('GUESS_REVEAL')
    expect(round(s).guess).toEqual({ A: 90, B: 120 })
    expect(guessWinner(round(s))).toBe('A')
    expect(guessBothClose(round(s))).toBe(true)
  })
  it('a year has to be within ten to count as close', () => {
    const r = { index: 1, question: 'In what year did the NHS start?', answer: 1948, guess: { A: 1950, B: 1960 } }
    expect(guessBothClose(r)).toBe(false)
    expect(guessBothClose({ ...r, guess: { A: 1950, B: 1939 } })).toBe(true)
  })
})
