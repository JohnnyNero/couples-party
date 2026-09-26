import { useCallback, useState, type ReactNode } from 'react'
import { api, DailyError, type Top5View } from './api'
import { outcome } from './Top5Card'
import { RankFive } from './RankFive'
import { Avatar, inkOf } from '../ui/Avatar'

// Guessing your partner's real order — one ranking, then it's locked in and their
// order is revealed either way, item by item.
export function PlayTop5({
  puzzle,
  partner,
  me = 'You',
  theme,
  onClose,
  extra,
}: {
  puzzle: Top5View
  partner: string
  me?: string
  theme: string
  onClose: () => void
  extra?: ReactNode // under your result: the way to see how they did on yours
}) {
  const [result, setResult] = useState<Top5View | null>(puzzle.status === 'open' ? null : puzzle)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const submit = useCallback(async (guess: number[]) => {
    setBusy(true)
    setNote(null)
    try {
      setResult(await api.submitTop5(puzzle.id, guess))
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [puzzle.id])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Top 5 · from {partner}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{theme}</div>
        </div>
      </header>

      {result ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 flex flex-col items-center gap-4 pt-3 animate-fade-up">
          <RevealLadder puzzle={result} order={{ p: 'B', name: partner, label: `${partner}’s order` }} guesser={{ p: 'A', name: me, label: 'Your guess' }} />
          <div className="font-display text-2xl font-bold text-accent-ink text-center">
            {outcome(result.exact!, result.near!)}
          </div>
          {extra}
          <button onClick={onClose} className="mt-1 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-6">
          <div className="text-sm text-fg/70 leading-snug mb-4">
            One at a time, tap where you reckon {partner} really put it — one guess, then it's locked in.
          </div>
          <RankFive items={puzzle.items} onDone={(guess) => void submit(guess)} disabled={busy} />
          <div className="h-6 mt-3 text-sm font-bold text-accent-ink text-center">{note}</div>
        </div>
      )}
    </div>
  )
}

// Both rankings side by side: their real order on the left, your guess on the right, a
// row per rank. Your guess is marked by how close it landed — exact, one rank out, or
// nowhere near.
type Side = { p: 'A' | 'B'; name: string; label: string }

export function RevealLadder({ puzzle, order, guesser }: { puzzle: Top5View; order: Side; guesser: Side }) {
  const rank = puzzle.rank!
  const guess = puzzle.guess!
  const cell = 'min-h-[3.25rem] rounded-xl border-2 px-2.5 py-1.5 flex items-center text-sm font-bold leading-tight break-words'
  return (
    <div className="w-full grid grid-cols-[1.25rem_1fr_1fr] gap-x-2 gap-y-1.5 items-stretch">
      <span />
      <span className={'flex items-center gap-1.5 min-w-0 text-xs font-extrabold ' + inkOf(order.p)}>
        <Avatar p={order.p} name={order.name} size="sm" /><span className="truncate">{order.label}</span>
      </span>
      <span className={'flex items-center gap-1.5 min-w-0 text-xs font-extrabold ' + inkOf(guesser.p)}>
        <Avatar p={guesser.p} name={guesser.name} size="sm" /><span className="truncate">{guesser.label}</span>
      </span>
      {rank.map((itemIndex, i) => {
        const guessed = guess[i]
        const gap = Math.abs(rank.indexOf(guessed) - i)
        const tier = gap === 0 ? 'exact' : gap === 1 ? 'near' : 'miss'
        return (
          <Row key={i} n={i + 1}>
            <div className={cell + ' border-fg/15 bg-card'}>{puzzle.items[itemIndex]}</div>
            <div
              className={
                cell + ' justify-between gap-1 ' +
                (tier === 'exact' ? 'border-sage-ink bg-sage-soft' : tier === 'near' ? 'border-tan-ink/50 bg-tan-soft' : 'border-fg/15 bg-card text-fg/60')
              }
            >
              <span className="min-w-0">{puzzle.items[guessed]}</span>
              {tier !== 'miss' && (
                <span className={'shrink-0 text-xs font-extrabold ' + (tier === 'exact' ? 'text-sage-ink' : 'text-tan-ink')} aria-label={tier === 'exact' ? 'Exact' : 'One out'}>
                  {tier === 'exact' ? '✓' : '±1'}
                </span>
              )}
            </div>
          </Row>
        )
      })}
    </div>
  )
}

function Row({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <>
      <span className="self-center font-display text-xl font-extrabold tabular-nums text-accent-ink">{n}</span>
      {children}
    </>
  )
}
