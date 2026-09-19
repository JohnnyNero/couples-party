import type { PlayerId } from '../engine/state'

const STORAGE_KEY = 'cp:ids'

function loadMap(): Map<string, PlayerId> {
  try {
    if (typeof localStorage === 'undefined') return new Map()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, PlayerId>
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

function saveMap(map: Map<string, PlayerId>): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)))
  } catch {
    // Private-mode / quota / disabled storage: identity just won't persist across reloads.
  }
}

const map = loadMap()

export function assignPlayerId(playroomId: string): PlayerId {
  const existing = map.get(playroomId)
  if (existing) return existing
  const id: PlayerId = map.size === 0 ? 'A' : 'B'
  map.set(playroomId, id)
  saveMap(map)
  return id
}

export function getPlayerId(playroomId: string): PlayerId | null {
  return map.get(playroomId) ?? null
}
