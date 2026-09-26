import { useSession } from '../net'
import { DebugBar } from '../debug/DebugBar'
import { Bot } from '../bot/Bot'
import { resolveBot } from '../start/mode'
import { BoardStage } from '../views/board'
import { GameHeader } from '../views/GameHeader'
import { ScreenLightsOut } from './phases/ScreenLightsOut'
import { AwayScreen } from '../views/AwayScreen'

// Shared-screen renderer: the public board on a TV/laptop, under the same header as the
// phones, drawn bigger.
export function Screen() {
  const s = useSession()
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  const bot = resolveBot(location.search)
  if (s.paused?.away) return <AwayScreen s={s} />
  if (s.phase === 'LIGHTS_OUT') {
    return (
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 min-h-0"><ScreenLightsOut s={s} /></div>
        {debug && <DebugBar s={s} />}
        {bot && <Bot />}
      </div>
    )
  }
  return (
    <div className="h-full w-full flex flex-col select-none">
      <GameHeader s={s} big />
      <div className="flex-1 min-h-0 overflow-y-auto px-8 sm:px-12 py-6 flex flex-col">
        <div className="my-auto w-full">
          <BoardStage s={s} />
        </div>
      </div>
      {debug && <DebugBar s={s} />}
      {bot && <Bot />}
    </div>
  )
}
