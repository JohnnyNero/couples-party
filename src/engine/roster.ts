import type { Game, GameKey, Phase } from './state'
import { makeRng, shuffled } from './rng'

// What each kind of session actually plays, in order, and how long each game runs in it.
// This is the only place a session's shape is decided — the reducer walks it and the
// scoreboard reads it, so adding a game to Tonight is a one-line change here.

export type RosterEntry = { key: GameKey; rounds: number }

const ROSTERS: Record<Game, RosterEntry[]> = {
  // The long night: every scored game, then a card to end on. Round counts are what the
  // scoring was balanced against — see SCORING in standing.ts before changing one.
  full: [
    { key: 'list', rounds: 2 }, // two acts, roles swapped
    // Who's More Likely is parked for now: it pays you both for agreeing, and every other
    // game is you against each other. It still runs on its own (?game=likely).
    { key: 'finger', rounds: 6 }, // Called It
    { key: 'circle', rounds: 1 }, // a filler after every second game
    { key: 'wave', rounds: 6 }, // three pairs: you each give a clue in every pair
    { key: 'clash', rounds: 3 },
    { key: 'clock', rounds: 3 }, // best of 3
    { key: 'mrmrs', rounds: 5 },
    { key: 'chain', rounds: 4 },
    { key: 'draw', rounds: 6 },
    { key: 'bluff', rounds: 3 },
    { key: 'meld', rounds: 4 },
    { key: 'describe', rounds: 2 }, // one turn each
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
}

// Tonight: quick games before bed, then a question to turn the light off on. The
// candidates keep this order; when there are more than TONIGHT_GAMES of them, each
// night leaves a different one out, so the mix changes from night to night. Shortlist
// never plays here — it needs both acts to be fair, and that's most of the night.
const TONIGHT_GAMES = 4
const TONIGHT_POOL: RosterEntry[] = [
  { key: 'finger', rounds: 4 },
  { key: 'wave', rounds: 2 }, // one each as the psychic
  { key: 'mrmrs', rounds: 2 },
  { key: 'draw', rounds: 2 }, // one drawing each
  { key: 'clash', rounds: 2 },
  { key: 'chain', rounds: 2 },
  { key: 'bluff', rounds: 1 }, // one each
  { key: 'meld', rounds: 2 },
  { key: 'describe', rounds: 2 },
]

// One quick filler after the second game, each of these in turn.
const TONIGHT_FILLERS: RosterEntry[] = [
  { key: 'clock', rounds: 3 },
  { key: 'spot', rounds: 3 },
  { key: 'circle', rounds: 1 },
  { key: 'follow', rounds: 1 },
  { key: 'frenzy', rounds: 1 },
]

const mod = (a: number, n: number) => ((a % n) + n) % n

function tonight(night: number): RosterEntry[] {
  const n = TONIGHT_POOL.length
  const skip = Math.max(0, n - TONIGHT_GAMES)
  const first = mod(night, n)
  const out = new Set(Array.from({ length: skip }, (_, i) => (first + i) % n))
  const games = TONIGHT_POOL.filter((_, i) => !out.has(i))
  const filler = TONIGHT_FILLERS[mod(night, TONIGHT_FILLERS.length)]
  return [...games.slice(0, 2), filler, ...games.slice(2), { key: 'lights', rounds: 1 }]
}

// A quick game: a handful of games to play right now, dealt at random from Tonight's
// mix — three of them, with a filler before the last — and no question at the end.
const QUICK_GAMES = 3

function quick(seed: number): RosterEntry[] {
  const games = shuffled(makeRng(seed ^ 0x9a1c), TONIGHT_POOL).slice(0, QUICK_GAMES)
  const filler = TONIGHT_FILLERS[mod(seed, TONIGHT_FILLERS.length)]
  return [...games.slice(0, 2), filler, ...games.slice(2)]
}

// `night` only matters to Tonight — the day number the host started the session on
// (dayIndex of its local date) — and to a quick game, whose line-up it deals (it's the
// session's seed there). Carried in the session, so both phones agree.
export function roster(game: Game, night = 0): RosterEntry[] {
  if (game === 'full') return full(night)
  return game === 'tonight' ? tonight(night) : game === 'quick' ? quick(night) : ROSTERS[game]
}

// The long night's two filler slots take their turn from the same list, so they vary
// from night to night too — never the same one twice in a night.
const FULL_FILLERS: GameKey[] = ['circle', 'clock', 'spot', 'follow', 'frenzy']
function full(night: number): RosterEntry[] {
  const n = FULL_FILLERS.length
  const pick = (k: GameKey) => TONIGHT_FILLERS.find((e) => e.key === k)!
  const slots = [pick(FULL_FILLERS[mod(night, n)]), pick(FULL_FILLERS[mod(night + 1, n)])]
  let k = 0
  return ROSTERS.full.map((e) => (e.key === 'circle' || e.key === 'clock' ? slots[k++] : e))
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
  if (phase === 'LIGHTS_OUT') return 'lights'
  return null
}

// The quick in-between games: a flat prize to the winner, no team points.
export const FILLER_KEYS: ReadonlySet<string> = new Set<GameKey>(['circle', 'clock', 'spot', 'frenzy', 'follow'])
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
  lights: 'Lights Out',
}
