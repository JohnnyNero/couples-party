import { useState } from 'react'
import { createPortal } from 'react-dom'
import { key } from './build'
import { CrosswordScreen, weekLabel } from './CrosswordScreen'
import { useCrossword } from './useCrossword'
import { isSolved } from './grid'
import { useBackLayer } from '../ui/back'
import { slide } from '../ui/transition'
import { card, eyebrow } from '../ui/styles'

// Our crossword on Today: this week's grid as a little picture of who's filled what, how
// far you've got, and the way in. A new one every Monday, built from the week's answers.
export function CrosswordCard() {
  const [open, setOpenNow] = useState(false)
  const setOpen = (v: boolean) => slide(v ? 'forward' : 'back', () => setOpenNow(v))
  useBackLayer(open, () => setOpen(false))
  const { status, week, fill, rebuild } = useCrossword(open)
  // Rebuilding (testing) while it's open: say so, rather than closing under you.
  if (status.kind === 'loading' && open) {
    return createPortal(
      <div className="fixed inset-0 z-50 bg-bg grid place-items-center font-display text-xl font-extrabold text-fg/50">Building this week’s crossword…</div>,
      document.body,
    )
  }
  if (status.kind === 'off' || status.kind === 'error') return null
  if (status.kind === 'loading') return null

  const { data, me, partner } = status
  const p = data.puzzle
  const squares = Object.keys(p.solution)
  const filled = squares.filter((k) => data.cells[k]).length
  const solved = !!data.solvedAt || isSolved(p, (k) => data.cells[k]?.l)
  const cell = Math.min(12, Math.floor(132 / Math.max(p.w, p.h)))
  return (
    <>
      <button onClick={() => setOpen(true)} className={card + ' press text-left p-5 flex items-center gap-4'}>
        {/* The grid in miniature — only colours, never letters. */}
        <div className="shrink-0 relative" style={{ width: cell * p.w, height: cell * p.h }} aria-hidden="true">
          {squares.map((k) => {
            const [r, c] = k.split(',').map(Number)
            const at = data.cells[key(r, c)]
            return (
              <span
                key={k}
                className={'absolute rounded-[2px] ' + (at ? (at.mine ? 'bg-pa' : 'bg-pb') : 'bg-fg/15')}
                style={{ left: c * cell, top: r * cell, width: cell - 1.5, height: cell - 1.5 }}
              />
            )
          })}
        </div>
        <div className="flex-1 min-w-0">
          <div className={eyebrow}>Week of {weekLabel(week)}</div>
          <div className="mt-0.5 font-display text-xl font-extrabold leading-tight">Our crossword</div>
          <div className="mt-1 text-sm font-bold text-fg/60">
            {solved ? 'Solved together ✓' : filled === 0 ? `${p.entries.length} clues, about the two of you` : `${Math.round((filled / squares.length) * 100)}% filled in`}
          </div>
        </div>
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 bg-bg">
          <CrosswordScreen key={data.puzzle.answers.join()} data={data} me={me} partner={partner} week={week} onFill={fill} onClose={() => setOpen(false)} onRebuild={() => void rebuild()} />
        </div>,
        document.body,
      )}
    </>
  )
}
