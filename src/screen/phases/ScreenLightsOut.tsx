import type { SessionState } from '../../engine/state'
import { dispatch, useMyPlayerId } from '../../net'

// The last card of the night. No score, nothing to type — one question, big, and a
// button to end on. It's the only screen that deliberately asks you to stop looking at
// it: the talking happens with the phone face down.
export function ScreenLightsOut({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center text-center gap-6 sm:gap-8">
      <svg
        viewBox="0 0 24 24"
        className="w-16 h-16 sm:w-24 sm:h-24 text-accent animate-pop"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        <path d="M16.5 4.5v2M15.5 5.5h2M19.5 8.5v1.4M18.8 9.2h1.4" />
      </svg>
      <div className="text-[0.65rem] sm:text-sm uppercase tracking-[0.3em] text-fg/40">Lights out</div>
      <div
        style={{ animationDelay: '250ms' }}
        className="text-2xl sm:text-4xl font-bold tracking-tight leading-snug text-balance animate-fade-up"
      >
        {s.lights?.question}
      </div>
      <div className="text-sm text-fg/50">Put the phone down and ask each other.</div>
      {me && s.phase === 'LIGHTS_OUT' && (
        <button
          onClick={() => dispatch({ type: 'CONTINUE', player: me })}
          className="min-h-[48px] px-8 rounded-xl border-2 border-fg/25 text-fg/70 font-bold uppercase tracking-widest active:translate-y-px"
        >
          Goodnight
        </button>
      )}
    </div>
  )
}
