import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
  LIST_WRITE: 30000,  // tapping seven from a pool, not typing them
  LIST_SWAP: 20000,
  LIST_PLACE: 45000,  // dragging all seven into order, both players at once
  LIST_REVEAL: 15000,
}

export const MELD = {
  roundCap: 7,
}

export const LIST = {
  items: 7,       // seven items, seven slots
  maxLen: 40,     // one line on a phone
  blank: '(blank)', // pads a short list on timeout — seven slots need seven items
}
