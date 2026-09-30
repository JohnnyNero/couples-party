import type { DrawStroke, PlayerId, SessionState } from '../../engine/state'
import { circleRoundWinner, fitCircle, roundWins } from '../../engine/fillers'
import { AnimatedNumber } from '../../views/AnimatedNumber'
import { DrawingStrokes } from '../../views/DrawingCanvas'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { Pips } from '../../ui/kit'
import { Burst, at, verdictFx } from '../../ui/fx'
import { ReplayButton } from '../../share/ReplayButton'
import { circleReplay } from '../../share/replay'

// Both circles side by side, each over a faint copy of the perfect circle that fits it,
// with the score counting up underneath.
export function BoardCircleReveal({ s }: { s: SessionState }) {
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
      <div className="relative mt-5 sm:mt-8">
        <div className={'font-display text-3xl sm:text-5xl font-extrabold leading-tight ' + verdictFx(!!winner)} style={at(1800)}>
          {winner ? `${playerName(s, winner)} wins${c.bestOf > 1 ? ' the round' : ''}!` : 'Dead level'}
        </div>
        {winner && <Burst delay={1900} />}
      </div>
      {c.bestOf > 1 && (
        <div className="mt-3"><Pips s={s} wins={wins} need={Math.ceil(c.bestOf / 2)} /></div>
      )}
      {(round.drawn.A?.length || round.drawn.B?.length) ? (
        <div className="mt-4">
          <ReplayButton
            label="Make a replay"
            make={() => circleReplay({
              drawn: { A: round.drawn.A ?? [], B: round.drawn.B ?? [] },
              names: { A: playerName(s, 'A'), B: playerName(s, 'B') },
              scores: { A: round.score.A ?? 0, B: round.score.B ?? 0 },
            })}
          />
        </div>
      ) : null}
    </div>
  )
}

function Panel({ s, p, stroke, score, won }: { s: SessionState; p: PlayerId; stroke: DrawStroke; score: number; won: boolean }) {
  const fit = stroke.length > 1 ? fitCircle(stroke) : null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-center gap-2 font-display text-lg sm:text-2xl font-extrabold truncate">
        <Avatar p={p} name={playerName(s, p)} size="sm" /> {playerName(s, p)}
      </div>
      <div className={'relative w-full aspect-square rounded-3xl bg-card border-2 ' + inkOf(p) + (won ? ' border-fg shadow-[4px_4px_0_rgba(0,0,0,0.12)]' : ' border-fg/20')}>
        {fit && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx={fit.cx * 100} cy={fit.cy * 100} r={fit.r * 100} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={1.5} strokeDasharray="3 3" />
          </svg>
        )}
        <div className="absolute inset-0">
          <DrawingStrokes strokes={stroke.length ? [stroke] : []} animate />
        </div>
      </div>
      <div className={'font-display text-3xl sm:text-5xl font-extrabold tabular-nums ' + (won ? inkOf(p) : 'text-fg/60')}>
        <AnimatedNumber value={Math.round(score * 10)} durationMs={1200} delayMs={500} format={(n) => `${(n / 10).toFixed(1)}%`} />
      </div>
    </div>
  )
}
