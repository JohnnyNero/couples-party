import type { PlayerId, SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'
import { Hand } from '../../ui/kit'
import { Avatar } from '../../ui/Avatar'
import { playerName } from '../../views/list'

// How much of each hand is still up IS the result, so it sits above the board.
export function ScreenFingerResult({ s }: { s: SessionState }) {
  const f = s.finger!
  return (
    <Scoreboard
      s={s}
      title="Put a Finger Down · done"
      flourish={
        <div className="flex justify-center gap-10 mt-3">
          {(['A', 'B'] as PlayerId[]).map((p) => (
            <div key={p} className="flex items-end gap-2">
              <Avatar p={p} name={playerName(s, p)} size="sm" />
              <Hand fingers={f.fingersLeft[p]} p={p} />
            </div>
          ))}
        </div>
      }
    />
  )
}
