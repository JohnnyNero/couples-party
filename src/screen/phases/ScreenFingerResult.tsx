import type { SessionState } from '../../engine/state'
import { fingerAward } from '../../engine/standing'
import { Hand } from '../../views/Hand'
import { playerName } from '../../views/list'

export function ScreenFingerResult({ s }: { s: SessionState }) {
  const f = s.finger!
  const award = fingerAward(f)
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40 mb-3 sm:mb-5">
        Put a finger down · final hands
      </div>
      <div className="flex justify-center gap-10 sm:gap-20 mb-8 sm:mb-12">
        <Side name={playerName(s, 'A')} fingers={f.fingersLeft.A} />
        <Side name={playerName(s, 'B')} fingers={f.fingersLeft.B} />
      </div>
      <div className="text-lg sm:text-3xl font-bold uppercase tracking-tight text-accent">
        {award ? `${playerName(s, award.player)} +${award.points}` : "It's a tie"}
      </div>
    </div>
  )
}

function Side({ name, fingers }: { name: string; fingers: number }) {
  return (
    <div>
      <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-2 sm:mb-3">{name}</div>
      <Hand fingers={fingers} />
    </div>
  )
}
