import { shown as scaled } from '../../engine/standing'
import type { SessionState } from '../../engine/state'
import { chainRoundWinner } from '../../engine/chain'
import { CHAIN } from '../../engine/phases'
import { ChainTrail } from '../../views/ChainTrail'
import { playerName } from '../../views/list'
import { eyebrow } from '../../ui/styles'

export function ScreenChainEnd({ s }: { s: SessionState }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const winner = chainRoundWinner(round)
  const words = round.chain.filter((l) => l.by !== null).length
  return (
    <div className="w-full max-w-4xl mx-auto text-center flex flex-col gap-5 sm:gap-8">
      <div className={eyebrow}>
        {round.category} · {words} word{words === 1 ? '' : 's'}
      </div>
      <ChainTrail round={round} max={12} broken={round.loser !== null} />
      <div>
        <div className="font-display text-4xl sm:text-6xl font-extrabold leading-tight animate-pop">
          {round.loser ? 'Chain broken!' : 'Out of words!'}
        </div>
        <div className="mt-1 text-base sm:text-2xl text-fg/65">
          {round.loser ? `${playerName(s, round.loser)} ran out of time` : 'Nothing left that could follow'}
          {' · '}
          {winner ? <b className="text-sage-ink">{playerName(s, winner)} +{scaled(s, 'chain', CHAIN.winPoints)}</b> : 'no points'}
        </div>
      </div>
    </div>
  )
}
