import type { RecordRow } from '../daily/api'

// The records page's numbers, worked out from every saved night. "You" is found by name
// in each night (seats swap between nights); a night where neither name is yours is
// counted from seat A.

export type Best = { value: number; on: string } | null
export type Records = {
  nights: number
  together: { tonight: Best; full: Best; thisWeek: number }
  wins: { you: number; them: number; level: number } // finished Tonights and full sessions
  // Most points in one finished night — Tonight and the full session kept apart.
  bestNight: Record<'tonight' | 'full', { you: Best; them: Best }>
  games: { label: string; best: Best }[] // best team score in each game, anywhere
  longestChain: Best
}

const better = (a: Best, value: number | null | undefined, on: string): Best =>
  value == null || (a && a.value >= value) ? a : { value, on }

export function computeRecords(rows: RecordRow[], me: string, today: string): Records {
  const monday = mondayOf(today)
  const out: Records = {
    nights: rows.length,
    together: { tonight: null, full: null, thisWeek: 0 },
    wins: { you: 0, them: 0, level: 0 },
    bestNight: { tonight: { you: null, them: null }, full: { you: null, them: null } },
    games: [],
    longestChain: null,
  }
  const perGame = new Map<string, Best>()
  const mine = me.trim().toLowerCase()
  for (const r of rows) {
    const you = r.players?.B?.trim().toLowerCase() === mine ? 'B' : 'A'
    const them = you === 'A' ? 'B' : 'A'
    if (r.playedOn >= monday && typeof r.team === 'number') out.together.thisWeek += r.team
    const night = r.game === 'tonight' || r.game === 'full'
    if (night && r.finished) {
      if (r.game === 'tonight') out.together.tonight = better(out.together.tonight, r.team, r.playedOn)
      else out.together.full = better(out.together.full, r.team, r.playedOn)
      const a = r.score?.[you] ?? 0
      const b = r.score?.[them] ?? 0
      if (a > b) out.wins.you += 1
      else if (b > a) out.wins.them += 1
      else out.wins.level += 1
      const kind = r.game as 'tonight' | 'full'
      out.bestNight[kind].you = better(out.bestNight[kind].you, a, r.playedOn)
      out.bestNight[kind].them = better(out.bestNight[kind].them, b, r.playedOn)
    }
    for (const g of r.games ?? []) {
      if (typeof g.team !== 'number' || g.label === 'Tiebreaker') continue
      perGame.set(g.label, better(perGame.get(g.label) ?? null, g.team, r.playedOn))
    }
    out.longestChain = better(out.longestChain, r.longestChain, r.playedOn)
  }
  out.games = [...perGame.entries()]
    .map(([label, best]) => ({ label, best }))
    .filter((g) => g.best && g.best.value > 0)
    .sort((x, y) => x.label.localeCompare(y.label))
  return out
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
