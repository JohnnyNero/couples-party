import type { SessionState } from '../../engine/state'
export function ScreenJoin({ s }: { s: SessionState }) {
  const dot = (on: boolean) => <span className={on ? 'text-accent' : 'text-fg/30'}>●</span>
  return (
    <div className="text-center">
      <div className="text-5xl mb-8">JOIN ON YOUR PHONES</div>
      <div className="text-3xl">{dot(s.players.A.connected)} {s.players.A.name || 'PLAYER A'}</div>
      <div className="text-3xl mt-2">{dot(s.players.B.connected)} {s.players.B.name || 'PLAYER B'}</div>
    </div>
  )
}
