import type { SessionState } from '../../engine/state'
import { ChainTrail } from '../../views/ChainTrail'
import { aLetter, rejectText } from '../../views/chain'
import { playerName } from '../../views/list'

export function ScreenChainTurn({ s }: { s: SessionState }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const reject = round.reject && round.reject.player === round.turn ? round.reject : null
  return (
    <div className="w-full max-w-4xl mx-auto text-center flex flex-col gap-6 sm:gap-10">
      <div>
        <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40">Round {round.index} of {g.rounds.length}</div>
        <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight">{round.category}</div>
      </div>
      <ChainTrail round={round} max={10} />
      <div>
        <div className="text-xl sm:text-4xl font-bold uppercase tracking-tight">
          {playerName(s, round.turn)} needs <span className="text-accent">{aLetter(round.need)}</span>
        </div>
        {reject && <div className="mt-2 text-sm sm:text-xl text-fg/50">{rejectText(reject, round.need, round.category)}</div>}
      </div>
    </div>
  )
}
