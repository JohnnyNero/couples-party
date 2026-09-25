import { useCallback, useState } from 'react'
import { renderQuestion } from './question'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { NumberForm } from './NumberForm'

// Answering today's five, about yourself, for real.
export function SetNumbers({
  partner,
  questions,
  onClose,
  forDate,
}: {
  partner: string
  questions: string[]
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = useCallback(async (answers: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      await api.setNumbers(forDate ?? localDate(), questions, answers)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [questions, forDate])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`Their Numbers · ${forDate ? 'tomorrow' : 'today'}'s five`}</div>
          <div className="font-display text-xl font-extrabold leading-tight">Your numbers</div>
        </div>
      </header>
      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they start.` : <>{partner} guesses them once they've answered theirs. You can change them until they guess.</>}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
          <div className="text-sm text-fg/70 leading-snug mb-4">
            The honest number for each — {partner} will be guessing them.
          </div>
          <NumberForm questions={questions} show={(q) => renderQuestion(q, partner)} onSubmit={(v) => void send(v)} label="Send them" busy={busy} />
          <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
        </div>
      )}
    </div>
  )
}
