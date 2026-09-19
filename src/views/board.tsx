import type { SessionState } from '../engine/state'
import { MELD } from '../engine/phases'
import { ScreenJoin } from '../screen/phases/ScreenJoin'
import { ScreenMeldType } from '../screen/phases/ScreenMeldType'
import { ScreenMeldReveal } from '../screen/phases/ScreenMeldReveal'
import { ScreenMeldResult } from '../screen/phases/ScreenMeldResult'

// The public "board" content for the current phase, shared by the shared-screen
// renderer (Screen) and the phones-only renderer (Duo). Holds no logic and shows
// nothing private — submission dots and counts only, never words in flight.
export function railText(s: SessionState): string {
  if (s.phase.startsWith('MELD') && s.meld) {
    return `Act I · Mind Meld · Round ${s.meld.rounds.length} of ${MELD.roundCap}`
  }
  if (s.phase === 'JOIN') return 'Lobby'
  if (s.phase === 'DONE') return 'Act I · Mind Meld'
  return s.phase
}

export function BoardStage({ s }: { s: SessionState }) {
  switch (s.phase) {
    case 'JOIN':
      return <ScreenJoin s={s} />
    case 'MELD_TYPE':
      return <ScreenMeldType s={s} />
    case 'MELD_REVEAL':
      return <ScreenMeldReveal s={s} />
    case 'MELD_RESULT':
    case 'DONE':
      return <ScreenMeldResult s={s} />
    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
