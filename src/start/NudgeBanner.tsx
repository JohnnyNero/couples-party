import { useEffect, useState } from 'react'
import { api, type Nudge } from '../daily/api'
import { resolveGame, type Game, type PlayMode } from './mode'
import { gameName } from '../views/LobbyInvite'
import { Avatar } from '../ui/Avatar'

// Checks every so often (and whenever you come back to the app) whether your partner's
// waiting for you in a game's lobby.
function useNudge(): Nudge | null {
  const [nudge, setNudge] = useState<Nudge | null>(null)
  useEffect(() => {
    let live = true
    const check = () => {
      if (document.visibilityState !== 'visible') return
      api.nudged().then((n) => { if (live) setNudge(n) }).catch(() => {})
    }
    check()
    const id = setInterval(check, 15000)
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
export function NudgeBanner({ onJoin }: { onJoin: (game: Game, mode: PlayMode) => void }) {
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
        onClick={() => onJoin(game, nudge.mode)}
        className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-white text-pb-ink font-display text-lg font-extrabold active:translate-y-px"
      >
        Join
      </button>
    </section>
  )
}
