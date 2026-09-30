import { useSyncExternalStore } from 'react'
import { api, type CoupleEntry } from '../daily/api'
import { refreshProfile } from '../profile/store'

// The couples you're in (migration 0028) and switching between them. One is the one
// you're using; the whole app — Today, games, Memories, friends — is that couple's.
//
// A switch reloads the app, so nothing from one couple lingers in the next. What this
// phone keeps for a couple (their questions, the game you were in the middle of, the
// getting-started list…) is put aside under that couple and brought back when you
// switch back to it.

const KEY = 'couples-party:couples'
const STASH = 'coupled:stash:'
// Kept per couple. Everything else on the phone (theme, name, vibration…) is yours.
const PER_COUPLE = [
  'couples-party:profile', 'couples-party:ideas', 'couples-party:leaderboard', 'couples-party:spun',
  'coupled:streak-seen', 'coupled:shown', 'coupled:pins', 'coupled:in-progress',
  'coupled:played-together', 'coupled:getting-started-hidden',
]
const perCouple = (k: string) => PER_COUPLE.includes(k) || k.startsWith('coupled:tonight:')
// Set for the reload after starting another couple: the app opens on setting it up.
export const ADDING = 'coupled:adding-couple'

const listeners = new Set<() => void>()
function load(): CoupleEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as CoupleEntry[] } catch { return [] }
}
let current: CoupleEntry[] = typeof localStorage === 'undefined' ? [] : load()
function set(next: CoupleEntry[]) {
  current = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private mode */ }
  for (const l of listeners) l()
}

export function useCouples(): CoupleEntry[] {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => current, () => [])
}

let inflight: Promise<CoupleEntry[]> | null = null
export function refreshCouples(): Promise<CoupleEntry[]> {
  inflight ??= api.myCouples().then((c) => { set(c); return c }).catch(() => current).finally(() => { inflight = null })
  return inflight
}

// This phone's things for the couple you're leaving, put aside; the next one's brought back.
function putAside(id: string | undefined) {
  try {
    const kept: Record<string, string> = {}
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k || !perCouple(k)) continue
      if (id) kept[k] = localStorage.getItem(k) ?? ''
      localStorage.removeItem(k)
    }
    if (id) localStorage.setItem(STASH + id, JSON.stringify(kept))
  } catch { /* private mode: nothing kept anyway */ }
}
function bringBack(id: string | undefined) {
  if (!id) return
  try {
    const kept = JSON.parse(localStorage.getItem(STASH + id) ?? '{}') as Record<string, string>
    for (const [k, v] of Object.entries(kept)) localStorage.setItem(k, v)
    localStorage.removeItem(STASH + id)
  } catch { /* nothing to bring back */ }
}
const activeId = () => current.find((c) => c.active)?.id

function reload() {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  window.location.replace(url.toString())
}

// Over to another of your couples.
export async function switchTo(id: string): Promise<void> {
  const from = activeId()
  await api.switchCouple(id)
  putAside(from)
  bringBack(id)
  reload()
}

// Room for another couple: you're set up as not in one, and the app opens on starting it
// (or joining with a code). The others carry on.
export async function startAnother(): Promise<void> {
  const from = activeId()
  await api.addCouple()
  putAside(from)
  try { sessionStorage.setItem(ADDING, '1') } catch { /* fine */ }
  reload()
}

// Joining someone's couple from their invite link when you're already in one: it's
// another couple, and the one you were in carries on. A couple still waiting for its
// other half has nothing in it yet, so that one's swapped for this. Returns whether the
// app needs a reload once you're done (see `arrived`).
export async function joinFromInvite(code: string, name: string): Promise<boolean> {
  const before = await refreshProfile()
  if (!before) throw new Error('offline')
  await refreshCouples()
  const from = activeId()
  let keep = from // whose things this phone is holding
  if (before.state === 'waiting') { await api.leaveCouple(); keep = undefined }
  const now = before.state === 'waiting' ? await refreshProfile() : before
  const making = !!now && now.state !== 'single'
  if (making) await api.addCouple()
  try {
    await api.joinCouple(code, name)
  } catch (e) {
    if (making) await api.leaveCouple().catch(() => {}) // back where you were
    throw e
  }
  if (!from && !making) return false
  putAside(keep)
  return true
}

// After unpairing: if you're in another couple, that's where you are now.
export async function afterLeaving(): Promise<boolean> {
  const left = activeId()
  const rest = await api.myCouples().catch(() => null)
  if (!rest || rest.length === 0) { set([]); return false }
  if (left) try { localStorage.removeItem(STASH + left) } catch { /* fine */ }
  putAside(undefined)
  bringBack(rest.find((c) => c.active)?.id)
  reload()
  return true
}

export const arrived = reload
