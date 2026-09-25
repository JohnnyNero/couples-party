import type { SessionState } from '../../engine/state'
import { chainRoundWinner } from '../../engine/chain'
import { CHAIN } from '../../engine/phases'
import { ChainTrail } from '../../views/ChainTrail'
import { playerName } from '../../views/list'

export function ScreenChainEnd({ s }: { s: SessionState }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const winner = chainRoundWinner(round)
  const words = round.chain.filter((l) => l.by !== null).length
  return (
    <div className="w-full max-w-4xl mx-auto text-center flex flex-col gap-5 sm:gap-8">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40">
        {round.category} · {words} word{words === 1 ? '' : 's'}
      </div>
      <ChainTrail round={round} max={12} broken={round.loser !== null} />
      <div>
        <div className="text-lg sm:text-3xl uppercase tracking-tight text-fg/60">
          {round.loser ? `${playerName(s, round.loser)} ran out of time` : 'Nothing left that could follow'}
        </div>
        <div className="mt-1 text-2xl sm:text-5xl font-bold uppercase tracking-tight text-accent animate-pop">
          {winner ? `${playerName(s, winner)} +${CHAIN.winPoints}` : 'No points'}
        </div>
      </div>
    </div>
  )
}
