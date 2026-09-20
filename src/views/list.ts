import type { ListAct, SessionState } from '../engine/state'
import { other } from '../engine/state'

// Presentation helpers for Act III. The engine keeps `{name}` unsubstituted so the same
// theme string works for either author.
export function themeText(s: SessionState, act: ListAct): string {
  const theme = s.themes.find((t) => t.id === act.themeId)
  const name = s.players[act.author].name || act.author
  return (theme?.text ?? 'seven things about {name}').replace('{name}', name)
}

export const rankerOf = (act: ListAct) => other(act.author)

export function playerName(s: SessionState, p: 'A' | 'B'): string {
  return s.players[p].name || p
}
