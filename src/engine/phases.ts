import type { Phase } from './state'

// How long each timed phase runs. The phases missing from here have no clock at all:
// the Shortlist reveal, every *_RESULT scoreboard, Lights Out, and Mr & Mrs's judging
// until both rulings are in — all of those wait for a tap, because hurrying them would
// cut off the conversation they exist to start.
export const DURATIONS: Partial<Record<Phase, number>> = {
  // Generous on purpose: these are the most a phase can take, not how long it does — a
  // phase ends the moment you've both answered. A clock is there to keep things moving,
  // never to hurry a good answer.
  LIST_INTRO: 5000,   // the theme card, read once before the items start
  LIST_PLACE: 25000,  // one item live at a time — tap a slot, it's locked
  LIKELY_ROUND: 20000, // read it, tap a name
  LIKELY_REVEAL: 5500,
  FINGER_ROUND: 30000,  // Called It: two taps — true for you, and your call on them
  FINGER_REVEAL: 6500,
  MM_ANSWER: 75000,   // two short answers to type — yours, and your guess at theirs
  MM_JUDGE: 6000,     // only starts once both rulings are in: a beat to take it in
  WAVE_CLUE: 75000,   // the clue-giver has to come up with a whole clue
  WAVE_GUESS: 60000,  // weighing up where on the scale they meant
  WAVE_REVEAL: 7000,
  DRAW_SKETCH: 40000, // the drawer decides what they'll draw — their answer, typed
  DRAW_GUESS: 75000,  // drawing it while the other watches and guesses
  DRAW_REVEAL: 12000, // long enough to look over the guesses, and wave one through
  CLASH_WRITE: 90000, // six answers, one letter (the reveal waits for taps)
  BLUFF_WRITE: 180000, // three things to make up (or own up to) — the reveal waits for taps
  BLUFF_PICK: 45000,  // three to choose from
  MELD_WRITE: 45000,  // one word
  MELD_REVEAL: 6000,  // the two words side by side (a miss waits longer: see MELD.missRevealMs)
  DESCRIBE_READY: 6000, // who's describing — get the phone in hand
  DESCRIBE_RUN: 60000,  // as many as you can
  CHAIN_END: 8000,    // the whole chain, with the broken link (CHAIN_TURN's clock is in CHAIN)
  CIRCLE_DRAW: 15000, // one circle — lifting your finger sends it
  CIRCLE_REVEAL: 6500,
  CLOCK_READY: 3000,  // the target, then 3-2-1 (CLOCK_RUN's length depends on the target)
  CLOCK_REVEAL: 5000,
  SPOT_READY: 3000,   // 3-2-1, then the grid
  SPOT_RUN: 20000,    // time to find it — the round ends sooner once you both have
  SPOT_REVEAL: 4500,
  FRENZY_READY: 3000,
  FRENZY_REVEAL: 4500,
  FOLLOW_REVEAL: 3500, // (FOLLOW_SHOW and FOLLOW_PLAY run as long as the sequence needs)
  TWIST_SAY: 15000,   // read it, then say it three times fast — the judge usually calls it sooner
  TWIST_REVEAL: 5000,
  HL_PICK: 15000,
  HL_REVEAL: 6000,
  GUESS_WRITE: 30000,
  GUESS_REVEAL: 7000,
  DECIDER_READY: 3000,
  DECIDER_REVEAL: 5500,
}

// Round counts are NOT here — they depend on the session, and live in roster.ts.

export const LIST = {
  items: 7,         // seven items, seven slots
  blank: '(blank)', // pads a theme whose pool comes up short of seven
}

export const WAVE = {
  clueMaxLen: 24,   // a clue, not a sentence
  targetMin: 5,     // kept off the literal poles — a target of 0 or 100 is no puzzle
  targetMax: 95,
}

export const MRMRS = {
  maxLen: 40,       // an answer, not an essay — the thing the other apps get wrong
}

export const BLUFF = {
  maxLen: 60, // one line each: a lie needs a little detail to be believable
}

export const MELD = {
  tries: 3,   // to meet on the same word
  maxLen: 30,
  missRevealMs: 9000, // a miss stays up longer: time to say "hang on, that's the same thing"
}

export const DRAW = {
  guessMaxLen: 30,  // a guess, not a sentence
  maxGuesses: 5,    // goes at it while it's being drawn
  maxPoints: 4000,  // of a whole drawing — a busy one still stays small on the wire
}

export const SPOT = {
  firstSize: 4,  // a 4×4 grid to start, one more a side each round…
  maxSize: 8,    // …up to 8×8
  deadHeatMs: 40,
  lockoutMs: 1500, // a wrong tap: hands off for a moment
}

export const FRENZY = {
  runMs: 5000,   // tapping time, on each phone's own clock
  graceMs: 3000, // for the count to arrive
  maxTaps: 120,  // no finger does more than ~20 a second
}

export const FOLLOW = {
  pads: 4,
  firstLength: 3,
  maxLength: 20,
  stepMs: 650,    // each flash in the sequence
  showLeadMs: 900, // a beat before it starts
  playMsPerStep: 1500, // time allowed to play it back, per step…
  playLeadMs: 3000,    // …plus this
}

export const TWIST = { times: 3 } // say it this many times

export const GUESS = { maxDigits: 9, closeShare: 0.25, yearSlack: 10 } // both within a quarter of it: a team point

export const FILLER = {
  winPoints: 5,     // to whoever wins a filler: matters in a close night, never swings a big one
  deciderPoints: 1, // the tiebreaker only has to break the tie
}

export const CIRCLE = {
  minRadius: 0.2,   // of the (square) canvas — a tiny scribble can't win
  minSweep: 330,    // degrees the line has to go round its centre
  maxPoints: 300,   // what's kept of a stroke, so the session stays small on the wire
}

export const CLOCK = {
  targetMin: 5000,  // targets are 5.0 s to 10.0 s, in tenths
  targetMax: 10000,
  hideAfter: [3000, 1000], // round 1 shows the clock for 3 s, round 2 for 1 s, later ones never
  deciderHideAfter: 1000,
  deadHeatMs: 10,   // closer than this is a dead heat, and the round is played again
  graceMs: 3000,    // on top of 2 × target before the host calls time — a tap from the other phone can take a moment to arrive
  deciderMaxRounds: 3,
}

export const CLASH = {
  categories: 6,
  // No Q, X, Z, J, V or Y: too few answers start with them to be fun against a clock.
  letters: 'ABCDEFGHIKLMNOPRSTUW',
  maxLen: 30,
}

export const CHAIN = {
  // The turn clock tightens as the chain grows: 25 s, then 18 s after ten words, then 13 s.
  turnMs: [25000, 18000, 13000],
  tightenEvery: 10,
  maxLen: 30,
  winPoints: 10,
  fuzzyMinLen: 5, // a word this long can be one letter off a listed one and still count
}
