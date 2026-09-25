import type { ListAct, PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { say } from '../say'

// Presentation helpers for Act III. The engine keeps a theme's template as written so the
// same one works for either author: it reads "you" on the author's own phone
// (`reader`), and their name everywhere else — the other phone, and a shared screen.
export function themeText(s: SessionState, act: ListAct, reader: PlayerId | null = null): string {
  const theme = s.themes.find((t) => t.id === act.themeId)
  const name = s.players[act.author].name || act.author
  return say(theme?.text ?? 'seven things about @', {
    self: reader === act.author,
    subject: name,
    partner: s.players[other(act.author)].name || other(act.author),
  })
}

export const rankerOf = (act: ListAct) => other(act.author)

export function playerName(s: SessionState, p: 'A' | 'B'): string {
  return s.players[p].name || p
}
