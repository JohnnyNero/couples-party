import type { SessionState } from '../../engine/state'
import { clockRoundWinner, roundWins } from '../../engine/fillers'
import { FILLER } from '../../engine/phases'
import { liveClock, seconds } from '../../views/fillers'
import { playerName } from '../../views/list'

export function ScreenClockReveal({ s }: { s: SessionState }) {
  const live = liveClock(s)!
  const g = live.game
  const round = g.rounds[g.current]
  const winner = clockRoundWinner(round)
  const wins = roundWins({ kind: 'clock', game: g })
  const headline = winner
    ? live.decider ? `${playerName(s, winner)} breaks the tie · +${FILLER.deciderPoints}` : `${playerName(s, winner)} wins the round`
    : 'Dead heat · go again'
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-4 sm:mb-6">
        Target {seconds(round.targetMs)}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {(['A', 'B'] as const).map((p) => {
          const t = round.stopped[p] ?? 2 * round.targetMs
          const missed = t >= 2 * round.targetMs
          const off = t - round.targetMs
          const won = winner === p
          return (
            <div key={p} className={'rounded-2xl border-2 px-3 py-4 sm:py-6 ' + (won ? 'border-accent' : 'border-fg/20')}>
              <div className={'text-sm sm:text-xl font-bold uppercase tracking-tight truncate ' + (won ? 'text-accent' : 'text-fg/70')}>
                {playerName(s, p)}
              </div>
              <div className={'font-display text-4xl sm:text-6xl font-bold tabular-nums ' + (won ? 'text-accent' : '')}>
                {missed ? '—' : seconds(t)}
              </div>
              <div className="text-xs sm:text-base uppercase tracking-wide text-fg/50 tabular-nums">
                {missed ? 'no tap' : `${off >= 0 ? '+' : '−'}${(Math.abs(off) / 1000).toFixed(2)} s`}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 sm:mt-8 text-xl sm:text-4xl font-bold uppercase tracking-tight animate-pop">{headline}</div>
      {!live.decider && (
        <div className="mt-2 text-xs sm:text-base uppercase tracking-[0.2em] text-fg/50 tabular-nums">
          {playerName(s, 'A')} {wins.A} · {playerName(s, 'B')} {wins.B} · first to {Math.ceil(g.bestOf / 2)}
        </div>
      )}
    </div>
  )
}
