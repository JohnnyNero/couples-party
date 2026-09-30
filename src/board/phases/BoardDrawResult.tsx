import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function BoardDrawResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Draw Your Answer · done" />
}
