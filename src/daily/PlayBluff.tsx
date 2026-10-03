import { useCallback, useState, type ReactNode } from 'react'
import { api, DailyError, type BluffView } from './api'
import { BluffResult, bluffVerdict } from './BluffKit'
import { btnAccent } from '../ui/styles'

// Their three: tap the one you think is true, lock it in — one go — then see.
export function PlayBluff({
  puzzle,
  partner,
  me,
  question,
  onClose,
  extra,
}: {
  puzzle: BluffView
  partner: string
  me: string
  question: string // as you read it: "Sam's worst ever present"
  onClose: () => void
  extra?: ReactNode // under your result: setting theirs, or seeing how they did on yours
}) {
  const [result, setResult] = useState<BluffView | null>(puzzle.status === 'open' ? null : puzzle)
  const [sel, setSel] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (sel === null) return
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitBluff(puzzle.id, sel))
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [puzzle.id, sel])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Two Lies & a Truth · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight break-words">{question}</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
        {result ? (
          <div className="flex flex-col items-center gap-3 pt-2 animate-fade-up">
            <BluffResult statements={result.statements} truth={result.truth ?? -1} pick={result.pick} guesser={{ p: 'A', name: me }} />
            <div className="font-display text-2xl font-bold text-accent-ink text-center mt-1">{bluffVerdict(result.status === 'solved', 'You')}</div>
            {extra}
            <button onClick={onClose} className="w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold press">
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pt-2">
            <div className="text-sm text-fg/70 leading-snug">One of these is true. Which? You get one pick.</div>
            {puzzle.statements.map((text, i) => {
              const on = sel === i
              return (
                <button
                  key={i}
                  onClick={() => setSel(i)}
                  aria-pressed={on}
                  disabled={busy}
                  className={
                    'text-left rounded-2xl border-2 px-4 py-4 font-display text-xl font-extrabold leading-tight break-words press transition-colors ' +
                    (on ? 'border-transparent bg-pa text-white' : 'border-fg bg-card shadow-[3px_3px_0_rgba(0,0,0,0.12)] text-pb-ink')
                  }
                >
                  {text}
                </button>
              )
            })}
            <button className={btnAccent + ' mt-2'} disabled={sel === null || busy} onClick={() => void submit()}>
              {busy ? 'Checking…' : 'Lock it in'}
            </button>
            <div className="h-6 text-sm font-bold text-accent-ink text-center">{note}</div>
          </div>
        )}
      </div>
    </div>
  )
}
