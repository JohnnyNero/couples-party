import { useEffect, useState } from 'react'
import type { PlayerId, SessionState } from '../engine/state'
import { gameName } from './LobbyInvite'
import { resolveGame } from '../start/mode'
import { replaceUrl } from '../ui/back'

// You picked one game, but your partner was already in another — so you've joined
// theirs (a room only ever plays one). Said once, for a few seconds, under the header.
// The address follows the game you're really in, so a reload comes back to it.
export function JoinedTheirs({ s, me }: { s: SessionState; me: PlayerId }) {
  const [picked] = useState(() => resolveGame(window.location.search))
  const [show, setShow] = useState(false)
  const differs = !!picked && picked !== s.game && s.phase !== 'DONE'
  useEffect(() => {
    if (!differs) return
    const url = new URL(window.location.href)
    url.searchParams.set('game', s.game)
    replaceUrl(url.toString())
    setShow(true)
    const id = setTimeout(() => setShow(false), 6000)
    return () => clearTimeout(id)
  }, [differs, s.game])
  if (!show) return null
  const partner = s.players[me === 'A' ? 'B' : 'A'].name || 'Your partner'
  return (
    <div className="mx-5 mb-2 rounded-2xl bg-pb-soft text-pb-ink px-4 py-2.5 text-sm font-bold animate-fade-up" role="status">
      {partner} had already started {gameName(s.game)} — you’ve joined them.
    </div>
  )
}
