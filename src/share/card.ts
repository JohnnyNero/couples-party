import type { PlayerId, SessionState } from '../engine/state'
import { gameScores, PER_GAME, standing, teamScore } from '../engine/standing'
import { FILLER_KEYS, GAME_LABELS, SESSION_NAMES } from '../engine/roster'
import { dailyNumber } from './daily'

// The couple share card: one summary of a finished session, as a few lines of text for
// a group chat and as a tall image for a Story. It gives away nothing anyone could spoil
// (no answers, no words, nothing either of you wrote) — just who took each game, how you
// did together, and a name for it.

export type CardRow = { label: string; winner: PlayerId | null; together: number | null }
export type CardData = {
  label: string
  names: Record<PlayerId, string>
  scores: Record<PlayerId, number>
  together: number
  tier: string | null
  rows: CardRow[]
}

// Together, named kindly — every tier is one you'd be happy to post. Measured against an
// average couple, who scores PER_GAME.us together in each game (see standing.ts).
export function tierFor(together: number, games: number): string | null {
  if (games === 0) return null
  const r = together / (PER_GAME.us * games)
  if (r >= 1.5) return 'Frighteningly us'
  if (r >= 1.15) return 'Same brain'
  if (r >= 0.85) return 'In sync'
  if (r >= 0.5) return 'Warming up'
  return 'Beautifully different'
}

const TEAMLESS = new Set([...FILLER_KEYS, 'decider'])

function labelFor(s: SessionState, date: Date, replay: boolean): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
  // Tonight is numbered — the same set for every couple that day.
  if (s.game === 'tonight') return `Today #${dailyNumber(s.night)}${replay ? ' · replay' : ''}`
  const name = SESSION_NAMES[s.game] ?? GAME_LABELS[s.game as keyof typeof GAME_LABELS] ?? 'Coupled'
  return `${name} · ${day}`
}

export function summarise(s: SessionState, { date = new Date(), replay = false }: { date?: Date; replay?: boolean } = {}): CardData {
  const played = gameScores(s).filter((g) => g.played)
  const teamGames = played.filter((g) => !TEAMLESS.has(g.key))
  const together = teamScore(s)
  return {
    label: labelFor(s, date, replay),
    names: { A: s.players.A.name || 'A', B: s.players.B.name || 'B' },
    scores: standing(s),
    together,
    tier: tierFor(together, teamGames.length),
    rows: played.map((g) => ({
      label: g.label,
      winner: g.points.A === g.points.B ? null : g.points.A > g.points.B ? 'A' : 'B',
      together: TEAMLESS.has(g.key) ? null : g.team,
    })),
  }
}

// Coral for seat A, blue for B, as everywhere else in the app.
const WON: Record<PlayerId | 'level', string> = { A: '🔴', B: '🔵', level: '⚪' }
const togetherSquare = (t: number) => (t >= PER_GAME.us * 1.2 ? '🟩' : t >= PER_GAME.us * 0.6 ? '🟨' : '⬜')

export const SITE = 'johnnynero.github.io/couples-party'

// The group-chat version: short, readable at a glance, and only a quiet link at the end.
export function cardText(d: CardData): string {
  const won = d.rows.map((r) => WON[r.winner ?? 'level']).join('')
  const team = d.rows.filter((r) => r.together !== null).map((r) => togetherSquare(r.together!)).join('')
  const lines = [
    `Coupled · ${d.label}`,
    `${d.names.A} ${d.scores.A} – ${d.scores.B} ${d.names.B}`,
    won && `${won} who took each game`,
    team && `${team} together ${d.together}${d.tier ? ` · ${d.tier}` : ''}`,
    SITE,
  ]
  return lines.filter(Boolean).join('\n')
}
