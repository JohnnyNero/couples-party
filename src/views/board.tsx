import type { SessionState } from '../engine/state'
import { GAME_LABELS, gameOfPhase, roundsFor } from '../engine/roster'
import { phaseKey } from './phaseKey'
import { Scoreboard } from './Scoreboard'
import { ScreenJoin } from '../screen/phases/ScreenJoin'
import { ScreenListIntro } from '../screen/phases/ScreenListIntro'
import { ScreenListPlace } from '../screen/phases/ScreenListPlace'
import { ScreenListReveal } from '../screen/phases/ScreenListReveal'
import { ScreenListResult } from '../screen/phases/ScreenListResult'
import { ScreenLikelyRound } from '../screen/phases/ScreenLikelyRound'
import { ScreenLikelyReveal } from '../screen/phases/ScreenLikelyReveal'
import { ScreenLikelyResult } from '../screen/phases/ScreenLikelyResult'
import { ScreenMmAnswer } from '../screen/phases/ScreenMmAnswer'
import { ScreenMmJudge } from '../screen/phases/ScreenMmJudge'
import { ScreenMmResult } from '../screen/phases/ScreenMmResult'
import { ScreenLightsOut } from '../screen/phases/ScreenLightsOut'
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
import { ScreenCircleDraw } from '../screen/phases/ScreenCircleDraw'
import { ScreenCircleReveal } from '../screen/phases/ScreenCircleReveal'
import { ScreenFillerResult } from '../screen/phases/ScreenFillerResult'
import { ScreenClockReady } from '../screen/phases/ScreenClockReady'
import { ScreenClockRun } from '../screen/phases/ScreenClockRun'
import { ScreenClockReveal } from '../screen/phases/ScreenClockReveal'

// The public "board" content for the current phase, shared by the shared-screen
// renderer (Screen) and the phones-only renderer (Duo). Holds no logic and shows
// nothing private — submission dots and counts only, never words in flight.
export function railText(s: SessionState): string {
  if (s.phase === 'JOIN') return 'Lobby'
  if (s.phase === 'DONE') return "That's the session"
  if (s.phase === 'LIGHTS_OUT') return 'Lights out'
  if (s.phase.startsWith('DECIDER_')) return 'Tiebreaker · sudden death'
  const key = gameOfPhase(s.phase)
  if (!key) return s.phase
  const label = GAME_LABELS[key]
  if (s.phase.endsWith('_RESULT')) return `${label} · the score`
  if (key === 'list') {
    const run = `${label} · ${s.listActs.length} of ${roundsFor(s, 'list')}`
    if (s.phase === 'LIST_INTRO') return `${run} · The theme`
    if (s.phase === 'LIST_PLACE') return `${run} · Ranking`
    return `${run} · Reveal`
  }
  if (key === 'circle' || key === 'clock') {
    const f = s[key]
    if (!f || f.bestOf === 1) return label
    return `${label} · Round ${f.current + 1} · best of ${f.bestOf}`
  }
  const game = key === 'lights' ? null
    : { likely: s.likely, finger: s.finger, mrmrs: s.mrmrs, wave: s.wave, draw: s.draw }[key]
  if (!game) return label
  return `${label} · Round ${game.current + 1} of ${game.rounds.length}`
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
    case 'LIST_INTRO':
      return <ScreenListIntro s={s} />
    case 'LIST_PLACE':
      return <ScreenListPlace s={s} />
    case 'LIST_REVEAL':
      return <ScreenListReveal s={s} />
    case 'LIST_RESULT':
      return <ScreenListResult s={s} />
    case 'LIKELY_ROUND':
      return <ScreenLikelyRound s={s} />
    case 'LIKELY_REVEAL':
      return <ScreenLikelyReveal s={s} />
    case 'LIKELY_RESULT':
      return <ScreenLikelyResult s={s} />
    case 'MM_ANSWER':
      return <ScreenMmAnswer s={s} />
    case 'MM_JUDGE':
      return <ScreenMmJudge s={s} />
    case 'MM_RESULT':
      return <ScreenMmResult s={s} />
    case 'LIGHTS_OUT':
      return <ScreenLightsOut s={s} />
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
    case 'CIRCLE_DRAW':
      return <ScreenCircleDraw s={s} />
    case 'CIRCLE_REVEAL':
      return <ScreenCircleReveal s={s} />
    case 'CIRCLE_RESULT':
      return <ScreenFillerResult s={s} kind="circle" />
    case 'CLOCK_READY':
    case 'DECIDER_READY':
      return <ScreenClockReady s={s} />
    case 'CLOCK_RUN':
    case 'DECIDER_RUN':
      return <ScreenClockRun s={s} />
    case 'CLOCK_REVEAL':
    case 'DECIDER_REVEAL':
      return <ScreenClockReveal s={s} />
    case 'CLOCK_RESULT':
      return <ScreenFillerResult s={s} kind="clock" />
    case 'DONE':
      // Terminal for now: the same board every game ends on, held up until the souvenir
      // (M5) gives it somewhere to go.
      return <Scoreboard s={s} title="That's the night" />
    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
