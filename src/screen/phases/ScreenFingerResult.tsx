import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'
import { Hand } from '../../views/Hand'
import { playerName } from '../../views/list'

// The one game whose ending is worth a picture as well as a number — how much of each
// hand is still up IS the result, so it sits above the board rather than being replaced
// by it.
export function ScreenFingerResult({ s }: { s: SessionState }) {
  const f = s.finger!
  return (
    <Scoreboard
      s={s}
      title="Put a finger down · final hands"
      flourish={
        <div className="flex justify-center gap-10 sm:gap-16 mt-3 sm:mt-4">
          <Side name={playerName(s, 'A')} fingers={f.fingersLeft.A} />
          <Side name={playerName(s, 'B')} fingers={f.fingersLeft.B} />
        </div>
      }
    />
  )
}

function Side({ name, fingers }: { name: string; fingers: number }) {
  return (
    <div>
      <div className="text-[0.55rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 mb-1.5">{name}</div>
      <Hand fingers={fingers} />
    </div>
  )
}
