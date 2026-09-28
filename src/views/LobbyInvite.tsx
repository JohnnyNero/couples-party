import { useEffect, useState } from 'react'
import type { GameKey, SessionState } from '../engine/state'
import { GAME_LABELS } from '../engine/roster'
import { useMyPlayerId } from '../net'
import { api } from '../daily/api'
import { useProfile } from '../profile/store'
import { btnOutline } from '../ui/styles'

const SESSION_NAMES: Record<string, string> = { tonight: 'today’s games', full: 'the full session', quick: 'a quick game' }
export const gameName = (game: string) => SESSION_NAMES[game] ?? GAME_LABELS[game as GameKey] ?? 'a game'

// In the lobby, waiting for your partner. Being here puts a note on their Coupled home
// screen by itself — "Johnny's waiting for you in Today's games", with a button straight
// in — kept fresh while you wait and taken down when you leave or they arrive. Or send
// them the link (it opens the game on their phone).
const HEARTBEAT_MS = 2 * 60 * 1000

// One note per phone, however many screens show the lobby (the phone's own and the
// board's both do): the first to want it posts it and keeps it fresh, the last to let go
// takes it down — a moment later, so a screen swapping for another doesn't flicker it.
let holders = 0
let beat: ReturnType<typeof setInterval> | null = null
let letGo: ReturnType<typeof setTimeout> | null = null
function holdNote(game: string): () => void {
  holders += 1
  if (letGo) { clearTimeout(letGo); letGo = null }
  if (!beat) {
    const post = () => void api.nudge(game, 'duo').catch(() => {})
    post()
    beat = setInterval(post, HEARTBEAT_MS)
  }
  return () => {
    holders -= 1
    if (holders > 0) return
    letGo = setTimeout(() => {
      letGo = null
      if (beat) { clearInterval(beat); beat = null }
      void api.clearNudge().catch(() => {})
    }, 1000)
  }
}

export function LobbyInvite({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const profile = useProfile()
  const [note, setNote] = useState<string | null>(null)
  const both = s.players.A.connected && s.players.B.connected
  const paired = profile?.state === 'paired' ? profile : null
  const partner = paired?.partner.name || 'your partner'
  const waiting = !!paired && !!me && !both && s.phase === 'JOIN'

  // They're here, or you've gone: the note's done its job.
  useEffect(() => (waiting ? holdNote(s.game) : undefined), [waiting, s.game])

  if (!me || both || s.phase !== 'JOIN') return null
  const name = gameName(s.game)

  const share = async () => {
    const url = window.location.href
    const text = `Come and play ${name} with me on Coupled`
    setNote(null)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Coupled', text, url })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // changed their mind
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}: ${url}`)
      setNote('Link copied — paste it to them.')
    } catch {
      setNote(url)
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {paired && (
        <div className="text-center text-sm font-bold text-fg/60">
          {partner} can see you’re waiting, on their Coupled home screen.
        </div>
      )}
      <button className={btnOutline} onClick={() => void share()}>
        Send {paired ? partner : 'them'} the link
      </button>
      <div className="min-h-[1.25rem] text-center text-sm text-fg/60 break-all">{note ?? ''}</div>
    </div>
  )
}
