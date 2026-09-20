import type { PlayerId, SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { SLOTS, currentAct, currentItem, slotOf, usedSlots } from '../../engine/list'
import { dispatch } from '../../net/playroom'
import { PlayWaiting } from './PlayWaiting'

// One item at a time, an irreversible bet each time. The author predicts, the ranker
// commits, neither sees the other — and by item seven there is one slot left, which is
// correct and is not hidden.
export function PlayListPlace({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  const byAuthor = me === act.author
  const mine = slotOf(item, byAuthor)

  if (mine !== null) return <PlayWaiting label={`Locked at ${mine} — waiting`} />

  const used = new Set(usedSlots(act, byAuthor))
  return (
    <div className="h-full flex flex-col justify-center p-5 gap-4">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          Item {act.placeIndex + 1} of {LIST.items} · {byAuthor ? 'where will they put it' : 'where does it go'}
        </div>
        <div className="text-2xl font-bold uppercase tracking-tight break-words">{item.text}</div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SLOTS.map((n) => {
          const taken = used.has(n)
          return (
            <button
              key={n}
              disabled={taken}
              className={
                'min-h-[64px] text-2xl font-bold tabular-nums uppercase active:translate-y-px ' +
                (taken ? 'border-2 border-fg/15 text-fg/20' : 'bg-fg text-bg')
              }
              onClick={() => dispatch({ type: 'PLACE_ITEM', player: me, slot: n })}
            >
              {n}
            </button>
          )
        })}
      </div>
    </div>
  )
}
