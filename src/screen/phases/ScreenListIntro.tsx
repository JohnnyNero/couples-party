import type { SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { ThemeIcon } from '../../views/ThemeIcon'
import { themeText, playerName, rankerOf } from '../../views/list'

// The card that opens each Shortlist act: the theme, once, big, with nothing to do.
// Both devices show it, so the first item never lands on someone still reading.
export function ScreenListIntro({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const theme = themeText(s, act)
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-5 sm:gap-7">
      <ThemeIcon
        themeText={theme}
        className="w-36 sm:w-56 animate-pop shadow-[5px_5px_0_rgba(0,0,0,0.10)]"
      />
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight text-balance">
        {theme}
      </div>
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.25em] text-fg/40">
        {playerName(s, rankerOf(act))} ranks · {playerName(s, act.author)} predicts
      </div>
    </div>
  )
}
