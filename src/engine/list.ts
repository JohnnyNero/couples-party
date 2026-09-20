import type { ListAct, PlayerId, SessionState } from './state'

// Pure helpers over an Act III record, shared by the reducer and both renderers.

export const isAuthor = (act: ListAct, p: PlayerId): boolean => act.author === p

export function currentAct(s: SessionState): ListAct | undefined {
  return s.listActs[s.listActs.length - 1]
}
