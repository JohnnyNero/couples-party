import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenFingerResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Called It · done" />
}
