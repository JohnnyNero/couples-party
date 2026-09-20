import type { SessionState } from '../engine/state'
import { LIST, MELD } from '../engine/phases'
import { ScreenJoin } from '../screen/phases/ScreenJoin'
import { ScreenStakeSet } from '../screen/phases/ScreenStakeSet'
import { ScreenStakeReveal } from '../screen/phases/ScreenStakeReveal'
import { ScreenMeldType } from '../screen/phases/ScreenMeldType'
import { ScreenMeldReveal } from '../screen/phases/ScreenMeldReveal'
import { ScreenMeldResult } from '../screen/phases/ScreenMeldResult'
import { ScreenListWrite } from '../screen/phases/ScreenListWrite'
import { ScreenListSwap } from '../screen/phases/ScreenListSwap'
import { ScreenListPlace } from '../screen/phases/ScreenListPlace'
import { ScreenListReveal } from '../screen/phases/ScreenListReveal'

// The public "board" content for the current phase, shared by the shared-screen
// renderer (Screen) and the phones-only renderer (Duo). Holds no logic and shows
// nothing private — submission dots and counts only, never words in flight.
export function railText(s: SessionState): string {
  if (s.phase.startsWith('MELD') && s.meld) {
    return `Act I · Mind Meld · Round ${s.meld.rounds.length} of ${MELD.roundCap}`
  }
  if (s.phase === 'JOIN') return 'Lobby'
  if (s.phase === 'STAKE_SET') return 'The Stake · Agree the forfeit'
  if (s.phase === 'STAKE_REVEAL') return 'The Stake'
  if (s.phase.startsWith('LIST') && s.listActs.length > 0) {
    const act = s.listActs[s.listActs.length - 1]
    const run = `Act III · Shortlist · ${s.listActs.length} of 2`
    if (s.phase === 'LIST_WRITE') return `${run} · Writing`
    if (s.phase === 'LIST_SWAP') return `${run} · The swap`
    if (s.phase === 'LIST_PLACE') return `${run} · Item ${act.placeIndex + 1} of ${LIST.items}`
    return `${run} · Reveal`
  }
  if (s.phase === 'DONE') return 'That\'s the session'
  return s.phase
}

export function BoardStage({ s }: { s: SessionState }) {
  switch (s.phase) {
    case 'JOIN':
      return <ScreenJoin s={s} />
    case 'STAKE_SET':
      return <ScreenStakeSet />
    case 'STAKE_REVEAL':
      return <ScreenStakeReveal s={s} />
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
    case 'DONE':
      // Terminal for now: hold the last thing that happened until the souvenir (M5).
      return s.listActs.length > 0 ? <ScreenListReveal s={s} /> : <ScreenMeldResult s={s} />
    default:
      return <div className="text-2xl uppercase text-fg/50">{s.phase}</div>
  }
}
