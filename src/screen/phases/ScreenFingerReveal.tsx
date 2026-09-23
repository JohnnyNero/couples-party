import type { SessionState } from '../../engine/state'
import { fingerRoundPoints } from '../../engine/standing'
import { Hand } from '../../views/Hand'
import { playerName } from '../../views/list'

export function ScreenFingerReveal({ s }: { s: SessionState }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {f.rounds.length}
      </div>
      <div className="text-xl sm:text-3xl font-bold uppercase tracking-tight break-words mb-8 sm:mb-12">
        If {round.statementId}
      </div>
      <div className="flex justify-center gap-10 sm:gap-20">
        <Side
          name={playerName(s, 'A')}
          applies={round.applies.A}
          fingers={f.fingersLeft.A}
          points={fingerRoundPoints(round, 'A')}
        />
        <Side
          name={playerName(s, 'B')}
          applies={round.applies.B}
          fingers={f.fingersLeft.B}
          points={fingerRoundPoints(round, 'B')}
        />
      </div>
    </div>
  )
}

function Side({
  name, applies, fingers, points,
}: { name: string; applies: boolean | null; fingers: number; points: number }) {
  return (
    <div>
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2 sm:mb-3">{name}</div>
      <div className="text-lg sm:text-2xl font-bold uppercase tracking-tight mb-1">
        {applies ? 'Finger down' : 'Stays up'}
      </div>
      {/* Every statement pays now, so the score moves here rather than once at the end. */}
      <div className="h-6 sm:h-8 text-base sm:text-2xl font-bold text-accent tabular-nums animate-pop">
        {points > 0 ? `+${points}` : ''}
      </div>
      <Hand fingers={fingers} />
    </div>
  )
}
