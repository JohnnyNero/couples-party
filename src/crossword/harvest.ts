import type { Memories } from '../daily/api'
import type { SessionMemory } from '../memories/summary'
import { MAX_LEN, MIN_LEN, type Candidate } from './build'
import { GENERAL } from './general'

// Everything either of you has said that could be a crossword answer, with its clue and
// whose it was: the daily words you set each other, Sketch words, and — from the games
// — Mr & Mrs answers, drawings and Category Clash answers. Only things you've both
// already seen revealed (past days, finished rounds), so nothing is spoiled.

type Paired = Extract<Memories, { state: 'paired' }>
type Found = Candidate & { on: string }

// An answer as crossword letters: capitals, no "a"/"the" in front, no spaces or
// punctuation — or null if it isn't a word (or two) of plain letters.
export function asAnswer(raw: string | null | undefined): string | null {
  if (!raw) return null
  let t = raw.trim().toUpperCase().replace(/[’']/g, '')
  t = t.replace(/^(A|AN|THE|MY|OUR|SOME)\s+/, '')
  if (t.split(/[\s-]+/).length > 2) return null
  t = t.replace(/[\s-]+/g, '')
  return /^[A-Z]+$/.test(t) && t.length >= MIN_LEN && t.length <= MAX_LEN ? t : null
}

const quoted = (q: string) => `“${q.trim().replace(/[“”]/g, '')}”`

function add(out: Found[], raw: string | null | undefined, clue: string, who: string, on: string) {
  const answer = asAnswer(raw)
  if (!answer || !clue.trim()) return
  // A clue that gives the answer away is no clue.
  if (clue.toUpperCase().replace(/[^A-Z]/g, '').includes(answer)) return
  out.push({ answer, clue, who, on })
}

export function harvest(m: Paired): Found[] {
  const out: Found[] = []
  for (const s of m.sessions) {
    const p = s.payload as SessionMemory
    if (!p || p.v !== 1 || !p.players) continue
    for (const r of p.mrmrs ?? []) {
      for (const seat of ['A', 'B'] as const) add(out, r.answer?.[seat], r.question, p.players[seat], s.playedOn)
    }
    for (const r of p.draw ?? []) add(out, r.answer, `Drawn for ${quoted(r.question)}`, p.players[r.drawer], s.playedOn)
    for (const round of p.clash ?? []) {
      for (const row of round.rows) {
        for (const seat of ['A', 'B'] as const) {
          const a = row.answers[seat]
          if (a && a.trim().toUpperCase().startsWith(round.letter)) add(out, a, `${row.category}, starting with ${round.letter}`, p.players[seat], s.playedOn)
        }
      }
    }
  }
  for (const pz of m.puzzles) {
    const who = pz.mine ? m.me : m.partner
    if (pz.kind === 'word' && pz.answer) add(out, pz.answer, pz.prompt, who, pz.forDate)
    if (pz.kind === 'sketch' && 'answer' in pz && pz.answer) add(out, pz.answer as string, `Drawn for ${quoted(pz.prompt)}`, who, pz.forDate)
  }
  return out
}

// The week's personal words: newest first, never one used in an earlier week, one of
// each answer, and as even between the two of you as your answers allow.
export function balanced(found: Found[], names: [string, string], used: string[], perPerson = 6): Candidate[] {
  const seen = new Set(used.map((u) => u.toUpperCase()))
  const fresh = [...found].sort((a, b) => b.on.localeCompare(a.on)).filter((f) => {
    if (seen.has(f.answer)) return false
    seen.add(f.answer)
    return true
  })
  const of = (name: string) => fresh.filter((f) => f.who === name)
  const [a, b] = [of(names[0]), of(names[1])]
  const even = Math.min(perPerson, Math.max(Math.min(a.length, b.length), 0))
  // Level where you can be; where one of you has fewer, a couple more of the other's.
  const take = (xs: Found[], other: number) => xs.slice(0, Math.min(xs.length, Math.max(even, Math.min(perPerson, other + 2))))
  const picked = [...take(a, b.length), ...take(b, a.length)]
  // Interleaved, so neither of you is all in one corner.
  const byA = picked.filter((f) => f.who === names[0])
  const byB = picked.filter((f) => f.who === names[1])
  const out: Candidate[] = []
  for (let i = 0; i < Math.max(byA.length, byB.length); i++) {
    if (byA[i]) out.push({ answer: byA[i].answer, clue: byA[i].clue, who: byA[i].who })
    if (byB[i]) out.push({ answer: byB[i].answer, clue: byB[i].clue, who: byB[i].who })
  }
  return out
}

export const generalCandidates = (used: string[]): Candidate[] => {
  const skip = new Set(used.map((u) => u.toUpperCase()))
  return GENERAL.filter(([a]) => !skip.has(a)).map(([answer, clue]) => ({ answer, clue, who: null }))
}
