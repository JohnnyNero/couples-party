import type { SessionState } from '../../engine/state'
import { fillerWinner } from '../../engine/fillers'
import { FILLER } from '../../engine/phases'
import { Scoreboard } from '../../views/Scoreboard'
import { playerName } from '../../views/list'
import { ReplayButton } from '../../share/ReplayButton'
import { circleReplay } from '../../share/replay'

// A filler ends on the same scoreboard as every game, with its prize said out loud.
export function ScreenFillerResult({ s, kind }: { s: SessionState; kind: 'circle' | 'clock' }) {
  const lastCircle = kind === 'circle' && s.circle ? s.circle.rounds[s.circle.current] : null
  const winner = kind === 'circle'
    ? s.circle && fillerWinner({ kind, game: s.circle })
    : s.clock && fillerWinner({ kind, game: s.clock })
  return (
    <Scoreboard
      s={s}
      title={kind === 'circle' ? 'Perfect Circle · done' : 'Stop the Clock · done'}
      flourish={
        <div className="flex flex-col items-center gap-3">
          <div className="mt-2 inline-block rounded-full bg-sage-soft text-sage-ink px-4 py-1 font-display text-lg sm:text-2xl font-extrabold animate-pop">
            {winner ? `${playerName(s, winner)} wins it · +${FILLER.winPoints}` : 'Nobody takes it'}
          </div>
          {/* The last round's circles, drawn again as a GIF to send. */}
          {kind === 'circle' && lastCircle && (
            <ReplayButton
              label="Make a replay of the circles"
              make={() => circleReplay({
                drawn: { A: lastCircle.drawn.A ?? [], B: lastCircle.drawn.B ?? [] },
                names: { A: playerName(s, 'A'), B: playerName(s, 'B') },
                scores: { A: lastCircle.score.A ?? 0, B: lastCircle.score.B ?? 0 },
              })}
            />
          )}
        </div>
      }
    />
  )
}
