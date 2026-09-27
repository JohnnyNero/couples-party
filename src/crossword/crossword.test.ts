import { describe, it, expect } from 'vitest'
import { buildCrossword, key, MAX_SIDE, type Candidate, type Puzzle } from './build'
import { asAnswer, balanced, generalCandidates, harvest } from './harvest'
import { makeRng } from '../engine/rng'
import type { Memories } from '../daily/api'

// Every run of two or more squares, across and down, is exactly one of the answers — no
// word running into another, none side by side — and every answer's letters are right.
function checkGrid(p: Puzzle) {
  const at = (r: number, c: number) => p.solution[key(r, c)]
  const runs: string[] = []
  for (let r = 0; r < p.h; r++) {
    for (let c = 0; c < p.w; c++) {
      if (at(r, c) && !at(r, c - 1) && at(r, c + 1)) {
        let w = ''
        for (let x = c; at(r, x); x++) w += at(r, x)
        runs.push(`across ${r},${c} ${w}`)
      }
      if (at(r, c) && !at(r - 1, c) && at(r + 1, c)) {
        let w = ''
        for (let y = r; at(y, c); y++) w += at(y, c)
        runs.push(`down ${r},${c} ${w}`)
      }
    }
  }
  const entries = p.entries.map((e) => `${e.dir} ${e.row},${e.col} ${e.answer}`)
  expect(runs.sort()).toEqual(entries.sort())
  expect(p.w).toBeLessThanOrEqual(MAX_SIDE)
  expect(p.h).toBeLessThanOrEqual(MAX_SIDE)
  // Numbers go left to right, top to bottom.
  const starts = [...new Set(p.entries.map((e) => `${e.n}:${e.row},${e.col}`))]
    .map((s) => s.split(':')).sort((a, b) => Number(a[0]) - Number(b[0]))
  const order = starts.map(([, rc]) => rc.split(',').map(Number)).map(([r, c]) => r * 100 + c)
  expect(order).toEqual([...order].sort((a, b) => a - b))
}

const general = generalCandidates([])

describe('building the crossword', () => {
  it('lays out a valid criss-cross from your words, topped up with general knowledge', () => {
    const mine: Candidate[] = [
      ['MALTA', 'Our first holiday', 'Sam'], ['CURRY', 'Forever takeaway', 'Alex'], ['OTTER', 'The animal Alex is', 'Sam'],
      ['PIZZA', 'Comfort food', 'Alex'], ['BRIGHTON', 'Where we met', 'Sam'], ['RAMEN', 'Drawn for “dinner”', 'Alex'],
    ].map(([answer, clue, who]) => ({ answer, clue, who }))
    for (let seed = 1; seed <= 20; seed++) {
      const p = buildCrossword(mine, general, makeRng(seed))!
      checkGrid(p)
      expect(p.entries.filter((e) => e.who !== null).length).toBeGreaterThanOrEqual(4)
      expect(p.entries.length).toBeGreaterThanOrEqual(8)
      expect(p.answers).toHaveLength(p.entries.length)
    }
  })
  it('still makes one from general knowledge alone, for a couple just starting out', () => {
    const p = buildCrossword([], general, makeRng(7))!
    checkGrid(p)
    expect(p.entries.length).toBeGreaterThanOrEqual(8)
    expect(p.entries.every((e) => e.who === null)).toBe(true)
  })
})

describe('your answers, as crossword answers', () => {
  it('cleans them up, and skips what isn’t a word', () => {
    expect(asAnswer('a pizza')).toBe('PIZZA')
    expect(asAnswer('Ice cream')).toBe('ICECREAM')
    expect(asAnswer("Nando's")).toBe('NANDOS')
    expect(asAnswer('the Lake District trip')).toBe(null) // too many words
    expect(asAnswer('7up')).toBe(null)
    expect(asAnswer('ok')).toBe(null) // too short
    expect(asAnswer('')).toBe(null)
  })

  it('finds them in the daily puzzles and the games, with whose they were', () => {
    const m: Extract<Memories, { state: 'paired' }> = {
      state: 'paired', me: 'Sam', partner: 'Alex', since: '2026-09-01',
      sessions: [{
        key: 's1', playedOn: '2026-09-20',
        payload: {
          v: 1, game: 'tonight', players: { A: 'Sam', B: 'Alex' }, score: { A: 1, B: 1 }, games: [],
          mrmrs: [{ question: 'Your go-to takeaway?', answer: { A: 'curry', B: 'a pizza' }, predict: { A: null, B: null }, verdict: { A: null, B: null } }],
          clash: [{ letter: 'R', rows: [{ category: 'A reason to be late', answers: { A: 'Rain', B: 'traffic' } }] }],
        },
      }],
      puzzles: [
        { id: 'p1', forDate: '2026-09-21', kind: 'word', prompt: 'Our first holiday', guesses: [], patterns: [], status: 'solved', answer: 'MALTA', mine: true },
        { id: 'p2', forDate: '2026-09-22', kind: 'word', prompt: 'The animal Sam reminds you of', guesses: [], patterns: [], status: 'solved', answer: 'OTTER', mine: false },
      ],
    }
    const found = harvest(m).map((f) => `${f.who}:${f.answer}`)
    expect(found).toEqual(expect.arrayContaining(['Sam:CURRY', 'Alex:PIZZA', 'Sam:RAIN', 'Sam:MALTA', 'Alex:OTTER']))
    expect(found).not.toContain('Alex:TRAFFIC') // doesn't start with the letter
  })

  it('keeps it even between you, newest first, never repeating an earlier week', () => {
    const f = (answer: string, who: string, on: string) => ({ answer, who, on, clue: 'c' })
    const found = [
      f('ONE', 'Sam', '2026-09-01'), f('TWO', 'Sam', '2026-09-02'), f('THREE', 'Sam', '2026-09-03'), f('FOUR', 'Sam', '2026-09-04'),
      f('FIVE', 'Alex', '2026-09-05'), f('SIX', 'Alex', '2026-09-06'), f('SIX', 'Sam', '2026-09-07'),
    ]
    const picked = balanced(found, ['Sam', 'Alex'], ['FOUR'])
    const sam = picked.filter((c) => c.who === 'Sam').map((c) => c.answer)
    const alex = picked.filter((c) => c.who === 'Alex').map((c) => c.answer)
    expect(alex).toEqual(['FIVE']) // SIX went to Sam, who said it more recently
    expect(sam).not.toContain('FOUR') // used last week
    expect(sam.length - alex.length).toBeLessThanOrEqual(2)
  })
})
