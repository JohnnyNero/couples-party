// This is the ONLY file that imports `playroomkit`. Every other module talks to the
// network through the functions exported here.
import {
  insertCoin,
  isHost,
  isStreamScreen,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
  getState,
  setState,
  getRoomCode,
  RPC,
  type PlayerState,
} from 'playroomkit'
import type { Action, PlayerId, SessionState } from '../engine/state'
import { initialState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { loadPacks } from '../packs'
import { assignPlayerId, getPlayerId } from './ids'
import type { PlayMode } from '../start/mode'

const SESSION_KEY = 'session'

let seedWords: string[] = []
let houseForfeits: string[] = []
let started = false

// Ruling P2: the per-session seed pair must vary across plays, so it is generated ONCE
// per session by the host via Math.random (never inside the reducer/engine) and then
// broadcast to every client as part of the initial session state.
let sessionSeed: number | null = null

function ensureSessionSeed(): number {
  if (sessionSeed === null) sessionSeed = Math.floor(Math.random() * 1e9)
  return sessionSeed
}

// Authoritative state factory. Only ever called on the host: for the initial broadcast,
// the RPC dispatch handler's fallback, and the local dispatch() fallback when this client
// is itself the host.
function hostFreshState(): SessionState {
  return initialState(ensureSessionSeed(), seedWords, houseForfeits)
}

// Non-authoritative placeholder used only as the useMultiplayerState default before the
// host's real (seeded) session state has synced. Deliberately does not touch Math.random.
function placeholderState(): SessionState {
  return initialState(0, seedWords, houseForfeits)
}

export async function initNet(mode: PlayMode): Promise<void> {
  if (started) return
  started = true

  const packs = await loadPacks()
  seedWords = packs.seedWords
  houseForfeits = packs.houseForfeits

  // Screen mode = Playroom Stream Mode (TV is the stream screen, phones are
  // controllers). Duo mode = regular multiplayer (both devices are equal players,
  // no stream screen). The reducer/host wiring below is identical either way.
  await insertCoin(
    mode === 'screen'
      ? { streamMode: true, maxPlayersPerRoom: 2 }
      : { maxPlayersPerRoom: 2 },
  )

  // Ruling P1: Playroom collects each player's name at join, so JOIN is dispatched
  // automatically here (host-guarded) instead of via a name-entry UI.
  onPlayerJoin((player: PlayerState) => {
    const id = assignPlayerId(player.id, getRoomCode())
    if (isHost()) {
      const current = (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState()
      const name = player.getProfile().name || id
      setState(SESSION_KEY, reduce(current, { type: 'JOIN', player: id, name }, Date.now()), true)
    }
    player.onQuit(() => {
      // Reconnection hardening is out of scope for M0 (tracked for M5).
    })
  })

  if (isHost()) {
    setState(SESSION_KEY, (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState(), true)

    RPC.register('dispatch', async (action: Action) => {
      const current = (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState()
      setState(SESSION_KEY, reduce(current, action, Date.now()), true)
      return null
    })

    // Host timer loop: fire TIMEOUT once the current phase's deadline has passed.
    setInterval(() => {
      const current = getState(SESSION_KEY) as SessionState | undefined
      if (!current || current.phaseEndsAt == null) return
      if (Date.now() >= current.phaseEndsAt) {
        setState(SESSION_KEY, reduce(current, { type: 'TIMEOUT' }, Date.now()), true)
      }
    }, 200)
  }
}

export function useSession(): SessionState {
  const [session] = useMultiplayerState<SessionState>(SESSION_KEY, placeholderState())
  return session
}

export function dispatch(action: Action): void {
  if (isHost()) {
    const current = (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState()
    setState(SESSION_KEY, reduce(current, action, Date.now()), true)
  } else {
    void RPC.call('dispatch', action, RPC.Mode.HOST)
  }
}

// Plain function (not a hook): only meaningful in screen mode, and only called after
// initNet has run, so it never touches Playroom before insertCoin.
export function getIsStreamScreen(): boolean {
  return isStreamScreen()
}

export function useMyPlayerId(): PlayerId | null {
  const me = myPlayer()
  return me ? getPlayerId(me.id, getRoomCode()) : null
}
