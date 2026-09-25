import { useCallback, useState } from 'react'
import { api, DailyError, type Top5View } from './api'
import { outcome } from './Top5Card'
import { RankFive } from './RankFive'

// Guessing your partner's real order — one ranking, then it's locked in and their
// order is revealed either way, item by item.
export function PlayTop5({
  puzzle,
  partner,
  theme,
  onClose,
}: {
  puzzle: Top5View
  partner: string
  theme: string
  onClose: () => void
}) {
  const [result, setResult] = useState<Top5View | null>(puzzle.status === 'open' ? null : puzzle)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async (guess: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitTop5(puzzle.id, guess))
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [puzzle.id])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Top 5 · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{theme}</div>
        </div>
      </header>

      {result ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 flex flex-col items-center gap-4 animate-fade-up">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50 mt-2">{partner}'s real order was</div>
          <RevealLadder puzzle={result} />
          <div className="font-display text-2xl font-bold text-accent-ink text-center">
            {outcome(result.exact!, result.near!)}
          </div>
          <button onClick={onClose} className="mt-1 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
          <div className="text-sm text-fg/70 leading-snug mb-4">
            One at a time, tap where you reckon {partner} really put it — one guess, then it's locked in.
          </div>
          <RankFive items={puzzle.items} onDone={(guess) => void submit(guess)} disabled={busy} />
          <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
        </div>
      )}
    </div>
  )
}

// The true order, top to bottom, each marked by how close the guess landed it —
// exact, a rank out, or nowhere near.
function RevealLadder({ puzzle }: { puzzle: Top5View }) {
  const rank = puzzle.rank!
  const guess = puzzle.guess!
  return (
    <div className="w-full flex flex-col gap-1.5">
      {rank.map((itemIndex, i) => {
        const gap = Math.abs(i - guess.indexOf(itemIndex))
        const tier = gap === 0 ? 'exact' : gap === 1 ? 'near' : 'miss'
        return (
          <div
            key={itemIndex}
            className={
              'flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 ' +
              (tier === 'exact' ? 'border-sage-ink bg-sage-soft' : tier === 'near' ? 'border-tan-ink/50 bg-tan-soft' : 'border-fg/15')
            }
          >
            <span className="w-6 shrink-0 text-xl font-bold tabular-nums text-accent-ink">{i + 1}</span>
            <span className="flex-1 min-w-0 truncate text-sm font-bold text-left">{puzzle.items[itemIndex]}</span>
            <span className="shrink-0 text-[0.6rem] uppercase tracking-widest text-fg/50">
              {tier === 'exact' ? 'Exact' : tier === 'near' ? 'Close' : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
