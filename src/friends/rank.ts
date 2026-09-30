// Competition ranking for a list already sorted best first: a tie shares a rank and the
// rank after it skips the places taken (1, 1, 3), so two couples on 0 are both first.
export function rankRows<T extends { points: number }>(rows: T[]): (T & { rank: number })[] {
  const out: (T & { rank: number })[] = []
  rows.forEach((r, i) => out.push({ ...r, rank: i > 0 && rows[i - 1].points === r.points ? out[i - 1].rank : i + 1 }))
  return out
}
