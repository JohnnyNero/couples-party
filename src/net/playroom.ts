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
import type { Action, Content, Game, PlayerId, SessionState } from '../engine/state'
import { EMPTY_CONTENT, initialState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { loadPacks } from '../packs'
import { freshen } from '../store/seen'
import { assignPlayerId, getPlayerId } from './ids'
import { dayIndex, localDate } from '../daily/dates'
import type { PlayMode } from '../start/mode'

const SESSION_KEY = 'session'

let content: Content = EMPTY_CONTENT
let game: Game = 'full'
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
  return initialState(ensureSessionSeed(), game, content, dayIndex(localDate()))
}

// Non-authoritative placeholder used only as the useMultiplayerState default before the
// host's real (seeded) session state has synced. Deliberately does not touch Math.random.
function placeholderState(): SessionState {
  return initialState(0, game, content)
}

export async function initNet(mode: PlayMode, chosenGame: Game, roomCode?: string): Promise<void> {
  if (started) return
  started = true
  game = chosenGame

  // Only the host's copy matters — it builds the session — but every phone trims its
  // pools to what it hasn't seen yet; see store/seen.
  content = freshen(await loadPacks())

  // Screen mode = Playroom Stream Mode (TV is the stream screen, phones are
  // controllers). Duo mode = regular multiplayer (both devices are equal players,
  // no stream screen). The reducer/host wiring below is identical either way.
  //
  // roomCode + skipLobby: a paired couple's own code (see api.coupleCode), so both
  // phones land in the same room without Playroom's own share-a-link lobby screen —
  // that's the whole point of already being paired. Unpaired phones get no roomCode
  // and see Playroom's usual lobby, unchanged.
  await insertCoin({
    ...(mode === 'screen' ? { streamMode: true } : {}),
    maxPlayersPerRoom: 2,
    ...(roomCode ? { roomCode, skipLobby: true } : {}),
  })

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

// Plain functions (not hooks): only called after initNet has run, so they never touch
// Playroom before insertCoin.
export function getIsStreamScreen(): boolean {
  return isStreamScreen()
}

// The authority. Anything that acts on its own — the timer loop, the bot — runs here and
// nowhere else, or every client does it at once.
export function getIsHost(): boolean {
  return isHost()
}

export function useMyPlayerId(): PlayerId | null {
  const me = myPlayer()
  return me ? getPlayerId(me.id, getRoomCode()) : null
}
