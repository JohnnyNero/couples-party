import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'
import type { DrawStroke } from '../engine/state'

// The daily puzzles' whole server surface, each call a Postgres function defined in
// supabase/migrations. Nothing here reads a table directly — it can't; see the
// migration for why.

export type PuzzleView = {
  id: string
  forDate: string
  kind: 'word'
  prompt: string
  length?: number // letters in the answer, 5 or 6 — absent from a server without migration 0003
  guesses: string[]
  patterns: string[] // one per guess: 'g' right place, 'y' wrong place, '.' absent
  status: 'open' | 'solved' | 'failed'
  answer: string | null // null while the solver is still playing
}

export type Daily =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      // Today's question, once either of you has answered — pinned for the couple.
      question: string | null
      mine: PuzzleView | null // my answer today, and how they're getting on with it
      theirs: PuzzleView | { locked: true } | null // null: not answered yet; locked: answer yours first
      // Consecutive days you've both answered, one missed day forgiven — 0 from a
      // server without migration 0004.
      streak?: number
    }

// The Dial: today's spectrum (as "Low | High"), a hidden mark on it, and a one-word
// clue for it. One slide to guess, not six.
export type DialView = {
  id: string
  forDate: string
  kind: 'dial'
  prompt: string // the spectrum, e.g. "Cold | Hot"
  clue: string // always visible — it's the hint, not the secret
  guess: number | null
  distance: number | null // |target - guess|, once guessed
  status: 'open' | 'solved'
  target: number | null // null until you've guessed, unless it's your own mark
}

// Its own card, landing independently of Their Word for now — see docs/ROADMAP.md.
export type DailyDial =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      prompt: string | null
      mine: DialView | null
      theirs: DialView | { locked: true } | null
    }

// Top 5: five things from a Shortlist theme, in the order they're offered up to rank
// (never a secret — you need to see them to rank them). `rank` is the true order,
// hidden until you've guessed; `guess` is your attempt at it, once made.
export type Top5View = {
  id: string
  forDate: string
  kind: 'top5'
  prompt: string // the theme
  items: string[] // the five, in the fixed day's order — index is "item i" everywhere else
  rank: number[] | null // rank[k] = index of the item placed at rank k+1; null until solved (or yours)
  guess: number[] | null // same shape, the solver's attempt
  exact: number | null // items landed on their exact rank, once guessed
  near: number | null // items one rank out, once guessed
  status: 'open' | 'solved'
}

// Its own card too, alongside Their Word and The Dial — see docs/ROADMAP.md.
export type DailyTop5 =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      prompt: string | null
      mine: Top5View | null
      theirs: Top5View | { locked: true } | null
    }

// Sketch: a question about the setter ("comfort food"), their drawing of the answer,
// and three guesses at what they wrote. The drawing is the whole puzzle, so it's never
// hidden; the answer is, until it's guessed or the guesses run out.
export type SketchView = {
  id: string
  forDate: string
  kind: 'sketch'
  prompt: string // bare noun phrase — "Your …" to the setter, "Sam's …" to the solver
  strokes: DrawStroke[]
  guesses: string[]
  status: 'open' | 'solved' | 'failed'
  answer: string | null
}

export type DailySketch =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      prompt: string | null
      mine: SketchView | null
      theirs: SketchView | { locked: true } | null
    }

// Why a call failed, in words the app can show. 'setup' means the project isn't ready
// (the migration hasn't been run, or anonymous sign-ins are off) — that's a problem for
// whoever runs the project, not the person holding the phone.
export class DailyError extends Error {
  constructor(message: string, readonly kind: 'setup' | 'offline' | 'input') {
    super(message)
  }
}

let client: SupabaseClient | null = null
function sb(): SupabaseClient {
  // Created on first use, so nothing touches the network until the Today tab needs it.
  client ??= createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return client
}

// Each phone is an anonymous user, created once and remembered by supabase-js in local
// storage. No email, no password — pairing is what ties two of them together.
//
// Shared across callers: the Today tab fires several calls at once on first open, and
// if each signed in separately the phone would become several different people — one
// of whom is paired and the rest of whom aren't.
let signingIn: Promise<void> | null = null
function signedIn(): Promise<void> {
  signingIn ??= signIn().finally(() => { signingIn = null })
  return signingIn
}

async function signIn(): Promise<void> {
  const { data } = await sb().auth.getSession()
  if (data.session) return
  const { error } = await sb().auth.signInAnonymously()
  if (error) {
    if ((error as { code?: string }).code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(error.message)) {
      throw new DailyError('Anonymous sign-ins are switched off in Supabase.', 'setup')
    }
    throw new DailyError("Couldn't reach the server.", 'offline')
  }
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  await signedIn()
  const { data, error } = await sb().rpc(fn, args)
  if (!error) return data as T
  // PostgREST's "no such function" — the migration hasn't been run on this project.
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new DailyError("The daily puzzle database isn't set up yet.", 'setup')
  }
  if (!error.code && /fetch/i.test(error.message)) throw new DailyError("Couldn't reach the server.", 'offline')
  // Everything else is one of the functions' own refusals — already readable.
  throw new DailyError(friendly(error.message), 'input')
}

function friendly(message: string): string {
  if (/no such code/.test(message)) return "That code didn't work — check it with them?"
  if (/already paired/.test(message)) return "You're already paired."
  if (/already started/.test(message)) return "They've already started it — too late to change."
  if (/five or six letters/.test(message)) return 'It has to be five or six letters.'
  if (/^(five|six) letters/.test(message)) return `It has to be ${message.split(' ')[0]} letters.`
  if (/answer yours first/.test(message)) return 'Answer yours first.'
  if (/target out of range/.test(message)) return "That mark isn't on the scale."
  if (/1 to 40 characters/.test(message)) return 'One word — up to 40 characters.'
  if (/guess out of range/.test(message)) return "That's off the end of the scale."
  if (/five items/.test(message)) return 'That needs to be five things.'
  if (/not a ranking/.test(message)) return 'Every rank, once each.'
  if (/1 to 30 characters/.test(message)) return 'A word or two — up to 30 characters.'
  if (/draw something/.test(message)) return 'Draw something first.'
  if (/drawing is too big/.test(message)) return "That drawing's too busy to send — undo a few lines."
  return message
}

export const api = {
  daily: (today: string) => rpc<Daily>('daily', { p_today: today }),
  createCouple: (name: string) => rpc<string>('create_couple', { p_name: name }),
  joinCouple: (code: string, name: string) => rpc<void>('join_couple', { p_code: code, p_name: name }),
  leaveCouple: () => rpc<void>('leave_couple'),
  setWord: (forDate: string, prompt: string, answer: string) =>
    rpc<void>('set_word', { p_for_date: forDate, p_prompt: prompt, p_answer: answer }),
  submitGuess: (puzzleId: string, guess: string) =>
    rpc<PuzzleView>('submit_guess', { p_puzzle: puzzleId, p_guess: guess }),
  dailyDial: (today: string) => rpc<DailyDial>('daily_dial', { p_today: today }),
  setDial: (forDate: string, prompt: string, target: number, clue: string) =>
    rpc<void>('set_dial', { p_for_date: forDate, p_prompt: prompt, p_target: target, p_clue: clue }),
  submitDial: (puzzleId: string, guess: number) =>
    rpc<DialView>('submit_dial', { p_puzzle: puzzleId, p_guess: guess }),
  dailyTop5: (today: string) => rpc<DailyTop5>('daily_top5', { p_today: today }),
  setTop5: (forDate: string, prompt: string, items: string[], rank: number[]) =>
    rpc<void>('set_top5', { p_for_date: forDate, p_prompt: prompt, p_items: items, p_rank: rank }),
  submitTop5: (puzzleId: string, guess: number[]) =>
    rpc<Top5View>('submit_top5', { p_puzzle: puzzleId, p_guess: guess }),
  dailySketch: (today: string) => rpc<DailySketch>('daily_sketch', { p_today: today }),
  setSketch: (forDate: string, prompt: string, answer: string, strokes: DrawStroke[]) =>
    rpc<void>('set_sketch', { p_for_date: forDate, p_prompt: prompt, p_answer: answer, p_strokes: strokes }),
  submitSketch: (puzzleId: string, guess: string) =>
    rpc<SketchView>('submit_sketch', { p_puzzle: puzzleId, p_guess: guess }),
}
