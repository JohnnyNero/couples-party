import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { circleRoundWinner, fitCircle, roundWins } from '../../engine/fillers'
import { AnimatedNumber } from '../../views/AnimatedNumber'
import { DrawingStrokes } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'

// Both circles side by side, each over a faint copy of the perfect circle that fits it,
// with the score counting up underneath.
export function ScreenCircleReveal({ s }: { s: SessionState }) {
  const c = s.circle!
  const round = c.rounds[c.current]
  const winner = circleRoundWinner(round)
  const wins = roundWins({ kind: 'circle', game: c })
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {(['A', 'B'] as const).map((p) => (
          <Panel key={p} s={s} p={p} stroke={round.drawn[p] ?? []} score={round.score[p] ?? 0} won={winner === p} />
        ))}
      </div>
      <div className="mt-5 sm:mt-8 text-xl sm:text-4xl font-bold uppercase tracking-tight animate-pop">
        {winner ? `${playerName(s, winner)} wins${c.bestOf > 1 ? ' the round' : ''}` : 'Dead level'}
      </div>
      {c.bestOf > 1 && (
        <div className="mt-2 text-xs sm:text-base uppercase tracking-[0.2em] text-fg/50 tabular-nums">
          {playerName(s, 'A')} {wins.A} · {playerName(s, 'B')} {wins.B} · first to {Math.ceil(c.bestOf / 2)}
        </div>
      )}
    </div>
  )
}

function Panel({ s, p, stroke, score, won }: { s: SessionState; p: PlayerId; stroke: DrawStroke; score: number; won: boolean }) {
  const fit = stroke.length > 1 ? fitCircle(stroke) : null
  return (
    <div className="flex flex-col gap-2">
      <div className={'text-sm sm:text-xl font-bold uppercase tracking-tight truncate ' + (won ? 'text-accent' : 'text-fg/70')}>
        {playerName(s, p)}
      </div>
      <div className={'relative w-full aspect-square rounded-2xl bg-fg/5 border-2 text-fg ' + (won ? 'border-accent' : 'border-fg/25')}>
        {fit && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx={fit.cx * 100} cy={fit.cy * 100} r={fit.r * 100} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1.5} strokeDasharray="3 3" />
          </svg>
        )}
        <div className="absolute inset-0">
          <DrawingStrokes strokes={stroke.length ? [stroke] : []} animate />
        </div>
      </div>
      <div className={'font-display text-3xl sm:text-5xl font-bold tabular-nums ' + (won ? 'text-accent' : '')}>
        <AnimatedNumber value={Math.round(score * 10)} durationMs={1200} delayMs={500} format={(n) => `${(n / 10).toFixed(1)}%`} />
      </div>
    </div>
  )
}
