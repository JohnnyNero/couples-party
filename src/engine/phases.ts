import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  LIST_INTRO: 4000,   // the theme card, read once before the items start
  LIST_PLACE: 15000,  // one item live at a time — tap a slot, it's locked
  // LIST_REVEAL has no clock: it is tapped through item by item, and neither do the
  // four *_RESULT scoreboards — see the CONTINUE action.
  FINGER_ROUND: 15000,  // read it, think about it, decide privately
  FINGER_REVEAL: 4000,
  WAVE_CLUE: 25000,   // the psychic has to come up with a whole clue
  WAVE_GUESS: 20000,  // dragging one slider is faster than that
  WAVE_REVEAL: 5000,
  DRAW_SKETCH: 40000, // one phone, one finger, one prompt
  DRAW_GUESS: 20000,  // typing a guess is faster than drawing was
  DRAW_REVEAL: 6000,
}

export const LIST = {
  items: 7,         // seven items, seven slots
  blank: '(blank)', // pads a theme whose pool comes up short of seven
}

export const FINGER = {
  rounds: 5,        // five statements, then it's over
  startFingers: 5,  // one hand — every round can matter
}

export const WAVE = {
  rounds: 7,        // the official 2-player co-op variant's own length
  clueMaxLen: 24,   // a clue, not a sentence
  targetMin: 5,     // kept off the literal poles — a target of 0 or 100 is no puzzle
  targetMax: 95,
}

export const DRAW = {
  rounds: 6,        // three prompts each as the drawer
  guessMaxLen: 30,  // a guess, not a sentence
}
