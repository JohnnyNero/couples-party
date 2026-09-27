import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { parseSpectrumPrompt } from './dial'
import { WaveDial } from '../ui/WaveDial'
import { KeyField, Keys } from '../ui/keys'
import { field } from '../ui/styles'

// Setting today's mark: a point on the scale rolled at random — nobody chooses it, same
// as the live game — and all you do is name one thing that sits right on it. The mark is
// rolled once per day and kept (see pins.ts), so backing out doesn't re-roll it.
export function SetDialClue({
  partner,
  spectrum,
  target: given,
  onClose,
  forDate,
}: {
  partner: string
  spectrum: string // "Low | High", as stored
  target?: number // 0..100; rolled here if not given (the old one-a-day card)
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const { low, high } = parseSpectrumPrompt(spectrum)
  const [rolled] = useState(() => Math.floor(Math.random() * 101))
  const target = given ?? rolled
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
      await api.setDial(forDate ?? localDate(), spectrum, target, text)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [clue, spectrum, target, forDate])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`The Dial · ${forDate ? 'tomorrow' : 'today'}'s spectrum`}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{low} ↔ {high}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they start.` : <>{partner} places it once they've set yours to guess too. You can change it until they place it.</>}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold press">
            Done
          </button>
        </div>
      ) : (
        <Keys className="flex-1 min-h-0" bodyClassName="justify-center gap-5 px-6 pb-3">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Only you can see the mark</div>
          <WaveDial low={low} high={high} target={target} marker="A" guesser="B" />
          <div className="text-sm text-fg/70 leading-snug">
            Name one thing that sits <span className="font-bold text-accent-ink">right on the mark</span>.
            All {partner} gets is the thing — then they swing the needle to where they reckon it lands.
          </div>
          <KeyField
            className={field}
            value={clue}
            onChange={setClue}
            onEnter={() => void send()}
            enter="Send"
            maxLength={40}
            placeholder="e.g. a hot bath"
            autoFocus
            disabled={busy}
          />
          <div className="h-6 text-sm font-bold text-accent-ink text-center">{note}</div>
        </Keys>
      )}
    </div>
  )
}
