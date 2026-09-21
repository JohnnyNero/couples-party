export type PlayerId = 'A' | 'B'

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A')

// Which acts this session runs. 'full' is the whole night; the rest skip straight to one
// game, for a shorter session or for testing a single act in isolation.
export type Game = 'full' | 'list' | 'finger' | 'wave' | 'draw'

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_PLACE' | 'LIST_REVEAL'
  | 'FINGER_ROUND' | 'FINGER_REVEAL' | 'FINGER_RESULT'
  | 'WAVE_CLUE' | 'WAVE_GUESS' | 'WAVE_REVEAL' | 'WAVE_RESULT'
  | 'DRAW_SKETCH' | 'DRAW_GUESS' | 'DRAW_REVEAL' | 'DRAW_RESULT'
  | 'SUDDEN_DEATH' | 'SOUVENIR'
  | 'DONE' // terminal placeholder until later acts extend the flow

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

// Draw Your Love: one partner sketches a prompt on their phone (privately, timed); the
// finished drawing then appears for the other to guess from a free-text answer. Role
// alternates every round, same shape as Wavelength's psychic/guesser split.
export type DrawPrompt = { id: string; text: string }
export type DrawStroke = [number, number][] // points normalized 0..1 within the canvas

export type DrawRound = {
  index: number // 1-based
  drawer: PlayerId
  promptId: string
  strokes: DrawStroke[]   // [] until the drawer submits (or times out with nothing)
  guess: string | null
  correct: boolean | null // set at reveal — the guess matched the prompt
}
export type DrawGame = {
  rounds: DrawRound[]     // exactly DRAW.rounds, prompt + drawer generated up front
  current: number         // 0-based index into rounds — which one is live
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  gapActs: GapAct[]
  listActs: ListAct[]
  finger: FingerGame | null
  wave: WaveGame | null
  draw: DrawGame | null
  themes: Theme[]
  fingerStatements: string[]
  spectrums: WaveSpectrum[]
  drawPrompts: DrawPrompt[]
  game: Game
}

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  // One item is live at a time. Each side locks a slot on it the instant they tap one —
  // no changing your mind, and a slot already spent on an earlier item can't be reused.
  | { type: 'PLACE_ITEM'; player: PlayerId; slot: number }
  // Put a Finger Down: a private yes/no to the round's statement. No changing your mind.
  | { type: 'SUBMIT_FINGER'; player: PlayerId; applies: boolean }
  // Wavelength: the psychic's one clue, then the guesser's position on the spectrum.
  | { type: 'SUBMIT_CLUE'; player: PlayerId; text: string }
  | { type: 'SUBMIT_GUESS'; player: PlayerId; value: number }
  // Draw Your Love: the drawer's finished sketch (empty strokes on a timeout), then the
  // guesser's one text guess at the prompt.
  | { type: 'SUBMIT_DRAWING'; player: PlayerId; strokes: DrawStroke[] }
  | { type: 'SUBMIT_DRAW_GUESS'; player: PlayerId; text: string }
  | { type: 'TIMEOUT' }
// Future actions: SUBMIT_RATING, TOGGLE_LIE, CALL, DOUBLE

export function initialState(
  seed: number,
  themes: Theme[] = [],
  game: Game = 'full',
  fingerStatements: string[] = [],
  spectrums: WaveSpectrum[] = [],
  drawPrompts: DrawPrompt[] = [],
): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    gapActs: [],
    listActs: [],
    finger: null,
    wave: null,
    draw: null,
    themes,
    fingerStatements,
    spectrums,
    drawPrompts,
    game,
  }
}
