import { aboutReader } from '../views/voice'
import { themeText } from '../views/list'
import type { DrawStroke, Game, PlayerId, SessionState } from '../engine/state'
import { gameScores, standing, teamScore } from '../engine/standing'
import { chainRoundWinner } from '../engine/chain'
import { asYou } from '../say'

// What a live session leaves behind once it's over: the answers worth looking back on,
// not the moves. Names are written in, because "A" and "B" mean different people on
// the two phones.

type Pair<T> = Record<PlayerId, T>

export type SessionMemory = {
  v: 1
  game: Game
  players: Pair<string>
  score: Pair<number>
  team?: number // points together — nights saved before team points have none
  finished?: boolean // every scored game played to the end
  games: { label: string; points: Pair<number>; team?: number }[]
  shortlist?: { theme: string; author: PlayerId; ranked: string[] }[]
  mrmrs?: { question: string; answer: Pair<string | null>; predict: Pair<string | null>; verdict: Pair<boolean | null> }[]
  draw?: { question: string; drawer: PlayerId; answer: string | null; strokes: DrawStroke[]; guess: string | null; correct: boolean | null }[]
  wave?: { low: string; high: string; psychic: PlayerId; clue: string | null; target: number; guess: number | null }[]
  clash?: { letter: string; rows: { category: string; answers: Pair<string> }[] }[]
  chain?: { category: string; words: string[]; winner: PlayerId | null }[]
  // Two Lies & a Truth: the prompt as it reads to anyone, and each of your truths — with
  // whether the other spotted it (null: it was never guessed).
  bluff?: { prompt: string; truth: Pair<string | null>; spotted: Pair<boolean | null> }[]
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
    team: teamScore(s),
    finished: gameScores(s).every((g) => g.played) && (s.phase.endsWith('_RESULT') || s.phase === 'LIGHTS_OUT' || s.phase === 'DONE'),
    games: gameScores(s).filter((g) => g.played).map((g) => ({ label: g.label, points: g.points, team: g.team })),
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

  const bluffs = upTo(s.bluff, (r) => r.entry.A !== null || r.entry.B !== null)
  if (bluffs.length) {
    m.bluff = bluffs.map((r) => ({
      prompt: asYou(r.prompt),
      truth: { A: r.entry.A?.truth ?? null, B: r.entry.B?.truth ?? null },
      spotted: { A: r.pick.A === null ? null : r.pick.A === 0, B: r.pick.B === null ? null : r.pick.B === 0 },
    }))
  }

  if (s.lights) m.lights = s.lights.question
  return m
}

// Worth keeping once there's something in it: an answer, a drawing, a clue, a point.
export function worthKeeping(m: SessionMemory): boolean {
  return !!(m.shortlist || m.mrmrs || m.draw || m.wave || m.clash || m.chain || m.bluff) || m.score.A + m.score.B > 0
}
