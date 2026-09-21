import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
  LIST_WRITE: 30000,  // tapping seven from a pool, not typing them
  LIST_SWAP: 20000,
  LIST_PLACE: 45000,  // dragging all seven into order, both players at once
  LIST_REVEAL: 15000,
  FINGER_ROUND: 15000,  // read it, think about it, decide privately
  FINGER_REVEAL: 4000,
  FINGER_RESULT: 6000,
  WAVE_CLUE: 25000,   // the psychic has to come up with a whole clue
  WAVE_GUESS: 20000,  // dragging one slider is faster than that
  WAVE_REVEAL: 5000,
  WAVE_RESULT: 6000,
}

export const MELD = {
  roundCap: 7,
}

export const LIST = {
  items: 7,       // seven items, seven slots
  maxLen: 40,     // one line on a phone
  blank: '(blank)', // pads a short list on timeout — seven slots need seven items
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
