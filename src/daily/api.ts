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

// Their Numbers: five questions about the setter, their whole-number answers, and the
// solver's five guesses, each marked exact, close or off. The questions are never
// hidden; the answers are, until the guesses are in.
export type NumbersMark = 'exact' | 'close' | 'off'
export type NumbersView = {
  id: string
  forDate: string
  kind: 'numbers'
  questions: string[]
  answers: number[] | null
  guesses: number[] | null
  marks: NumbersMark[] | null
  status: 'open' | 'solved'
}

export type DailyNumbers =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      questions: string[] | null // the day's five, once either of you has answered
      mine: NumbersView | null
      theirs: NumbersView | { locked: true } | null
    }

// This or That: five either/ors ("Tea | Coffee"), the setter's picks (0 for the first
// of each pair, 1 for the second) and the solver's predictions. The pairs are never
// hidden; the picks are, until the predictions are in.
export type EitherView = {
  id: string
  forDate: string
  kind: 'either'
  questions: string[]
  answers: number[] | null
  guesses: number[] | null
  matches: number | null
  status: 'open' | 'solved'
}

// The Today board: every kind at once. For each, `solve` is your partner's puzzle for
// you today, `mine` is yours for them today, `next` is what you've set them for
// tomorrow. Finished puzzles carry `points` (out of 10) for whoever solved them.
type Scored = { points: number | null }
export type BoardKinds = {
  word: { solve: (PuzzleView & Scored) | null; mine: (PuzzleView & Scored) | null; next: (PuzzleView & Scored) | null }
  dial: { solve: (DialView & Scored) | null; mine: (DialView & Scored) | null; next: (DialView & Scored) | null }
  top5: { solve: (Top5View & Scored) | null; mine: (Top5View & Scored) | null; next: (Top5View & Scored) | null }
  sketch: { solve: (SketchView & Scored) | null; mine: (SketchView & Scored) | null; next: (SketchView & Scored) | null }
  numbers: { solve: (NumbersView & Scored) | null; mine: (NumbersView & Scored) | null; next: (NumbersView & Scored) | null }
  // Missing on a server without migration 0017.
  either?: { solve: (EitherView & Scored) | null; mine: (EitherView & Scored) | null; next: (EitherView & Scored) | null }
}
export type Board =
  | { state: 'single' }
  | { state: 'waiting'; code: string; me: string }
  | {
      state: 'paired'
      me: string
      partner: string
      kinds: BoardKinds
      today: { me: number; them: number }
      total: { me: number; them: number }
      streak: number
      // From board_stats (migration 0016); null on a server without it.
      stats?: BoardStats | null
    }

// The week (the crown resets each Monday), your best day together, and how many of the
// last seven days you both played.
export type BoardStats = {
  week: { me: number; them: number }
  lastWeek: { me: number; them: number }
  bestDay: number
  daysLast7: number
}

// One saved night, for the records page: names and scores by seat (A/B), since which
// seat was whose can change from night to night.
export type RecordRow = {
  playedOn: string
  game: string
  players: { A: string; B: string }
  score: { A: number; B: number }
  team?: number | null
  finished?: boolean | null
  games?: { label: string; points: { A: number; B: number }; team?: number }[] | null
  longestChain?: number | null
}

// Your partner waiting for you in a game's lobby (see nudge).
export type Nudge = { game: string; mode: 'duo' | 'screen'; at: string; from: string }

// Memories: the live sessions you've played together, and your past daily puzzles.
// A puzzle carries `mine` (you set it) alongside its usual view.
export type Memories =
  | { state: 'single' }
  | { state: 'waiting' }
  | {
      state: 'paired'
      me: string
      partner: string
      since: string // the oldest day this window covers
      sessions: { key: string; playedOn: string; payload: unknown }[]
      puzzles: Array<(PuzzleView | DialView | Top5View | SketchView | NumbersView | EitherView) & { mine: boolean; points?: number | null }>
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
  if (/five whole numbers/.test(message)) return 'Whole numbers, 0 to 9999, all five.'
  if (/five pairs/.test(message)) return 'That needs five pairs.'
  if (/pick one of each/.test(message)) return 'Pick one of each pair.'
  if (/another device/.test(message)) return "That's this device's own code — type it on the other one."
  if (/already linked/.test(message)) return 'This device is already linked to someone.'
  if (/2 to 120 characters/.test(message)) return 'A few words — up to 120 characters.'
  if (/already on the list/.test(message)) return "That one's already on your list."
  if (/two ends/.test(message)) return 'A scale needs two ends — like Cringe and Cool.'
  if (/plenty of ideas/.test(message)) return "That's plenty — take some off first."
  if (/1 to 24 characters/.test(message)) return 'A name, up to 24 characters.'
  if (/photo is too big/.test(message)) return "That photo's too big — try another."
  if (/drawing is too big/.test(message)) return "That drawing's too busy to send — undo a few lines."
  return message
}

// You and your partner, for the profile page and every avatar — from migration 0013.
export type Person = { name: string; photo: string | null }
// `linked`: this device was linked to you from another one (migration 0015);
// `devices`: how many other devices you have linked.
export type Profile =
  | { state: 'single'; linked?: boolean }
  | { state: 'waiting'; code: string | null; me: Person; linked?: boolean; devices?: number }
  | { state: 'paired'; me: Person; partner: Person; since: string; linked?: boolean; devices?: number }

// Our questions: the couple's own cards for the games — from migration 0014.
export type IdeaKind = 'mrmrs' | 'finger' | 'lights' | 'wave' | 'clash' | 'word' | 'meld' | 'describe'
export type Idea = { id: string; kind: IdeaKind; text: string; mine: boolean; createdAt: string }

export const api = {
  ideas: () => rpc<Idea[]>('ideas'),
  addIdea: (kind: IdeaKind, text: string) => rpc<Idea>('add_idea', { p_kind: kind, p_text: text }),
  deleteIdea: (id: string) => rpc<void>('delete_idea', { p_id: id }),
  profile: () => rpc<Profile>('profile'),
  setName: (name: string) => rpc<void>('set_name', { p_name: name }),
  setPhoto: (photo: string | null) => rpc<void>('set_photo', { p_photo: photo }),
  linkCode: () => rpc<string>('link_code'),
  linkDevice: (code: string) => rpc<void>('link_device', { p_code: code }),
  unlinkDevice: () => rpc<void>('unlink_device'),
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
  board: (today: string) => rpc<Board>('board', { p_today: today }),
  boardStats: (today: string) => rpc<({ state: 'paired' } & BoardStats) | { state: 'single' | 'waiting' }>('board_stats', { p_today: today }),
  coupleCode: () => rpc<string | null>('my_couple_code'),
  saveMoment: (key: string, playedOn: string, payload: unknown) =>
    rpc<void>('save_moment', { p_session_key: key, p_played_on: playedOn, p_payload: payload }),
  memories: (today: string, before?: string) =>
    rpc<Memories>('memories', { p_today: today, ...(before ? { p_before: before } : {}), p_days: 30 }),
  streak: (today: string) => rpc<number>('streak', { p_today: today }),
  dailyNumbers: (today: string) => rpc<DailyNumbers>('daily_numbers', { p_today: today }),
  setNumbers: (forDate: string, questions: string[], answers: number[]) =>
    rpc<void>('set_numbers', { p_for_date: forDate, p_questions: questions, p_answers: answers }),
  submitNumbers: (puzzleId: string, guesses: number[]) =>
    rpc<NumbersView>('submit_numbers', { p_puzzle: puzzleId, p_guesses: guesses }),
  // The questions your partner already set for a day, kind by kind (migration 0018).
  dayPrompts: (date: string) =>
    rpc<Partial<Record<'word' | 'dial' | 'top5' | 'sketch' | 'numbers' | 'either', { prompt?: string; items?: string[]; questions?: string[] }>>>('day_prompts', { p_date: date }),
  // Nudging your partner into a game from its lobby (migration 0019).
  nudge: (game: string, mode: string) => rpc<void>('nudge', { p_game: game, p_mode: mode }),
  clearNudge: () => rpc<void>('clear_nudge'),
  nudged: () => rpc<Nudge | null>('nudged'),
  // Every saved night, trimmed to the scores (migration 0020).
  records: () => rpc<RecordRow[]>('records'),
  setEither: (forDate: string, questions: string[], picks: number[]) =>
    rpc<void>('set_either', { p_for_date: forDate, p_questions: questions, p_answers: picks }),
  submitEither: (puzzleId: string, guesses: number[]) =>
    rpc<EitherView>('submit_either', { p_puzzle: puzzleId, p_guesses: guesses }),
}

// One box for any code: a device code (from your own Profile, on another device) makes
// this device you; anything else is taken as your partner's pairing code. A server
// without migration 0015 has no device codes, so it goes straight to pairing.
export async function enterCode(code: string, name: string): Promise<'device' | 'couple'> {
  try {
    await api.linkDevice(code)
    return 'device'
  } catch (e) {
    const notADeviceCode = e instanceof DailyError && (e.kind === 'setup' || /didn't work/.test(e.message))
    if (!notADeviceCode) throw e
  }
  await api.joinCouple(code, name)
  return 'couple'
}
