import { localDate } from './dates'
import { cooldownDays } from './deal'

// What each daily puzzle has asked, by day, so the next pick can pass over anything
// recent (see deal.ts). Kept on this phone — both of you see the same questions, so
// both phones remember the same things — for the last few months.

type Log = Record<string, Record<string, string[]>> // date → kind → what was asked

const KEY = 'coupled:shown'
const KEEP_DAYS = 90

function load(): Log {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Log) : {}
  } catch {
    return {}
  }
}

export function noteShown(date: string, kind: string, asked: string[]): void {
  const items = asked.filter(Boolean)
  if (items.length === 0) return
  const log = load()
  const had = log[date]?.[kind] ?? []
  if (items.every((t) => had.includes(t))) return
  log[date] = { ...log[date], [kind]: [...new Set([...had, ...items])] }
  const oldest = localDate(-KEEP_DAYS)
  for (const d of Object.keys(log)) if (d < oldest) delete log[d]
  try {
    localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    // Private mode or full storage: picks just can't look back.
  }
}

// What to pass over today for a pool of `poolSize`, `perDay` at a time.
export const recentFor = (kind: string, date: string, poolSize: number, perDay = 1) =>
  recentlyShown(kind, date, cooldownDays(poolSize, perDay))

// Everything asked for `kind` in the `days` before `date` (not `date` itself — that's
// the one being picked).
export function recentlyShown(kind: string, date: string, days: number): Set<string> {
  const out = new Set<string>()
  if (days <= 0) return out
  const [y, m, d] = date.split('-').map(Number)
  const from = localDate(-days, new Date(y, m - 1, d))
  for (const [day, kinds] of Object.entries(load())) {
    if (day >= from && day < date) for (const t of kinds[kind] ?? []) out.add(t)
  }
  return out
}
