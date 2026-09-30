import type { PlayerId, SessionState } from '../engine/state'
import { phaseKey } from './phaseKey'
import { PlayListPlace } from '../play/phases/PlayListPlace'
import { PlayFingerRound } from '../play/phases/PlayFingerRound'
import { PlayLikelyRound } from '../play/phases/PlayLikelyRound'
import { PlayMmAnswer } from '../play/phases/PlayMmAnswer'
import { PlayWaveClue } from '../play/phases/PlayWaveClue'
import { PlayWaveGuess } from '../play/phases/PlayWaveGuess'
import { PlayDrawSketch } from '../play/phases/PlayDrawSketch'
import { PlayDrawGuess } from '../play/phases/PlayDrawGuess'
import { PlayWaiting } from '../play/phases/PlayWaiting'
import { PlayCircleDraw } from '../play/phases/PlayCircleDraw'
import { PlayClashWrite } from '../play/phases/PlayClashWrite'
import { PlayChainTurn } from '../play/phases/PlayChainTurn'
import { PlayFollow, PlayFrenzy, PlaySpot } from '../play/phases/PlayMinis'
import { PlayGuess, PlayHigher, PlayTwist } from '../play/phases/PlayQuiz'
import { PlayClockRun } from '../play/phases/PlayClockRun'
import { PlayMeldWrite } from '../play/phases/PlayMeldWrite'
import { PlayDescribe } from '../play/phases/PlayDescribe'
import { PlayBluffWrite } from '../play/phases/PlayBluffWrite'
import { PlayBluffPick } from '../play/phases/PlayBluffPick'

// The phases with nothing private to ask either of you: the board gets the whole screen
// (see Duo), so there's no controller for them.
export const BOARD_ONLY: ReadonlySet<string> = new Set([
  'JOIN', 'INTRO', 'LIST_INTRO', 'LIST_REVEAL', 'LIST_RESULT', 'LIKELY_REVEAL',
  'LIKELY_RESULT', 'MM_JUDGE', 'MM_RESULT', 'LIGHTS_OUT', 'FINGER_REVEAL', 'FINGER_RESULT',
  'WAVE_REVEAL', 'WAVE_RESULT', 'DRAW_REVEAL', 'DRAW_RESULT', 'CLASH_REVEAL', 'CLASH_RESULT',
  'CHAIN_END', 'CHAIN_RESULT', 'BLUFF_REVEAL', 'BLUFF_RESULT', 'MELD_REVEAL', 'MELD_RESULT',
  'DESCRIBE_READY', 'DESCRIBE_RESULT', 'CIRCLE_REVEAL', 'CIRCLE_RESULT', 'CLOCK_READY', 'CLOCK_REVEAL',
  'CLOCK_RESULT', 'SPOT_READY', 'SPOT_REVEAL', 'SPOT_RESULT', 'FRENZY_READY', 'FRENZY_REVEAL',
  'FRENZY_RESULT', 'FOLLOW_REVEAL', 'FOLLOW_RESULT', 'TWIST_REVEAL', 'TWIST_RESULT', 'HL_REVEAL',
  'HL_RESULT', 'GUESS_REVEAL', 'GUESS_RESULT', 'DECIDER_READY', 'DECIDER_REVEAL', 'DONE',
])

// This player's private controller for the current phase: only this player's own
// input, never the other player's.
export function Controller({ s, me }: { s: SessionState; me: PlayerId }) {
  return (
    <div key={phaseKey(s)} className="h-full w-full animate-fade-up">
      <ControllerContent s={s} me={me} />
    </div>
  )
}

function ControllerContent({ s, me }: { s: SessionState; me: PlayerId }) {
  switch (s.phase) {
    case 'LIST_PLACE':
      return <PlayListPlace s={s} me={me} />
    case 'LIKELY_ROUND':
      return <PlayLikelyRound s={s} me={me} />
    case 'MM_ANSWER':
      return <PlayMmAnswer s={s} me={me} />
    case 'DESCRIBE_RUN':
      return <PlayDescribe s={s} me={me} />
    case 'MELD_WRITE':
      return <PlayMeldWrite s={s} me={me} />
    case 'BLUFF_WRITE':
      return <PlayBluffWrite s={s} me={me} />
    case 'BLUFF_PICK':
      return <PlayBluffPick s={s} me={me} />
    // The truth, on the phone too: it's where the tap to move on is.
    case 'CHAIN_TURN':
      return <PlayChainTurn s={s} me={me} />
    case 'CLASH_WRITE':
      return <PlayClashWrite s={s} me={me} />
    case 'CIRCLE_DRAW':
      return <PlayCircleDraw s={s} me={me} />
    case 'SPOT_RUN':
      return <PlaySpot s={s} me={me} />
    case 'TWIST_SAY':
      return <PlayTwist s={s} me={me} />
    case 'HL_PICK':
      return <PlayHigher s={s} me={me} />
    case 'GUESS_WRITE':
      return <PlayGuess s={s} me={me} />
    case 'FRENZY_RUN':
      return <PlayFrenzy s={s} me={me} />
    case 'FOLLOW_SHOW':
    case 'FOLLOW_PLAY':
      return <PlayFollow s={s} me={me} />
    case 'CLOCK_RUN':
    case 'DECIDER_RUN':
      return <PlayClockRun s={s} me={me} />
    case 'FINGER_ROUND':
      return <PlayFingerRound s={s} me={me} />
    case 'WAVE_CLUE':
      return <PlayWaveClue s={s} me={me} />
    case 'WAVE_GUESS':
      return <PlayWaveGuess s={s} me={me} />
    case 'DRAW_SKETCH':
      return <PlayDrawSketch s={s} me={me} />
    case 'DRAW_GUESS':
      return <PlayDrawGuess s={s} me={me} />
    default:
      return <PlayWaiting label="One moment…" />
  }
}
