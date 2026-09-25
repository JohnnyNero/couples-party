import { aboutReader } from '../views/voice'
import { themeText } from '../views/list'
import type { DrawStroke, Game, PlayerId, SessionState } from '../engine/state'
import { gameScores, standing } from '../engine/standing'
import { chainRoundWinner } from '../engine/chain'

// What a live session leaves behind once it's over: the answers worth looking back on,
// not the moves. Names are written in, because "A" and "B" mean different people on
// the two phones.

type Pair<T> = Record<PlayerId, T>

export type SessionMemory = {
  v: 1
  game: Game
  players: Pair<string>
  score: Pair<number>
  games: { label: string; points: Pair<number> }[]
  shortlist?: { theme: string; author: PlayerId; ranked: string[] }[]
  mrmrs?: { question: string; answer: Pair<string | null>; predict: Pair<string | null>; verdict: Pair<boolean | null> }[]
  draw?: { question: string; drawer: PlayerId; answer: string | null; strokes: DrawStroke[]; guess: string | null; correct: boolean | null }[]
  wave?: { low: string; high: string; psychic: PlayerId; clue: string | null; target: number; guess: number | null }[]
  clash?: { letter: string; rows: { category: string; answers: Pair<string> }[] }[]
  chain?: { category: string; words: string[]; winner: PlayerId | null }[]
  lights?: string
}

// Three decimals is finer than any screen will show it, and a third of the size.
const r3 = (v: number) => Math.round(v * 1000) / 1000
const round3 = (stroke: DrawStroke): DrawStroke => stroke.map(([x, y]) => [r3(x), r3(y)])

const upTo = <R,>(g: { rounds: R[]; current: number } | null, done: (r: R) => boolean) =>
  g ? g.rounds.slice(0, g.current + 1).filter(done) : []

export function sessionMemory(s: SessionState): SessionMemory {
  const name = (p: PlayerId) => s.players[p].name || p
  const m: SessionMemory = {
    v: 1,
    game: s.game,
    players: { A: name('A'), B: name('B') },
    score: standing(s),
    games: gameScores(s).filter((g) => g.played).map((g) => ({ label: g.label, points: g.points })),
  }

  const acts = s.listActs.filter((a) => a.displacement !== null)
  if (acts.length) {
    m.shortlist = acts.map((a) => ({
      theme: themeText(s, a),
      author: a.author,
      ranked: [...a.items].filter((i) => i.actualSlot !== null).sort((x, y) => x.actualSlot! - y.actualSlot!).map((i) => i.text),
    }))
  }

  const mm = upTo(s.mrmrs, (r) => r.answer.A !== null || r.answer.B !== null)
  if (mm.length) m.mrmrs = mm.map((r) => ({ question: aboutReader(s, r.question, null), answer: r.answer, predict: r.predict, verdict: r.verdict }))

  const draws = upTo(s.draw, (r) => r.answer !== null)
  if (draws.length) {
    m.draw = draws.map((r) => ({
      question: s.drawPrompts.find((p) => p.id === r.promptId)?.text ?? '',
      drawer: r.drawer, answer: r.answer, strokes: r.strokes.map(round3), guess: r.guess, correct: r.correct,
    }))
  }

  const waves = upTo(s.wave, (r) => r.guess !== null)
  if (waves.length) {
    m.wave = waves.map((r) => {
      const sp = s.spectrums.find((x) => x.id === r.spectrumId)
      return { low: sp?.low ?? '', high: sp?.high ?? '', psychic: r.psychic, clue: r.clue, target: r.target, guess: r.guess }
    })
  }

  const clash = upTo(s.clash, (r) => r.answers.A !== null && r.answers.B !== null)
  if (clash.length) {
    m.clash = clash.map((r) => ({
      letter: r.letter,
      rows: r.categories.map((category, i) => ({ category, answers: { A: r.answers.A![i] ?? '', B: r.answers.B![i] ?? '' } })),
    }))
  }

  const chains = upTo(s.chain, (r) => r.over)
  if (chains.length) m.chain = chains.map((r) => ({ category: r.category, words: r.chain.map((l) => l.word), winner: chainRoundWinner(r) }))

  if (s.lights) m.lights = s.lights.question
  return m
}

// Worth keeping once there's something in it: an answer, a drawing, a clue, a point.
export function worthKeeping(m: SessionMemory): boolean {
  return !!(m.shortlist || m.mrmrs || m.draw || m.wave || m.clash || m.chain) || m.score.A + m.score.B > 0
}
