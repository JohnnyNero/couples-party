import type { ChainRound, PlayerId } from './state'
import { CHAIN } from './phases'

// Word Chain's checking, pure so the host, the bot and the tests agree.

// Compared letters only: case, accents, spaces and punctuation don't matter, and
// neither does a plural "s" ("Guinea pigs" is "guinea pig").
export function chainKey(word: string): string {
  let k = word.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')
  if (k.length > 3 && k.endsWith('s') && !k.endsWith('ss')) k = k.slice(0, -1)
  return k
}

// Bare letters, no plural trimming — for reading the last letter off a word.
const letters = (word: string) => word.toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '')

function oneEditApart(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length > b.length) i++
    else if (b.length > a.length) j++
    else { i++; j++ }
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}

// The listed answer a typed word stands for: an exact match, or — for a longer word —
// one slip away from exactly one listed answer ("elefant" is elephant).
export function findListed(typed: string, words: string[]): string | null {
  const k = chainKey(typed)
  if (!k) return null
  const exact = words.find((w) => chainKey(w) === k)
  if (exact) return exact
  if (k.length < CHAIN.fuzzyMinLen) return null
  const near = words.filter((w) => chainKey(w).length >= CHAIN.fuzzyMinLen && oneEditApart(chainKey(w), k))
  return near.length === 1 ? near[0] : null
}

const used = (round: ChainRound) => new Set(round.chain.map((l) => chainKey(l.word)))

// Listed answers still free to play that start with this letter.
export function freeFor(round: ChainRound, letter: string): string[] {
  const gone = used(round)
  return round.words.filter((w) => letters(w)[0] === letter && !gone.has(chainKey(w)))
}

// The letter the next word must start with: the last letter of the last word — or, if
// nothing left on the list starts with that, the letter before it, and so on. Null when
// nothing at all can follow, which ends the round with no winner.
export function nextLetter(round: ChainRound, lastWord: string): string | null {
  const l = letters(lastWord)
  for (let i = l.length - 1; i >= 0; i--) if (freeFor(round, l[i]).length > 0) return l[i]
  return null
}

export type ChainCheck = { ok: true; word: string } | { ok: false; reason: 'letter' | 'used' | 'unknown' }

export function checkWord(round: ChainRound, typed: string): ChainCheck {
  const listed = findListed(typed, round.words)
  if (!listed) {
    // Say "wrong letter" before "not on the list" when the letter is the obvious problem.
    return { ok: false, reason: letters(typed)[0] !== round.need ? 'letter' : 'unknown' }
  }
  if (letters(listed)[0] !== round.need) return { ok: false, reason: 'letter' }
  if (used(round).has(chainKey(listed))) return { ok: false, reason: 'used' }
  return { ok: true, word: listed }
}

export function turnMs(round: ChainRound): number {
  const played = round.chain.filter((l) => l.by !== null).length
  const step = Math.min(CHAIN.turnMs.length - 1, Math.floor(played / CHAIN.tightenEvery))
  return CHAIN.turnMs[step]
}

export function chainRoundWinner(round: ChainRound): PlayerId | null {
  if (!round.over || round.loser === null) return null
  return round.loser === 'A' ? 'B' : 'A'
}
