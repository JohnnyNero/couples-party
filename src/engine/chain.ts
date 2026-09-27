import type { ChainCategory, ChainLink, ChainRound, PlayerId } from './state'
import { CHAIN } from './phases'

// Word Chain's checking, pure so the host, the bot and the tests agree.

// The answer lists are long — thousands of names — and the session is sent between the
// phones on every move, so they don't ride along in it: every phone has the same content
// file, and keeps its lists here, by category (see keepChainLists). A round in the
// session carries just its category's name; one that does carry its own list (the
// tests, an older session) uses that.
const lists = new Map<string, string[]>()

export function keepChainLists(cats: ChainCategory[]): ChainCategory[] {
  for (const c of cats) if (c.words.length > 0) lists.set(c.name, c.words)
  return cats.map((c) => ({ name: c.name, words: [] }))
}

export const listFor = (c: { name?: string; category?: string; words: string[] }): string[] =>
  c.words.length > 0 ? c.words : lists.get(c.name ?? c.category ?? '') ?? []

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
  return listFor(round).filter((w) => letters(w)[0] === letter && !gone.has(chainKey(w)))
}

// The letter the next word must start with: the last letter of the last word — or, if
// nothing left on the list starts with that, the letter before it, and so on. When
// nothing on the list is left at all, it's just the last letter: answers needn't be on
// the list any more. Null only for a "word" with no letters in it.
export function nextLetter(round: ChainRound, lastWord: string): string | null {
  const l = letters(lastWord)
  for (let i = l.length - 1; i >= 0; i--) if (freeFor(round, l[i]).length > 0) return l[i]
  return l[l.length - 1] ?? null
}

export type ChainCheck = { ok: true; word: string; listed: boolean } | { ok: false; reason: 'letter' | 'used' | 'rejected' }

// On the list, it goes in as the list spells it. Not on it — no list has every name —
// it still goes in, as typed, for the other to accept or reject. Either way it has to
// start with the right letter, and not have been said (or rejected) already.
export function checkWord(round: ChainRound, typed: string): ChainCheck {
  const listed = findListed(typed, listFor(round))
  const word = listed ?? typed.trim().replace(/\s+/g, ' ')
  if (letters(word)[0] !== round.need) return { ok: false, reason: 'letter' }
  const k = chainKey(word)
  if ((round.banned ?? []).includes(k)) return { ok: false, reason: 'rejected' }
  if (used(round).has(k)) return { ok: false, reason: 'used' }
  return { ok: true, word, listed: !!listed }
}

// The last answer, if the player whose turn it is can still reject it: theirs, and not
// one the list vouches for.
export function rejectable(round: ChainRound): ChainLink | null {
  const last = round.chain[round.chain.length - 1]
  if (!last || last.by === null || last.by === round.turn || last.listed !== false || round.over) return null
  return last
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
