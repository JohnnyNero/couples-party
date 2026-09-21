import type { SessionState } from '../engine/state'
import { FINGER, MELD, WAVE } from '../engine/phases'
import { ScreenJoin } from '../screen/phases/ScreenJoin'
import { ScreenMeldType } from '../screen/phases/ScreenMeldType'
import { ScreenMeldReveal } from '../screen/phases/ScreenMeldReveal'
import { ScreenMeldResult } from '../screen/phases/ScreenMeldResult'
import { ScreenListWrite } from '../screen/phases/ScreenListWrite'
import { ScreenListSwap } from '../screen/phases/ScreenListSwap'
import { ScreenListPlace } from '../screen/phases/ScreenListPlace'
import { ScreenListReveal } from '../screen/phases/ScreenListReveal'
import { ScreenFingerRound } from '../screen/phases/ScreenFingerRound'
import { ScreenFingerReveal } from '../screen/phases/ScreenFingerReveal'
import { ScreenFingerResult } from '../screen/phases/ScreenFingerResult'
import { ScreenWaveClue } from '../screen/phases/ScreenWaveClue'
import { ScreenWaveGuess } from '../screen/phases/ScreenWaveGuess'
import { ScreenWaveReveal } from '../screen/phases/ScreenWaveReveal'
import { ScreenWaveResult } from '../screen/phases/ScreenWaveResult'

// The public "board" content for the current phase, shared by the shared-screen
// renderer (Screen) and the phones-only renderer (Duo). Holds no logic and shows
// nothing private — submission dots and counts only, never words in flight.
export function railText(s: SessionState): string {
  if (s.phase.startsWith('MELD') && s.meld) {
    return `Act I · Mind Meld · Round ${s.meld.rounds.length} of ${MELD.roundCap}`
  }
  if (s.phase === 'JOIN') return 'Lobby'
  if (s.phase.startsWith('LIST') && s.listActs.length > 0) {
    const run = `Act III · Shortlist · ${s.listActs.length} of 2`
    if (s.phase === 'LIST_WRITE') return `${run} · Picking`
    if (s.phase === 'LIST_SWAP') return `${run} · The swap`
    if (s.phase === 'LIST_PLACE') return `${run} · Ranking`
    return `${run} · Reveal`
  }
  if (s.phase.startsWith('FINGER') && s.finger) {
    return `Put a Finger Down · Round ${s.finger.rounds[s.finger.current].index} of ${FINGER.rounds}`
  }
  if (s.phase.startsWith('WAVE') && s.wave) {
    return `Wavelength · Round ${s.wave.rounds[s.wave.current].index} of ${WAVE.rounds}`
  }
  if (s.phase === 'DONE') return 'That\'s the session'
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
      return <ScreenMeldResult s={s} />
    case 'LIST_WRITE':
      return <ScreenListWrite s={s} />
    case 'LIST_SWAP':
      return <ScreenListSwap s={s} />
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
    case 'DONE':
      // Terminal for now: hold the last thing that happened until the souvenir (M5).
      if (s.listActs.length > 0) return <ScreenListReveal s={s} />
      if (s.finger) return <ScreenFingerResult s={s} />
      if (s.wave) return <ScreenWaveResult s={s} />
      return <ScreenMeldResult s={s} />
    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
