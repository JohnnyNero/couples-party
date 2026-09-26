import { useSession, useMyPlayerId } from '../net'
import { Controller } from '../views/controller'
import { PlayWaiting } from './phases/PlayWaiting'
import { GameHeader } from '../views/GameHeader'
import { useRecordSession } from '../store/useRecordSession'
import { ScreenLightsOut } from '../screen/phases/ScreenLightsOut'
import { AwayScreen } from '../views/AwayScreen'

// Phone renderer for shared-screen mode: this player's private controller, under the
// same header as every game screen — which game, both scores, the clock.
export function Play() {
  const s = useSession()
  const me = useMyPlayerId()
  useRecordSession(s)
  if (!me) return <PlayWaiting label="Connecting…" />
  if (s.paused?.away) return <AwayScreen s={s} />
  // The night's last card is dark and full-bleed on every device.
  if (s.phase === 'LIGHTS_OUT') return <ScreenLightsOut s={s} />
  return (
    <div className="h-full w-full flex flex-col select-none">
      <GameHeader s={s} />
      <div className="flex-1 min-h-0">
        <Controller s={s} me={me} />
      </div>
    </div>
  )
}
