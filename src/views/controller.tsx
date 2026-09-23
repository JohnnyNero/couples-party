import type { PlayerId, SessionState } from '../engine/state'
import { phaseKey } from './phaseKey'
import { PlayJoin } from '../play/phases/PlayJoin'
import { PlayListPlace } from '../play/phases/PlayListPlace'
import { PlayListReveal } from '../play/phases/PlayListReveal'
import { PlayContinue } from '../play/phases/PlayContinue'
import { PlayFingerRound } from '../play/phases/PlayFingerRound'
import { PlayLikelyRound } from '../play/phases/PlayLikelyRound'
import { PlayMmAnswer } from '../play/phases/PlayMmAnswer'
import { PlayMmJudge } from '../play/phases/PlayMmJudge'
import { PlayDrawReveal } from '../play/phases/PlayDrawReveal'
import { PlayWaveClue } from '../play/phases/PlayWaveClue'
import { PlayWaveGuess } from '../play/phases/PlayWaveGuess'
import { PlayDrawSketch } from '../play/phases/PlayDrawSketch'
import { PlayDrawGuess } from '../play/phases/PlayDrawGuess'
import { PlayWaiting } from '../play/phases/PlayWaiting'

// This player's private controller for the current phase, shared by the phone
// renderer (Play, screen mode) and the phones-only renderer (Duo). Shows only this
// player's own input — never the other player's.
export function Controller({ s, me }: { s: SessionState; me: PlayerId }) {
  return (
    <div key={phaseKey(s)} className="h-full w-full animate-fade-up">
      <ControllerContent s={s} me={me} />
    </div>
  )
}

function ControllerContent({ s, me }: { s: SessionState; me: PlayerId }) {
  switch (s.phase) {
    case 'JOIN':
      return <PlayJoin s={s} me={me} />
    case 'LIST_INTRO':
      return <PlayWaiting label="See the board" />
    case 'LIST_PLACE':
      return <PlayListPlace s={s} me={me} />
    case 'LIST_REVEAL':
      return <PlayListReveal s={s} me={me} />
    case 'LIKELY_ROUND':
      return <PlayLikelyRound s={s} me={me} />
    case 'LIKELY_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'MM_ANSWER':
      return <PlayMmAnswer s={s} me={me} />
    case 'MM_JUDGE':
      return <PlayMmJudge s={s} me={me} />
    case 'LIGHTS_OUT':
      return <PlayContinue s={s} me={me} label="Goodnight" />
    case 'LIST_RESULT':
    case 'LIKELY_RESULT':
    case 'MM_RESULT':
    case 'FINGER_RESULT':
    case 'WAVE_RESULT':
    case 'DRAW_RESULT':
      return <PlayContinue s={s} me={me} />
    case 'FINGER_ROUND':
      return <PlayFingerRound s={s} me={me} />
    case 'FINGER_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'WAVE_CLUE':
      return <PlayWaveClue s={s} me={me} />
    case 'WAVE_GUESS':
      return <PlayWaveGuess s={s} me={me} />
    case 'WAVE_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'DRAW_SKETCH':
      return <PlayDrawSketch s={s} me={me} />
    case 'DRAW_GUESS':
      return <PlayDrawGuess s={s} me={me} />
    case 'DRAW_REVEAL':
      return <PlayDrawReveal s={s} me={me} />
    case 'DONE':
      return <PlayWaiting label="That's the session" />
    default:
      return <PlayWaiting label="See the board" />
  }
}
