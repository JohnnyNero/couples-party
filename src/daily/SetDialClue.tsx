import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { parseSpectrumPrompt } from './dial'
import { WaveBar } from '../views/WaveBar'

// Setting today's mark: a point on the scale is rolled at random the moment this opens
// — nobody chooses it, same as the live game — and all you do is name one thing that
// sits right on it.
export function SetDialClue({
  partner,
  spectrum,
  onClose,
}: {
  partner: string
  spectrum: string // "Low | High", as stored
  onClose: () => void
}) {
  const { low, high } = parseSpectrumPrompt(spectrum)
  const [target] = useState(() => Math.floor(Math.random() * 101))
  const [clue, setClue] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = useCallback(async () => {
    const text = clue.trim()
    if (text.length === 0) return setNote('Name one thing that sits right on the mark')
    setBusy(true)
    setNote(null)
    try {
      await api.setDial(localDate(), spectrum, target, text)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [clue, spectrum, target])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="text-2xl text-fg/60 px-1 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">The Dial · today's spectrum</div>
          <div className="text-lg font-bold leading-tight">{low} ↔ {high}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {partner} places it once they've set yours to guess too. You can change it until they place it.
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-xl bg-accent text-bg font-bold uppercase tracking-widest active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-6 px-6">
          <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Only you can see the mark</div>
          <WaveBar low={low} high={high} target={target} showTarget />
          <div className="text-sm text-fg/70 leading-snug">
            Name one thing that sits <span className="font-bold text-accent">right on the mark</span>.
            All {partner} gets is the thing — then they slide to where they reckon it lands.
          </div>
          <input
            className="w-full min-h-[56px] text-xl uppercase bg-ink text-paper px-4 outline-none border-b-4 border-accent placeholder:text-paper/30 placeholder:normal-case"
            value={clue}
            onChange={(e) => setClue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send() }}
            maxLength={40}
            placeholder="e.g. a hot bath"
            autoFocus
            autoComplete="off"
            disabled={busy}
          />
          <div className="h-6 text-sm font-bold text-accent text-center">{note}</div>
          <button
            className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-50"
            onClick={() => void send()}
            disabled={busy}
          >
            Send it
          </button>
        </div>
      )}
    </div>
  )
}
