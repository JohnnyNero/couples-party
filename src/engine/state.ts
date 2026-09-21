export type PlayerId = 'A' | 'B'

export const DEFAULT_SEEDS = [
  'spaghetti', 'handcuffs', 'cathedral', 'lawnmower',
  'volcano', 'umbrella', 'trombone', 'glacier',
]

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A')

// Which acts this session runs. 'full' is the whole night; the rest skip straight to one
// game, for a shorter session or for testing a single act in isolation.
export type Game = 'full' | 'meld' | 'list' | 'finger' | 'wave'

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'MELD_TYPE' | 'MELD_REVEAL' | 'MELD_RESULT'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_PLACE' | 'LIST_REVEAL'
  | 'FINGER_ROUND' | 'FINGER_REVEAL' | 'FINGER_RESULT'
  | 'WAVE_CLUE' | 'WAVE_GUESS' | 'WAVE_REVEAL' | 'WAVE_RESULT'
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

// `pool` is the theme's own bank of candidate items (~20); seven are drawn at random for
// each act, so nobody — author or ranker — has picked or seen them in advance.
export type Theme = { id: string; text: string; pool: string[] }

export type ListItem = {
  id: string
  text: string
  actualSlot: number | null      // 1..7, the ranker's commitment
  predictedSlot: number | null   // 1..7, the author's guess at it
}
export type ListAct = {
  author: PlayerId
  themeId: string
  items: ListItem[]              // exactly 7, drawn at random and revealed one at a time
  placeIndex: number             // 0-based — which item is currently live in LIST_PLACE
  displacement: number | null    // 0..24, set at LIST_REVEAL
}

// Put a Finger Down: five statements, drawn once at the start of the game. Missing a
// round (timeout) counts the same as "doesn't apply" — nobody is forced to confess.
export type FingerRound = {
  index: number // 1-based
  statementId: string
  applies: Record<PlayerId, boolean | null> // null = hasn't answered yet
}
export type FingerGame = {
  rounds: FingerRound[]        // exactly FINGER.rounds, chosen up front
  current: number              // 0-based index into rounds — which one is live
  fingersLeft: Record<PlayerId, number>
}

// Wavelength: a spectrum (two opposed poles), a hidden target on it, a one-word clue
// from that round's psychic, and the other player's guess. Role alternates every round.
export type WaveSpectrum = { id: string; low: string; high: string }

export type WaveRound = {
  index: number // 1-based
  psychic: PlayerId
  spectrumId: string
  target: number         // 0..100, hidden from the guesser until reveal
  clue: string | null
  guess: number | null   // 0..100
  distance: number | null // |target - guess|, set at reveal
}
export type WaveGame = {
  rounds: WaveRound[]     // exactly WAVE.rounds, generated up front
  current: number         // 0-based index into rounds — which one is live
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  meld: MeldResult | null
  gapActs: GapAct[]
  listActs: ListAct[]
  finger: FingerGame | null
  wave: WaveGame | null
  meldWords: string[] // every word either player typed, incl. misses
  seedWords: string[]
  themes: Theme[]
  fingerStatements: string[]
  spectrums: WaveSpectrum[]
  game: Game
}

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  | { type: 'SUBMIT_WORD'; player: PlayerId; word: string }
  // One item is live at a time. Each side locks a slot on it the instant they tap one —
  // no changing your mind, and a slot already spent on an earlier item can't be reused.
  | { type: 'PLACE_ITEM'; player: PlayerId; slot: number }
  // Put a Finger Down: a private yes/no to the round's statement. No changing your mind.
  | { type: 'SUBMIT_FINGER'; player: PlayerId; applies: boolean }
  // Wavelength: the psychic's one clue, then the guesser's position on the spectrum.
  | { type: 'SUBMIT_CLUE'; player: PlayerId; text: string }
  | { type: 'SUBMIT_GUESS'; player: PlayerId; value: number }
  | { type: 'TIMEOUT' }
// Future actions: SUBMIT_RATING, TOGGLE_LIE, CALL, DOUBLE

export function initialState(
  seed: number,
  seedWords: string[] = DEFAULT_SEEDS,
  themes: Theme[] = [],
  game: Game = 'full',
  fingerStatements: string[] = [],
  spectrums: WaveSpectrum[] = [],
): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    meld: null,
    gapActs: [],
    listActs: [],
    finger: null,
    wave: null,
    meldWords: [],
    seedWords,
    themes,
    fingerStatements,
    spectrums,
    game,
  }
}
