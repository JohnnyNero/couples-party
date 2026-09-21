import { useSession, useMyPlayerId } from '../net'
import { Controller } from '../views/controller'
import { PlayWaiting } from './phases/PlayWaiting'
import { LeaderboardInline } from '../views/Leaderboard'
import { useRecordSession } from '../store/useRecordSession'

// Phone renderer for shared-screen mode: this player's private controller, plus a thin
// leaderboard strip — the TV has no identity of its own to show it against, so it has
// to live here instead.
export function Play() {
  const s = useSession()
  const me = useMyPlayerId()
  useRecordSession(s)
  if (!me) return <PlayWaiting label="Connecting…" />
  return (
    <div className="h-full w-full flex flex-col select-none">
      <div className="flex-1 min-h-0">
        <Controller s={s} me={me} />
      </div>
      <div className="shrink-0 border-t-2 border-fg/80 px-4 py-2 text-[0.6rem]">
        <LeaderboardInline s={s} me={me} />
      </div>
    </div>
  )
}
