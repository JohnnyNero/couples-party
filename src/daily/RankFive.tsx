import { useState } from 'react'

const RANKS = [1, 2, 3, 4, 5]

// Ranking five things, one at a time — the same ladder-building feel as the live
// Shortlist round (PlayListPlace), just standalone: no session, no partner watching,
// just this phone building the list and handing back the finished order.
export function RankFive({
  items,
  onDone,
  disabled = false,
}: {
  items: string[] // exactly five, in the fixed order they're offered
  onDone: (order: number[]) => void // order[k] = index into `items` placed at rank k+1
  disabled?: boolean
}) {
  const [slots, setSlots] = useState<(number | null)[]>([null, null, null, null, null])
  const current = slots.filter((s) => s !== null).length // how many placed so far = index of the item in hand
  const done = current >= items.length

  const place = (rank: number) => {
    if (disabled || done || slots[rank] !== null) return
    const next = [...slots]
    next[rank] = current
    setSlots(next)
    if (next.every((s) => s !== null)) onDone(next as number[])
  }

  return (
    <div className="flex flex-col gap-3">
      {/* The item in hand. Gone quiet once every rank is spoken for — there's nothing
          left to place, whether or not onDone has been acted on yet. */}
      <div
        className={
          'shrink-0 rounded-2xl px-4 text-center ' +
          (done
            ? 'py-2 text-xs font-bold text-fg/35 border-2 border-dashed border-fg/15'
            : 'py-4 font-display text-2xl font-extrabold leading-tight bg-fg text-bg shadow-[4px_4px_0_rgba(0,0,0,0.18)] animate-pop')
        }
      >
        {done ? 'All ranked' : items[current]}
      </div>

      <div className="flex flex-col gap-1.5">
        {RANKS.map((n, i) => {
          const filled = slots[i]
          const isLive = filled === current && !done
          return (
            <button
              key={n}
              type="button"
              disabled={disabled || filled !== null || done}
              onClick={() => place(i)}
              className={
                'min-h-[44px] flex items-center gap-3 rounded-xl border-2 px-3 text-left transition-colors ' +
                (isLive
                  ? 'border-accent bg-pa text-white animate-pop'
                  : filled !== null
                    ? 'border-fg/15 bg-fg/5 text-fg/70'
                    : 'border-fg/20 text-fg active:translate-y-px active:bg-pa-soft')
              }
            >
              <span className={'w-6 shrink-0 text-xl font-bold tabular-nums ' + (isLive ? 'text-bg' : filled !== null ? 'text-fg/40' : 'text-accent-ink')}>
                {n}
              </span>
              <span className="flex-1 min-w-0 truncate text-sm font-bold">
                {filled !== null ? items[filled] : ''}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
