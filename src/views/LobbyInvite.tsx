import { useEffect, useState } from 'react'
import type { GameKey, SessionState } from '../engine/state'
import { GAME_LABELS } from '../engine/roster'
import { useMyPlayerId } from '../net'
import { api } from '../daily/api'
import { useProfile } from '../profile/store'
import { resolveMode } from '../start/mode'
import { btnAccent, btnOutline } from '../ui/styles'

const SESSION_NAMES: Record<string, string> = { tonight: 'Tonight', full: 'the full session' }
export const gameName = (game: string) => SESSION_NAMES[game] ?? GAME_LABELS[game as GameKey] ?? 'a game'

// In the lobby, waiting for your partner: send them the link (it opens the game on their
// phone), or nudge them in the app — a note on their Coupled home screen, "Johnny's
// waiting for you in Tonight", with a button straight in.
export function LobbyInvite({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const profile = useProfile()
  const [note, setNote] = useState<string | null>(null)
  const [nudge, setNudge] = useState<'idle' | 'sending' | 'sent'>('idle')
  const both = s.players.A.connected && s.players.B.connected
  const paired = profile?.state === 'paired' ? profile : null
  const partner = paired?.partner.name || 'your partner'

  // You're both in: the nudge has done its job.
  useEffect(() => { if (both && paired) void api.clearNudge().catch(() => {}) }, [both, paired])

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

  const sendNudge = async () => {
    setNudge('sending')
    setNote(null)
    try {
      const mode = resolveMode(window.location.search) === 'screen' ? 'screen' : 'duo'
      await api.nudge(s.game, mode)
      setNudge('sent')
    } catch {
      setNudge('idle')
      setNote("Couldn't send that — try the link instead.")
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {paired && (
        <button className={btnAccent} onClick={() => void sendNudge()} disabled={nudge !== 'idle'}>
          {nudge === 'sent' ? `Nudged ${partner} ✓` : nudge === 'sending' ? 'Nudging…' : `Nudge ${partner}`}
        </button>
      )}
      <button className={btnOutline} onClick={() => void share()}>
        Send {paired ? partner : 'them'} the link
      </button>
      <div className="min-h-[1.25rem] text-center text-sm text-fg/60 break-all">
        {note ?? (nudge === 'sent' ? `It’s on ${partner}’s Coupled home screen, with a button straight in.` : '')}
      </div>
    </div>
  )
}
