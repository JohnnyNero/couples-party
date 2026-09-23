import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenListResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Shortlist · done" />
}
