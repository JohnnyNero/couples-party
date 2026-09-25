import type { SessionState } from '../../engine/state'
import { fillerWinner } from '../../engine/fillers'
import { FILLER } from '../../engine/phases'
import { Scoreboard } from '../../views/Scoreboard'
import { playerName } from '../../views/list'

// A filler ends on the same scoreboard as every game, with its prize said out loud.
export function ScreenFillerResult({ s, kind }: { s: SessionState; kind: 'circle' | 'clock' }) {
  const winner = kind === 'circle'
    ? s.circle && fillerWinner({ kind, game: s.circle })
    : s.clock && fillerWinner({ kind, game: s.clock })
  return (
    <Scoreboard
      s={s}
      title={kind === 'circle' ? 'Perfect Circle · done' : 'Stop the Clock · done'}
      flourish={
        <div className="mt-2 text-xl sm:text-3xl font-bold uppercase tracking-tight animate-pop">
          {winner ? `${playerName(s, winner)} +${FILLER.winPoints}` : 'Nobody takes it'}
        </div>
      }
    />
  )
}
