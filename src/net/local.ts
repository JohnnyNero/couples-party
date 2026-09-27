import { useSyncExternalStore } from 'react'
import type { Action, Content, Game, PlayerId, SessionState } from '../engine/state'
import { initialState } from '../engine/state'
import { keepChainLists } from '../engine/chain'
import { reduce } from '../engine/reducer'
import { dayIndex, localDate } from '../daily/dates'
import { dailySeed } from '../share/daily'
import type { Activity, Live } from './live'

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

export function initLocal(content: Content, game: Game): void {
  const day = dayIndex(localDate())
  // Word Chain's lists stay on the phone, as over the network (see keepChainLists).
  const kept = { ...content, chainCategories: keepChainLists(content.chainCategories) }
  state = { ...initialState(game === 'tonight' ? dailySeed(day) : Math.floor(Math.random() * 1e9), game, kept, day), intros: true }
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

// Solo: the only one typing or dragging is you, but the same preview shows on the board.
let live: Live | null = null
const liveListeners = new Set<() => void>()
export function setLocalLive(value: Live | null): void {
  live = value
  for (const l of liveListeners) l()
}
export function useLocalLive(): Live | null {
  return useSyncExternalStore(
    (l) => { liveListeners.add(l); return () => { liveListeners.delete(l) } },
    () => live,
    () => live,
  )
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

// Solo: yours, and the bot's (which says it's thinking while it makes up its mind).
const activity: Record<PlayerId, Activity | null> = { A: null, B: null }
const activityListeners = new Set<() => void>()
export function setLocalActivity(p: PlayerId, value: Activity | null): void {
  if (activity[p]?.kind === value?.kind && activity[p]?.key === value?.key) return
  activity[p] = value
  for (const l of activityListeners) l()
}
export function useLocalActivity(p: PlayerId): Activity | null {
  return useSyncExternalStore(
    (l) => { activityListeners.add(l); return () => { activityListeners.delete(l) } },
    () => activity[p],
    () => activity[p],
  )
}
