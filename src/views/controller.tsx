import type { PlayerId, SessionState } from '../engine/state'
import { PlayJoin } from '../play/phases/PlayJoin'
import { PlayListPlace } from '../play/phases/PlayListPlace'
import { PlayFingerRound } from '../play/phases/PlayFingerRound'
import { PlayWaveClue } from '../play/phases/PlayWaveClue'
import { PlayWaveGuess } from '../play/phases/PlayWaveGuess'
import { PlayDrawSketch } from '../play/phases/PlayDrawSketch'
import { PlayDrawGuess } from '../play/phases/PlayDrawGuess'
import { PlayWaiting } from '../play/phases/PlayWaiting'

// This player's private controller for the current phase, shared by the phone
// renderer (Play, screen mode) and the phones-only renderer (Duo). Shows only this
// player's own input — never the other player's.
export function Controller({ s, me }: { s: SessionState; me: PlayerId }) {
  switch (s.phase) {
    case 'JOIN':
      return <PlayJoin s={s} me={me} />
    case 'LIST_PLACE':
      return <PlayListPlace s={s} me={me} />
    case 'LIST_REVEAL':
      return <PlayWaiting label="See the board" />
    case 'FINGER_ROUND':
      return <PlayFingerRound s={s} me={me} />
    case 'FINGER_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'FINGER_RESULT':
      return <PlayWaiting label="See the board" />
    case 'WAVE_CLUE':
      return <PlayWaveClue s={s} me={me} />
    case 'WAVE_GUESS':
      return <PlayWaveGuess s={s} me={me} />
    case 'WAVE_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'WAVE_RESULT':
      return <PlayWaiting label="See the board" />
    case 'DRAW_SKETCH':
      return <PlayDrawSketch s={s} me={me} />
    case 'DRAW_GUESS':
      return <PlayDrawGuess s={s} me={me} />
    case 'DRAW_REVEAL':
      return <PlayWaiting label="Reveal" />
    case 'DRAW_RESULT':
      return <PlayWaiting label="See the board" />
    case 'DONE':
      return <PlayWaiting label="That's the session" />
    default:
      return <PlayWaiting label="See the board" />
  }
}
