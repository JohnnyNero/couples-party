// Controller ruling P1: the host auto-dispatches JOIN (using the Playroom-collected
// name) the moment a phone connects, so this phone view never collects a name and
// never shows a JOIN button — it only reflects connection state back to the player.
import type { PlayerId, SessionState } from '../../engine/state'
import { PlayWaiting } from './PlayWaiting'

export function PlayJoin({ s, me }: { s: SessionState; me: PlayerId }) {
  const player = s.players[me]
  if (!player.connected) return <PlayWaiting label="CONNECTING…" />
  const name = player.name || me
  return <PlayWaiting label={`YOU'RE IN, ${name.toUpperCase()} — WAITING FOR THE OTHER PLAYER`} />
}
