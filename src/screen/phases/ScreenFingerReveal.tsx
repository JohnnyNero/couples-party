import type { SessionState } from '../../engine/state'
import { FINGER } from '../../engine/phases'
import { Hand } from '../../views/Hand'
import { playerName } from '../../views/list'

export function ScreenFingerReveal({ s }: { s: SessionState }) {
  const f = s.finger!
  const round = f.rounds[f.current]
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Round {round.index} of {FINGER.rounds}
      </div>
      <div className="text-xl sm:text-3xl font-bold uppercase tracking-tight break-words mb-8 sm:mb-12">
        If {round.statementId}
      </div>
      <div className="flex justify-center gap-10 sm:gap-20">
        <Side name={playerName(s, 'A')} applies={round.applies.A} fingers={f.fingersLeft.A} />
        <Side name={playerName(s, 'B')} applies={round.applies.B} fingers={f.fingersLeft.B} />
      </div>
    </div>
  )
}

function Side({ name, applies, fingers }: { name: string; applies: boolean | null; fingers: number }) {
  return (
    <div>
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2 sm:mb-3">{name}</div>
      <div className="text-lg sm:text-2xl font-bold uppercase tracking-tight mb-3 sm:mb-4">
        {applies ? 'Finger down' : 'Stays up'}
      </div>
      <Hand fingers={fingers} />
    </div>
  )
}
