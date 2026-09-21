import type { SessionState } from '../../engine/state'
import { currentAct, currentItem, SLOTS } from '../../engine/list'
import { Dot } from '../../views/Dot'
import { themeText, playerName, rankerOf } from '../../views/list'

// Items are revealed one at a time, on the phones only — the board says which item
// number is live and who has locked it in, never the text itself. Spoiling the list
// here would ruin the reveal.
export function ScreenListPlace({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  const authorDone = item.predictedSlot !== null
  const rankerDone = item.actualSlot !== null
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        {themeText(s, act)}
      </div>
      <div className="text-2xl sm:text-5xl font-bold uppercase tracking-tight tabular-nums">
        Item {act.placeIndex + 1}
        <span className="text-fg/30"> / {SLOTS.length}</span>
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
