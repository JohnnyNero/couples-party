import { useSyncExternalStore } from 'react'

// What this phone remembers about getting started: whether it's been shown round, whether
// the getting-started list has been put away, and whether you've played a game together
// yet. Just conveniences — lost with the browser's data, and nothing breaks if they are.

const WELCOMED = 'coupled:welcomed'
const LIST_HIDDEN = 'coupled:getting-started-hidden'
const PLAYED = 'coupled:played-together'
// Set for the reload after signing out (sessionStorage): the app opens on signing in.
export const SIGNED_OUT = 'coupled:signed-out'

const read = (k: string) => { try { return localStorage.getItem(k) !== null } catch { return false } }
const write = (k: string) => { try { localStorage.setItem(k, String(Date.now())) } catch { /* private mode */ } }

export const welcomed = () => read(WELCOMED)
export const markWelcomed = () => write(WELCOMED)
export const listHidden = () => read(LIST_HIDDEN)
export const hideList = () => write(LIST_HIDDEN)
export const playedTogether = () => read(PLAYED)
export const markPlayedTogether = () => write(PLAYED)

// The welcome, opened from anywhere — first thing on a new phone, from Today's "Invite
// your partner", or from the profile page to see the tour again. `start` is where in it.
export type WelcomeStart = 'tour' | 'you' | 'code' | 'tour-only' | 'save' | 'signin'
let open: WelcomeStart | null = null
const listeners = new Set<() => void>()
const emit = () => { for (const l of listeners) l() }

export function openWelcome(start: WelcomeStart): void { open = start; emit() }
export function closeWelcome(): void { open = null; emit() }
export function useWelcome(): WelcomeStart | null {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l) },
    () => open,
    () => null,
  )
}
