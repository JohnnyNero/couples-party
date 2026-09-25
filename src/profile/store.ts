import { useSyncExternalStore } from 'react'
import { api, type Profile } from '../daily/api'

// Who you are and who you're with, for the profile page and every avatar in the app.
// Kept in memory and in localStorage, so avatars have their photos from the first
// frame, and refreshed from the server whenever the app opens or something changes.
// A phone that isn't paired (or a server without migration 0013) just has no photos.

const KEY = 'couples-party:profile'
const listeners = new Set<() => void>()

function load(): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Profile) : null
  } catch {
    return null
  }
}

let current: Profile | null = typeof localStorage === 'undefined' ? null : load()

function set(next: Profile | null) {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch { /* private mode — memory only */ }
  for (const l of listeners) l()
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useProfile(): Profile | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

let inflight: Promise<Profile | null> | null = null
export function refreshProfile(): Promise<Profile | null> {
  inflight ??= api
    .profile()
    .then((p) => {
      set(p)
      return p
    })
    .catch(() => current)
    .finally(() => { inflight = null })
  return inflight
}

// After unpairing: nobody to show.
export const clearProfile = () => set({ state: 'single' })

// A photo for whoever goes by this name — you or your partner. Names are how the games
// know you (see useGameName), so this is what lets an in-game avatar find its picture.
export function photoFor(p: Profile | null, name: string | undefined): string | null {
  if (!p || p.state === 'single' || !name) return null
  const n = name.trim().toLowerCase()
  if (p.me.name.trim().toLowerCase() === n) return p.me.photo
  if (p.state === 'paired' && p.partner.name.trim().toLowerCase() === n) return p.partner.photo
  return null
}

export function usePhoto(name: string | undefined): string | null {
  return photoFor(useProfile(), name)
}

// Changes made on the profile page, reflected locally straight away.
export function patchMe(change: Partial<{ name: string; photo: string | null }>) {
  if (!current || current.state === 'single') return
  set({ ...current, me: { ...current.me, ...change } })
}
