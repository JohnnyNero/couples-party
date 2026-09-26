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
import { PlayIntro } from '../play/phases/PlayIntro'
import { PlayCircleDraw } from '../play/phases/PlayCircleDraw'
import { PlayClashWrite } from '../play/phases/PlayClashWrite'
import { PlayClashReveal } from '../play/phases/PlayClashReveal'
import { PlayChainTurn } from '../play/phases/PlayChainTurn'
import { PlayClockRun } from '../play/phases/PlayClockRun'
import { HomeButton } from './HomeButton'
import { PlayMeldWrite } from '../play/phases/PlayMeldWrite'
import { PlayBluffWrite } from '../play/phases/PlayBluffWrite'
import { PlayBluffPick } from '../play/phases/PlayBluffPick'
import { ScreenBluffReveal } from '../screen/phases/ScreenBluff'

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
    case 'INTRO':
      return <PlayIntro s={s} me={me} />
    case 'LIST_INTRO':
      return <PlayWaiting label="Eyes on the board" />
    case 'LIST_PLACE':
      return <PlayListPlace s={s} me={me} />
    case 'LIST_REVEAL':
      return <PlayListReveal s={s} me={me} />
    case 'LIKELY_ROUND':
      return <PlayLikelyRound s={s} me={me} />
    case 'LIKELY_REVEAL':
      return <PlayWaiting label="Eyes on the board" sub="Here comes the reveal." />
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
    case 'CIRCLE_RESULT':
    case 'CLOCK_RESULT':
    case 'CLASH_RESULT':
    case 'CHAIN_RESULT':
    case 'BLUFF_RESULT':
    case 'MELD_RESULT':
      return <PlayContinue s={s} me={me} />
    case 'MELD_WRITE':
      return <PlayMeldWrite s={s} me={me} />
    case 'MELD_REVEAL':
      return <PlayWaiting label="Eyes on the board" sub="Did you meet?" />
    case 'BLUFF_WRITE':
      return <PlayBluffWrite s={s} me={me} />
    case 'BLUFF_PICK':
      return <PlayBluffPick s={s} me={me} />
    // The truth, on the phone too: it's where the tap to move on is.
    case 'BLUFF_REVEAL':
      return <div className="h-full overflow-y-auto p-5 flex flex-col"><div className="my-auto w-full"><ScreenBluffReveal s={s} /></div></div>
    case 'CHAIN_TURN':
      return <PlayChainTurn s={s} me={me} />
    case 'CLASH_WRITE':
      return <PlayClashWrite s={s} me={me} />
    case 'CLASH_REVEAL':
      return <PlayClashReveal s={s} me={me} />
    case 'CIRCLE_DRAW':
      return <PlayCircleDraw s={s} me={me} />
    case 'CLOCK_READY':
    case 'DECIDER_READY':
      return <PlayWaiting label="Get ready…" sub="Your Stop button is coming." />
    case 'CLOCK_RUN':
    case 'DECIDER_RUN':
      return <PlayClockRun s={s} me={me} />
    case 'FINGER_ROUND':
      return <PlayFingerRound s={s} me={me} />
    case 'FINGER_REVEAL':
      return <PlayWaiting label="Eyes on the board" sub="Here comes the reveal." />
    case 'WAVE_CLUE':
      return <PlayWaveClue s={s} me={me} />
    case 'WAVE_GUESS':
      return <PlayWaveGuess s={s} me={me} />
    case 'WAVE_REVEAL':
      return <PlayWaiting label="Eyes on the board" sub="Here comes the reveal." />
    case 'DRAW_SKETCH':
      return <PlayDrawSketch s={s} me={me} />
    case 'DRAW_GUESS':
      return <PlayDrawGuess s={s} me={me} />
    case 'DRAW_REVEAL':
      return <PlayDrawReveal s={s} me={me} />
    case 'DONE':
      return (
        <div className="h-full flex flex-col">
          <div className="flex-1 min-h-0"><PlayWaiting label="That’s the night" sub="Thanks for playing." /></div>
          <div className="px-5 pb-6"><HomeButton /></div>
        </div>
      )
    default:
      return <PlayWaiting label="Eyes on the board" />
  }
}
