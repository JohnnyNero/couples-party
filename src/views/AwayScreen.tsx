import type { PlayerId, SessionState } from '../engine/state'
import { useMyPlayerId } from '../net'
import { leaveTo } from '../ui/back'
import { Avatar } from '../ui/Avatar'
import { Logo } from '../ui/Logo'
import { btnOutline } from '../ui/styles'
import { playerName } from './list'

// One of you has left mid-game (or you're picking a saved one back up and the other
// isn't in yet). The game's paused and saved; this waits for them, and carries on by
// itself the moment they're back.
export function AwayScreen({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const gone = (['A', 'B'] as PlayerId[]).filter((p) => !s.players[p].connected && p !== me)
  const names = gone.map((p) => playerName(s, p))
  const who = names.length ? names.join(' and ') : 'your partner'
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-5 p-8 text-center animate-fade-up">
      <div className="flex -space-x-2">
        {gone.length > 0
          ? gone.map((p) => <Avatar key={p} p={p} name={playerName(s, p)} size="md" className="animate-pulse" />)
          : <Logo className="w-16 animate-pulse" />}
      </div>
      <div className="font-display text-3xl font-extrabold leading-tight">
        {gone.length > 0 ? `Waiting for ${who}` : 'Getting back in…'}
      </div>
      <div className="text-fg/65 max-w-xs leading-snug">
        Your game’s paused and saved, scores and all. The moment {gone.length > 0 ? 'they’re' : 'you’re both'} back,
        you’ll carry on right where you left off.
      </div>
      <div className="flex gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-pa animate-pulse" />
        <span className="w-2.5 h-2.5 rounded-full bg-pb animate-pulse [animation-delay:200ms]" />
      </div>
      {me && (
        <button className={btnOutline + ' !w-auto px-8 mt-2'} onClick={() => leaveTo(window.location.pathname)}>
          Leave for now
        </button>
      )}
    </div>
  )
}
