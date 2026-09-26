import { localDate } from './dates'

// A set screen's question, fixed the first time you see it. Worked out from the date it
// would come out the same anyway — until Our questions changes, or the content file
// does, or (The Dial) the mark is rolled — so whatever you were shown first is kept
// here and shown again, however many times you back out and come back in.

export type Pin = {
  prompt?: string      // Their Word's template, The Dial's "Low | High", Top 5's theme, Sketch's prompt
  items?: string[]     // Top 5's five
  questions?: string[] // Their Numbers, This or That
  target?: number      // The Dial's hidden mark (yours alone — never from the server)
}

type Store = Record<string, Record<string, Pin>> // date → kind → pin

const KEY = 'coupled:pins'

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Store) : {}
  } catch {
    return {}
  }
}

function save(store: Store) {
  try {
    // Only the days a set screen can still be for.
    const oldest = localDate(-3)
    for (const d of Object.keys(store)) if (d < oldest) delete store[d]
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Private mode or full storage: it just won't survive a reload.
  }
}

export function pinned(date: string, kind: string): Pin | null {
  return load()[date]?.[kind] ?? null
}

export function pin(date: string, kind: string, value: Pin): void {
  const store = load()
  store[date] = { ...store[date], [kind]: value }
  save(store)
}

// What to show: the question your partner already set for that day (the server keeps
// you both on it, so anything else would be answered against the wrong question), else
// the one you were shown before, else a fresh one — and whichever it is becomes the pin.
// The Dial's mark is never your partner's: it stays yours from the first time.
export function settle(date: string, kind: string, server: Pin | undefined, fresh: () => Pin): Pin {
  const before = pinned(date, kind)
  let made: Pin | null = null
  const make = () => (made ??= fresh())
  const { target: _, ...base } = server ?? (before && filled(before) ? before : make())
  const target = before?.target ?? make().target
  const out: Pin = target === undefined ? base : { ...base, target }
  // Nothing to pin if the content hadn't loaded yet — it gets another go next time.
  if (filled(out)) pin(date, kind, out)
  return out
}

const filled = (p: Pin) => !!p.prompt || (p.questions?.length ?? 0) > 0 || (p.items?.length ?? 0) > 0

// Setting one for today — day one, or a day they missed — is your one for the day: the
// board doesn't then ask for tomorrow's as well (that read as the first one not having
// gone). Remembered here, per day and kind, the moment that set screen opens; it only
// counts once the board also shows yours for today.
export const markCaughtUp = (date: string, kind: string) => pin(date, `${kind}:caught-up`, {})
export const caughtUpOn = (date: string, kind: string) => pinned(date, `${kind}:caught-up`) !== null
