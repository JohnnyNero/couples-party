import type { ListItem, SessionState } from '../../engine/state'
import { currentAct } from '../../engine/list'
import { listItemPoints, SCORING, shown as scaled } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { AnimatedNumber } from '../../views/AnimatedNumber'
import { themeText, playerName, rankerOf } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { card } from '../../ui/styles'

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
  const total = shown.reduce((n, i) => n + scaled(s, 'list', listItemPoints(i)), 0)
  const last = act.revealIndex >= act.items.length - 1
  const ranker = rankerOf(act)
  // A TV has nobody to tap it (`me` is null on a stream screen), and the act is over by
  // the time this is held up on DONE — in both cases the button would do nothing.
  const canAdvance = me !== null && s.phase === 'LIST_REVEAL'

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <div className="font-display text-xl sm:text-3xl font-extrabold text-center leading-tight text-balance">
        {themeText(s, act, me)}
      </div>

      <section className={card + ' px-4 py-2'}>
        <div className="flex items-center py-1.5 text-xs sm:text-base font-extrabold">
          <span className="flex-1 min-w-0" />
          {/* Too narrow for names on a phone: the avatar says whose, the label says it in full. */}
          <span title={`${playerName(s, ranker)} ranked`} aria-label={`${playerName(s, ranker)} ranked`} className={'w-[4.5rem] sm:w-28 shrink-0 flex items-center justify-center gap-1 ' + inkOf(ranker)}>
            <Avatar p={ranker} name={playerName(s, ranker)} size="sm" /> ranked
          </span>
          <span title={`${playerName(s, act.author)} guessed`} aria-label={`${playerName(s, act.author)} guessed`} className={'w-[5.5rem] sm:w-32 shrink-0 flex items-center justify-center gap-1 ' + inkOf(act.author)}>
            <Avatar p={act.author} name={playerName(s, act.author)} size="sm" /> guessed
          </span>
        </div>
        {shown.map((item, i) => (
          <Row s={s} key={item.id} item={item} live={i === act.revealIndex} />
        ))}
        {/* The items still to come, as empty ruled lines — you can see how much is left. */}
        {act.items.slice(act.revealIndex + 1).map((item) => (
          <div key={item.id} className="border-t border-fg/10 h-[2.4rem] sm:h-[3.2rem]" />
        ))}
      </section>

      <div className="flex items-center justify-between gap-3">
        <span className="font-display text-xl sm:text-3xl font-extrabold">
          {playerName(s, act.author)}{' '}
          <span className={'tabular-nums ' + inkOf(act.author)}>
            <AnimatedNumber
              value={total}
              from={total - scaled(s, 'list', listItemPoints(act.items[act.revealIndex]))}
              delayMs={600}
            />
          </span>
        </span>
        {canAdvance && (
          <button
            onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}
            className="min-h-[52px] px-6 rounded-2xl bg-fg text-bg font-display text-lg sm:text-2xl font-extrabold active:translate-y-px"
          >
            {last ? 'Done' : 'Next item'}
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ s, item, live }: { s: SessionState; item: ListItem; live: boolean }) {
  const raw = listItemPoints(item)
  const exact = raw === SCORING.listExact
  const points = scaled(s, 'list', raw)
  return (
    <div
      className={
        'flex items-center border-t border-fg/10 h-[2.4rem] sm:h-[3.2rem] text-sm sm:text-2xl font-bold ' +
        (live ? 'text-fg' : 'text-fg/55')
      }
    >
      <span className="flex-1 min-w-0 truncate pr-2">{item.text}</span>
      <span
        className={
          'w-[4.5rem] sm:w-28 text-center shrink-0 font-display text-lg sm:text-3xl font-extrabold tabular-nums ' +
          (live ? 'animate-drop-in' : '')
        }
      >
        {item.actualSlot ?? '—'}
      </span>
      <span
        style={live ? { animationDelay: '550ms' } : undefined}
        className={
          'w-[5.5rem] sm:w-32 text-center shrink-0 font-display text-lg sm:text-3xl font-extrabold tabular-nums ' +
          (live ? 'animate-reveal-pop' : '')
        }
      >
        {item.predictedSlot ?? '—'}
        {points > 0 && (
          <span className={'ml-1.5 align-middle inline-block rounded-full px-1.5 text-[0.7rem] sm:text-base font-extrabold ' + (exact ? 'bg-sage-soft text-sage-ink' : 'bg-tan-soft text-tan-ink')}>
            +{points}
          </span>
        )}
      </span>
    </div>
  )
}
