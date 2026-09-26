import { useEffect, useState } from 'react'
import { initNet, getIsStreamScreen, useSession, useMyPlayerId, dispatch } from './net'
import { useThemeSync } from './views/ThemeToggle'
import { refreshProfile, useProfile } from './profile/store'
import { recordSeen } from './store/seen'
import { useKeepMemory } from './memories/useKeepMemory'
import { api } from './daily/api'
import { resolveMode, resolveGame, stampMode, type PlayMode, type Game } from './start/mode'
import { ModePicker } from './start/ModePicker'
import { Home } from './start/Home'
import { Invite } from './start/Invite'
import { Logo } from './ui/Logo'
import { readDeviceLink, readInvite } from './start/invite'
import { DeviceLink } from './start/DeviceLink'
import { Screen } from './screen/Screen'
import { Play } from './play/Play'
import { Duo } from './duo/Duo'
import { leaveTo, useBackLayer } from './ui/back'
import { loadSaved, useKeepProgress, type Saved } from './store/progress'

export default function App() {
  // Game and mode both come from the URL (a shared link carries both) or the launch
  // screens in sequence — what you're playing (the home screen), then how.
  const [mode, setMode] = useState<PlayMode | null>(() => resolveMode(window.location.search))
  const [game, setGame] = useState<Game | null>(() => resolveGame(window.location.search))
  const [ready, setReady] = useState(false)
  // Carrying on a saved game (Home's "Carry on"), or reloading the page mid-game: this
  // phone's copy of it, for the room to pick up if it's the first one back in.
  const [resume, setResume] = useState<Saved | null>(() => {
    const saved = loadSaved()
    return saved && saved.game === game && saved.mode === mode ? saved : null
  })
  // An invite link (?pair=CODE&from=Name) opens on its own welcome page first.
  const [invite, setInvite] = useState(() => readInvite(window.location.search))
  // …and a device link (?device=CODE&from=Name) on a page that makes this device you.
  const [deviceLink, setDeviceLink] = useState(() => readDeviceLink(window.location.search))
  useThemeSync()
  // From Home, a game (its mode picker, then the game itself) is one step in: back from
  // the picker returns Home, and back from a game that's over leaves it for Home too.
  // Mid-game, back pauses instead (see GameHeader) — this only answers once that's gone.
  useBackLayer(!!game, () => {
    if (mode) leaveTo(window.location.pathname)
    else setGame(null)
  })

  useEffect(() => {
    if (!mode || !game) return
    // Paired phones skip Playroom's own room-code lobby and join straight into their
    // couple's own room — but only for the ordinary two-phones case, and only when
    // this load isn't itself a shared link (Playroom's own share link carries the
    // room to join as "#r=CODE" in the hash, and that must win). A failed lookup
    // never holds the game up — it just falls back to Playroom's usual lobby.
    const sharedLink = /(?:^|[#&])r=/.test(window.location.hash)
    const wantsCode = mode === 'duo' && !sharedLink
    ;(wantsCode ? api.coupleCode().catch(() => null) : Promise.resolve(null)).then((code) => {
      initNet(mode, game, code ?? undefined, resume).then(() => setReady(true))
    })
  }, [mode, game])

  return (
    <>
      {ready && <SeenRecorder keep={mode !== 'solo' && !getIsStreamScreen()} mode={mode!} />}
      {renderApp()}
    </>
  )

  function renderApp() {
    if (deviceLink && !game) return <DeviceLink link={deviceLink} onDone={() => setDeviceLink(null)} />
    if (invite && !game) return <Invite invite={invite} onDone={() => setInvite(null)} />
    if (!game) {
      return (
        <Home
          onPick={(g) => { setResume(null); setGame(g) }}
          onJoin={(g, m) => {
            stampMode(m, g, false)
            setResume(null)
            setMode(m)
            setGame(g)
          }}
          onResume={(saved) => {
            stampMode(saved.mode, saved.game, false)
            setResume(saved)
            setMode(saved.mode)
            setGame(saved.game)
          }}
        />
      )
    }
    if (!mode) {
      return (
        <ModePicker
          game={game}
          onBack={() => setGame(null)}
          onPick={(m, bot) => {
            // stampMode writes ?mode and ?game into the URL BEFORE initNet, so Playroom's
            // share link (location.href + #r=CODE) carries both to the joining device.
            stampMode(m, game, !!bot)
            setMode(m)
          }}
        />
      )
    }
    if (!ready) return <Connecting />
    if (mode === 'screen') return getIsStreamScreen() ? <Screen /> : <Play />
    // Duo and solo share a layout: the board on top, your own controller underneath.
    return <Duo />
  }
}

// Logs every prompt the session puts in front of you, so the next one draws new ones —
// and, on a paired phone, keeps the session for Memories. A TV isn't anyone's phone and
// solo play is a testing seat, so neither keeps anything.
function SeenRecorder({ keep, mode }: { keep: boolean; mode: PlayMode }) {
  const session = useSession()
  useKeepProgress(session, useMyPlayerId(), mode, keep)
  useEffect(() => recordSeen(session), [session])
  useKeepMemory(session, keep)
  useProfileName(keep)
  return null
}

function Connecting() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <Logo className="w-20 animate-pulse" />
      <div className="font-display text-xl font-bold text-fg/50">Getting the room ready…</div>
    </div>
  )
}

// In a game, a paired phone goes by the name on its profile rather than whatever
// Playroom picked — so the game says "Roxx", not "Player 2", and every avatar can find
// its photo (photos are matched by name). A JOIN from a seat already taken only
// renames it; it doesn't restart anything.
function useProfileName(enabled: boolean) {
  const session = useSession()
  const me = useMyPlayerId()
  const profile = useProfile()
  useEffect(() => { if (enabled) void refreshProfile() }, [enabled])
  const name = profile?.state === 'paired' ? profile.me.name : null
  const current = me ? session.players[me] : null
  useEffect(() => {
    if (!enabled || !me || !name || !current?.connected || current.name === name) return
    dispatch({ type: 'JOIN', player: me, name })
  }, [enabled, me, name, current?.connected, current?.name])
}
