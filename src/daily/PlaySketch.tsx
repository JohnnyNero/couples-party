import { useCallback, useState, type ReactNode } from 'react'
import { api, DailyError, type SketchView } from './api'
import { SKETCH_GUESSES } from './sketch'
import { theirs } from './SketchCard'
import { DrawingCanvas } from '../views/DrawingCanvas'
import { KeyField, Keys } from '../ui/keys'
import { field } from '../ui/styles'

// Guessing what they drew — three goes at the word they wrote. Close-but-not-quite is a
// miss (there's no one here to wave it through); that's what "ask them why" is for.
export function PlaySketch({
  puzzle: initial,
  partner,
  prompt,
  onClose,
  extra,
}: {
  puzzle: SketchView
  partner: string
  prompt: string
  onClose: () => void
  extra?: ReactNode // under your result: the way to see how they did on yours
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
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Sketch · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{theirs(prompt, partner)}</div>
        </div>
      </header>

      <Keys className="flex-1 min-h-0" bodyClassName="px-5 pb-3 gap-4">
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
            {extra}
            <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold press">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="text-sm text-fg/70">
              What did {partner} write? {left} {left === 1 ? 'guess' : 'guesses'} left.
            </div>
            <KeyField
              className={field}
              value={guess}
              onChange={setGuess}
              onEnter={() => void submit()}
              enter="Guess"
              canEnter={!!guess.trim()}
              maxLength={30}
              placeholder="your guess"
              autoFocus
              disabled={busy}
            />
            <div className="h-5 text-sm font-bold text-accent-ink text-center">{note}</div>
          </div>
        )}
      </Keys>
    </div>
  )
}
