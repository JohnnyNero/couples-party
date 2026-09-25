import { useCallback, useState } from 'react'
import { api, DailyError, type SketchView } from './api'
import { SKETCH_GUESSES } from './sketch'
import { theirs } from './SketchCard'
import { DrawingCanvas } from '../views/DrawingCanvas'

// Guessing what they drew — three goes at the word they wrote. Close-but-not-quite is a
// miss (there's no one here to wave it through); that's what "ask them why" is for.
export function PlaySketch({
  puzzle: initial,
  partner,
  prompt,
  onClose,
}: {
  puzzle: SketchView
  partner: string
  prompt: string
  onClose: () => void
}) {
  const [puzzle, setPuzzle] = useState(initial)
  const [guess, setGuess] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const done = puzzle.status !== 'open'
  const left = SKETCH_GUESSES - puzzle.guesses.length

  const submit = useCallback(async () => {
    const g = guess.trim()
    if (!g) return
    setBusy(true)
    setNote(null)
    try {
      const next = await api.submitSketch(puzzle.id, g)
      setPuzzle(next)
      setGuess('')
      if (next.status === 'open') setNote('Not quite')
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [guess, puzzle.id])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Sketch · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{theirs(prompt, partner)}</div>
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6 flex flex-col gap-4">
        <DrawingCanvas strokes={puzzle.strokes} animate={initial.guesses.length === 0 && !done} />

        {puzzle.guesses.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {puzzle.guesses.map((g, i) => {
              const hit = puzzle.status === 'solved' && i === puzzle.guesses.length - 1
              return (
                <span
                  key={i}
                  className={
                    'px-3 py-1 rounded-full text-sm uppercase tracking-wide ' +
                    (hit ? 'bg-correct text-white' : 'bg-fg/10 text-fg/50 line-through')
                  }
                >
                  {g}
                </span>
              )
            })}
          </div>
        )}

        {done ? (
          <div className="flex flex-col items-center gap-3 text-center animate-fade-up">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">
              {puzzle.status === 'solved' ? `Got it in ${puzzle.guesses.length}` : 'Not this time — it was'}
            </div>
            <div className="font-display text-4xl font-bold uppercase tracking-wide text-accent-ink break-words">{puzzle.answer}</div>
            {puzzle.status === 'failed' && <div className="text-sm text-fg/60">Ask {partner} why.</div>}
            <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-fg/70">
              What did {partner} write? {left} {left === 1 ? 'guess' : 'guesses'} left.
            </div>
            <input
              className="w-full min-h-[56px] rounded-2xl border-2 border-fg bg-card px-4 text-xl font-bold outline-none focus:border-pa placeholder:text-fg/30 placeholder:font-semibold disabled:opacity-60"
              value={guess}
              onChange={(e) => setGuess(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              maxLength={30}
              placeholder="your guess"
              autoComplete="off"
              disabled={busy}
            />
            <div className="h-5 text-sm font-bold text-accent-ink text-center">{note}</div>
            <button
              className="w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px disabled:opacity-40"
              onClick={() => void submit()}
              disabled={busy || !guess.trim()}
            >
              Guess
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
