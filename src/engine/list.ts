import type { ListAct, PlayerId, SessionState } from './state'
import { LIST } from './phases'

// Pure helpers over an Act III record, shared by the reducer and both renderers.

export const isAuthor = (act: ListAct, p: PlayerId): boolean => act.author === p

export function currentAct(s: SessionState): ListAct | undefined {
  return s.listActs[s.listActs.length - 1]
}

export const SLOTS: number[] = Array.from({ length: LIST.items }, (_, i) => i + 1)

// The item currently up for placing — LIST_PLACE reveals them one at a time.
export function currentItem(act: ListAct) {
  return act.items[act.placeIndex]
}

// The slots one side (the author's predictions, or the ranker's actuals) has already
// locked in, across every item placed so far — each number gets used exactly once.
export function usedSlots(act: ListAct, byAuthor: boolean): Set<number> {
  const used = new Set<number>()
  for (const item of act.items) {
    const slot = byAuthor ? item.predictedSlot : item.actualSlot
    if (slot !== null) used.add(slot)
  }
  return used
}

export function lowestFreeSlot(act: ListAct, byAuthor: boolean): number {
  const used = usedSlots(act, byAuthor)
  return SLOTS.find((n) => !used.has(n)) ?? SLOTS[SLOTS.length - 1]
}
