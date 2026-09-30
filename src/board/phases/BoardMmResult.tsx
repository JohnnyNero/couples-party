import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function BoardMmResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Mr & Mrs · done" />
}
