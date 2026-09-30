import { useSyncExternalStore } from 'react'
import type { User } from '@supabase/supabase-js'
import { sb, signedIn } from '../daily/api'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../daily/config'

// Who's signed in on this phone. Everyone starts as a guest (an anonymous account the
// phone makes for itself) and keeps everything they do as one; adding an email turns
// that same account into a real one — nothing moves, nothing's lost — and from then on
// any phone that signs in with that email is you, with all of it.
//
// Email is a six-digit code, not a link: a link opens the browser, and on an iPhone the
// home-screen app wouldn't be the one signed in. Google appears once it's switched on in
// Supabase (see providers).

export type Account =
  | { kind: 'loading' }
  | { kind: 'guest' }
  | { kind: 'member'; email: string | null; google: boolean }

let current: Account = { kind: 'loading' }
const listeners = new Set<() => void>()
const set = (a: Account) => { current = a; for (const l of listeners) l() }

const describe = (user: User | null | undefined): Account =>
  !user ? { kind: 'guest' }
    : user.is_anonymous ? { kind: 'guest' }
    : { kind: 'member', email: user.email ?? null, google: (user.identities ?? []).some((i) => i.provider === 'google') }

let watching = false
function watch() {
  if (watching) return
  watching = true
  const auth = sb().auth
  auth.onAuthStateChange((_event, session) => set(describe(session?.user)))
  void auth.getSession().then(({ data }) => set(describe(data.session?.user)))
}

export function useAccount(): Account {
  return useSyncExternalStore(
    (l) => { watch(); listeners.add(l); return () => listeners.delete(l) },
    () => current,
    () => current,
  )
}

// ---------------------------------------------------------------- email

// What happened when you asked for a code: your guest account is being made yours
// ('upgrade'), or there's already an account with that email and you're signing in to
// it ('signin').
export type Sent = 'upgrade' | 'signin'

export class AccountError extends Error {}

function friendly(error: { code?: string; message: string; status?: number }): AccountError {
  const code = error.code ?? ''
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(error.message)) return new AccountError('That doesn’t look like an email address.')
  if (code === 'over_email_send_rate_limit' || /rate limit|too many/i.test(error.message)) return new AccountError('Too many codes asked for — wait a minute, then try again.')
  if (code === 'email_address_not_authorized' || code === 'email_provider_disabled') return new AccountError('Email sign-in isn’t set up yet — try again soon.')
  if (code === 'otp_expired' || /expired|invalid.*(otp|token)|token.*invalid/i.test(error.message)) return new AccountError('That code’s not right, or it’s expired. Check it, or send a new one.')
  if (error.status === 0 || /fetch|network/i.test(error.message)) return new AccountError('Couldn’t reach the server — check your signal.')
  return new AccountError(error.message)
}

export async function sendCode(email: string): Promise<Sent> {
  const address = email.trim().toLowerCase()
  await signedIn().catch(() => {})
  const { data } = await sb().auth.getUser()
  // A guest keeps everything: the email is added to this very account.
  if (data.user?.is_anonymous) {
    const { error } = await sb().auth.updateUser({ email: address })
    if (!error) return 'upgrade'
    if (error.code !== 'email_exists' && !/already.*(registered|exists)/i.test(error.message)) throw friendly(error)
  }
  // Someone already has this email: sign in to theirs.
  const { error } = await sb().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } })
  if (error) throw friendly(error)
  return 'signin'
}

export async function confirmCode(email: string, code: string, sent: Sent): Promise<void> {
  const { error } = await sb().auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.replace(/\D/g, ''),
    type: sent === 'upgrade' ? 'email_change' : 'email',
  })
  if (error) throw friendly(error)
  // Signing in to another account: what this phone kept for whoever it was is no longer
  // anyone's here.
  if (sent === 'signin') forgetThisPhone()
}

// ---------------------------------------------------------------- Google

let settings: Promise<{ google: boolean }> | null = null
export function providers(): Promise<{ google: boolean }> {
  settings ??= fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } })
    .then((r) => r.json())
    .then((s: { external?: Record<string, boolean> }) => ({ google: !!s.external?.google }))
    .catch(() => ({ google: false }))
  return settings
}

const back = () => window.location.origin + window.location.pathname

// A guest links Google to the account they have; anyone else signs in with it. Either
// way the browser goes to Google and comes back here (see finishRedirect).
export async function withGoogle(): Promise<void> {
  await signedIn().catch(() => {})
  const { data } = await sb().auth.getUser()
  const redirectTo = back()
  if (data.user?.is_anonymous) {
    try { sessionStorage.setItem(GOOGLE_LINK, '1') } catch { /* fine */ }
    const { error } = await sb().auth.linkIdentity({ provider: 'google', options: { redirectTo } })
    if (!error) return
  }
  const { error } = await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
  if (error) throw friendly(error)
}

const GOOGLE_LINK = 'coupled:google-link'

// Back from Google. If that Google account already belonged to someone, linking it to
// this guest failed — so sign in to theirs instead.
export async function finishRedirect(): Promise<void> {
  const params = new URLSearchParams(window.location.hash.slice(1) + '&' + window.location.search.slice(1))
  const failed = params.get('error_code') ?? params.get('error')
  let linking = false
  try { linking = sessionStorage.getItem(GOOGLE_LINK) === '1'; sessionStorage.removeItem(GOOGLE_LINK) } catch { /* fine */ }
  if (!failed) return
  const url = new URL(window.location.href)
  url.hash = ''
  for (const k of ['error', 'error_code', 'error_description']) url.searchParams.delete(k)
  window.history.replaceState(window.history.state, '', url.toString())
  if (linking && /identity_already_exists|already/i.test(failed + (params.get('error_description') ?? ''))) {
    forgetThisPhone()
    await sb().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back() } })
  }
}

// ---------------------------------------------------------------- leaving

// What this phone keeps about the person signed in on it — their profile, their pairing,
// a game in progress, the questions they've seen — none of which belongs to whoever
// signs in next. Settings that are the phone's own (theme, vibration, the tab you were
// on, having seen the tour) stay.
const PERSONAL = [
  'couples-party:profile', 'couples-party:ideas', 'couples-party:seen', 'couples-party:name', 'couples-party:leaderboard',
  'couples-party:spun', 'coupled:in-progress', 'coupled:shown', 'coupled:pins', 'coupled:streak-seen',
  'coupled:played-together', 'coupled:getting-started-hidden',
]
export function forgetThisPhone(): void {
  try {
    for (const k of PERSONAL) localStorage.removeItem(k)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && /^coupled:(tonight|seen):/.test(k)) localStorage.removeItem(k)
    }
  } catch { /* private mode: nothing kept anyway */ }
}

export async function signOut(): Promise<void> {
  await sb().auth.signOut()
  forgetThisPhone()
}
