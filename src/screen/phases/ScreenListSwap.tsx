import type { SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { themeText, playerName, rankerOf } from '../../views/list'

// The veto is free, unexplained and unattributed: the board says it is happening and
// never says what was changed.
export function ScreenListSwap({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        {themeText(s, act)}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">
        {playerName(s, rankerOf(act))} may replace one
      </div>
      <div className="mt-6 sm:mt-10 text-sm sm:text-xl uppercase tracking-[0.25em] text-fg/40">
        No cost · no explanation
      </div>
    </div>
  )
}
