import type { Game } from '../engine/state'
export type { Game } from '../engine/state'

// The play mode is chosen once (launch picker or a shared link's ?mode= param) and
// determines how the transport is initialised. It lives in the URL query string so
// Playroom's share link — which is `location.href` up to the hash + "#r=CODE" —
// carries it to the joining device.
// 'solo' is a testing seat: one device, a bot in the other chair, and no network at all.
export type PlayMode = 'screen' | 'duo' | 'solo'

export function resolveMode(search: string): PlayMode | null {
  const m = new URLSearchParams(search).get('mode')
  return m === 'screen' || m === 'duo' || m === 'solo' ? m : null
}

// Which acts to run this session — rides alongside ?mode= for the same reason (a shared
// link must agree with the host before either side calls initNet).
export function resolveGame(search: string): Game | null {
  const g = new URLSearchParams(search).get('game')
  return g === 'full' || g === 'meld' || g === 'list' || g === 'finger' || g === 'wave' ? g : null
}

// The bot flag rides in the URL too. A second human joining a bot room is harmless: the
// bot only claims a seat nobody is sitting in, and only the host runs it at all.
export function resolveBot(search: string): boolean {
  return new URLSearchParams(search).get('bot') === '1'
}

export function stampMode(mode: PlayMode, game: Game, bot = false): void {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  url.searchParams.set('game', game)
  if (bot) url.searchParams.set('bot', '1')
  else url.searchParams.delete('bot')
  window.history.replaceState(null, '', url.toString())
}
