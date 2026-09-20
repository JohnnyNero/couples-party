import type { ListAct, SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { SLOTS, currentAct, currentItem, usedSlots } from '../../engine/list'
import { playerName, rankerOf } from '../../views/list'

// The item is public — both phones hold it. The grids show occupancy only: which slots
// are gone, never what went in them.
export function ScreenListPlace({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  return (
    <div className="w-full max-w-4xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Item {act.placeIndex + 1} of {LIST.items}
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight break-words">
        {item.text}
      </div>
      <div className="mt-8 sm:mt-14 flex flex-col sm:flex-row justify-center gap-6 sm:gap-16">
        <Occupancy label={`${playerName(s, rankerOf(act))} places`} act={act} byAuthor={false} />
        <Occupancy label={`${playerName(s, act.author)} predicts`} act={act} byAuthor />
      </div>
    </div>
  )
}

function Occupancy({ label, act, byAuthor }: { label: string; act: ListAct; byAuthor: boolean }) {
  const used = new Set(usedSlots(act, byAuthor))
  return (
    <div>
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2 sm:mb-3">
        {label}
      </div>
      <div className="flex justify-center gap-1 sm:gap-2">
        {SLOTS.map((n) => (
          <span
            key={n}
            className={
              'h-8 w-8 sm:h-12 sm:w-12 flex items-center justify-center tabular-nums text-sm sm:text-xl ' +
              (used.has(n) ? 'bg-fg/80 text-bg' : 'border-2 border-fg/25 text-fg/30')
            }
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}
