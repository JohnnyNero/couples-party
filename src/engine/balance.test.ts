import { describe, it, expect } from 'vitest'
import type { BluffRound, ChainRound, ClashRound, DrawRound, Game, GameKey, ListAct, MrMrsRound, PlayerId, SessionState, WaveRound } from './state'
import { initialState } from './state'
import { makeRng } from './rng'
import { roster, roundsFor } from './roster'
import { gameScores, PER_GAME } from './standing'

// The promise: every game counts the same towards a night, however many rounds it
// plays. Thousands of average couples — right about half the time, close some of the
// rest — play each game at both lengths it comes in (Tonight's and the full
// session's), and every game has to average out near the same personal and team points.

type Sim = (rng: () => number, rounds: number) => Partial<SessionState>
const PS: PlayerId[] = ['A', 'B']
const chance = (rng: () => number, p: number) => rng() < p

const SIMS: Partial<Record<GameKey, Sim>> = {
  list: (rng, rounds) => ({
    listActs: Array.from({ length: rounds }, (_, a): ListAct => ({
      author: PS[a % 2], themeId: 't', placeIndex: 7, revealIndex: 6, displacement: 0,
      items: Array.from({ length: 7 }, (_, i) => {
        const r = rng()
        const off = r < 0.25 ? 0 : r < 0.6 ? 1 : 3
        const actual = i + 1
        return { id: `${a}${i}`, text: 'x', actualSlot: actual, predictedSlot: actual + off <= 7 ? actual + off : actual - off }
      }),
    })),
  }),
  mrmrs: (rng, rounds) => ({
    mrmrs: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): MrMrsRound => ({
      index: i + 1, question: 'q', answer: { A: 'a', B: 'b' }, predict: { A: 'b', B: 'a' },
      verdict: { A: chance(rng, 0.45), B: chance(rng, 0.45) },
    })) },
  }),
  wave: (rng, rounds) => ({
    wave: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): WaveRound => {
      const r = rng()
      const distance = r < 0.05 ? 0 : r < 0.2 ? 3 : r < 0.5 ? 10 : r < 0.75 ? 22 : 45
      return { index: i + 1, psychic: PS[i % 2], spectrumId: 'w', target: 50, clue: 'c', guess: 50 - distance, distance }
    }) },
  }),
  draw: (rng, rounds) => ({
    draw: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): DrawRound => ({
      index: i + 1, drawer: PS[i % 2], promptId: 'd', answer: 'x', strokes: [], guess: 'x', correct: chance(rng, 0.5),
    })) },
  }),
  clash: (rng, rounds) => ({
    phase: 'CLASH_RESULT',
    clash: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): ClashRound => {
      const answers = { A: [] as string[], B: [] as string[] }
      for (let c = 0; c < 6; c++) {
        if (chance(rng, 0.13)) { answers.A.push('apple'); answers.B.push('apple'); continue }
        answers.A.push(chance(rng, 0.62) ? `a${c}x` : '')
        answers.B.push(chance(rng, 0.62) ? `a${c}y` : '')
      }
      return { index: i + 1, letter: 'A', categories: Array(6).fill('c'), answers, challenged: { A: Array(6).fill(false), B: Array(6).fill(false) }, revealIndex: 5 }
    }) },
  }),
  chain: (rng, rounds) => ({
    chain: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): ChainRound => {
      const words = 6 + Math.floor(rng() * 13) // 6..18, about 12
      return {
        index: i + 1, category: 'c', words: [], need: 'a', turn: 'A', over: true, reject: null,
        loser: chance(rng, 0.95) ? PS[Math.floor(rng() * 2)] : null,
        chain: Array.from({ length: words }, (_, w) => ({ word: 'w', by: PS[w % 2] })),
      }
    }) },
  }),
  bluff: (rng, rounds) => ({
    bluff: { current: rounds - 1, rounds: Array.from({ length: rounds }, (_, i): BluffRound => ({
      index: i + 1, prompt: 'p', first: 'A', turn: 'B',
      entry: { A: { truth: 't', lies: ['a', 'b'] }, B: { truth: 't', lies: ['a', 'b'] } },
      order: { A: [0, 1, 2], B: [0, 1, 2] },
      pick: { A: chance(rng, 0.4) ? 0 : 1, B: chance(rng, 0.4) ? 0 : 1 },
    })) },
  }),
}

function average(game: Game, key: GameKey, night: number) {
  const rng = makeRng(0xba1 ^ night)
  const rounds = roundsFor({ game, night }, key)
  const N = 2000
  let you = 0
  let us = 0
  for (let n = 0; n < N; n++) {
    const s = { ...initialState(1, game, {}, night), ...SIMS[key]!(rng, rounds) } as SessionState
    const row = gameScores(s).find((g) => g.key === key)!
    you += row.points.A + row.points.B
    us += row.team
  }
  return { you: you / N, us: us / N }
}

describe('every game counts the same', () => {
  // Every night of Tonight's rotation, so every game turns up at its Tonight length.
  const lengths: Array<{ game: Game; night: number }> = [
    { game: 'full', night: 0 },
    ...Array.from({ length: 9 }, (_, night) => ({ game: 'tonight' as Game, night })),
  ]
  for (const { game, night } of lengths) {
    for (const { key } of roster(game, night)) {
      if (!SIMS[key]) continue
      it(`${key} in ${game}${game === 'tonight' ? ` (night ${night})` : ''}`, () => {
        const avg = average(game, key, night)
        expect(avg.you).toBeGreaterThan(PER_GAME.you * 0.85)
        expect(avg.you).toBeLessThan(PER_GAME.you * 1.15)
        expect(avg.us).toBeGreaterThan(PER_GAME.us * 0.85)
        expect(avg.us).toBeLessThan(PER_GAME.us * 1.15)
      })
    }
  }
})
