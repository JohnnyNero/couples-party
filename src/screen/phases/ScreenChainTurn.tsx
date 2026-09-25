import type { SessionState } from '../../engine/state'
import { ChainTrail } from '../../views/ChainTrail'
import { aLetter, rejectText } from '../../views/chain'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { eyebrow } from '../../ui/styles'

export function ScreenChainTurn({ s }: { s: SessionState }) {
  const g = s.chain!
  const round = g.rounds[g.current]
  const reject = round.reject && round.reject.player === round.turn ? round.reject : null
  return (
    <div className="w-full max-w-4xl mx-auto text-center flex flex-col gap-6 sm:gap-10">
      <div>
        <div className={eyebrow}>Category</div>
        <div className="mt-1 font-display text-3xl sm:text-6xl font-extrabold leading-tight">{round.category}</div>
      </div>
      <ChainTrail round={round} max={10} />
      <div>
        <div key={round.chain.length} className="flex items-center justify-center gap-2.5 font-display text-2xl sm:text-4xl font-extrabold animate-fade-up">
          <Avatar p={round.turn} name={playerName(s, round.turn)} size="md" />
          <span>{playerName(s, round.turn)} needs <span className={inkOf(round.turn)}>{aLetter(round.need)}</span></span>
        </div>
        {reject && <div className="mt-2 text-sm sm:text-xl font-bold text-fg/55">{rejectText(reject, round.need, round.category)}</div>}
      </div>
    </div>
  )
}
