export type PlayerId = 'A' | 'B'

export const DEFAULT_SEEDS = [
  'spaghetti', 'handcuffs', 'cathedral', 'lawnmower',
  'volcano', 'umbrella', 'trombone', 'glacier',
]

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'FORFEIT_WRITE' | 'POT_SHUFFLE'
  | 'MELD_TYPE' | 'MELD_REVEAL' | 'MELD_RESULT'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_WRITE' | 'LIST_SWAP' | 'LIST_PLACE' | 'LIST_REVEAL'
  | 'SUDDEN_DEATH' | 'SOUVENIR'
  | 'DONE' // M1 terminal placeholder; replaced when M2 wires the pot/next act

export type Forfeit = {
  id: string
  text: string
  authoredBy: PlayerId | null // never rendered; null = house forfeit
  state: 'pot' | 'burned' | 'owed'
  owedBy?: PlayerId
}

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
export type ListItem = {
  id: string; text: string; swapped: boolean
  actualSlot: number | null; predictedSlot: number | null
}
export type ListAct = {
  author: PlayerId; themeId: string; items: ListItem[]; displacement: number | null
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  forfeits: Forfeit[]
  doubledBy: PlayerId | null
  meld: MeldResult | null
  gapActs: GapAct[]
  listActs: ListAct[]
  meldWords: string[] // every word either player typed, incl. misses
  seedWords: string[]
  houseForfeits: string[]
  forfeitWriteExtended: boolean
}

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  | { type: 'SUBMIT_WORD'; player: PlayerId; word: string }
  | { type: 'SUBMIT_FORFEITS'; player: PlayerId; text: string }
  | { type: 'TIMEOUT' }
// Future actions (M2+): SUBMIT_RATING, TOGGLE_LIE, CALL,
// SUBMIT_ITEMS, SWAP_ITEM, PLACE_ITEM, DOUBLE

export function initialState(
  seed: number,
  seedWords: string[] = DEFAULT_SEEDS,
  houseForfeits: string[] = [],
): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    forfeits: [],
    doubledBy: null,
    meld: null,
    gapActs: [],
    listActs: [],
    meldWords: [],
    seedWords,
    houseForfeits,
    forfeitWriteExtended: false,
  }
}
