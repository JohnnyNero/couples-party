import type { SessionState } from '../../engine/state'
import { Dot } from '../../views/Dot'

export function ScreenJoin({ s }: { s: SessionState }) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-3xl sm:text-5xl font-bold uppercase tracking-tight mb-8 sm:mb-12">
        Join to begin
      </div>
      <PlayerRow name={s.players.A.name || 'Player A'} on={s.players.A.connected} />
      <div className="h-px bg-fg/15 my-4 sm:my-5" />
      <PlayerRow name={s.players.B.name || 'Player B'} on={s.players.B.connected} />
    </div>
  )
}

function PlayerRow({ name, on }: { name: string; on: boolean }) {
  return (
    <div className="flex items-center gap-4 sm:gap-6">
      <Dot on={on} />
      <span className={'text-2xl sm:text-4xl uppercase tracking-tight ' + (on ? 'text-fg' : 'text-fg/40')}>
        {name}
      </span>
      <span className="ml-auto text-xs sm:text-base uppercase tracking-[0.25em] text-fg/40">
        {on ? 'Ready' : 'Waiting'}
      </span>
    </div>
  )
}
