import type { SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { Dot } from '../../views/Dot'
import { playerName, rankerOf } from '../../views/list'

// Both players are dragging the same seven items into their own order, in private —
// the board says only whether each side has locked in yet, never what either order is.
export function ScreenListPlace({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const authorDone = act.items.every((i) => i.predictedSlot !== null)
  const rankerDone = act.items.every((i) => i.actualSlot !== null)
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Ranking, in private
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight">
        Seven items, one order each
      </div>
      <div className="mt-8 sm:mt-14 flex justify-center gap-10 sm:gap-20">
        <Side label={`${playerName(s, act.author)} predicts`} done={authorDone} />
        <Side label={`${playerName(s, rankerOf(act))} ranks`} done={rankerDone} />
      </div>
    </div>
  )
}

function Side({ label, done }: { label: string; done: boolean }) {
  return (
    <div>
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2 sm:mb-3">
        {label}
      </div>
      <Dot on={done} />
    </div>
  )
}
