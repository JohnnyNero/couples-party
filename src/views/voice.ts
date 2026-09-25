import type { PlayerId, SessionState } from '../engine/state'
import { other } from '../engine/state'
import { say } from '../say'
import { playerName } from './list'

// Our questions can name one of you with {player}; the app decides who, per game.
// Built-in cards never use it, so for them these just hand the text back.

// Mr & Mrs: each of you answers about yourself, so {player} is whoever's reading.
export function aboutReader(s: SessionState, text: string, reader: PlayerId | null): string {
  if (!text.includes('{player}')) return text
  const p = reader ?? seatFor(s)
  return say(text, { self: false, subject: playerName(s, p), partner: playerName(s, p) })
}

// Put a Finger Down: "…if {player} has seen you cry" — the other one of you.
export function aboutPartner(s: SessionState, text: string, reader: PlayerId | null): string {
  if (!text.includes('{player}')) return text
  const p = reader ? other(reader) : seatFor(s)
  return say(text, { self: false, subject: playerName(s, p), partner: playerName(s, p) })
}

// Lights Out, Category Clash, Wavelength: one card both of you read the same way, so the
// session picks one of you (fixed by its seed, so both phones agree).
export function aboutOne(s: SessionState, text: string): string {
  if (!text.includes('{player}')) return text
  const name = playerName(s, seatFor(s))
  return say(text, { self: false, subject: name, partner: name })
}

const seatFor = (s: SessionState): PlayerId => (s.seed % 2 === 0 ? 'A' : 'B')
