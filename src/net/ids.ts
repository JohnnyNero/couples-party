import type { PlayerId } from '../engine/state'

// Persisted key is scoped PER ROOM (`cp:ids:<roomCode>`), not global. A single global map
// would survive across different Playroom rooms/sessions on the same device; since Playroom
// mints a fresh player id per room, a brand-new session would then inherit a stale non-empty
// map from a previous session and the `map.size === 0 ? 'A' : 'B'` rule below would assign
// every new player 'B'. Scoping by room means a new room always starts from an empty map
// (correct A/B assignment), while reloading the SAME room restores the same map (identity
// survives the reload).
const STORAGE_PREFIX = 'cp:ids:'

// `room` is passed in by the caller (net/playroom.ts, the only module allowed to import
// `playroomkit` and therefore the only one that can read `getRoomCode()`). Kept here as
// module-level state so repeated calls within the same room don't re-parse localStorage.
let map: Map<string, PlayerId> = new Map()
let loadedRoom: string | undefined

function loadMapForRoom(room: string): Map<string, PlayerId> {
  try {
    if (typeof localStorage === 'undefined') return new Map()
    const raw = localStorage.getItem(STORAGE_PREFIX + room)
    if (!raw) return new Map()
    const parsed = JSON.parse(raw) as Record<string, PlayerId>
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

function saveMapForRoom(room: string, m: Map<string, PlayerId>): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_PREFIX + room, JSON.stringify(Object.fromEntries(m)))
  } catch {
    // Private-mode / quota / disabled storage: identity just won't persist across reloads.
  }
}

// (Re)loads `map` from storage the first time we see a given room. If no room code is
// available yet (e.g. called before Playroom has finished joining a room), leaves `map` as
// whatever it currently is — a fresh, unpersisted, in-memory Map — rather than guessing at a
// storage key. That in-memory map still lets `assignPlayerId` hand out correct A/B within the
// current session; it just won't survive a reload until a room code becomes available.
function ensureRoom(room: string | undefined): void {
  if (room === undefined) return
  if (loadedRoom !== room) {
    map = loadMapForRoom(room)
    loadedRoom = room
  }
}

export function assignPlayerId(playroomId: string, room?: string): PlayerId {
  ensureRoom(room)
  const existing = map.get(playroomId)
  if (existing) return existing
  const id: PlayerId = map.size === 0 ? 'A' : 'B'
  map.set(playroomId, id)
  if (room !== undefined) saveMapForRoom(room, map)
  return id
}

export function getPlayerId(playroomId: string, room?: string): PlayerId | null {
  ensureRoom(room)
  return map.get(playroomId) ?? null
}
