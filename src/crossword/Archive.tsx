import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api, type CrosswordWeek } from '../daily/api'
import { localDate } from '../daily/dates'
import { CrosswordScreen, weekLabel } from './CrosswordScreen'
import { mondayOf, useCrossword } from './useCrossword'
import { MiniGrid } from './MiniGrid'
import { pct, standing } from './standing'
import { useBackLayer } from '../ui/back'
import { slide } from '../ui/transition'
import { eyebrow } from '../ui/styles'

// Every week's crossword, kept: in Memories as a shelf of little grids, and any of them
// open to finish — last week's never goes away just because Monday came.

// Where each of you is on a week's.
export const sides = (w: CrosswordWeek) => ({
  me: { pct: pct(w.mine.length, w.squares.length), solvedAt: w.solvedAt },
  them: { pct: pct(w.theirs.length, w.squares.length), solvedAt: w.theirSolvedAt },
})

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

// The shelf in Memories: every week, small — your copy — with how far each of you got.
export function CrosswordShelf({ partner }: { partner: string }) {
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
          const { me, them } = sides(w)
          const line = standing(me, them, partner) || 'Not started'
          return (
            <button
              key={w.week}
              onClick={() => setOpen(w.week)}
              className="press snap-start shrink-0 w-[9.5rem] rounded-3xl border-2 border-fg/15 bg-card p-3 flex flex-col items-center gap-2 text-center"
            >
              <div className="h-[92px] grid place-items-center">
                <MiniGrid w={w.w} h={w.h} squares={w.squares} whose={(k) => (w.mine.includes(k) ? true : undefined)} size={92} />
              </div>
              <div>
                <div className="text-sm font-extrabold leading-tight">{w.week === thisWeek ? 'This week' : `Week of ${weekLabel(w.week)}`}</div>
                <div className={'text-xs font-bold leading-snug ' + (me.solvedAt ? 'text-sage-ink' : 'text-fg/55')}>{line}</div>
              </div>
            </button>
          )
        })}
      </div>
      {open && <CrosswordSheet week={open} onClose={close} />}
    </section>
  )
}
