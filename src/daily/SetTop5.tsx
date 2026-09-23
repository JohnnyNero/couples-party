import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { RankFive } from './RankFive'

// Ranking today's five for real — your own honest order, for your partner to guess.
export function SetTop5({
  partner,
  theme,
  items,
  onClose,
}: {
  partner: string
  theme: string
  items: string[] // the five, in the fixed day's order
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = useCallback(async (order: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      await api.setTop5(localDate(), theme, items, order)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [theme, items])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={onClose} aria-label="Back" className="text-2xl text-fg/60 px-1 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">Top 5 · today's five</div>
          <div className="text-lg font-bold leading-tight">{theme}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {partner} guesses your order once they've ranked yours to unlock it. You can
            change it until they guess.
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-xl bg-accent text-bg font-bold uppercase tracking-widest active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
          <div className="text-sm text-fg/70 leading-snug mb-4">
            One at a time, tap the rank it really belongs at for you — top to bottom.
          </div>
          <RankFive items={items} onDone={(order) => void send(order)} disabled={busy} />
          <div className="h-6 mt-3 text-sm font-bold text-accent text-center">{note}</div>
        </div>
      )}
    </div>
  )
}
