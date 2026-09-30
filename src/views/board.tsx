import { BoardDescribeReady } from '../board/phases/BoardDescribe'
import { BoardMeldReveal } from '../board/phases/BoardMeld'
import { HomeButton } from './HomeButton'
import { BoardBluffReveal } from '../board/phases/BoardBluff'
import type { SessionState } from '../engine/state'
import { GAME_LABELS, gameOfPhase, roundsFor } from '../engine/roster'
import { phaseKey } from './phaseKey'
import { Scoreboard } from './Scoreboard'
import { BoardJoin } from '../board/phases/BoardJoin'
import { BoardIntro } from '../board/phases/BoardIntro'
import { BoardListIntro } from '../board/phases/BoardListIntro'
import { BoardListReveal } from '../board/phases/BoardListReveal'
import { BoardListResult } from '../board/phases/BoardListResult'
import { BoardLikelyReveal } from '../board/phases/BoardLikelyReveal'
import { BoardLikelyResult } from '../board/phases/BoardLikelyResult'
import { BoardMmJudge } from '../board/phases/BoardMmJudge'
import { BoardMmResult } from '../board/phases/BoardMmResult'
import { BoardLightsOut } from '../board/phases/BoardLightsOut'
import { BoardFingerReveal } from '../board/phases/BoardFingerReveal'
import { BoardFingerResult } from '../board/phases/BoardFingerResult'
import { BoardWaveReveal } from '../board/phases/BoardWaveReveal'
import { BoardWaveResult } from '../board/phases/BoardWaveResult'
import { BoardDrawReveal } from '../board/phases/BoardDrawReveal'
import { BoardDrawResult } from '../board/phases/BoardDrawResult'
import { BoardClashReveal } from '../board/phases/BoardClashReveal'
import { BoardChainEnd } from '../board/phases/BoardChainEnd'
import { BoardCircleReveal } from '../board/phases/BoardCircleReveal'
import { BoardGuessReveal, BoardHlReveal, BoardTwistReveal } from '../board/phases/BoardQuiz'
import { BoardFollowReveal, BoardFrenzyReady, BoardFrenzyReveal, BoardSpotReady, BoardSpotReveal } from '../board/phases/BoardMinis'
import { BoardFillerResult } from '../board/phases/BoardFillerResult'
import { BoardClockReady } from '../board/phases/BoardClockReady'
import { BoardClockReveal } from '../board/phases/BoardClockReveal'

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
  if (key === 'circle' || key === 'clock' || key === 'spot' || key === 'frenzy') {
    const f = s[key]
    if (!f || f.bestOf === 1) return f && f.current > 0 ? `${label} · Round ${f.current + 1}` : label
    return `${label} · Round ${f.current + 1} · best of ${f.bestOf}`
  }
  if (key === 'follow') {
    const f = s.follow
    return f ? `${label} · Round ${f.current + 1}` : label
  }
  if (key === 'describe') {
    const g = s.describe
    return g ? `${label} · Turn ${g.current + 1} of ${g.turns.length}` : label
  }
  // Clues and drawings go in pairs, one each: a round is a pair.
  if (key === 'wave' || key === 'draw') {
    const g = s[key]
    if (!g) return label
    return `${label} · Round ${Math.floor(g.current / 2) + 1} of ${Math.ceil(g.rounds.length / 2)}`
  }
  const game = key === 'lights' ? null
    : { likely: s.likely, finger: s.finger, mrmrs: s.mrmrs, wave: s.wave, draw: s.draw, clash: s.clash, chain: s.chain, bluff: s.bluff, meld: s.meld, twist: s.twist ?? null, higher: s.higher ?? null, guess: s.guess ?? null }[key as string]
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
      return <BoardJoin s={s} />
    case 'INTRO':
      return <BoardIntro s={s} />
    case 'LIST_INTRO':
      return <BoardListIntro s={s} />
    case 'LIST_REVEAL':
      return <BoardListReveal s={s} />
    case 'LIST_RESULT':
      return <BoardListResult s={s} />
    case 'LIKELY_REVEAL':
      return <BoardLikelyReveal s={s} />
    case 'LIKELY_RESULT':
      return <BoardLikelyResult s={s} />
    case 'MM_JUDGE':
      return <BoardMmJudge s={s} />
    case 'MM_RESULT':
      return <BoardMmResult s={s} />
    case 'LIGHTS_OUT':
      return <BoardLightsOut s={s} />
    case 'FINGER_REVEAL':
      return <BoardFingerReveal s={s} />
    case 'FINGER_RESULT':
      return <BoardFingerResult s={s} />
    case 'WAVE_REVEAL':
      return <BoardWaveReveal s={s} />
    case 'WAVE_RESULT':
      return <BoardWaveResult s={s} />
    case 'DRAW_REVEAL':
      return <BoardDrawReveal s={s} />
    case 'DRAW_RESULT':
      return <BoardDrawResult s={s} />
    case 'CLASH_REVEAL':
      return <BoardClashReveal s={s} />
    case 'CLASH_RESULT':
      return <Scoreboard s={s} title="Category Clash · done" />
    case 'CHAIN_END':
      return <BoardChainEnd s={s} />
    case 'CHAIN_RESULT':
      return <Scoreboard s={s} title="Word Chain · done" />
    case 'BLUFF_REVEAL':
      return <BoardBluffReveal s={s} />
    case 'BLUFF_RESULT':
      return <Scoreboard s={s} title="Two Lies & a Truth · done" />
    case 'MELD_REVEAL':
      return <BoardMeldReveal s={s} />
    case 'MELD_RESULT':
      return <Scoreboard s={s} title="Mind Meld · done" />
    case 'DESCRIBE_READY':
      return <BoardDescribeReady s={s} />
    case 'DESCRIBE_RESULT':
      return <Scoreboard s={s} title="Describe It · done" />
    case 'CIRCLE_REVEAL':
      return <BoardCircleReveal s={s} />
    case 'CIRCLE_RESULT':
      return <BoardFillerResult s={s} kind="circle" />
    case 'CLOCK_READY':
    case 'DECIDER_READY':
      return <BoardClockReady s={s} />
    case 'CLOCK_REVEAL':
    case 'DECIDER_REVEAL':
      return <BoardClockReveal s={s} />
    case 'CLOCK_RESULT':
      return <BoardFillerResult s={s} kind="clock" />
    case 'SPOT_READY':
      return <BoardSpotReady s={s} />
    case 'SPOT_REVEAL':
      return <BoardSpotReveal s={s} />
    case 'SPOT_RESULT':
      return <BoardFillerResult s={s} kind="spot" />
    case 'FRENZY_READY':
      return <BoardFrenzyReady s={s} />
    case 'FRENZY_REVEAL':
      return <BoardFrenzyReveal s={s} />
    case 'FRENZY_RESULT':
      return <BoardFillerResult s={s} kind="frenzy" />
    case 'FOLLOW_REVEAL':
      return <BoardFollowReveal s={s} />
    case 'FOLLOW_RESULT':
      return <BoardFillerResult s={s} kind="follow" />
    case 'TWIST_REVEAL':
      return <BoardTwistReveal s={s} />
    case 'TWIST_RESULT':
      return <Scoreboard s={s} title="Tongue Twisters · done" />
    case 'HL_REVEAL':
      return <BoardHlReveal s={s} />
    case 'HL_RESULT':
      return <Scoreboard s={s} title="Higher or Lower · done" />
    case 'GUESS_REVEAL':
      return <BoardGuessReveal s={s} />
    case 'GUESS_RESULT':
      return <Scoreboard s={s} title="Guesstimate · done" />
    case 'DONE':
      // Terminal for now: the same board every game ends on, held up until the souvenir
      // (M5) gives it somewhere to go.
      return (
        <>
          <Scoreboard s={s} title="That's the night" />
          <HomeButton />
        </>
      )

    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
