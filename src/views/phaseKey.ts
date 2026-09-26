import type { SessionState } from '../engine/state'
import { currentAct } from '../engine/list'

// A key that changes whenever the "moment" on screen changes — the named phase, plus
// whichever act's own sub-step is live — so a phase-transition animation restarts on
// every new round or item, not just when the phase name itself changes (several phases,
// like LIST_PLACE, stay on the same name across many items).
export function phaseKey(s: SessionState): string {
  const act = currentAct(s)
  return [
    s.phase,
    s.intro?.key ?? '',
    s.listActs.length,
    act?.placeIndex ?? 0,
    act?.revealIndex ?? 0,
    s.likely?.current ?? 0,
    s.finger?.current ?? 0,
    s.mrmrs?.current ?? 0,
    s.wave?.current ?? 0,
    s.draw?.current ?? 0,
    s.clash?.current ?? 0,
    s.clash ? s.clash.rounds[s.clash.current].revealIndex : 0,
    s.chain?.current ?? 0,
    s.chain ? s.chain.rounds[s.chain.current].chain.length : 0,
    s.bluff?.current ?? 0,
    s.meld ? `${s.meld.current}.${s.meld.rounds[s.meld.current].tries.length}` : '',
    s.bluff ? s.bluff.rounds[s.bluff.current].turn : '',
    s.circle?.current ?? 0,
    s.clock?.current ?? 0,
    s.decider?.current ?? 0,
  ].join('|')
}
