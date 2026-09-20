import type { MeldResult, MeldRound } from '../engine/state'
import { normalize } from '../engine/match'

// The pair shown to both players for a round: round 1 shows the two seed words;
// every later round shows the previous round's two submissions. Shared by the board
// and the controller so the two never drift.
export function shownPair(meld: MeldResult, round: MeldRound): [string, string] {
  if (round.index === 1) return meld.seedPair
  const prev = meld.rounds[round.index - 2]
  return [prev.words.A ?? '—', prev.words.B ?? '—']
}

// A word is "already said" only if it was submitted in a PRIOR (completed) round by
// either player — this prevents the cat/dog/cat/dog death spiral. It must NEVER block
// the current round's submissions against each other: matching your partner this round
// is the entire point of the game, so the current round is excluded.
export function isAlreadySaid(meld: MeldResult, round: MeldRound, word: string): boolean {
  const n = normalize(word)
  if (n.length === 0) return false
  return meld.rounds.some(
    (r) =>
      r.index !== round.index &&
      (normalize(r.words.A ?? '') === n || normalize(r.words.B ?? '') === n),
  )
}
