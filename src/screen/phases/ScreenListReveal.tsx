import type { SessionState } from '../../engine/state'
import { SLOTS, currentAct } from '../../engine/list'
import { listAward } from '../../engine/standing'
import { playerName } from '../../views/list'

// Actual against predicted, side by side. The board states the result and says nothing
// about it — with two people in the room it is the only neutral party.
export function ScreenListReveal({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const award = listAward(act)
  const bySlot = (slot: number, byAuthor: boolean) =>
    act.items.find((i) => (byAuthor ? i.predictedSlot : i.actualSlot) === slot)

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2">
        <span className="w-6 sm:w-9" />
        <span className="flex-1">{playerName(s, act.author)} predicted</span>
        <span className="flex-1">Actual</span>
      </div>
      <div className="border-t-2 border-fg/80">
        {SLOTS.map((n) => {
          const predicted = bySlot(n, true)
          const actual = bySlot(n, false)
          const hit = !!predicted && predicted.id === actual?.id
          return (
            <div
              key={n}
              className={
                'flex items-baseline gap-2 border-b border-fg/15 py-1 sm:py-2 text-sm sm:text-2xl uppercase ' +
                (hit ? 'text-accent' : 'text-fg/80')
              }
            >
              <span className="w-6 sm:w-9 shrink-0 tabular-nums text-fg/30 text-xs sm:text-base">{n}</span>
              <span className="flex-1 min-w-0 truncate">{predicted?.text ?? '—'}</span>
              <span className="flex-1 min-w-0 truncate">{actual?.text ?? '—'}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-4 sm:mt-6 flex items-baseline justify-between gap-4">
        <span className="text-lg sm:text-3xl font-bold uppercase tracking-tight">
          Displacement <span className="tabular-nums">{act.displacement ?? 0}</span>
        </span>
        <span className="text-lg sm:text-3xl font-bold uppercase tracking-tight text-accent text-right">
          {award ? `${playerName(s, award.player)} +${award.points}` : 'Nothing moves'}
        </span>
      </div>
    </div>
  )
}
