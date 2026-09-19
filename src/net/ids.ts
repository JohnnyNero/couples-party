import type { PlayerId } from '../engine/state'

const map = new Map<string, PlayerId>()

export function assignPlayerId(playroomId: string): PlayerId {
  const existing = map.get(playroomId)
  if (existing) return existing
  const id: PlayerId = map.size === 0 ? 'A' : 'B'
  map.set(playroomId, id)
  return id
}

export function getPlayerId(playroomId: string): PlayerId | null {
  return map.get(playroomId) ?? null
}
