// Controller ruling P1: the host auto-dispatches JOIN (using the Playroom-collected
// name) the moment a phone connects, so this phone view never collects a name and
// never shows a JOIN button — it only reflects connection state back to the player.
import type { PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { Avatar } from '../../ui/Avatar'
import { LobbyInvite } from '../../views/LobbyInvite'

export function PlayJoin({ s, me }: { s: SessionState; me: PlayerId }) {
  const player = s.players[me]
  const them = s.players[other(me)]
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Avatar p={me} name={player.name || '?'} size="xl" />
      <div className="font-display text-3xl font-extrabold leading-tight">
        {player.connected ? `You're in, ${player.name || me}` : 'Connecting…'}
      </div>
      <div className="text-sm text-fg/60 animate-pulse">
        {them.connected ? 'Starting…' : 'Waiting for your partner to join'}
      </div>
      <div className="w-full max-w-sm mt-2"><LobbyInvite s={s} /></div>
    </div>
  )
}
