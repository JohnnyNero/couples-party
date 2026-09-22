import type { SessionState } from '../engine/state'
import { DRAW, FINGER, WAVE } from '../engine/phases'
import { phaseKey } from './phaseKey'
import { ScreenJoin } from '../screen/phases/ScreenJoin'
import { ScreenListPlace } from '../screen/phases/ScreenListPlace'
import { ScreenListReveal } from '../screen/phases/ScreenListReveal'
import { ScreenFingerRound } from '../screen/phases/ScreenFingerRound'
import { ScreenFingerReveal } from '../screen/phases/ScreenFingerReveal'
import { ScreenFingerResult } from '../screen/phases/ScreenFingerResult'
import { ScreenWaveClue } from '../screen/phases/ScreenWaveClue'
import { ScreenWaveGuess } from '../screen/phases/ScreenWaveGuess'
import { ScreenWaveReveal } from '../screen/phases/ScreenWaveReveal'
import { ScreenWaveResult } from '../screen/phases/ScreenWaveResult'
import { ScreenDrawSketch } from '../screen/phases/ScreenDrawSketch'
import { ScreenDrawGuess } from '../screen/phases/ScreenDrawGuess'
import { ScreenDrawReveal } from '../screen/phases/ScreenDrawReveal'
import { ScreenDrawResult } from '../screen/phases/ScreenDrawResult'

// The public "board" content for the current phase, shared by the shared-screen
// renderer (Screen) and the phones-only renderer (Duo). Holds no logic and shows
// nothing private — submission dots and counts only, never words in flight.
export function railText(s: SessionState): string {
  if (s.phase === 'JOIN') return 'Lobby'
  if (s.phase.startsWith('LIST') && s.listActs.length > 0) {
    const run = `Act III · Shortlist · ${s.listActs.length} of 2`
    if (s.phase === 'LIST_PLACE') return `${run} · Ranking`
    return `${run} · Reveal`
  }
  if (s.phase.startsWith('FINGER') && s.finger) {
    return `Put a Finger Down · Round ${s.finger.rounds[s.finger.current].index} of ${FINGER.rounds}`
  }
  if (s.phase.startsWith('WAVE') && s.wave) {
    return `Wavelength · Round ${s.wave.rounds[s.wave.current].index} of ${WAVE.rounds}`
  }
  if (s.phase.startsWith('DRAW') && s.draw) {
    return `Draw Your Love · Round ${s.draw.rounds[s.draw.current].index} of ${DRAW.rounds}`
  }
  if (s.phase === 'DONE') return 'That\'s the session'
  return s.phase
}

export function BoardStage({ s }: { s: SessionState }) {
  return (
    <div key={phaseKey(s)} className="w-full animate-fade-up">
      <BoardStageContent s={s} />
    </div>
  )
}

function BoardStageContent({ s }: { s: SessionState }) {
  switch (s.phase) {
    case 'JOIN':
      return <ScreenJoin s={s} />
    case 'LIST_PLACE':
      return <ScreenListPlace s={s} />
    case 'LIST_REVEAL':
      return <ScreenListReveal s={s} />
    case 'FINGER_ROUND':
      return <ScreenFingerRound s={s} />
    case 'FINGER_REVEAL':
      return <ScreenFingerReveal s={s} />
    case 'FINGER_RESULT':
      return <ScreenFingerResult s={s} />
    case 'WAVE_CLUE':
      return <ScreenWaveClue s={s} />
    case 'WAVE_GUESS':
      return <ScreenWaveGuess s={s} />
    case 'WAVE_REVEAL':
      return <ScreenWaveReveal s={s} />
    case 'WAVE_RESULT':
      return <ScreenWaveResult s={s} />
    case 'DRAW_SKETCH':
      return <ScreenDrawSketch s={s} />
    case 'DRAW_GUESS':
      return <ScreenDrawGuess s={s} />
    case 'DRAW_REVEAL':
      return <ScreenDrawReveal s={s} />
    case 'DRAW_RESULT':
      return <ScreenDrawResult s={s} />
    case 'DONE':
      // Terminal for now: hold the last thing that happened until the souvenir (M5).
      if (s.draw) return <ScreenDrawResult s={s} />
      if (s.wave) return <ScreenWaveResult s={s} />
      if (s.finger) return <ScreenFingerResult s={s} />
      return <ScreenListReveal s={s} />
    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
