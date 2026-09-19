import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Vitest's default (node) environment has no `localStorage`. `src/net/ids.ts` guards every
// access with `typeof localStorage !== 'undefined'`, so a minimal Map-backed stub is enough
// to exercise the real persistence path end to end.
class FakeStorage {
  private store = new Map<string, string>()
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value)
  }
  removeItem(key: string): void {
    this.store.delete(key)
  }
  clear(): void {
    this.store.clear()
  }
}

describe('net/ids — room-scoped player-id persistence', () => {
  beforeEach(() => {
    ;(globalThis as unknown as { localStorage: FakeStorage }).localStorage = new FakeStorage()
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as unknown as { localStorage?: FakeStorage }).localStorage
  })

  it('assigns the first joiner A and the second B in a fresh room', async () => {
    const { assignPlayerId } = await import('./ids')
    expect(assignPlayerId('player-1', 'ROOM1')).toBe('A')
    expect(assignPlayerId('player-2', 'ROOM1')).toBe('B')
  })

  it('re-asking for an already-assigned id in the same room returns the same label', async () => {
    const { assignPlayerId } = await import('./ids')
    expect(assignPlayerId('player-1', 'ROOM1')).toBe('A')
    expect(assignPlayerId('player-1', 'ROOM1')).toBe('A')
  })

  it('a second, different room starts fresh — does not inherit B from a prior room', async () => {
    const { assignPlayerId } = await import('./ids')
    assignPlayerId('player-1', 'ROOM1')
    assignPlayerId('player-2', 'ROOM1')
    // This is the regression the room-scoping fix exists to prevent: without it, the global
    // map would already hold 2 entries here, so the first joiner of a brand-new room would
    // incorrectly be assigned 'B' instead of 'A'.
    expect(assignPlayerId('player-3', 'ROOM2')).toBe('A')
  })

  it('reloading the same room (fresh module instance, same localStorage) restores identity', async () => {
    const first = await import('./ids')
    expect(first.assignPlayerId('player-1', 'ROOM1')).toBe('A')
    expect(first.assignPlayerId('player-2', 'ROOM1')).toBe('B')

    // Simulate a page reload: the JS module registry is thrown away and re-evaluated (module
    // top-level state resets to empty), but `localStorage` — backed here by the same
    // FakeStorage instance — survives, exactly like a real browser reload.
    vi.resetModules()
    const second = await import('./ids')
    expect(second.getPlayerId('player-1', 'ROOM1')).toBe('A')
    expect(second.getPlayerId('player-2', 'ROOM1')).toBe('B')
  })

  it('getPlayerId returns null for an id nothing has assigned', async () => {
    const { getPlayerId } = await import('./ids')
    expect(getPlayerId('nobody', 'ROOM1')).toBeNull()
  })

  it('without a room code, assignment still works in-memory but is not persisted across a reload', async () => {
    const first = await import('./ids')
    expect(first.assignPlayerId('player-1')).toBe('A')

    vi.resetModules()
    const second = await import('./ids')
    // No room was ever known, so nothing was written to storage under any room key — the
    // fresh module instance has no record of player-1.
    expect(second.getPlayerId('player-1')).toBeNull()
  })
})
