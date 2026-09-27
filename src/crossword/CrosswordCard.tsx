import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { CrosswordScreen, weekLabel } from './CrosswordScreen'
import { useCrossword } from './useCrossword'
import { isSolved } from './grid'
import { CrosswordSheet, MiniGrid, progress, useCrosswordWeeks } from './Archive'
import { useBackLayer } from '../ui/back'
import { slide } from '../ui/transition'
import { useFirstTime } from '../ui/fx'
import { card, eyebrow } from '../ui/styles'

// Our crossword on Today: this week's grid as a little picture of who's filled what, how
// far you've got, and the way in. A new one every Monday, built from the week's answers —
// the first time you see it, its squares land one by one. An earlier week you didn't
// finish is still there underneath, to go back to.
export function CrosswordCard() {
  const [open, setOpenNow] = useState(false)
  const setOpen = (v: boolean) => slide(v ? 'forward' : 'back', () => setOpenNow(v))
  useBackLayer(open, () => setOpen(false))
  const { status, week, fill } = useCrossword(open)
  const { weeks, reload } = useCrosswordWeeks()
  const [past, setPast] = useState<string | null>(null)
  const closePast = useCallback(() => { slide('back', () => setPast(null)); reload() }, [reload])
  const fresh = useFirstTime(status.kind === 'ready' ? `crossword-new:${week}` : null)

  if (status.kind !== 'ready') return null

  const { data, me, partner } = status
  const p = data.puzzle
  const squares = Object.keys(p.solution)
  const filled = squares.filter((k) => data.cells[k]).length
  const solved = !!data.solvedAt || isSolved(p, (k) => data.cells[k]?.l)
  // The newest earlier week still not solved.
  const unfinished = weeks?.find((w) => w.week < week && !w.solvedAt) ?? null
  return (
    <div className="flex flex-col gap-2">
      <button onClick={() => setOpen(true)} className={card + ' press text-left p-5 flex items-center gap-4'}>
        <MiniGrid w={p.w} h={p.h} squares={squares} whose={(k) => data.cells[k]?.mine} deal={fresh} />
        <div className="flex-1 min-w-0">
          <div className={eyebrow + (fresh ? ' !text-accent-ink animate-slam' : '')} style={fresh ? { animationDelay: '500ms' } : undefined}>
            {fresh ? 'New this week' : `Week of ${weekLabel(week)}`}
          </div>
          <div className="mt-0.5 font-display text-xl font-extrabold leading-tight">Our crossword</div>
          <div className="mt-1 text-sm font-bold text-fg/60">
            {solved ? 'Solved together ✓' : filled === 0 ? `${p.entries.length} clues, about the two of you` : `${Math.round((filled / squares.length) * 100)}% filled in`}
          </div>
        </div>
      </button>
      {unfinished && (
        <button onClick={() => slide('forward', () => setPast(unfinished.week))} className="press self-start ml-2 min-h-[36px] text-sm font-extrabold text-accent-ink">
          The week of {weekLabel(unfinished.week)}’s isn’t finished{progress(unfinished) > 0 ? ` (${progress(unfinished)}%)` : ''} — finish it →
        </button>
      )}
      {open && createPortal(
        <div className="fixed inset-0 z-50 bg-bg">
          <CrosswordScreen key={data.puzzle.answers.join()} data={data} me={me} partner={partner} week={week} onFill={fill} onClose={() => { setOpen(false); reload() }} />
        </div>,
        document.body,
      )}
      {past && <CrosswordSheet week={past} onClose={closePast} />}
    </div>
  )
}
