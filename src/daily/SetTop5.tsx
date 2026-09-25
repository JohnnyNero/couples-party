import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { RankFive } from './RankFive'

// Ranking today's five for real — your own honest order, for your partner to guess.
export function SetTop5({
  partner,
  theme,
  template,
  items,
  onClose,
  forDate,
}: {
  partner: string
  theme: string // as you read it: "five things you do in bed"
  template?: string // as it's stored, for your partner to read their way (see say)
  items: string[] // the five, in the fixed day's order
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = useCallback(async (order: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      await api.setTop5(forDate ?? localDate(), template ?? theme, items, order)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [theme, template, items, forDate])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`Top 5 · ${forDate ? 'tomorrow' : 'today'}'s five`}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{theme}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they start.` : <>{partner} guesses your order once they've ranked yours to unlock it. You can
            change it until they guess.</>}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
          <div className="text-sm text-fg/70 leading-snug mb-4">
            One at a time, tap the rank it really belongs at for you — top to bottom.
          </div>
          <RankFive items={items} onDone={(order) => void send(order)} disabled={busy} />
          <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
        </div>
      )}
    </div>
  )
}
