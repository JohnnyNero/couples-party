import type { SessionState } from '../../engine/state'

export function ScreenStakeReveal({ s }: { s: SessionState }) {
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="text-xs sm:text-sm uppercase tracking-[0.3em] text-accent mb-4">
        The stake · the loser does this
      </div>
      <div className="text-3xl sm:text-6xl font-bold uppercase tracking-tight break-words">{s.stake}</div>
    </div>
  )
}
