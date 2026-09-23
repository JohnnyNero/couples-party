import type { DrawRound, PlayerId, SessionState } from '../engine/state'
import { playerName } from './list'

// Draw Your Answer questions are bare noun phrases in the content file ("comfort food"),
// so the same line reads right from both sides: "Your comfort food" to the drawer,
// "Sam's comfort food" to everyone else.
export function drawQuestion(s: SessionState, round: DrawRound, viewer: PlayerId | null): string {
  const text = s.drawPrompts.find((p) => p.id === round.promptId)?.text ?? ''
  const owner = viewer === round.drawer ? 'Your' : `${playerName(s, round.drawer)}'s`
  return `${owner} ${text}`
}
