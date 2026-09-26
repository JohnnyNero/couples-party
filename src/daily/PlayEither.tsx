import { useCallback, useState, type ReactNode } from 'react'
import { api, DailyError, type EitherView } from './api'
import { eitherSummary } from './either'
import { EitherResult, PickForm } from './EitherKit'

// Predicting all five of theirs at once, then their picks beside yours.
export function PlayEither({
  puzzle,
  partner,
  onClose,
  extra,
}: {
  puzzle: EitherView
  partner: string
  onClose: () => void
  extra?: ReactNode // under your result: setting theirs, or seeing how they did on yours
}) {
  const [result, setResult] = useState<EitherView | null>(puzzle.status === 'open' ? null : puzzle)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async (guesses: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitEither(puzzle.id, guesses))
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
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">This or That · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{partner}’s picks</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {result ? (
          <div className="flex flex-col items-center gap-3 animate-fade-up">
            <EitherResult
              questions={result.questions}
              answers={result.answers!}
              guesses={result.guesses!}
              setter={{ p: 'B', name: partner }}
              guesser={{ p: 'A', name: 'You' }}
            />
            <div className="font-display text-2xl font-bold text-accent-ink text-center mt-1">{eitherSummary(result.matches ?? 0)}</div>
            {extra}
            <button onClick={onClose} className="w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="text-sm text-fg/70 leading-snug mb-4">
              Which would {partner} pick? One go at all five, then you’ll see.
            </div>
            <PickForm questions={puzzle.questions} onSubmit={(v) => void submit(v)} label="Lock them in" busy={busy} p="B" />
            <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
          </>
        )}
      </div>
    </div>
  )
}
