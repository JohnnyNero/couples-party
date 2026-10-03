import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { placeTruth } from './bluff'
import { BLUFF } from '../engine/phases'
import { KeyField, Keys } from '../ui/keys'
import { btnAccent, field } from '../ui/styles'

// Your truth and two lies about today's prompt. They're shown to your partner in a
// random order; they get one pick.
export function SetBluff({
  partner,
  template,
  question,
  onClose,
  forDate,
}: {
  partner: string
  template: string // as stored: "[Your|@'s] worst ever present"
  question: string // as you read it: "Your worst ever present"
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const [truth, setTruth] = useState('')
  const [lie1, setLie1] = useState('')
  const [lie2, setLie2] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const ready = [truth, lie1, lie2].every((t) => t.trim().length > 0)

  const send = useCallback(async () => {
    if (!ready) return setNote('One truth and two lies, please')
    setBusy(true)
    setNote(null)
    try {
      const { statements, truth: at } = placeTruth(truth.trim(), [lie1.trim(), lie2.trim()])
      await api.setBluff(forDate ?? localDate(), template, statements, at)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [ready, truth, lie1, lie2, template, forDate])

  const box = (label: string, hint: string, value: string, set: (v: string) => void, tone: string, last = false) => (
    <div className="flex flex-col gap-1.5">
      <span className={'text-sm font-extrabold ' + tone}>{label}</span>
      <KeyField
        className={field + ' !text-lg py-2'}
        value={value}
        onChange={set}
        onEnter={last ? () => void send() : undefined}
        enter={last ? 'Send' : undefined}
        canEnter={ready}
        maxLength={BLUFF.maxLen}
        placeholder={hint}
        autoFocus={label === 'The truth'}
        disabled={busy}
      />
    </div>
  )

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 press">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`Two Lies & a Truth · ${forDate ? 'tomorrow' : 'today'}'s`}</div>
          <div className="font-display text-xl font-extrabold leading-tight break-words">{question}</div>
        </div>
      </header>
      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they pick.` : `${partner} can pick now. You can change it until they do.`}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold press">
            Done
          </button>
        </div>
      ) : (
        <Keys className="flex-1 min-h-0" bodyClassName="px-5 pb-3">
          <div className="flex-1 flex flex-col justify-center gap-4 py-4">
            <div className="text-sm text-fg/60">{partner} sees all three, shuffled, and gets one pick at the true one.</div>
            {box('The truth', 'what really happened', truth, setTruth, 'text-sage-ink')}
            {box('A lie', 'make it believable', lie1, setLie1, 'text-fg/60')}
            {box('Another lie', 'and another', lie2, setLie2, 'text-fg/60', true)}
            <div className="h-5 text-sm font-bold text-accent-ink text-center">{note}</div>
          </div>
          <button className={btnAccent} onClick={() => void send()} disabled={!ready || busy}>
            {busy ? 'Sending…' : 'Send'}
          </button>
        </Keys>
      )}
    </div>
  )
}
