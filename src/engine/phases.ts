import type { Phase } from './state'

// How long each timed phase runs. The phases missing from here have no clock at all:
// the Shortlist reveal, every *_RESULT scoreboard, Lights Out, and Mr & Mrs's judging
// until both rulings are in — all of those wait for a tap, because hurrying them would
// cut off the conversation they exist to start.
export const DURATIONS: Partial<Record<Phase, number>> = {
  LIST_INTRO: 4000,   // the theme card, read once before the items start
  LIST_PLACE: 15000,  // one item live at a time — tap a slot, it's locked
  LIKELY_ROUND: 12000, // read it, tap a name
  LIKELY_REVEAL: 4000,
  FINGER_ROUND: 15000,  // read it, think about it, decide privately
  FINGER_REVEAL: 4000,
  MM_ANSWER: 45000,   // two short answers to type — yours, and your guess at theirs
  MM_JUDGE: 5000,     // only starts once both rulings are in: a beat to take it in
  WAVE_CLUE: 25000,   // the clue-giver has to come up with a whole clue
  WAVE_GUESS: 20000,  // dragging one slider is faster than that
  WAVE_REVEAL: 5000,
  DRAW_SKETCH: 50000, // decide your answer, then draw it with one finger
  DRAW_GUESS: 20000,  // typing a guess is faster than drawing was
  DRAW_REVEAL: 8000,  // long enough for the drawer to wave through a near miss
  CIRCLE_DRAW: 10000, // one circle — lifting your finger sends it
  CIRCLE_REVEAL: 6000,
  CLOCK_READY: 3000,  // the target, then 3-2-1 (CLOCK_RUN's length depends on the target)
  CLOCK_REVEAL: 4500,
  DECIDER_READY: 3000,
  DECIDER_REVEAL: 5000,
}

// Round counts are NOT here — they depend on the session, and live in roster.ts.

export const LIST = {
  items: 7,         // seven items, seven slots
  blank: '(blank)', // pads a theme whose pool comes up short of seven
}

export const FINGER = {
  startFingers: 5,  // one hand — every round can matter
}

export const WAVE = {
  clueMaxLen: 24,   // a clue, not a sentence
  targetMin: 5,     // kept off the literal poles — a target of 0 or 100 is no puzzle
  targetMax: 95,
}

export const MRMRS = {
  maxLen: 40,       // an answer, not an essay — the thing the other apps get wrong
}

export const DRAW = {
  guessMaxLen: 30,  // a guess, not a sentence
}

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
  graceMs: 1500,    // on top of 2 × target before the host calls time
  deciderMaxRounds: 3,
}
