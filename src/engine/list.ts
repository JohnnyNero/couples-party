import type { ListAct, ListItem, PlayerId, SessionState } from './state'
import { LIST } from './phases'

// Pure helpers over an Act III record, shared by the reducer and both renderers so the
// phone grid and the board occupancy can never disagree about what is taken.

export const isAuthor = (act: ListAct, p: PlayerId): boolean => act.author === p

export const slotOf = (item: ListItem, byAuthor: boolean): number | null =>
  byAuthor ? item.predictedSlot : item.actualSlot

export function usedSlots(act: ListAct, byAuthor: boolean): number[] {
  return act.items.map((i) => slotOf(i, byAuthor)).filter((n): n is number => n !== null)
}

export function lowestFreeSlot(act: ListAct, byAuthor: boolean): number {
  const used = new Set(usedSlots(act, byAuthor))
  for (let n = 1; n <= LIST.items; n++) if (!used.has(n)) return n
  return LIST.items
}

export const SLOTS: number[] = Array.from({ length: LIST.items }, (_, i) => i + 1)

export function currentAct(s: SessionState): ListAct | undefined {
  return s.listActs[s.listActs.length - 1]
}

export function currentItem(act: ListAct): ListItem | undefined {
  return act.items[act.placeIndex]
}
