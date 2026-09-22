import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct, currentItem, usedSlots, SLOTS } from '../../engine/list'
import { dispatch } from '../../net'
import { themeText } from '../../views/list'
import { PlayWaiting } from './PlayWaiting'

// Items come up one at a time. Tap a slot and it's locked immediately — no dragging, no
// changing your mind, and a slot already spent on an earlier item can't be reused. The
// author guesses where the ranker will put it; the ranker gives the real answer.
export function PlayListPlace({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  const byAuthor = me === act.author
  const placed = byAuthor ? item.predictedSlot !== null : item.actualSlot !== null
  const used = usedSlots(act, byAuthor)

  if (placed) return <PlayWaiting label="Locked in — waiting on them" />

  return (
    <div className="h-full flex flex-col p-5 gap-3">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          Item {act.placeIndex + 1} of {SLOTS.length} · {byAuthor ? 'guess where they\'ll rank it' : 'rank it for real'}
        </div>
        <div className="text-sm uppercase tracking-wide text-fg/50 truncate">{themeText(s, act)}</div>
      </div>
      <div className="rounded-2xl bg-fg text-bg px-5 py-6 text-xl font-bold uppercase tracking-tight text-center shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
        {item.text}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-3 w-full max-w-sm">
          {SLOTS.map((n) => {
            const taken = used.has(n)
            return (
              <button
                key={n}
                disabled={taken}
                onClick={() => dispatch({ type: 'PLACE_ITEM', player: me, slot: n })}
                className={
                  'aspect-square rounded-2xl text-3xl font-bold tabular-nums border-2 active:translate-y-px ' +
                  (taken
                    ? 'border-fg/10 text-fg/20'
                    : 'border-fg/20 bg-accent text-bg shadow-[3px_3px_0_rgba(0,0,0,0.18)]')
                }
              >
                {n}
              </button>
            )
          })}
        </div>
      </div>
      <div className="text-xs uppercase tracking-wide text-fg/40 text-center">1st down to 7th — tap one, it's locked</div>
    </div>
  )
}
