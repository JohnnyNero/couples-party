import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type CrosswordWeek } from '../daily/api'
import { localDate } from '../daily/dates'
import { CrosswordScreen, weekLabel } from './CrosswordScreen'
import { mondayOf, useCrossword } from './useCrossword'
import { useBackLayer } from '../ui/back'
import { slide } from '../ui/transition'
import { at } from '../ui/fx'
import { eyebrow } from '../ui/styles'

// Every week's crossword, kept: in Memories as a shelf of little grids, and any of them
// open to finish — last week's never goes away just because Monday came.

// A grid in miniature: only colours, never letters. `deal` has the squares land one by
// one, for a new week's first sight of it.
export function MiniGrid({ w, h, squares, whose, size = 132, deal = false }: {
  w: number; h: number; squares: string[]; whose: (k: string) => boolean | undefined; size?: number; deal?: boolean
}) {
  const cell = Math.min(12, Math.floor(size / Math.max(w, h, 1)))
  return (
    <div className="shrink-0 relative" style={{ width: cell * w, height: cell * h }} aria-hidden="true">
      {squares.map((k) => {
        const [r, c] = k.split(',').map(Number)
        const mine = whose(k)
        return (
          <span
            key={k}
            className={'absolute rounded-[2px] ' + (mine === undefined ? 'bg-fg/15' : mine ? 'bg-pa' : 'bg-pb') + (deal ? ' animate-pop' : '')}
            style={{ left: c * cell, top: r * cell, width: cell - 1.5, height: cell - 1.5, ...(deal ? at((r + c) * 35) : {}) }}
          />
        )
      })}
    </div>
  )
}

export const progress = (w: CrosswordWeek) =>
  w.squares.length === 0 ? 0 : Math.round((w.squares.filter((k) => k in w.cells).length / w.squares.length) * 100)

// All your crosswords, newest first — reloaded after one's been open, so how far you got
// shows straight away.
export function useCrosswordWeeks() {
  const [weeks, setWeeks] = useState<CrosswordWeek[] | null>(null)
  const reload = useCallback(() => {
    api.crosswordWeeks().then(setWeeks).catch(() => setWeeks(null))
  }, [])
  useEffect(reload, [reload])
  return { weeks, reload }
}

// Any week's crossword, open over everything.
export function CrosswordSheet({ week, onClose }: { week: string; onClose: () => void }) {
  const { status, fill } = useCrossword(true, week)
  useBackLayer(true, onClose)
  useEffect(() => { if (status.kind === 'off' || status.kind === 'error') onClose() }, [status.kind, onClose])
  return createPortal(
    <div className="fixed inset-0 z-50 bg-bg">
      {status.kind === 'ready' ? (
        <CrosswordScreen data={status.data} me={status.me} partner={status.partner} week={week} onFill={fill} onClose={onClose} />
      ) : (
        <div className="h-full grid place-items-center font-display text-xl font-extrabold text-fg/50">Opening…</div>
      )}
    </div>,
    document.body,
  )
}

// The shelf in Memories: every week, small, with how far you got.
export function CrosswordShelf() {
  const { weeks, reload } = useCrosswordWeeks()
  const [open, setOpenNow] = useState<string | null>(null)
  const setOpen = (w: string | null) => slide(w ? 'forward' : 'back', () => setOpenNow(w))
  const close = useCallback(() => { slide('back', () => setOpenNow(null)); reload() }, [reload])
  if (!weeks || weeks.length === 0) return null
  const thisWeek = mondayOf(localDate())

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={eyebrow}>Our crosswords</span>
        <span className="flex-1 h-px bg-fg/10" />
      </div>
      <div className="-mx-5 px-5 flex gap-3 overflow-x-auto pb-1 snap-x">
        {weeks.map((w) => {
          const done = !!w.solvedAt
          const pct = progress(w)
          return (
            <button
              key={w.week}
              onClick={() => setOpen(w.week)}
              className="press snap-start shrink-0 w-[9.5rem] rounded-3xl border-2 border-fg/15 bg-card p-3 flex flex-col items-center gap-2 text-center"
            >
              <div className="h-[92px] grid place-items-center">
                <MiniGrid w={w.w} h={w.h} squares={w.squares} whose={(k) => w.cells[k]} size={92} />
              </div>
              <div>
                <div className="text-sm font-extrabold leading-tight">{w.week === thisWeek ? 'This week' : `Week of ${weekLabel(w.week)}`}</div>
                <div className={'text-xs font-bold ' + (done ? 'text-sage-ink' : 'text-fg/55')}>
                  {done ? 'Solved together ✓' : pct === 0 ? 'Not started' : `${pct}% · finish it`}
                </div>
              </div>
            </button>
          )
        })}
      </div>
      {open && <CrosswordSheet week={open} onClose={close} />}
    </section>
  )
}
