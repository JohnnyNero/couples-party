import { useCallback, useState } from 'react'
import { api, DailyError, type DialView } from './api'
import { closeness } from './DialCard'
import { parseSpectrumPrompt } from './dial'
import { WaveDial } from '../ui/WaveDial'

// Placing your partner's mark: their clue is the only hint, same as the live game — one
// slide, then it's locked in and the mark is revealed either way.
export function PlayDial({
  puzzle,
  partner,
  spectrum,
  onClose,
}: {
  puzzle: DialView
  partner: string
  spectrum: string
  onClose: () => void
}) {
  const { low, high } = parseSpectrumPrompt(spectrum)
  const [value, setValue] = useState(50)
  const [result, setResult] = useState<DialView | null>(puzzle.status === 'open' ? null : puzzle)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async () => {
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitDial(puzzle.id, value))
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [puzzle.id, value])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">The Dial · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{low} ↔ {high}</div>
        </div>
      </header>

      {result ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{partner}'s clue was</div>
          <div className="text-3xl font-display font-extrabold leading-tight break-words">“{result.clue}”</div>
          <div className="w-full max-w-sm">
            <WaveDial low={low} high={high} target={result.target} guess={result.guess} marker="B" guesser="A" reveal />
          </div>
          <div className="font-display text-3xl font-bold text-accent-ink">{closeness(result.distance!)}</div>
          <div className="text-sm text-fg/60">You placed it {result.distance} away from the mark.</div>
          <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-6 px-6">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50 mb-2">{partner} named</div>
            <div className="text-3xl font-display font-extrabold leading-tight break-words">“{puzzle.clue}”</div>
          </div>
          <div className="text-sm text-fg/70 leading-snug">
            Drag the needle to where you think that sits — one shot, then it's locked in either way.
          </div>
          <WaveDial low={low} high={high} guess={value} marker="B" guesser="A" onChange={busy ? undefined : setValue} />
          <div className="h-6 text-sm font-bold text-accent-ink text-center">{note}</div>
          <button
            className="w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px disabled:opacity-50"
            onClick={() => void submit()}
            disabled={busy}
          >
            Lock it in
          </button>
        </div>
      )}
    </div>
  )
}
