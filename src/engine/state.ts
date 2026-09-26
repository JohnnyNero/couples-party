export type PlayerId = 'A' | 'B'

export const other = (p: PlayerId): PlayerId => (p === 'A' ? 'B' : 'A')

// One game in the roster. Lights Out is in here too even though it doesn't score — it's
// a stop on the night like any other, it just has no points and no scoreboard.
export type GameKey = 'list' | 'likely' | 'finger' | 'mrmrs' | 'wave' | 'draw' | 'clash' | 'chain' | 'bluff' | 'circle' | 'clock' | 'lights'

// Which session this is. 'full' is the long night, 'tonight' the short one; a bare
// game key runs that game on its own. The actual line-up for each lives in roster.ts.
export type Game = 'full' | 'tonight' | Exclude<GameKey, 'lights'>

export type Phase =
  | 'BOOT' | 'JOIN'
  | 'INTRO' // a game's title card, before its first round
  | 'GAP_STATEMENT' | 'GAP_INPUT' | 'GAP_CALL' | 'GAP_REVEAL' | 'GAP_RESULT'
  | 'LIST_INTRO' | 'LIST_PLACE' | 'LIST_REVEAL' | 'LIST_RESULT'
  | 'LIKELY_ROUND' | 'LIKELY_REVEAL' | 'LIKELY_RESULT'
  | 'FINGER_ROUND' | 'FINGER_REVEAL' | 'FINGER_RESULT'
  | 'MM_ANSWER' | 'MM_JUDGE' | 'MM_RESULT'
  | 'WAVE_CLUE' | 'WAVE_GUESS' | 'WAVE_REVEAL' | 'WAVE_RESULT'
  | 'DRAW_SKETCH' | 'DRAW_GUESS' | 'DRAW_REVEAL' | 'DRAW_RESULT'
  | 'CLASH_WRITE' | 'CLASH_REVEAL' | 'CLASH_RESULT'
  | 'CHAIN_TURN' | 'CHAIN_END' | 'CHAIN_RESULT'
  | 'BLUFF_WRITE' | 'BLUFF_PICK' | 'BLUFF_REVEAL' | 'BLUFF_RESULT'
  | 'CIRCLE_DRAW' | 'CIRCLE_REVEAL' | 'CIRCLE_RESULT'
  | 'CLOCK_READY' | 'CLOCK_RUN' | 'CLOCK_REVEAL' | 'CLOCK_RESULT'
  | 'DECIDER_READY' | 'DECIDER_RUN' | 'DECIDER_REVEAL'
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

// Category Clash: one letter, six categories, a minute to answer them all. An answer
// scores if it starts with the letter and isn't the same as your partner's; the app
// can check the letter but not whether it fits, so either of you can challenge the
// other's at the reveal, which halves it.
export type ClashRound = {
  index: number // 1-based
  letter: string // upper case
  categories: string[]
  answers: Record<PlayerId, string[] | null> // one per category, '' for blank; null = not in yet
  challenged: Record<PlayerId, boolean[]>    // keyed by the answer's OWNER
  revealIndex: number // the category the reveal is on
}
export type ClashGame = { rounds: ClashRound[]; current: number }

// Word Chain: take turns naming things in a category, each starting with the letter the
// last one ended on, against a clock. The category's answer list lives in the content
// file, so every word is checked instantly — a word that doesn't pass is turned back and
// you try again, but the clock keeps running. Run out of time and you lose the round.
export type ChainCategory = { name: string; words: string[] }
export type ChainLink = { word: string; by: PlayerId | null } // null = the app's opener
export type ChainReject = { player: PlayerId; word: string; reason: 'letter' | 'used' | 'unknown' }
export type ChainRound = {
  index: number // 1-based
  category: string
  words: string[]    // the accepted answers, as written in the content file
  chain: ChainLink[]
  turn: PlayerId
  need: string       // the letter the next word must start with, lower case
  loser: PlayerId | null // whoever ran out of time; null while live, or a round nobody could go on
  over: boolean
  reject: ChainReject | null
}
export type ChainGame = { rounds: ChainRound[]; current: number }

// Two Lies & a Truth: one prompt about yourselves ("the worst gift you've been given").
// You both write a truth and two lies at once; then it takes one of you at a time, and
// the other picks which of the three is true. Options are numbered 0 (the truth), 1 and
// 2 (the lies); `order` is the shuffle they're shown in, dealt up front.
export type BluffEntry = { truth: string; lies: [string, string] }
export type BluffRound = {
  index: number // 1-based
  prompt: string
  first: PlayerId // whose three are guessed first this round
  turn: PlayerId  // whose three are being guessed now
  entry: Record<PlayerId, BluffEntry | null> // null = not in yet (or never came)
  order: Record<PlayerId, number[]>          // keyed by the entry's owner
  pick: Record<PlayerId, number | null>      // keyed by the entry's OWNER: what the other picked; -1 = ran out of time
}
export type BluffGame = { rounds: BluffRound[]; current: number }

// Perfect Circle, a filler: you both draw one circle at once and the rounder one takes
// the round. Only the longest stroke is kept — that's the circle; the rest is noise.
export type CircleRound = {
  index: number // 1-based
  drawn: Record<PlayerId, DrawStroke | null> // null = not in yet
  score: Record<PlayerId, number | null>     // 0..100, one decimal, set at the reveal
}
// `bestOf` is the roster's round count: 1 between games, 5 played on its own. Ends as
// soon as someone has won a majority of it.
export type CircleGame = { rounds: CircleRound[]; current: number; bestOf: number }

// Stop the Clock, a filler — and the tiebreaker on a level night. A clock starts on each
// phone, disappears after `hideAfterMs`, and each of you taps when you think it has
// reached the target. Each phone times itself and sends only the elapsed time, so
// network lag never reaches the result.
export type ClockRound = {
  index: number // 1-based
  targetMs: number
  hideAfterMs: number // 0 = never shown
  stopped: Record<PlayerId, number | null> // elapsed ms; a miss is recorded as 2 × target
}
export type ClockGame = { rounds: ClockRound[]; current: number; bestOf: number }

// A game's title card: what it is and how it plays, before its first round. The game has
// already been set up underneath it; `resume` is where it picks up — the phase, and how
// long that phase's clock had — once you're both ready, or the card's own clock runs out.
export type IntroCard = {
  key: GameKey
  ready: Record<PlayerId, boolean>
  resume: Phase
  resumeMs: number | null
}

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
  clashCategories: string[]
  chainCategories: ChainCategory[]
  bluffPrompts: string[]
  // The couple's own cards (Our questions), by their text — a Wavelength scale as
  // "Low | High". Already in the pools above; this only says which to deal first.
  ours?: string[]
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
  clash: ClashGame | null
  chain: ChainGame | null
  bluff: BluffGame | null
  circle: CircleGame | null
  clock: ClockGame | null
  decider: ClockGame | null // a level night's tiebreaker — one Stop the Clock, sudden death
  intro: IntroCard | null
  intros: boolean // title cards on — set by the host for real sessions; tests leave them off
  // Paused by either of you, from the menu: the clock stops (what was left of it is kept
  // here) and nothing moves until one of you resumes.
  paused: { by: PlayerId; leftMs: number | null } | null
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
  // Done reading a game's title card.
  | { type: 'READY'; player: PlayerId }
  // Category Clash: all six of your answers at once ('' for a blank), then — at the
  // reveal — a challenge to your partner's answer in one category.
  | { type: 'SUBMIT_CLASH'; player: PlayerId; answers: string[] }
  | { type: 'CHALLENGE'; player: PlayerId; index: number }
  // Word Chain: one try at the next word, on your turn.
  | { type: 'CHAIN_WORD'; player: PlayerId; word: string }
  // Two Lies & a Truth: your truth and two lies, all at once (sending is readying up);
  // then, on your partner's turn, which of theirs you think is true (0, 1 or 2).
  | { type: 'SUBMIT_BLUFF'; player: PlayerId; truth: string; lies: [string, string] }
  | { type: 'PICK_BLUFF'; player: PlayerId; choice: number }
  // Perfect Circle: your one circle, sent the moment your finger lifts.
  | { type: 'SUBMIT_CIRCLE'; player: PlayerId; strokes: DrawStroke[] }
  // Stop the Clock (and the tiebreaker): how long your own phone's clock ran before you
  // tapped, in ms.
  | { type: 'STOP_CLOCK'; player: PlayerId; elapsedMs: number }
  | { type: 'TIMEOUT' }
  | { type: 'PAUSE'; player: PlayerId }
  | { type: 'RESUME'; player: PlayerId }
// Future actions: SUBMIT_RATING, TOGGLE_LIE, CALL, DOUBLE

export const EMPTY_CONTENT: Content = {
  themes: [],
  fingerStatements: [],
  spectrums: [],
  drawPrompts: [],
  likelyStatements: [],
  mrmrsQuestions: [],
  lightsQuestions: [],
  clashCategories: [],
  chainCategories: [],
  bluffPrompts: [],
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
    clash: null,
    chain: null,
    bluff: null,
    circle: null,
    clock: null,
    decider: null,
    intro: null,
    intros: false,
    paused: null,
    game,
    night,
    ...EMPTY_CONTENT,
    ...content,
  }
}
