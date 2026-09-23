import { useCallback, useState } from 'react'
import { api, DailyError, type DialView } from './api'
import { closeness } from './DialCard'
import { parseSpectrumPrompt } from './dial'
import { WaveBar } from '../views/WaveBar'

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
        <button onClick={onClose} aria-label="Back" className="text-2xl text-fg/60 px-1 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">The Dial · from {partner}</div>
          <div className="text-lg font-bold leading-tight">{low} ↔ {high}</div>
        </div>
      </header>

      {result ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">{partner}'s clue was</div>
          <div className="text-2xl font-bold uppercase tracking-tight break-words">"{result.clue}"</div>
          <div className="w-full max-w-sm">
            <WaveBar low={low} high={high} target={result.target} guess={result.guess} showTarget reveal />
          </div>
          <div className="font-display text-3xl font-bold text-accent">{closeness(result.distance!)}</div>
          <div className="text-sm text-fg/60">You placed it {result.distance} away from the mark.</div>
          <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-xl border-2 border-fg/20 font-bold uppercase tracking-widest active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-6 px-6">
          <div>
            <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-2">{partner} named</div>
            <div className="text-2xl font-bold uppercase tracking-tight break-words">"{puzzle.clue}"</div>
          </div>
          <div className="text-sm text-fg/70 leading-snug">
            Slide to where you think that sits — one shot, then it's locked in either way.
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="w-full accent-accent h-8"
            disabled={busy}
          />
          <div className="flex justify-between gap-2 text-[0.6rem] uppercase tracking-wide text-fg/50 -mt-4">
            <span>{low}</span>
            <span className="text-right">{high}</span>
          </div>
          <div className="h-6 text-sm font-bold text-accent text-center">{note}</div>
          <button
            className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-50"
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
