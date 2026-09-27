import type { Action, Game, PlayerId, SessionState } from '../engine/state'
import type { PlayMode } from '../start/mode'
import { loadPacks } from '../packs'
import { freshen } from '../store/seen'
import { ideasForGame, withIdeas } from '../ideas/store'
import { SOLO_PLAYER, initLocal, localDispatch, setLocalActivity, setLocalLive, useLocalActivity, useLocalLive, useLocalSession } from './local'
import type { Activity, ActivityKind, Live } from './live'
import type { Saved } from '../store/progress'
import { buzz } from '../ui/haptics'

export type { Activity, ActivityKind, Live }

// Every client talks to the game through this facade. Solo play runs the reducer in
// process; two-phone play runs it over Playroom. The choice is made once at boot, before
// anything renders, and never changes for the life of the page — so the hooks below
// always take the same branch on every render.
let solo = false
// Playroom is most of the app's size, and only games need it: it's fetched when one
// starts (or ahead of time — see preloadNet), never just for Home.
let playroom: typeof import('./playroom')
const loadPlayroom = () => import('./playroom')

export function preloadNet(): void {
  void loadPlayroom().catch(() => {})
}

export async function initNet(mode: PlayMode, game: Game, roomCode?: string, resume?: Saved | null): Promise<void> {
  solo = mode === 'solo'
  if (!solo) {
    playroom = await loadPlayroom()
    return playroom.initNet(game, roomCode, resume)
  }
  initLocal(game === 'tonight' ? await loadPacks() : freshen(withIdeas(await loadPacks(), await ideasForGame())), game)
}

export function useSession(): SessionState {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `solo` is fixed before first render
  return solo ? useLocalSession() : playroom.useSession()
}

// What you feel when you act: a firm buzz for locking an answer in, a light one for moving
// things on. The bot acts through `dispatch` too, and passes `quiet` — its moves aren't
// yours to feel.
const LOCK = new Set<Action['type']>([
  'SUBMIT_GUESS', 'SUBMIT_CLUE', 'SUBMIT_DRAWING', 'SUBMIT_DRAW_GUESS', 'SUBMIT_CALLED', 'SUBMIT_MRMRS',
  'SUBMIT_CLASH', 'SUBMIT_BLUFF', 'SUBMIT_MELD', 'SUBMIT_CIRCLE', 'PICK_LIKELY', 'PICK_BLUFF', 'PLACE_ITEM',
  'CHAIN_WORD', 'STOP_CLOCK', 'JUDGE', 'CHALLENGE', 'COUNT_IT', 'COUNT_MELD', 'DESCRIBE_GOT',
])
const TAP = new Set<Action['type']>(['READY', 'CONTINUE', 'ADVANCE_REVEAL', 'DESCRIBE_SKIP'])

export function dispatch(action: Action, { quiet = false }: { quiet?: boolean } = {}): void {
  if (!quiet) {
    if (LOCK.has(action.type)) buzz('lock')
    else if (TAP.has(action.type)) buzz('tap')
  }
  if (solo) localDispatch(action)
  else playroom.dispatch(action)
}

// The live preview (see live.ts): set by whoever's solving, watched by the other.
export function setLive(value: Live | null): void {
  if (solo) setLocalLive(value)
  else playroom.setLive(value)
}

export function useLive(key: string): Live['value'] | null {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- as above
  const live = solo ? useLocalLive() : playroom.useLive()
  return live && live.key === key ? live.value : null
}

export function useMyPlayerId(): PlayerId | null {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- as above
  return solo ? SOLO_PLAYER : playroom.useMyPlayerId()
}

// The authority: the client that owns the timers and runs the bot. Solo is its own.
export function getIsHost(): boolean {
  return solo || playroom.getIsHost()
}

// What each of you is up to right now (see live.ts). `seat` is for the bot, which acts
// for the other chair; everyone else only ever sets their own.
export function setActivity(value: Activity | null, seat?: PlayerId): void {
  if (solo) setLocalActivity(seat ?? SOLO_PLAYER, value)
  else playroom.setActivity(value, seat)
}

// Theirs (or yours), but only while it's about the screen you're both on.
export function useActivity(p: PlayerId, screen: string): ActivityKind | null {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `solo` is fixed before first render
  const a = solo ? useLocalActivity(p) : playroom.useActivity(p)
  return a && a.key === screen ? a.kind : null
}
