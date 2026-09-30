import { lazy, Suspense, useEffect, useState } from 'react'
import { initNet, preloadNet, useSession, useMyPlayerId, dispatch } from './net'
import { useThemeSync } from './views/ThemeToggle'
import { refreshProfile, useProfile } from './profile/store'
import { recordSeen } from './store/seen'
import { useKeepMemory } from './memories/useKeepMemory'
import { api } from './daily/api'
import { resolveMode, resolveGame, stampMode, type PlayMode, type Game } from './start/mode'
import { Home } from './start/Home'
import { Invite } from './start/Invite'
import { Logo } from './ui/Logo'
import { readFriendLink, readInvite } from './start/invite'
import { FriendInvite } from './friends/FriendInvite'
import { finishRedirect } from './auth/account'
import { leaveTo, useBackLayer } from './ui/back'
import { slide } from './ui/transition'
import { useRecordTonight } from './share/tonightResult'
import { loadSaved, useKeepProgress, type Saved } from './store/progress'
import { closeWelcome, markPlayedTogether, markWelcomed, openWelcome, SIGNED_OUT, useWelcome, welcomed } from './onboard/flags'

// The welcome (the tour, setting up, inviting your partner) loads when it's wanted.
const Welcome = lazy(() => import('./onboard/Welcome').then((m) => ({ default: m.Welcome })))

// The game side (every game's screens) loads when a game starts, not with Home.
const loadDuo = () => import('./duo/Duo')
const Duo = lazy(() => loadDuo().then((m) => ({ default: m.Duo })))

export default function App() {
  // Game and mode both come from the URL (a shared link carries both) or Home. A game
  // is played on two phones unless the link says it's the testing seat.
  const [game, setGame] = useState<Game | null>(() => resolveGame(window.location.search))
  const [mode, setMode] = useState<PlayMode | null>(() => game && (resolveMode(window.location.search) ?? 'duo'))
  const [ready, setReady] = useState(false)
  // Carrying on a saved game (Home's "Carry on"), or reloading the page mid-game: this
  // phone's copy of it, for the room to pick up if it's the first one back in.
  const [resume, setResume] = useState<Saved | null>(() => {
    const saved = loadSaved()
    return saved && saved.game === game && saved.mode === mode ? saved : null
  })
  // An invite link (?pair=CODE&from=Name) opens on its own welcome page first.
  const [invite, setInvite] = useState(() => readInvite(window.location.search))
  // …and a friend link (?friend=CODE&from=Names) on one that offers to add that couple.
  const [friendLink, setFriendLink] = useState(() => readFriendLink(window.location.search))
  useThemeSync()
  const welcome = useWelcome()
  // A new phone that isn't paired gets shown round first. One that's already paired (or
  // waiting for a partner) has been here before — it never sees it unasked.
  useEffect(() => {
    // Back from Google (see auth/account): finish off anything left to do.
    void finishRedirect()
    // Just signed out: straight to signing back in.
    let signedOut = false
    try { signedOut = sessionStorage.getItem(SIGNED_OUT) === '1'; sessionStorage.removeItem(SIGNED_OUT) } catch { /* fine */ }
    if (signedOut && !game) return openWelcome('signin')
    if (game || invite || friendLink || welcomed()) return
    void refreshProfile().then((p) => {
      if (p && p.state !== 'single') markWelcomed()
      else if (!welcomed()) openWelcome('tour')
    })
  }, [])
  // Once Home is up and settled, fetch the game side in the background, so starting a
  // game doesn't wait on it (and it's there offline, once the app's installed).
  useEffect(() => {
    const id = setTimeout(() => { preloadNet(); void loadDuo().catch(() => {}) }, 2500)
    return () => clearTimeout(id)
  }, [])
  // From Home, a game is one step in: back from a game that's over leaves it for Home.
  // Mid-game, back pauses instead (see GameHeader) — this only answers once that's gone.
  useBackLayer(!!game, () => leaveTo(window.location.pathname))

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
      {ready && <SeenRecorder keep={mode !== 'solo'} mode={mode!} />}
      {renderApp()}
    </>
  )

  function renderApp() {
    if (invite && !game) return <Invite invite={invite} onDone={() => setInvite(null)} />
    if (friendLink && !game) {
      return <FriendInvite link={friendLink} onDone={(added) => {
        if (added) try { localStorage.setItem('couples-party:tab', 'friends') } catch { /* fine */ }
        setFriendLink(null)
      }} />
    }
    if (!game || !mode) {
      // stampMode writes ?mode and ?game into the URL BEFORE initNet, so Playroom's share
      // link (location.href + #r=CODE) carries both to the joining device.
      const start = (g: Game) => slide('forward', () => {
        stampMode('duo', g, false)
        setResume(null)
        setMode('duo')
        setGame(g)
      })
      return (
        <>
          <Home
            onPick={start}
            onJoin={start}
            onResume={(saved) => slide('forward', () => {
              stampMode(saved.mode, saved.game, false)
              setResume(saved)
              setMode(saved.mode)
              setGame(saved.game)
            })}
          />
          {welcome && <Suspense fallback={null}><Welcome start={welcome} onClose={closeWelcome} /></Suspense>}
        </>
      )
    }
    if (!ready) return <Connecting />
    // Duo and solo share a layout: the board on top, your own controller underneath.
    return <Suspense fallback={<Connecting />}><Duo /></Suspense>
  }
}

// Logs every prompt the session puts in front of you, so the next one draws new ones —
// and, on a paired phone, keeps the session for Memories. Solo play is a testing seat,
// so it keeps nothing.
function SeenRecorder({ keep, mode }: { keep: boolean; mode: PlayMode }) {
  const session = useSession()
  useKeepProgress(session, useMyPlayerId(), mode, keep)
  useEffect(() => recordSeen(session), [session])
  useKeepMemory(session, keep)
  useRecordTonight(session, keep)
  useProfileName(keep)
  // A game played to its end on a paired phone: one off the getting-started list.
  useEffect(() => { if (keep && session.phase === 'DONE') markPlayedTogether() }, [keep, session.phase])
  return null
}

function Connecting() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-4">
      <Logo className="w-20" link="loop" />
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
