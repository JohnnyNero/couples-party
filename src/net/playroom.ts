// This is the ONLY file that imports `playroomkit`. Every other module talks to the
// network through the functions exported here.
import {
  insertCoin,
  isHost,
  myPlayer,
  onPlayerJoin,
  useMultiplayerState,
  getState,
  setState,
  RPC,
  type PlayerState,
} from 'playroomkit'
import type { Action, Content, Game, PlayerId, SessionState } from '../engine/state'
import { EMPTY_CONTENT, initialState } from '../engine/state'
import { adopt, reduce } from '../engine/reducer'
import type { Saved } from '../store/progress'
import { loadPacks } from '../packs'
import { freshen } from '../store/seen'
import { ideasForGame, withIdeas } from '../ideas/store'
import { claimSeat, type Seats } from './ids'
import { keepChainLists } from '../engine/chain'
import { dayIndex, localDate } from '../daily/dates'
import { dailySeed } from '../share/daily'
import type { Activity, Live } from './live'

const SESSION_KEY = 'session'
// What one of you is doing right now, for the other to watch — a slider mid-drag, a
// guess being typed. Off the game state, and sent unreliably: it's only ever a preview,
// and the next one replaces it.
const LIVE_KEY = 'live'
// Which device sits in which seat — decided by the host, read by everyone (see ids.ts).
const SEATS_KEY = 'seats'
// Each phone's own lasting id, as a player state its partner can read (see deviceKey).
const DEVICE_KEY = 'device'
// Who's in the room right now: Playroom id → that phone's lasting id. Every phone keeps
// this, not just the host, so whichever phone becomes host already knows.
const present = new Map<string, string>()

// Seats are kept against an id this phone keeps for good — not Playroom's, which can be
// a new one every time a phone drops out and comes back. With Playroom's, a phone that
// came back could be seated by whoever asked first, and find itself in its partner's
// chair: their score, their questions.
const STORED_DEVICE = 'coupled:device'
let myKey: string | null = null
function deviceKey(): string {
  if (myKey) return myKey
  try {
    myKey = localStorage.getItem(STORED_DEVICE)
    if (!myKey) {
      myKey = `d${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
      localStorage.setItem(STORED_DEVICE, myKey)
    }
  } catch {
    myKey ??= `d${Math.random().toString(36).slice(2, 12)}`
  }
  return myKey
}

// A player's lasting id, once their phone has shared it — falling back to Playroom's own
// for a phone that never does (an older version of the app).
const keyOf = (player: PlayerState): string | null => (player.getState(DEVICE_KEY) as string | undefined) ?? null
const seatsNow = () => (getState(SEATS_KEY) as Seats | undefined) ?? {}
const presentKeys = () => new Set(present.values())

let content: Content = EMPTY_CONTENT
// What goes in the session: the content, less Word Chain's lists (kept on each phone —
// see keepChainLists).
const sessionContent = (): Content => ({ ...content, chainCategories: keepChainLists(content.chainCategories) })
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
  const content = sessionContent()
  // Tonight is the same for every couple that day: its seed is the day's, not ours.
  const day = dayIndex(localDate())
  return { ...initialState(game === 'tonight' ? dailySeed(day) : ensureSessionSeed(), game, content, day), intros: true }
}

// Non-authoritative placeholder used only as the useMultiplayerState default before the
// host's real (seeded) session state has synced. Deliberately does not touch Math.random.
function placeholderState(): SessionState {
  return initialState(0, game, sessionContent())
}

export async function initNet(chosenGame: Game, roomCode?: string, resume?: Saved | null): Promise<void> {
  if (started) return
  started = true
  game = chosenGame

  // Only the host's copy matters — it builds the session — but every phone trims its
  // pools to what it hasn't seen yet; see store/seen.
  // Not Tonight, though: every couple plays the same one that day (so you can compare),
  // so it's dealt from the full packs, untrimmed, without your own questions mixed in.
  content = game === 'tonight' ? await loadPacks() : freshen(withIdeas(await loadPacks(), await ideasForGame()))

  // Regular multiplayer: both phones are equal players.
  //
  // roomCode + skipLobby: a paired couple's own code (see api.coupleCode), so both
  // phones land in the same room without Playroom's own share-a-link lobby screen —
  // that's the whole point of already being paired. Unpaired phones get no roomCode
  // and see Playroom's usual lobby, unchanged.
  await insertCoin({
    maxPlayersPerRoom: 2,
    ...(roomCode ? { roomCode, skipLobby: true } : {}),
  })
  myPlayer().setState(DEVICE_KEY, deviceKey(), true)

  // Before anyone's seated, so the first JOIN lands in the session that stays. Host at
  // this point normally means the room was empty — your partner isn't in it waiting.
  if (isHost()) {
    const existing = getState(SESSION_KEY) as SessionState | undefined
    const seats = seatsNow()
    if (resume) {
      // Carrying on a saved game: the room's own copy if it still has it, else this
      // phone's. Either way it waits, paused, until you've both joined (see adopt). You
      // sit back down in the seat you had — unless the room already knows this phone,
      // and never by clearing your partner out of theirs.
      const room = existing && existing.seed === resume.state.seed && existing.phase !== 'DONE' ? existing : null
      if (!seats[deviceKey()]) {
        const taken = Object.entries(seats).some(([k, s]) => s === resume.seat && presentKeys().has(k))
        if (!taken) {
          const next: Seats = {}
          for (const [k, s] of Object.entries(seats)) if (s !== resume.seat) next[k] = s
          setState(SEATS_KEY, { ...next, [deviceKey()]: resume.seat }, true)
        }
      }
      setState(SESSION_KEY, adopt(room ?? resume.state, Date.now()), true)
    } else {
      // A new game — unless this phone's only reconnecting to one still going, which
      // it must never wipe.
      const ongoing = existing && existing.game === game && existing.phase !== 'DONE' && !!seats[deviceKey()]
      if (!ongoing) setState(SESSION_KEY, hostFreshState(), true)
    }
  }

  // Ruling P1: Playroom collects each player's name at join, so JOIN is dispatched
  // automatically here (host-guarded) instead of via a name-entry UI. The host also
  // gives the newcomer a seat and tells everyone which it is.
  onPlayerJoin((player: PlayerState) => {
    present.set(player.id, keyOf(player) ?? player.id)
    if (isHost()) seat(player)
    // Gone — backed out, closed the app, lost signal: the game pauses and waits for them
    // (see AWAY). If it was the host who went, another phone takes over as host, so this
    // gives that a moment to happen.
    player.onQuit(() => {
      present.delete(player.id)
      let tries = 0
      const away = () => {
        if (!isHost()) {
          if (++tries < 6) setTimeout(away, 500)
          return
        }
        const k = keyOf(player) ?? player.id
        // Only if that phone isn't already back on another connection.
        const back = [...present.values()].includes(k)
        const seatOf = seatsNow()[k]
        if (seatOf && !back) hostReduce({ type: 'AWAY', player: seatOf })
      }
      setTimeout(away, 300)
    })
  })

  // Every phone listens, but only the host acts — the host can change hands (the host
  // leaving hands it to whoever's left), and the new one has to pick all this up.
  RPC.register('dispatch', async (action: Action) => {
    if (isHost()) hostReduce(action)
    return null
  })

  // Host timer loop: fire TIMEOUT once the current phase's deadline has passed.
  setInterval(() => {
    if (!isHost()) return
    const current = getState(SESSION_KEY) as SessionState | undefined
    if (!current || current.phaseEndsAt == null) return
    if (Date.now() >= current.phaseEndsAt) hostReduce({ type: 'TIMEOUT' })
  }, 200)
}

function hostReduce(action: Action): void {
  const current = (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState()
  setState(SESSION_KEY, reduce(current, action, Date.now()), true)
}

export function useSession(): SessionState {
  const [session] = useMultiplayerState<SessionState>(SESSION_KEY, placeholderState())
  return session
}

export function setLive(value: Live | null): void {
  setState(LIVE_KEY, value, false)
}

export function useLive(): Live | null {
  const [live] = useMultiplayerState<Live | null>(LIVE_KEY, null)
  return live
}

// Each seat writes only its own activity, so the two never overwrite each other.
const activityKey = (p: PlayerId) => `activity:${p}`

export function setActivity(value: Activity | null, seatOverride?: PlayerId): void {
  const seatOf = seatOverride ?? seatsNow()[deviceKey()]
  if (seatOf) setState(activityKey(seatOf), value, false)
}

export function useActivity(p: PlayerId): Activity | null {
  const [value] = useMultiplayerState<Activity | null>(activityKey(p), null)
  return value
}

export function dispatch(action: Action): void {
  if (isHost()) {
    hostReduce(action)
  } else {
    void RPC.call('dispatch', action, RPC.Mode.HOST)
  }
}

// Plain functions (not hooks): only called after initNet has run, so they never touch
// Playroom before insertCoin.
// The authority. Anything that acts on its own — the timer loop, the bot — runs here and
// nowhere else, or every client does it at once.
export function getIsHost(): boolean {
  return isHost()
}

// Your seat, as the host decided it — the same answer on every phone.
export function useMyPlayerId(): PlayerId | null {
  const [seats] = useMultiplayerState<Seats>(SEATS_KEY, {})
  return myPlayer() ? seats?.[deviceKey()] ?? null : null
}

// Host only: seat a player who's just arrived, and JOIN them into the session. Their
// phone shares its lasting id just after it joins, so this waits a moment for it.
function seat(player: PlayerState, tries = 0): void {
  const k = keyOf(player)
  if (!k && tries < 20) {
    setTimeout(() => { if (isHost() && present.has(player.id)) seat(player, tries + 1) }, 150)
    return
  }
  const key = k ?? player.id
  present.set(player.id, key)
  const { seats, seat: mine } = claimSeat(seatsNow(), key, presentKeys())
  setState(SEATS_KEY, seats, true)
  if (!mine) return // a third device: it can watch, not play
  const current = (getState(SESSION_KEY) as SessionState | undefined) ?? hostFreshState()
  const name = player.getProfile().name || mine
  setState(SESSION_KEY, reduce(current, { type: 'JOIN', player: mine, name }, Date.now()), true)
}
