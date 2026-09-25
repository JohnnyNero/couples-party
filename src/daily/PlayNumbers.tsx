import { useCallback, useState } from 'react'
import { api, DailyError, type NumbersView } from './api'
import { NumberForm } from './NumberForm'
import { summary } from './NumbersCard'

// Guessing all five of theirs at once, then the answers side by side with how each
// guess landed.
export function PlayNumbers({
  puzzle,
  partner,
  onClose,
}: {
  puzzle: NumbersView
  partner: string
  onClose: () => void
}) {
  const [result, setResult] = useState<NumbersView | null>(puzzle.status === 'open' ? null : puzzle)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async (guesses: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitNumbers(puzzle.id, guesses))
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [puzzle.id])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Their Numbers · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{partner}'s numbers</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {result ? (
          <div className="flex flex-col gap-3 animate-fade-up">
            {result.questions.map((q, i) => {
              const mark = result.marks![i]
              return (
                <div
                  key={i}
                  className={
                    'rounded-2xl border-2 px-4 py-3 ' +
                    (mark === 'exact' ? 'border-sage-ink bg-sage-soft' : mark === 'close' ? 'border-tan-ink/50 bg-tan-soft' : 'border-fg/15')
                  }
                >
                  <div className="text-sm leading-snug">{q}</div>
                  <div className="mt-1 flex items-baseline justify-between gap-3">
                    <span className="font-display text-3xl font-bold tabular-nums text-accent-ink">{result.answers![i]}</span>
                    <span className="text-xs uppercase tracking-widest text-fg/50 tabular-nums">
                      You said {result.guesses![i]}{mark === 'exact' ? ' · exact' : mark === 'close' ? ' · close' : ''}
                    </span>
                  </div>
                </div>
              )
            })}
            <div className="font-display text-2xl font-bold text-accent-ink text-center mt-1">{summary(result.marks!)}</div>
            <button onClick={onClose} className="w-full min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm text-fg/70 leading-snug mb-4">
              Your guess at each of {partner}'s — one go, then they're revealed. Close counts for something.
            </div>
            <NumberForm questions={puzzle.questions} onSubmit={(v) => void submit(v)} label="Lock them in" busy={busy} />
            <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
          </>
        )}
      </div>
    </div>
  )
}
