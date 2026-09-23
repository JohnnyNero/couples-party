import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenDrawResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Quick Draw · done" />
}
