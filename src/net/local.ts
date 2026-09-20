import { useSyncExternalStore } from 'react'
import type { Action, PlayerId, SessionState, Theme } from '../engine/state'
import { initialState } from '../engine/state'
import { reduce } from '../engine/reducer'

// Solo transport: one process, no room, no lobby, no network. The reducer, the timer
// loop and the clock work exactly as they do over Playroom — this only removes the wire.
// Solo play is a testing seat against the bot, so there is nobody to sync with.

export const SOLO_PLAYER: PlayerId = 'A'

let state: SessionState = initialState(0)
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const l of listeners) l()
}

function set(next: SessionState): void {
  if (next === state) return
  state = next
  emit()
}

export function initLocal(seedWords: string[], themes: Theme[]): void {
  state = initialState(Math.floor(Math.random() * 1e9), seedWords, themes)
  // The human takes the first seat the moment the app opens; the bot claims the other.
  state = reduce(state, { type: 'JOIN', player: SOLO_PLAYER, name: 'Player 1' }, Date.now())
  emit()
  if (timer !== null) clearInterval(timer)
  // Same host timer loop as the networked transport: a phase ends when its deadline
  // passes, whatever anyone has or hasn't submitted.
  timer = setInterval(() => {
    if (state.phaseEndsAt == null) return
    if (Date.now() >= state.phaseEndsAt) set(reduce(state, { type: 'TIMEOUT' }, Date.now()))
  }, 200)
}

export function localDispatch(action: Action): void {
  set(reduce(state, action, Date.now()))
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useLocalSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state, () => state)
}
