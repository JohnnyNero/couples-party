import type { ClashGame, ClashRound, PlayerId } from './state'
import { other } from './state'

// Scoring for Category Clash, pure so the host, both phones and the tests agree.

export const CLASH_POINTS = {
  unique: 2,     // fits the letter, and not the same as theirs
  challenged: 1, // they didn't think it fits — halved, never wiped
} as const

// Two answers are "the same" once case, accents, punctuation, spaces, a leading
// "a/an/the" and a final "s" are set aside — so "The Beatles" and "beatle" match.
export function clashNorm(answer: string): string {
  let t = answer
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  t = t.replace(/^(the|an|a) /, '').replace(/ /g, '')
  if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1)
  return t
}

// Starts with the letter, either as typed or once a leading "the/a/an" is dropped — so
// "The Beatles" works for B, and "Tea" still works for T.
export function startsRight(answer: string, letter: string): boolean {
  const l = letter.toLowerCase()
  const raw = answer.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
  return raw.startsWith(l) || clashNorm(answer).startsWith(l)
}

export type ClashVerdict = 'blank' | 'wrong-letter' | 'same' | 'challenged' | 'scores'

export function clashVerdict(round: ClashRound, p: PlayerId, i: number): ClashVerdict {
  const mine = round.answers[p]?.[i] ?? ''
  if (!mine.trim()) return 'blank'
  if (!startsRight(mine, round.letter)) return 'wrong-letter'
  const theirs = round.answers[other(p)]?.[i] ?? ''
  if (theirs.trim() && clashNorm(theirs) === clashNorm(mine)) return 'same'
  if (round.challenged[p][i]) return 'challenged'
  return 'scores'
}

export function clashCellPoints(round: ClashRound, p: PlayerId, i: number): number {
  const v = clashVerdict(round, p, i)
  return v === 'scores' ? CLASH_POINTS.unique : v === 'challenged' ? CLASH_POINTS.challenged : 0
}

// Only what the reveal has reached counts, so the number on screen climbs as the
// categories turn over, the same way Shortlist's does.
export function clashRoundPoints(round: ClashRound, p: PlayerId, revealedOnly = true): number {
  const upTo = revealedOnly ? round.revealIndex : round.categories.length - 1
  let n = 0
  for (let i = 0; i <= upTo; i++) n += clashCellPoints(round, p, i)
  return n
}

export function clashPoints(g: ClashGame | null, revealing: boolean): Record<PlayerId, number> {
  const t = { A: 0, B: 0 }
  if (!g) return t
  g.rounds.forEach((round, r) => {
    // Rounds before the live one are fully revealed; the live one only as far as the
    // reveal has got — and not at all while you're still writing.
    if (r < g.current) {
      t.A += clashRoundPoints(round, 'A', false)
      t.B += clashRoundPoints(round, 'B', false)
    } else if (r === g.current && revealing) {
      t.A += clashRoundPoints(round, 'A')
      t.B += clashRoundPoints(round, 'B')
    }
  })
  return t
}
