import type { PlayerId, SessionState } from '../../engine/state'
import { currentAct, currentItem, slotContents, SLOTS } from '../../engine/list'
import { dispatch } from '../../net'
import { themeText } from '../../views/list'

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
    <div className="h-full flex flex-col p-4 gap-3">
      <div className="shrink-0">
        <div className="flex items-baseline justify-between gap-2 text-[0.6rem] uppercase tracking-[0.25em] mb-1">
          <span className="text-fg/40">Item {act.placeIndex + 1} of {SLOTS.length}</span>
          <span className="text-accent font-bold shrink-0">
            {byAuthor ? 'Your guess' : 'For real'}
          </span>
        </div>
        <div className="text-sm uppercase tracking-wide text-fg/50 truncate">{themeText(s, act)}</div>
      </div>

      {/* The item in hand. Once it's placed it's down in the ladder, so the card goes
          quiet rather than sitting there looking tappable. */}
      <div
        className={
          'shrink-0 rounded-2xl px-4 text-center uppercase tracking-tight ' +
          (placed
            ? 'py-2 text-xs font-bold text-fg/35 border-2 border-dashed border-fg/15'
            : 'py-4 text-xl font-bold bg-fg text-bg shadow-[4px_4px_0_rgba(0,0,0,0.18)] animate-pop')
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
                'flex-1 min-h-[44px] flex items-center gap-3 rounded-xl border-2 px-3 text-left transition-colors ' +
                (isLive
                  ? 'border-accent bg-accent text-bg animate-pop'
                  : sitting
                    ? 'border-fg/15 bg-fg/5 text-fg/70'
                    : placed
                      ? 'border-fg/10 text-fg/25'
                      : 'border-fg/20 text-fg active:translate-y-px active:bg-accent/15')
              }
            >
              <span
                className={
                  'w-7 shrink-0 text-2xl font-bold tabular-nums ' +
                  (isLive ? 'text-bg' : sitting ? 'text-fg/40' : 'text-accent')
                }
              >
                {n}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm uppercase tracking-wide">
                {sitting?.text ?? ''}
              </span>
            </button>
          )
        })}
      </div>

      <div className="shrink-0 text-xs uppercase tracking-wide text-fg/40 text-center">
        {placed ? 'They\'re still placing theirs' : '1 is top — tap a rank and it\'s locked'}
      </div>
    </div>
  )
}
