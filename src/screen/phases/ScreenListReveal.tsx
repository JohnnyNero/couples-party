import type { ListItem, SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { listItemPoints } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { AnimatedNumber } from '../../views/AnimatedNumber'
import { themeText, playerName, rankerOf } from '../../views/list'

// The reveal walks the items in the order they were handed out, one tap at a time. Each
// new row shows the ranker's real slot first and the guess a beat later — the pause is
// the whole point, it's the gap where you find out how you're read. Rows stay on screen
// as they're done, so by the end the two columns are the full comparison.
//
// Names, never "yours" and "theirs": in phones-only mode this is one screen two people
// are both looking at, so there is no "you".
export function ScreenListReveal({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const me = useMyPlayerId()
  const shown = act.items.slice(0, act.revealIndex + 1)
  const total = shown.reduce((n, i) => n + listItemPoints(i), 0)
  const last = act.revealIndex >= act.items.length - 1
  const ranker = rankerOf(act)
  // A TV has nobody to tap it (`me` is null on a stream screen), and the act is over by
  // the time this is held up on DONE — in both cases the button would do nothing.
  const canAdvance = me !== null && s.phase === 'LIST_REVEAL'

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 text-center truncate">
        {themeText(s, act)}
      </div>

      <div className="flex text-[0.55rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-fg/40">
        <span className="flex-1 min-w-0" />
        <span className="w-[4.5rem] sm:w-28 text-center shrink-0">{playerName(s, ranker)} ranked</span>
        <span className="w-[5.5rem] sm:w-32 text-center shrink-0">{playerName(s, act.author)} guessed</span>
      </div>

      <div className="border-t-2 border-fg/80">
        {shown.map((item, i) => (
          <Row key={item.id} item={item} live={i === act.revealIndex} />
        ))}
        {/* The items still to come, as empty ruled lines — you can see how much is left. */}
        {act.items.slice(act.revealIndex + 1).map((item) => (
          <div key={item.id} className="border-b border-fg/10 py-1.5 sm:py-2.5 h-[2.1rem] sm:h-[3rem]" />
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-base sm:text-2xl font-bold uppercase tracking-tight">
          {playerName(s, act.author)}{' '}
          <span className="text-accent tabular-nums">
            <AnimatedNumber
              value={total}
              from={total - listItemPoints(act.items[act.revealIndex])}
              delayMs={600}
            />
          </span>
        </span>
        {canAdvance && (
          <button
            onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}
            className="min-h-[48px] px-5 bg-accent text-bg text-base sm:text-xl font-bold uppercase tracking-widest active:translate-y-px rounded-xl"
          >
            {last ? 'Done' : 'Next item'}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ item, live }: { item: ListItem; live: boolean }) {
  const points = listItemPoints(item)
  const exact = points === 3
  return (
    <div
      className={
        'flex items-center border-b border-fg/15 py-1.5 sm:py-2.5 text-sm sm:text-2xl uppercase ' +
        (live ? 'text-fg' : 'text-fg/45')
      }
    >
      <span className="flex-1 min-w-0 truncate pr-2">{item.text}</span>
      <span
        className={
          'w-[4.5rem] sm:w-28 text-center shrink-0 font-bold tabular-nums ' +
          (live ? 'animate-drop-in' : '')
        }
      >
        {item.actualSlot ?? '—'}
      </span>
      <span
        style={live ? { animationDelay: '550ms' } : undefined}
        className={
          'w-[5.5rem] sm:w-32 text-center shrink-0 font-bold tabular-nums ' +
          (exact ? 'text-accent ' : '') +
          (live ? 'animate-reveal-pop' : '')
        }
      >
        {item.predictedSlot ?? '—'}
        <span className="text-xs sm:text-lg font-bold ml-1.5 text-accent">
          {points > 0 ? `+${points}` : ''}
        </span>
      </span>
    </div>
  )
}
