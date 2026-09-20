import type { SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { currentAct } from '../../engine/list'
import { themeText, playerName, rankerOf } from '../../views/list'

// Counts only — the items are revealed one at a time in LIST_PLACE, and a board that
// spoils the list destroys the act.
export function ScreenListWrite({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        {playerName(s, act.author)} picks · {playerName(s, rankerOf(act))} ranks
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight break-words">
        {themeText(s, act)}
      </div>
      <div className="mt-8 sm:mt-14 text-4xl sm:text-7xl font-bold tabular-nums">
        {act.items.length}
        <span className="text-fg/30"> / {LIST.items}</span>
      </div>
    </div>
  )
}
