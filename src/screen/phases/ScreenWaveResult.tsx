import type { SessionState } from '../../engine/state'
import { Scoreboard } from '../../views/Scoreboard'

export function ScreenWaveResult({ s }: { s: SessionState }) {
  return <Scoreboard s={s} title="Wavelength · done" />
}
