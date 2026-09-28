import type { Game, GameKey, Phase } from './state'
import { makeRng, shuffled } from './rng'

// What each kind of session actually plays, in order, and how long each game runs in it.
// This is the only place a session's shape is decided — the reducer walks it and the
// scoreboard reads it, so adding a game to a session is a one-line change to its kind's pool.

export type RosterEntry = { key: GameKey; rounds: number }

const ROSTERS: Record<Game, RosterEntry[]> = {
  // The long night: every scored game, then a card to end on. Round counts are what the
  // scoring was balanced against — see SCORING in standing.ts before changing one.
  full: [
    { key: 'list', rounds: 2 }, // two acts, roles swapped
    // Who's More Likely is parked for now: it pays you both for agreeing, and every other
    // game is you against each other. It still runs on its own (?game=likely).
    { key: 'finger', rounds: 6 }, // Called It
    { key: 'circle', rounds: 1 }, // filler slot
    { key: 'wave', rounds: 6 }, // three pairs: you each give a clue in every pair
    { key: 'clash', rounds: 3 }, // play slot
    { key: 'clock', rounds: 3 }, // filler slot
    { key: 'mrmrs', rounds: 5 },
    { key: 'chain', rounds: 4 }, // play slot
    { key: 'draw', rounds: 6 },
    { key: 'bluff', rounds: 3 },
    { key: 'describe', rounds: 2 }, // play slot
    { key: 'meld', rounds: 4 },
    { key: 'lights', rounds: 1 },
  ],
  // Tonight rotates, and a quick game is dealt — see below; these entries are never read.
  tonight: [],
  quick: [],
  // A single game on its own runs at its full-session length.
  list: [{ key: 'list', rounds: 2 }],
  likely: [{ key: 'likely', rounds: 6 }],
  finger: [{ key: 'finger', rounds: 8 }],
  mrmrs: [{ key: 'mrmrs', rounds: 5 }],
  wave: [{ key: 'wave', rounds: 6 }],
  draw: [{ key: 'draw', rounds: 6 }],
  clash: [{ key: 'clash', rounds: 3 }],
  chain: [{ key: 'chain', rounds: 4 }],
  bluff: [{ key: 'bluff', rounds: 3 }],
  meld: [{ key: 'meld', rounds: 5 }],
  describe: [{ key: 'describe', rounds: 4 }],
  // A filler on its own is a best of 5.
  circle: [{ key: 'circle', rounds: 5 }],
  clock: [{ key: 'clock', rounds: 5 }],
  spot: [{ key: 'spot', rounds: 5 }],
  frenzy: [{ key: 'frenzy', rounds: 3 }],
  follow: [{ key: 'follow', rounds: 1 }], // sudden death: it runs till one of you slips
  twist: [{ key: 'twist', rounds: 6 }],
  higher: [{ key: 'higher', rounds: 8 }],
  guess: [{ key: 'guess', rounds: 6 }],
}

// Every game is one of three kinds, and a session is built from slots of each kind:
//  - us: about the two of you — knowing, reading or guessing each other;
//  - play: nothing to do with each other — quizzes, wordplay, saying things out loud;
//  - filler: thirty seconds of thumbs, between the bigger games.
// Lights Out is none of them: it's what a night ends on.
export type Kind = 'us' | 'play' | 'filler'
export const KIND: Record<Exclude<GameKey, 'lights'>, Kind> = {
  list: 'us', likely: 'us', finger: 'us', wave: 'us', mrmrs: 'us', draw: 'us', bluff: 'us', meld: 'us',
  clash: 'play', chain: 'play', describe: 'play', twist: 'play', higher: 'play', guess: 'play',
  circle: 'filler', clock: 'filler', spot: 'filler', frenzy: 'filler', follow: 'filler',
}
export const kindOf = (key: GameKey): Kind | null => (key === 'lights' ? null : KIND[key])

// Each kind's pool for the short sessions, at their short lengths. Shortlist never plays
// in them — it needs both acts to be fair, and that's most of a night.
const US_POOL: RosterEntry[] = [
  { key: 'finger', rounds: 4 },
  { key: 'wave', rounds: 2 }, // one each as the psychic
  { key: 'mrmrs', rounds: 2 },
  { key: 'draw', rounds: 2 }, // one drawing each
  { key: 'bluff', rounds: 1 }, // one each
  { key: 'meld', rounds: 2 },
]
const PLAY_POOL: RosterEntry[] = [
  { key: 'clash', rounds: 2 },
  { key: 'chain', rounds: 2 },
  { key: 'describe', rounds: 2 },
  { key: 'twist', rounds: 3 },
  { key: 'higher', rounds: 5 },
  { key: 'guess', rounds: 4 },
]
// The full session's play slots, at full length.
const PLAY_FULL: RosterEntry[] = [
  { key: 'clash', rounds: 3 },
  { key: 'chain', rounds: 4 },
  { key: 'describe', rounds: 2 },
  { key: 'twist', rounds: 4 },
  { key: 'higher', rounds: 6 },
  { key: 'guess', rounds: 5 },
]
const FILLER_POOL: RosterEntry[] = [
  { key: 'clock', rounds: 3 },
  { key: 'spot', rounds: 3 },
  { key: 'circle', rounds: 1 },
  { key: 'follow', rounds: 1 },
  { key: 'frenzy', rounds: 1 },
]

const mod = (a: number, n: number) => ((a % n) + n) % n

// `k` of a pool for this night, taken in turn: every game comes round once a lap
// (pool ÷ k nights), and never two nights running. Each lap starts one place further on,
// so the same games don't keep sharing a night.
function dealt(pool: RosterEntry[], k: number, night: number): RosterEntry[] {
  const n = pool.length
  const start = k * night + Math.floor(night / Math.ceil(n / k))
  return Array.from({ length: Math.min(k, n) }, (_, i) => pool[mod(start + i, n)])
}

// Today: a game to play, a game about you, a filler, another of each, then a question to
// turn the light off on. Ending on one about you two leads into it.
function tonight(night: number): RosterEntry[] {
  const [us1, us2] = dealt(US_POOL, 2, night)
  // A night further on, so which of these meets which of those shifts about too.
  const [play1, play2] = dealt(PLAY_POOL, 2, night + 1)
  const filler = FILLER_POOL[mod(night, FILLER_POOL.length)]
  return [play1, us1, filler, play2, us2, { key: 'lights', rounds: 1 }]
}

// A quick game: three games to play right now, dealt at random — one of each kind, then
// either — with a filler before the last, and no question at the end.
function quick(seed: number): RosterEntry[] {
  const rng = makeRng(seed ^ 0x9a1c)
  const us = shuffled(rng, US_POOL)
  const play = shuffled(rng, PLAY_POOL)
  const first = rng() < 0.5 ? [us[0], play[0]] : [play[0], us[0]]
  const last = rng() < 0.5 ? us[1] : play[1]
  const filler = FILLER_POOL[mod(seed, FILLER_POOL.length)]
  return [...first, filler, last]
}

// `night` only matters to Tonight — the day number the host started the session on
// (dayIndex of its local date) — and to a quick game, whose line-up it deals (it's the
// session's seed there). Carried in the session, so both phones agree.
export function roster(game: Game, night = 0): RosterEntry[] {
  if (game === 'full') return full(night)
  return game === 'tonight' ? tonight(night) : game === 'quick' ? quick(night) : ROSTERS[game]
}

// The long night: every game about you two, in its set places; three of the play games,
// taken in turn; and two fillers, never the same one twice in a night.
function full(night: number): RosterEntry[] {
  const fillers = [FILLER_POOL[mod(night + 2, FILLER_POOL.length)], FILLER_POOL[mod(night, FILLER_POOL.length)]]
  const play = dealt(PLAY_FULL, 3, night)
  let f = 0
  let p = 0
  return ROSTERS.full.map((e) => {
    const kind = kindOf(e.key)
    return kind === 'filler' ? fillers[f++] : kind === 'play' ? play[p++] : e
  })
}

// What each kind of session is called, where a single game would just use its own name.
export const SESSION_NAMES: Record<string, string> = { tonight: 'Today', full: 'The full session', quick: 'A quick game' }

export type RosterOf = { game: Game; night?: number }

export function roundsFor(s: RosterOf, key: GameKey): number {
  return roster(s.game, s.night).find((e) => e.key === key)?.rounds ?? 0
}

// The game after `key` in this session, or null if it was the last.
export function nextGame(s: RosterOf, key: GameKey): GameKey | null {
  const r = roster(s.game, s.night)
  const i = r.findIndex((e) => e.key === key)
  return i >= 0 && i < r.length - 1 ? r[i + 1].key : null
}

// Which game a phase belongs to, read off its prefix. JOIN/DONE belong to none.
export function gameOfPhase(phase: Phase): GameKey | null {
  if (phase.startsWith('LIST_')) return 'list'
  if (phase.startsWith('LIKELY_')) return 'likely'
  if (phase.startsWith('FINGER_')) return 'finger'
  if (phase.startsWith('MM_')) return 'mrmrs'
  if (phase.startsWith('WAVE_')) return 'wave'
  if (phase.startsWith('DRAW_')) return 'draw'
  if (phase.startsWith('CLASH_')) return 'clash'
  if (phase.startsWith('CHAIN_')) return 'chain'
  if (phase.startsWith('BLUFF_')) return 'bluff'
  if (phase.startsWith('MELD_')) return 'meld'
  if (phase.startsWith('DESCRIBE_')) return 'describe'
  if (phase.startsWith('CIRCLE_')) return 'circle'
  if (phase.startsWith('CLOCK_')) return 'clock'
  if (phase.startsWith('SPOT_')) return 'spot'
  if (phase.startsWith('FRENZY_')) return 'frenzy'
  if (phase.startsWith('FOLLOW_')) return 'follow'
  if (phase.startsWith('TWIST_')) return 'twist'
  if (phase.startsWith('HL_')) return 'higher'
  if (phase.startsWith('GUESS_')) return 'guess'
  if (phase === 'LIGHTS_OUT') return 'lights'
  return null
}

// The quick in-between games: a flat prize to the winner, no team points.
export const FILLER_KEYS: ReadonlySet<string> = new Set<GameKey>((Object.keys(KIND) as GameKey[]).filter((k) => kindOf(k) === 'filler'))
export const isFiller = (key: string) => FILLER_KEYS.has(key)

export const GAME_LABELS: Record<GameKey, string> = {
  list: 'Shortlist',
  likely: "Who's More Likely",
  finger: 'Called It',
  mrmrs: 'Mr & Mrs',
  wave: 'Wavelength',
  draw: 'Draw Your Answer',
  clash: 'Category Clash',
  chain: 'Word Chain',
  bluff: 'Two Lies & a Truth',
  meld: 'Mind Meld',
  describe: 'Describe It',
  circle: 'Perfect Circle',
  clock: 'Stop the Clock',
  spot: 'Spot It',
  frenzy: 'Frenzy',
  follow: 'Follow Me',
  twist: 'Tongue Twisters',
  higher: 'Higher or Lower',
  guess: 'Guesstimate',
  lights: 'Lights Out',
}
