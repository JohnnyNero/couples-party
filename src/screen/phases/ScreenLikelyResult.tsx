import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenLikelyResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Who's More Likely · done" />
}
