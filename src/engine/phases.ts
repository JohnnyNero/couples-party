import type { Phase } from './state'

export const DURATIONS: Partial<Record<Phase, number>> = {
  FORFEIT_WRITE: 45000,
  POT_SHUFFLE: 4000,
  MELD_TYPE: 20000,
  MELD_REVEAL: 4000,
  MELD_RESULT: 6000,
}

export const MELD = {
  roundCap: 7,
  burnThreshold: 3, // converge in <= 3 rounds burns a forfeit (wired in M2)
}
