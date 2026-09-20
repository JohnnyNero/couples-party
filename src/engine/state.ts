export type PlayerId = 'A' | 'B'

export const DEFAULT_SEEDS = [
  'spaghetti', 'handcuffs', 'cathedral', 'lawnmower',
  'volcano', 'umbrella', 'trombone', 'glacier',
]

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A')

// Which acts this session runs. 'full' is the whole night; 'meld' and 'list' skip
// straight to one game, for a shorter session or for testing a single act in isolation.
export type Game = 'full' | 'meld' | 'list'

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'STAKE_SET' | 'STAKE_REVEAL'
  | 'MELD_TYPE' | 'MELD_REVEAL' | 'MELD_RESULT'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_WRITE' | 'LIST_SWAP' | 'LIST_PLACE' | 'LIST_REVEAL'
  | 'SUDDEN_DEATH' | 'SOUVENIR'
  | 'DONE' // terminal placeholder until later acts extend the flow

export type MeldRound = {
  index: number // 1-based
  words: Record<PlayerId, string | null>
  converged: boolean
}

export type MeldResult = {
  rounds: MeldRound[]
  roundsTaken: number // 7 = failed
  converged: boolean
  finalWord: string | null
  seedPair: [string, string] // round 1's shown pair (deviation: seeds stored here)
}

// Full-game types carried now so state.ts is stable; unused fields stay null in M1.
export type GapRound = {
  index: number; statementId: string
  selfRating: number | null; guessRating: number | null
  isLie: boolean; called: boolean
}
export type GapAct = {
  subject: PlayerId; rounds: GapRound[]
  lieSpent: boolean; callSpent: boolean
  outcome: 'caught' | 'missed' | 'never-called' | null
}

// `pool` is the theme's own bank of candidate items (~20) — the author picks seven of
// them rather than writing anything, so nobody has to come up with items cold.
export type Theme = { id: string; text: string; pool: string[] }

export type ListItem = {
  id: string
  text: string
  swapped: boolean               // replaced by the ranker; never shown as whose veto it was
  poolIndex: number | null       // which pool entry this was; null for a blank pad or a swap-in
  actualSlot: number | null      // 1..7, the ranker's commitment
  predictedSlot: number | null   // 1..7, the author's guess at it
}
export type ListAct = {
  author: PlayerId
  themeId: string
  pool: string[]                 // this act's shuffled candidates, drawn from the theme's own pool
  items: ListItem[]              // exactly 7; authored order until LIST_SWAP ends, then reveal order
  swapDone: boolean
  displacement: number | null    // 0..24, set at LIST_REVEAL
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  // The single forfeit, agreed out loud and typed in by one player before the match.
  // It is the stake for the whole session; `stakeOwedBy` records who ends up doing it
  // (set at the end of the session — null until then; the standing is derived, see
  // engine/standing.ts, because the spec allows no stored score).
  stake: string | null
  stakeOwedBy: PlayerId | null
  meld: MeldResult | null
  gapActs: GapAct[]
  listActs: ListAct[]
  meldWords: string[] // every word either player typed, incl. misses
  seedWords: string[]
  themes: Theme[]
  game: Game
}

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  | { type: 'SET_STAKE'; text: string }
  | { type: 'SUBMIT_WORD'; player: PlayerId; word: string }
  // One pick locked at a time, from the theme's pool — so a timeout keeps whatever was
  // already picked.
  | { type: 'SUBMIT_ITEMS'; player: PlayerId; poolIndex: number }
  // The ranker's free veto. `index: null` = declined; either way the phase ends.
  | { type: 'SWAP_ITEM'; player: PlayerId; index: number | null; text: string }
  // One player's whole ranking, dragged into order in one pass — top of `order` is 1st.
  | { type: 'SUBMIT_ORDER'; player: PlayerId; order: string[] }
  | { type: 'TIMEOUT' }
// Future actions: SUBMIT_RATING, TOGGLE_LIE, CALL, DOUBLE

export function initialState(
  seed: number,
  seedWords: string[] = DEFAULT_SEEDS,
  themes: Theme[] = [],
  game: Game = 'full',
): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    stake: null,
    stakeOwedBy: null,
    meld: null,
    gapActs: [],
    listActs: [],
    meldWords: [],
    seedWords,
    themes,
    game,
  }
}
