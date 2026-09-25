import type { SessionState } from '../../engine/state'
import { clockRoundWinner, roundWins } from '../../engine/fillers'
import { FILLER } from '../../engine/phases'
import { liveClock, seconds } from '../../views/fillers'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { Pips } from '../../ui/kit'
import { card, eyebrow } from '../../ui/styles'

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
      <div className={eyebrow + ' mb-4 sm:mb-6'}>
        Target {seconds(round.targetMs)}
      </div>
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {(['A', 'B'] as const).map((p) => {
          const t = round.stopped[p] ?? 2 * round.targetMs
          const missed = t >= 2 * round.targetMs
          const off = t - round.targetMs
          const won = winner === p
          return (
            <div key={p} className={(won ? card : 'rounded-3xl border-2 border-fg/15') + ' px-3 py-4 sm:py-6 flex flex-col items-center gap-1'}>
              <div className="flex items-center gap-2 font-display text-lg sm:text-2xl font-extrabold truncate">
                <Avatar p={p} name={playerName(s, p)} size="sm" /> {playerName(s, p)}
              </div>
              <div className={'font-display text-4xl sm:text-6xl font-extrabold tabular-nums animate-reveal-pop ' + (won ? inkOf(p) : 'text-fg/60')}>
                {missed ? '—' : seconds(t)}
              </div>
              <div className="text-sm sm:text-lg font-bold text-fg/50 tabular-nums">
                {missed ? 'no tap' : `${off >= 0 ? '+' : '−'}${(Math.abs(off) / 1000).toFixed(2)} s`}
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 sm:mt-8 font-display text-3xl sm:text-5xl font-extrabold leading-tight animate-pop">{headline}</div>
      {!live.decider && (
        <div className="mt-3"><Pips s={s} wins={wins} need={Math.ceil(g.bestOf / 2)} /></div>
      )}
    </div>
  )
}
