import type { MeldResult, MeldRound } from '../engine/state'

// The pair shown to both players for a round: round 1 shows the two seed words;
// every later round shows the previous round's two submissions. Shared by the board
// and the controller so the two never drift.
export function shownPair(meld: MeldResult, round: MeldRound): [string, string] {
  if (round.index === 1) return meld.seedPair
  const prev = meld.rounds[round.index - 2]
  return [prev.words.A ?? '—', prev.words.B ?? '—']
}
