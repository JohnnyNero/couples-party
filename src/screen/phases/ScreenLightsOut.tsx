import type { PlayerId, SessionState } from '../../engine/state'
import { standing } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'
import { Avatar } from '../../ui/Avatar'

// The last card of the night, and the only screen that's always dark: stars, a moon,
// one question, big. No score to chase, nothing to type — the night's result sits in a
// small card at the bottom, and a button to end on. It's the one screen that asks you
// to stop looking at it: the talking happens with the phone face down.
//
// Full-bleed, so it's drawn outside the usual header and padding (see Duo and Screen).

const STARS: [number, number, number, number][] = [
  [10, 9, 1.5, 0.5], [23, 18, 1, 0.4], [38, 7, 1.2, 0.6], [82, 13, 1.5, 0.5], [90, 26, 1, 0.35],
  [15, 31, 1.2, 0.4], [64, 5, 1, 0.5], [54, 22, 1.3, 0.3], [77, 36, 1, 0.3], [4, 45, 1, 0.3],
  [95, 48, 1.2, 0.4], [45, 40, 0.9, 0.25],
]

export function ScreenLightsOut({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const t = standing(s)
  const lead: PlayerId | null = t.A === t.B ? null : t.A > t.B ? 'A' : 'B'
  const played = t.A + t.B > 0
  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col bg-[#1B1311] text-[#F0DED2]">
      <svg className="absolute inset-x-0 top-0 w-full h-1/2 pointer-events-none" viewBox="0 0 100 50" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {STARS.map(([x, y, r, o], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.28} fill="#F0DED2" opacity={o} className="animate-pulse" style={{ animationDelay: `${i * 370}ms`, animationDuration: '3s' }} />
        ))}
      </svg>

      <div className="relative flex-1 flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="w-32 h-32 sm:w-44 sm:h-44 rounded-full flex items-center justify-center bg-[radial-gradient(circle,rgba(255,128,112,0.28)_0%,rgba(255,128,112,0)_70%)] animate-pop">
          <svg viewBox="0 0 24 24" className="w-16 h-16 sm:w-24 sm:h-24" fill="#FF8070" aria-hidden="true">
            <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
          </svg>
        </div>
        <div className="text-xs uppercase tracking-[0.3em] font-extrabold text-[#F0DED2]/50">Lights out</div>
        <div
          style={{ animationDelay: '250ms' }}
          className="max-w-xl font-display text-[2.3rem] sm:text-6xl font-bold leading-[1.12] text-balance animate-fade-up"
        >
          {s.lights?.question}
        </div>
        <div className="text-[0.95rem] sm:text-xl text-[#F0DED2]/65">Put the phones down, and ask each other.</div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-5 pb-7 flex flex-col gap-3">
        {played && (
          <section className="rounded-[22px] bg-[#F0DED2]/[0.06] border border-[#F0DED2]/[0.12] px-4 py-3.5 flex items-center gap-3">
            <div className="flex">
              <Avatar p="A" name={playerName(s, 'A')} size="md" className="ring-2 ring-[#1B1311]" />
              <Avatar p="B" name={playerName(s, 'B')} size="md" className="-ml-2 ring-2 ring-[#1B1311]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-extrabold">
                {lead ? `${playerName(s, lead)} takes the night` : 'A dead heat'}, {Math.max(t.A, t.B)} – {Math.min(t.A, t.B)}
              </div>
              <div className="text-xs text-[#F0DED2]/55">Same time tomorrow?</div>
            </div>
          </section>
        )}
        {me && s.phase === 'LIGHTS_OUT' && (
          <button
            onClick={() => dispatch({ type: 'CONTINUE', player: me })}
            className="w-full min-h-[56px] rounded-2xl border-2 border-[#F0DED2]/35 font-display text-xl font-extrabold active:translate-y-px"
          >
            Goodnight
          </button>
        )}
      </div>
    </div>
  )
}
