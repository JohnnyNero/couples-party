import type { BluffRound, PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { say } from '../say'
import { playerName } from './list'

// One of you's three, in the order they're shown: id 0 is the truth, 1 and 2 the lies.
export function bluffOptions(round: BluffRound, owner: PlayerId): { id: number; text: string }[] {
  const e = round.entry[owner]
  if (!e) return []
  const all = [e.truth, e.lies[0], e.lies[1]]
  return round.order[owner].map((id) => ({ id, text: all[id] }))
}

// The prompt as `reader` sees it, about `owner`: "Your worst ever present" to the person
// it's about, "Rocko's worst ever present" to everyone else (and to a TV).
export function bluffPrompt(s: SessionState, round: BluffRound, owner: PlayerId, reader: PlayerId | null): string {
  return say(round.prompt, { self: reader === owner, subject: playerName(s, owner), partner: playerName(s, other(owner)) })
}
