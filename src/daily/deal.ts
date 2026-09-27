import { makeRng, shuffled } from '../engine/rng'
import { dayIndex } from './dates'

// How each daily puzzle picks its question(s) for a day, the same on both phones, with
// nothing coming back soon after it was last used.
//
// One a day (Their Word, The Dial, Top 5, Sketch): the pool is walked in one fixed
// shuffled order, so nothing repeats until everything has had its day.
//
// Five a day (Their Numbers, This or That): dealt from the pool like a deck, five a day
// in turn. Each time round, the order is reshuffled within thirds of the pool, so the
// same five don't keep turning up together — but a question never moves out of its
// third, so it always comes back at least two-thirds of the way round the pool later.
//
// And either way, anything shown in the last few days (see shown.ts) is passed over for
// the next one along. The order above already keeps them apart; this is for the day the
// pool itself changes — new content reshuffles everything, and without it yesterday's
// could come straight back.

// A day's single pick: the walk's own, or the next one along that isn't recent.
export function walkPick<T>(date: string, pool: T[], salt: number, key: (t: T) => string, recent: Set<string> = new Set()): T | null {
  if (pool.length === 0) return null
  const order = shuffled(makeRng(salt), pool)
  const n = order.length
  const day = dayIndex(date)
  for (let i = 0; i < n; i++) {
    const t = order[(((day + i) % n) + n) % n]
    if (!recent.has(key(t))) return t
  }
  return order[((day % n) + n) % n] // everything's recent: the walk's own
}

// Where the deck is on a given go round: the pool split into up to three fixed bands,
// each shuffled afresh for that go round.
function round<T>(base: T[], count: number, salt: number, c: number): T[] {
  const n = base.length
  const bands = Math.max(1, Math.min(3, Math.floor(n / count)))
  const size = Math.ceil(n / bands)
  const out: T[] = []
  for (let b = 0; b < bands; b++) {
    const seed = (salt ^ Math.imul(c + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca6b)) | 0
    out.push(...shuffled(makeRng(seed), base.slice(b * size, (b + 1) * size)))
  }
  return out
}

// A day's `count`, dealt, skipping any that are recent (or already in today's hand).
export function dealPick<T>(date: string, pool: T[], count: number, salt: number, key: (t: T) => string, recent: Set<string> = new Set()): T[] | null {
  if (pool.length < count) return null
  const base = shuffled(makeRng(salt), pool)
  const n = base.length
  const start = Math.max(0, dayIndex(date)) * count
  const rounds = new Map<number, T[]>()
  const at = (pos: number) => {
    const c = Math.floor(pos / n)
    if (!rounds.has(c)) rounds.set(c, round(base, count, salt, c))
    return rounds.get(c)![pos % n]
  }
  const hand: T[] = []
  const taken = new Set<string>()
  // First pass skips the recent; if the pool's too small for that, a second takes them.
  for (const skipRecent of [true, false]) {
    for (let pos = start; pos < start + 2 * n && hand.length < count; pos++) {
      const t = at(pos)
      const k = key(t)
      if (taken.has(k) || (skipRecent && recent.has(k))) continue
      taken.add(k)
      hand.push(t)
    }
    if (hand.length === count) break
  }
  return hand
}

// How many days back counts as "recent" for a pool: most of the way round it, capped at
// two months — long enough that it's a surprise to see one again, short enough that a
// small pool always has something left.
export function cooldownDays(poolSize: number, perDay: number): number {
  return Math.max(0, Math.min(60, Math.floor((poolSize / perDay) * 0.6)))
}
