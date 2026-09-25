export type PlayerId = 'A' | 'B'

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A')

// One game in the roster. Lights Out is in here too even though it doesn't score — it's
// a stop on the night like any other, it just has no points and no scoreboard.
export type GameKey = 'list' | 'likely' | 'finger' | 'mrmrs' | 'wave' | 'draw' | 'lights'

// Which session this is. 'full' is the long night, 'tonight' the short one; a bare
// game key runs that game on its own. The actual line-up for each lives in roster.ts.
export type Game = 'full' | 'tonight' | Exclude<GameKey, 'lights'>

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_INTRO' | 'LIST_PLACE' | 'LIST_REVEAL' | 'LIST_RESULT'
  | 'LIKELY_ROUND' | 'LIKELY_REVEAL' | 'LIKELY_RESULT'
  | 'FINGER_ROUND' | 'FINGER_REVEAL' | 'FINGER_RESULT'
  | 'MM_ANSWER' | 'MM_JUDGE' | 'MM_RESULT'
  | 'WAVE_CLUE' | 'WAVE_GUESS' | 'WAVE_REVEAL' | 'WAVE_RESULT'
  | 'DRAW_SKETCH' | 'DRAW_GUESS' | 'DRAW_REVEAL' | 'DRAW_RESULT'
  | 'LIGHTS_OUT'
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
  revealIndex: number            // 0-based — how far the reveal has been tapped through
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
  rounds: FingerRound[]        // as many as the roster asks for, chosen up front
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
  rounds: WaveRound[]     // as many as the roster asks for, generated up front
  current: number         // 0-based index into rounds — which one is live
}

// Draw Your Answer: the drawer gets a question about themselves ("your comfort food"),
// privately types their one-word answer, then draws it; the other guesses. Getting it
// right takes a readable drawing AND knowing them. Role alternates every round.
export type DrawPrompt = { id: string; text: string }
export type DrawStroke = [number, number][] // points normalized 0..1 within the canvas

export type DrawRound = {
  index: number // 1-based
  drawer: PlayerId
  promptId: string        // the question, not the answer
  answer: string | null   // the drawer's own secret answer — what the drawing is OF
  strokes: DrawStroke[]   // [] until the drawer submits (or times out with nothing)
  guess: string | null
  correct: boolean | null // set at reveal; the drawer can still count a near miss
}
export type DrawGame = {
  rounds: DrawRound[]     // as many as the roster asks for, prompt + drawer up front
  current: number         // 0-based index into rounds — which one is live
}

// Who's More Likely: one statement, each of you privately taps a name. Agree and you
// both score — it's the warm-up, so it pays for being on the same page, not for winning.
export type LikelyRound = {
  index: number // 1-based
  statement: string
  picks: Record<PlayerId, PlayerId | null> // who each of you named; null = not yet
}
export type LikelyGame = { rounds: LikelyRound[]; current: number }

// Mr & Mrs: one question about yourselves. Each of you types your own answer AND a
// prediction of the other's. At the reveal, whoever an answer belongs to rules on the
// prediction about them — free text never matches exactly, and "close enough?" is the
// argument the game is for.
export type MrMrsRound = {
  index: number // 1-based
  question: string
  answer: Record<PlayerId, string | null>   // what each said about themselves
  predict: Record<PlayerId, string | null>  // each one's guess at the OTHER's answer
  verdict: Record<PlayerId, boolean | null> // keyed by the PREDICTOR: did they get it?
}
export type MrMrsGame = { rounds: MrMrsRound[]; current: number }

// Lights Out: one gentle question to end the night on. No score, no typing — it's there
// to be talked about with the phone face down.
export type LightsCard = { question: string }

// Everything the content file provides. Fetched at boot and carried in the session so the
// host and both phones draw from exactly the same pools.
export type Content = {
  themes: Theme[]
  fingerStatements: string[]
  spectrums: WaveSpectrum[]
  drawPrompts: DrawPrompt[]
  likelyStatements: string[]
  mrmrsQuestions: string[]
  lightsQuestions: string[]
}

export type SessionState = {
  seed: number
  phase: Phase
  phaseEndsAt: number | null // absolute epoch ms; null = untimed
  players: Record<PlayerId, { name: string; connected: boolean }>
  gapActs: GapAct[]
  listActs: ListAct[]
  likely: LikelyGame | null
  finger: FingerGame | null
  mrmrs: MrMrsGame | null
  wave: WaveGame | null
  draw: DrawGame | null
  lights: LightsCard | null
  game: Game
  night: number // the host's day number at the start — picks Tonight's line-up (roster.ts)
} & Content

export type Action =
  | { type: 'JOIN'; player: PlayerId; name: string }
  // One item is live at a time. Each side locks a slot on it the instant they tap one —
  // no changing your mind, and a slot already spent on an earlier item can't be reused.
  | { type: 'PLACE_ITEM'; player: PlayerId; slot: number }
  // Put a Finger Down: a private yes/no to the round's statement. No changing your mind.
  | { type: 'SUBMIT_FINGER'; player: PlayerId; applies: boolean }
  // Who's More Likely: the name each of you taps, privately. No changing your mind.
  | { type: 'PICK_LIKELY'; player: PlayerId; pick: PlayerId }
  // Mr & Mrs: your own answer and your prediction of theirs, sent together.
  | { type: 'SUBMIT_MRMRS'; player: PlayerId; answer: string; predict: string }
  // Mr & Mrs: rule on the prediction about YOU — was it right?
  | { type: 'JUDGE'; player: PlayerId; correct: boolean }
  // Wavelength: the psychic's one clue, then the guesser's position on the spectrum.
  | { type: 'SUBMIT_CLUE'; player: PlayerId; text: string }
  | { type: 'SUBMIT_GUESS'; player: PlayerId; value: number }
  // Quick Draw: the drawer's finished sketch (empty strokes on a timeout), then the
  // guesser's one text guess at the prompt.
  | { type: 'SUBMIT_DRAWING'; player: PlayerId; answer: string; strokes: DrawStroke[] }
  // Draw Your Answer: the drawer counts a guess the auto-match missed ("ramen" for
  // "noodles"). Only ever turns a miss into a hit, never the other way.
  | { type: 'COUNT_IT'; player: PlayerId }
  | { type: 'SUBMIT_DRAW_GUESS'; player: PlayerId; text: string }
  // Shortlist's reveal walks the items one at a time, on a tap from either player —
  // there's no clock on it, so an argument about item four can run as long as it likes.
  | { type: 'ADVANCE_REVEAL'; player: PlayerId }
  // Every game ends on a scoreboard that waits to be tapped — the point of it is to sit
  // and look at the numbers, so nothing moves it on by itself.
  | { type: 'CONTINUE'; player: PlayerId }
  | { type: 'TIMEOUT' }
// Future actions: SUBMIT_RATING, TOGGLE_LIE, CALL, DOUBLE

export const EMPTY_CONTENT: Content = {
  themes: [],
  fingerStatements: [],
  spectrums: [],
  drawPrompts: [],
  likelyStatements: [],
  mrmrsQuestions: [],
  lightsQuestions: [],
}

export function initialState(
  seed: number,
  game: Game = 'full',
  content: Partial<Content> = {},
  night = 0,
): SessionState {
  return {
    seed,
    phase: 'JOIN',
    phaseEndsAt: null,
    players: { A: { name: '', connected: false }, B: { name: '', connected: false } },
    gapActs: [],
    listActs: [],
    likely: null,
    finger: null,
    mrmrs: null,
    wave: null,
    draw: null,
    lights: null,
    game,
    night,
    ...EMPTY_CONTENT,
    ...content,
  }
}
