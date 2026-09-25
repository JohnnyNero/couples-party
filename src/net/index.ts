import type { Action, Game, PlayerId, SessionState } from '../engine/state'
import type { PlayMode } from '../start/mode'
import { loadPacks } from '../packs'
import { freshen } from '../store/seen'
import { ideasForGame, withIdeas } from '../ideas/store'
import * as playroom from './playroom'
import { SOLO_PLAYER, initLocal, localDispatch, useLocalSession } from './local'

// Every client talks to the game through this facade. Solo play runs the reducer in
// process; screen and duo run it over Playroom. The choice is made once at boot, before
// anything renders, and never changes for the life of the page — so the hooks below
// always take the same branch on every render.
let solo = false

export async function initNet(mode: PlayMode, game: Game, roomCode?: string): Promise<void> {
  solo = mode === 'solo'
  if (!solo) return playroom.initNet(mode, game, roomCode)
  initLocal(freshen(withIdeas(await loadPacks(), await ideasForGame())), game)
}

export function useSession(): SessionState {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `solo` is fixed before first render
  return solo ? useLocalSession() : playroom.useSession()
}

export function dispatch(action: Action): void {
  if (solo) localDispatch(action)
  else playroom.dispatch(action)
}

export function useMyPlayerId(): PlayerId | null {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- as above
  return solo ? SOLO_PLAYER : playroom.useMyPlayerId()
}

// The authority: the client that owns the timers and runs the bot. Solo is its own.
export function getIsHost(): boolean {
  return solo || playroom.getIsHost()
}

export function getIsStreamScreen(): boolean {
  return !solo && playroom.getIsStreamScreen()
}
