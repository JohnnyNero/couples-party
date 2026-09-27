// How the two of you stand on a week's crossword, in a line: you each solve your own
// copy, and this is what you see of theirs next to yours.

export type Side = { pct: number; solvedAt: string | null }

export const pct = (filled: number, total: number) => (total === 0 ? 0 : Math.round((filled / total) * 100))

// Who got there first, when you both have.
export function first(me: Side, them: Side): 'me' | 'them' | null {
  if (!me.solvedAt || !them.solvedAt) return null
  return me.solvedAt <= them.solvedAt ? 'me' : 'them'
}

export function standing(me: Side, them: Side, partner: string): string {
  const who = partner || 'They'
  if (me.solvedAt && them.solvedAt) return 'You’ve both solved it ✓'
  if (me.solvedAt) return them.pct === 0 ? `Solved ✓ · ${who} hasn’t started` : `Solved ✓ · ${who} ${them.pct}%`
  if (them.solvedAt) return me.pct === 0 ? `${who} has solved it — your turn` : `${who} has solved it · you ${me.pct}%`
  if (me.pct === 0 && them.pct === 0) return ''
  if (me.pct === 0) return `${who}’s ${them.pct}% through theirs`
  return `You ${me.pct}% · ${who} ${them.pct}%`
}
