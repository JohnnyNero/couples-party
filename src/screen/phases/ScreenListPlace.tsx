import type { SessionState } from '../../engine/state'
import { currentAct, currentItem, SLOTS } from '../../engine/list'
import { themeText, rankerOf } from '../../views/list'
import { WhoIsIn } from '../../ui/kit'
import { card, eyebrow } from '../../ui/styles'

// Items are revealed one at a time, on the phones only — the board says which item
// number is live and who has locked it in, never the text itself. Spoiling the list
// here would ruin the reveal.
export function ScreenListPlace({ s }: { s: SessionState }) {
  const act = currentAct(s)!
  const item = currentItem(act)!
  const ranker = rankerOf(act)
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center text-center gap-8">
      <section className={card + ' w-full px-5 py-6'}>
        <div className={eyebrow + ' text-accent-ink'}>{themeText(s, act)}</div>
        <div className="mt-2 font-display text-[2.4rem] sm:text-6xl font-extrabold tabular-nums leading-none">
          Item {act.placeIndex + 1}
          <span className="text-fg/30"> of {SLOTS.length}</span>
        </div>
        <div className="mt-4 flex justify-center gap-1.5">
          {SLOTS.map((n) => (
            <span key={n} className={'h-2 w-6 rounded-full ' + (n - 1 < act.placeIndex ? 'bg-fg' : n - 1 === act.placeIndex ? 'bg-pa' : 'bg-fg/15')} />
          ))}
        </div>
      </section>
      <WhoIsIn
        s={s}
        big
        done={{
          [act.author]: item.predictedSlot !== null,
          [ranker]: item.actualSlot !== null,
        } as Record<'A' | 'B', boolean>}
        waiting={(p) => (p === act.author ? 'Guessing…' : 'Ranking…')}
      />
    </div>
  )
}
