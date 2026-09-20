import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  STAKE_REVEAL: 4000,
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
  // STAKE_SET is untimed: the pair agree at their own pace, then one types it in.
}

export const MELD = {
  roundCap: 7,
}

export const STAKE = { maxLen: 80 }
