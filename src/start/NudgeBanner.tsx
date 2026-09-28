import { useEffect, useState } from 'react'
import { api, type Nudge } from '../daily/api'
import { resolveGame, type Game } from './mode'
import { gameName } from '../views/LobbyInvite'
import { Avatar } from '../ui/Avatar'

// A lobby keeps its note fresh every couple of minutes while someone's in it (see
// LobbyInvite), so one older than this is from a phone that's since gone quiet — closed,
// out of signal — and nobody's really waiting. (A phone whose clock runs ahead of the
// server's still counts: better a note shown than one missed.)
const STALE_MS = 5 * 60 * 1000
const fresh = (n: Nudge) => !(Date.parse(n.at) < Date.now() - STALE_MS)

// Checks every so often (and whenever you come back to the app) whether your partner's
// waiting for you in a game's lobby.
function useNudge(): Nudge | null {
  const [nudge, setNudge] = useState<Nudge | null>(null)
  useEffect(() => {
    let live = true
    const check = () => {
      if (document.visibilityState !== 'visible') return
      api.nudged().then((n) => { if (live) setNudge(n && fresh(n) ? n : null) }).catch(() => {})
    }
    check()
    const id = setInterval(check, 10000)
    document.addEventListener('visibilitychange', check)
    return () => {
      live = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return nudge
}

// "Johnny's waiting for you" — top of Home, with a button straight into their lobby.
export function NudgeBanner({ onJoin }: { onJoin: (game: Game) => void }) {
  const nudge = useNudge()
  const game = nudge ? resolveGame(`?game=${nudge.game}`) : null
  if (!nudge || !game) return null
  return (
    <section className="rounded-[1.75rem] bg-pb text-white p-4 flex items-center gap-3 shadow-[4px_4px_0_rgba(0,0,0,0.15)] animate-fade-up">
      <Avatar p="B" name={nudge.from} size="md" className="ring-2 ring-white/70" />
      <div className="flex-1 min-w-0">
        <div className="font-display text-lg font-extrabold leading-tight">{nudge.from}’s waiting for you</div>
        <div className="text-sm font-bold text-white/80 truncate">in {gameName(nudge.game)}</div>
      </div>
      <button
        onClick={() => onJoin(game)}
        className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-white text-pb-ink font-display text-lg font-extrabold press"
      >
        Join
      </button>
    </section>
  )
}
