// The leaderboard lives in this browser only — there is no server, so it cannot be a
// shared source of truth between the pair's two phones. Each device keeps its own
// running totals, keyed by player name, the same name the session already collects at
// JOIN. All-time never resets; the weekly bucket rolls over on its own once the
// Monday it started has passed.

export type Totals = Record<string, number>

export type LeaderboardState = {
  weekStart: string // ISO date (UTC) of the Monday this weekly bucket started
  weekly: Totals
  allTime: Totals
}

const STORAGE_KEY = 'couples-party:leaderboard'

function mondayOf(d: Date): string {
  const dayIndex = (d.getUTCDay() + 6) % 7 // 0 = Monday .. 6 = Sunday
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayIndex))
  return monday.toISOString().slice(0, 10)
}

function empty(weekStart: string): LeaderboardState {
  return { weekStart, weekly: {}, allTime: {} }
}

function load(now: Date): LeaderboardState {
  const currentWeek = mondayOf(now)
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return empty(currentWeek) // storage blocked (private mode, etc.) — play on without it
  }
  if (!raw) return empty(currentWeek)
  let parsed: Partial<LeaderboardState>
  try {
    parsed = JSON.parse(raw)
  } catch {
    return empty(currentWeek)
  }
  const allTime = parsed.allTime ?? {}
  // A new week starts a fresh weekly bucket; all-time carries over untouched.
  if (parsed.weekStart !== currentWeek) return { weekStart: currentWeek, weekly: {}, allTime }
  return { weekStart: currentWeek, weekly: parsed.weekly ?? {}, allTime }
}

function save(state: LeaderboardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage unavailable — the session still played fine, it just won't be remembered.
  }
}

export function getLeaderboard(now: Date = new Date()): LeaderboardState {
  return load(now)
}

// Adds one finished session's points per player name into both buckets.
export function recordSession(points: Totals, now: Date = new Date()): LeaderboardState {
  const state = load(now)
  for (const [name, n] of Object.entries(points)) {
    if (!name || n === 0) continue
    state.weekly[name] = (state.weekly[name] ?? 0) + n
    state.allTime[name] = (state.allTime[name] ?? 0) + n
  }
  save(state)
  return state
}
