import { useEffect, useRef, useState } from 'react'
import type { PlayerId, SessionState } from '../engine/state'
import { currentAct } from '../engine/list'
import { dispatch, getIsHost, useSession } from '../net'
import { BRAIN } from './brain'
import { botDelay, nextBotAction } from './policy'

// Mounts on ?bot=1 and plays the empty seat, so the loop can be played solo. It runs on
// the host client only — every other client would dispatch the same action twice — and
// it reaches the game through the same `dispatch` a phone uses, so the engine has no
// idea it exists.
export function Bot() {
  const s = useSession()
  const [id, setId] = useState<PlayerId | null>(null)

  // Take whichever seat the humans left. Both empty means nobody has joined yet, so
  // wait: claiming a seat first would push a real player into the bot's chair.
  useEffect(() => {
    if (id !== null) return
    const connected = (['A', 'B'] as const).filter((p) => s.players[p].connected)
    if (connected.length === 1) setId(connected[0] === 'A' ? 'B' : 'A')
  }, [id, s.players.A.connected, s.players.B.connected])

  return id === null ? <Badge label="waiting for a seat" /> : <BotSeat s={s} id={id} />
}

// One pending decision at a time, re-armed whenever the game moves. The action is
// recomputed when the timer fires, never when it is set, so a bot that was beaten to
// the punch by the clock does nothing instead of something stale.
function BotSeat({ s, id }: { s: SessionState; id: PlayerId }) {
  const latest = useRef(s)
  latest.current = s
  const [pending, setPending] = useState<string | null>(null)

  const act = currentAct(s)
  const key = [
    s.phase,
    s.meld?.rounds.length ?? 0,
    s.listActs.length,
    act?.items.length ?? 0,
    act?.placeIndex ?? 0,
  ].join('|')

  // Keyed on the decision point, so an ordinary re-render never restarts the clock the
  // bot is sitting on — and a remount (StrictMode does exactly that) re-arms it rather
  // than leaving the seat silent.
  useEffect(() => {
    if (!getIsHost()) return
    if (!nextBotAction(latest.current, id, BRAIN, Math.random)) {
      setPending(null)
      return
    }
    const wait = botDelay(latest.current, Math.random)
    setPending(`${s.phase.toLowerCase()} · ${Math.round(wait / 1000)}s`)
    const timer = setTimeout(() => {
      const action = nextBotAction(latest.current, id, BRAIN, Math.random)
      if (action) dispatch(action)
      setPending(null)
    }, wait)
    return () => clearTimeout(timer)
  }, [key, id])

  return <Badge label={`${id} · ${pending ?? 'idle'}`} />
}

function Badge({ label }: { label: string }) {
  return (
    <div className="fixed bottom-2 left-2 text-[0.6rem] uppercase tracking-widest text-fg/40 border border-fg/20 bg-bg/90 px-2 py-1">
      Bot {label}
    </div>
  )
}
