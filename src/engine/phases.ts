import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  STAKE_REVEAL: 4000,
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
  LIST_WRITE: 60000,
  LIST_SWAP: 20000,
  LIST_PLACE: 15000,
  LIST_REVEAL: 15000,
  // STAKE_SET is untimed: the pair agree at their own pace, then one types it in.
}

export const MELD = {
  roundCap: 7,
}

export const STAKE = { maxLen: 80 }

export const LIST = {
  items: 7,       // seven items, seven slots
  maxLen: 40,     // one line on a phone
  blank: '(blank)', // pads a short list on timeout — seven slots need seven items
}
