import { useSession, useMyPlayerId } from '../net/playroom'
import { Controller } from '../views/controller'
import { PlayWaiting } from './phases/PlayWaiting'

// Phone renderer for shared-screen mode: this player's private controller only.
// The public board lives on the TV.
export function Play() {
  const s = useSession()
  const me = useMyPlayerId()
  if (!me) return <PlayWaiting label="Connecting…" />
  return (
    <div className="h-full w-full select-none">
      <Controller s={s} me={me} />
    </div>
  )
}
