import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct, currentItem, slotContents, SLOTS } from '../../engine/list'
import { dispatch } from '../../net'
import { themeText } from '../../views/list'
import { eyebrow } from '../../ui/styles'

// Items come up one at a time. Tap a rank and the item drops into it, so the ladder
// fills in front of you and the next call is made against the list you've already
// built rather than from memory. A rank is spent once it holds something — no dragging,
// no changing your mind. The author guesses where the ranker will put each item; the
// ranker gives the real answer.
export function PlayListPlace({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  const byAuthor = me === act.author
  const placed = byAuthor ? item.predictedSlot !== null : item.actualSlot !== null
  const filled = slotContents(act, byAuthor)

  return (
    <div className="h-full flex flex-col px-4 pb-4 gap-3">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className={eyebrow}>Item {act.placeIndex + 1} of {SLOTS.length}</span>
          <span className="shrink-0 rounded-full bg-pa-soft text-pa-ink px-2.5 py-0.5 text-xs font-extrabold">
            {byAuthor ? 'Your guess' : 'For real'}
          </span>
        </div>
        <div className="mt-0.5 font-display text-lg font-bold leading-tight truncate">{themeText(s, act, me)}</div>
      </div>

      {/* The item in hand. Once it's placed it's down in the ladder, so the card goes
          quiet rather than sitting there looking tappable. */}
      <div
        className={
          'shrink-0 rounded-2xl px-4 text-center ' +
          (placed
            ? 'py-2 text-sm font-bold text-fg/45 border-2 border-dashed border-fg/15'
            : 'py-4 font-display text-2xl font-extrabold leading-tight bg-fg text-bg shadow-[4px_4px_0_rgba(0,0,0,0.18)] animate-pop')
        }
      >
        {placed ? 'Locked in — waiting on them' : item.text}
      </div>

      {/* The rows share out whatever height is left rather than sitting in a clump with
          dead space under the card — seven fat tap targets, no scrolling. */}
      <div className="flex-1 min-h-0 flex flex-col gap-1.5">
        {SLOTS.map((n) => {
          const sitting = filled.get(n)
          const isLive = sitting?.id === item.id
          return (
            <button
              key={n}
              disabled={!!sitting || placed}
              onClick={() => dispatch({ type: 'PLACE_ITEM', player: me, slot: n })}
              className={
                'flex-1 min-h-[44px] flex items-center gap-3 rounded-2xl border-2 px-3 text-left transition-colors ' +
                (isLive
                  ? 'border-pa bg-pa text-white animate-pop'
                  : sitting
                    ? 'border-fg/10 bg-fg/5 text-fg/70'
                    : placed
                      ? 'border-fg/10 text-fg/25'
                      : 'border-fg/25 bg-card text-fg active:translate-y-px active:bg-pa-soft active:border-pa')
              }
            >
              <span
                className={
                  'w-7 shrink-0 font-display text-2xl font-extrabold tabular-nums ' +
                  (isLive ? 'text-white' : sitting ? 'text-fg/40' : 'text-pa-ink')
                }
              >
                {n}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-bold">
                {sitting?.text ?? ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="shrink-0 text-xs font-bold text-fg/50 text-center">
        {placed ? 'They\'re still placing theirs' : '1 is top — tap a rank and it\'s locked'}
      </div>
    </div>
  )
}
