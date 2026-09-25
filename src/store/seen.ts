import type { Content, SessionState } from '../engine/state'
import { roundsFor } from '../engine/roster'
import { CLASH } from '../engine/phases'

// What this phone has already been shown, so the next session draws something new.
// Each phone keeps its own log — both play every session, so the two logs match — and
// whichever phone hosts filters the pools before the session is built. The engine never
// knows: it just gets smaller pools and shuffles them as usual.
//
// Items are logged by their text, not their id: ids come from their position in the
// content file, and they shift whenever a line is added or removed.

type PoolKey = 'likely' | 'finger' | 'mrmrs' | 'lights' | 'wave' | 'draw' | 'list' | 'clash'
export type SeenLog = Partial<Record<PoolKey, string[]>> // oldest first

const STORAGE_KEY = 'couples-party:seen'
const CAP = 400 // per pool; far more than any pool holds

// The most any one session draws from each pool: a game played on its own runs its
// longest, so that's the size to keep.
const NEED: Record<PoolKey, number> = {
  likely: roundsFor({ game: 'likely' }, 'likely'),
  finger: roundsFor({ game: 'finger' }, 'finger'),
  mrmrs: roundsFor({ game: 'mrmrs' }, 'mrmrs'),
  lights: 1,
  wave: roundsFor({ game: 'wave' }, 'wave'),
  draw: roundsFor({ game: 'draw' }, 'draw'),
  list: roundsFor({ game: 'list' }, 'list'), // one theme per act
  clash: roundsFor({ game: 'clash' }, 'clash') * CLASH.categories,
}

const waveKey = (s: { low: string; high: string }) => `${s.low} | ${s.high}`

// Drops what's been seen, keeping at least `need` — when there aren't enough unseen,
// the longest-ago seen come back first. Keeps the pool's own order.
export function unseen<T>(pool: T[], key: (t: T) => string, seen: string[] = [], need: number): T[] {
  const when = new Map(seen.map((k, i) => [k, i]))
  const fresh = pool.filter((t) => !when.has(key(t)))
  const short = need - fresh.length
  if (short <= 0) return fresh
  const back = new Set(
    pool.filter((t) => when.has(key(t)))
      .sort((a, b) => when.get(key(a))! - when.get(key(b))!)
      .slice(0, short)
      .map(key),
  )
  return pool.filter((t) => !when.has(key(t)) || back.has(key(t)))
}

export function freshen(content: Content, log: SeenLog = loadSeen()): Content {
  const id = (t: string) => t
  return {
    ...content,
    likelyStatements: unseen(content.likelyStatements, id, log.likely, NEED.likely),
    fingerStatements: unseen(content.fingerStatements, id, log.finger, NEED.finger),
    mrmrsQuestions: unseen(content.mrmrsQuestions, id, log.mrmrs, NEED.mrmrs),
    lightsQuestions: unseen(content.lightsQuestions, id, log.lights, NEED.lights),
    spectrums: unseen(content.spectrums, waveKey, log.wave, NEED.wave),
    drawPrompts: unseen(content.drawPrompts, (p) => p.text, log.draw, NEED.draw),
    themes: unseen(content.themes, (t) => t.text, log.list, NEED.list),
    clashCategories: unseen(content.clashCategories, id, log.clash, NEED.clash),
  }
}

// Everything the session has actually put in front of you so far — rounds up to and
// including the live one, not ones drawn for later that you may never reach.
export function shownIn(s: SessionState): Record<PoolKey, string[]> {
  const upTo = <R,>(g: { rounds: R[]; current: number } | null) => (g ? g.rounds.slice(0, g.current + 1) : [])
  const spectrum = new Map(s.spectrums.map((w) => [w.id, waveKey(w)]))
  const prompt = new Map(s.drawPrompts.map((p) => [p.id, p.text]))
  const theme = new Map(s.themes.map((t) => [t.id, t.text]))
  const known = (x: string | undefined): x is string => !!x
  return {
    likely: upTo(s.likely).map((r) => r.statement),
    finger: upTo(s.finger).map((r) => r.statementId),
    mrmrs: upTo(s.mrmrs).map((r) => r.question),
    lights: s.lights ? [s.lights.question] : [],
    wave: upTo(s.wave).map((r) => spectrum.get(r.spectrumId)).filter(known),
    draw: upTo(s.draw).map((r) => prompt.get(r.promptId)).filter(known),
    list: s.listActs.map((a) => theme.get(a.themeId)).filter(known),
    clash: s.clash ? s.clash.rounds.slice(0, s.clash.current + 1).flatMap((r) => r.categories) : [],
  }
}

// Moves each newly shown item to the most-recent end. Returns the same object when
// nothing changed, so the caller can skip the write.
export function noteShown(log: SeenLog, shown: Record<PoolKey, string[]>, already: Set<string>): SeenLog {
  let next = log
  for (const pool of Object.keys(shown) as PoolKey[]) {
    for (const item of shown[pool]) {
      const tag = `${pool}:${item}`
      if (already.has(tag)) continue
      already.add(tag)
      if (next === log) next = { ...log }
      next[pool] = [...(next[pool] ?? []).filter((k) => k !== item), item].slice(-CAP)
    }
  }
  return next
}

export function loadSeen(): SeenLog {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {} // storage blocked or garbled — just play without the memory
  }
}

// One session's worth of already-logged items, so a state update that shows nothing
// new doesn't touch storage. Reset when a new session (new seed) starts.
let session: { seed: number; logged: Set<string> } | null = null

export function recordSeen(s: SessionState): void {
  if (s.phase === 'BOOT' || s.phase === 'JOIN') return
  if (!session || session.seed !== s.seed) session = { seed: s.seed, logged: new Set() }
  const shown = shownIn(s)
  const logged = session.logged
  if (!(Object.keys(shown) as PoolKey[]).some((pool) => shown[pool].some((item) => !logged.has(`${pool}:${item}`)))) return
  const log = loadSeen()
  const next = noteShown(log, shown, logged)
  if (next === log) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // storage full or blocked — nothing to do
  }
}
