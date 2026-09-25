import type { Game, GameKey, Phase } from './state'

// What each kind of session actually plays, in order, and how long each game runs in it.
// This is the only place a session's shape is decided — the reducer walks it and the
// scoreboard reads it, so adding a game to Tonight is a one-line change here.

export type RosterEntry = { key: GameKey; rounds: number }

const ROSTERS: Record<Game, RosterEntry[]> = {
  // The long night: every scored game, then a card to end on. Round counts are what the
  // scoring was balanced against — see SCORING in standing.ts before changing one.
  full: [
    { key: 'list', rounds: 2 }, // two acts, roles swapped
    { key: 'likely', rounds: 6 },
    { key: 'finger', rounds: 5 },
    { key: 'wave', rounds: 7 },
    { key: 'mrmrs', rounds: 5 },
    { key: 'draw', rounds: 6 },
    { key: 'lights', rounds: 1 },
  ],
  // Tonight rotates — see tonight() below; this entry is never read.
  tonight: [],
  // A single game on its own runs at its full-session length.
  list: [{ key: 'list', rounds: 2 }],
  likely: [{ key: 'likely', rounds: 6 }],
  finger: [{ key: 'finger', rounds: 5 }],
  mrmrs: [{ key: 'mrmrs', rounds: 5 }],
  wave: [{ key: 'wave', rounds: 7 }],
  draw: [{ key: 'draw', rounds: 6 }],
}

// Tonight: four quick games before bed, then a question to turn the light off on. The
// five candidates keep this order; each night leaves a different one out, so the same
// mix comes round only every fifth night. Shortlist never plays here — it needs both
// acts to be fair, and that's most of the night on its own.
const TONIGHT_POOL: RosterEntry[] = [
  { key: 'likely', rounds: 4 },
  { key: 'finger', rounds: 3 },
  { key: 'wave', rounds: 2 }, // one each as the psychic
  { key: 'mrmrs', rounds: 2 },
  { key: 'draw', rounds: 2 }, // one drawing each
]

function tonight(night: number): RosterEntry[] {
  const out = ((night % TONIGHT_POOL.length) + TONIGHT_POOL.length) % TONIGHT_POOL.length
  return [...TONIGHT_POOL.filter((_, i) => i !== out), { key: 'lights', rounds: 1 }]
}

// `night` only matters to Tonight: the day number the host started the session on
// (dayIndex of its local date), carried in the session so both phones agree.
export function roster(game: Game, night = 0): RosterEntry[] {
  return game === 'tonight' ? tonight(night) : ROSTERS[game]
}

type RosterOf = { game: Game; night?: number }

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
  if (phase === 'LIGHTS_OUT') return 'lights'
  return null
}

export const GAME_LABELS: Record<GameKey, string> = {
  list: 'Shortlist',
  likely: "Who's More Likely",
  finger: 'Put a Finger Down',
  mrmrs: 'Mr & Mrs',
  wave: 'Wavelength',
  draw: 'Draw Your Answer',
  lights: 'Lights Out',
}
