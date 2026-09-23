import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenMmResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Mr & Mrs · done" />
}
