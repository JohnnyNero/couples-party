import type { SessionState } from '../../engine/state'
import { useMyPlayerId } from '../../net'
import { currentAct } from '../../engine/list'
import { ThemeIcon } from '../../views/ThemeIcon'
import { themeText, playerName, rankerOf } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'

// The card that opens each Shortlist act: the theme, once, big, with nothing to do.
// Both devices show it, so the first item never lands on someone still reading.
export function ScreenListIntro({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const act = currentAct(s)!
  const theme = themeText(s, act, me)
  const ranker = rankerOf(act)
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-5 sm:gap-7">
      <ThemeIcon themeText={theme} className="w-36 sm:w-56 animate-pop shadow-[5px_5px_0_rgba(0,0,0,0.10)]" />
      <div className="font-display text-[2rem] sm:text-5xl font-extrabold leading-[1.1] tracking-tight text-balance">{theme}</div>
      <div className="flex flex-col gap-2 text-sm sm:text-lg font-bold">
        <span className="flex items-center justify-center gap-2">
          <Avatar p={ranker} name={playerName(s, ranker)} size="sm" />
          <span className={inkOf(ranker)}>{playerName(s, ranker)}</span> ranks them for real
        </span>
        <span className="flex items-center justify-center gap-2">
          <Avatar p={act.author} name={playerName(s, act.author)} size="sm" />
          <span className={inkOf(act.author)}>{playerName(s, act.author)}</span> guesses how
        </span>
      </div>
    </div>
  )
}
