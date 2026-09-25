import { useEffect, useState, type ReactNode } from 'react'
import type { PlayerId, SessionState } from '../engine/state'
import { gameScores, needsDecider, standing } from '../engine/standing'
import { GAME_LABELS, gameOfPhase, nextGame } from '../engine/roster'
import { dispatch, useMyPlayerId } from '../net'
import { AnimatedNumber } from './AnimatedNumber'
import { playerName } from './list'

// The card that closes every game. It isn't just this game's score — the point of it is
// the shape of the whole night so far, which is why the per-game rows stay on screen
// with the games still to come showing as blanks.
//
// Nothing moves it on by itself. Either player taps when they've both finished looking.

const ORDER: Array<PlayerId> = ['A', 'B']

export function Scoreboard({
  s,
  title,
  flourish,
}: {
  s: SessionState
  title: string
  flourish?: ReactNode
}) {
  const me = useMyPlayerId()
  const games = gameScores(s)
  const total = standing(s)
  // What a tap leads to, straight off the roster. DONE leads nowhere, whatever is left
  // unplayed — a session that ended early shouldn't promise a game that isn't coming.
  const current = gameOfPhase(s.phase)
  const next = s.phase === 'DONE' || !current ? null : nextGame(s, current)
  // Once nothing scored is left, the board calls the night — Lights Out is still to come
  // after it, but it doesn't change the result.
  const called = !next || next === 'lights'
  // A level night doesn't end level: the tap goes to a tiebreaker first.
  const decider = called && s.phase !== 'DONE' && needsDecider(s)
  // A TV has nobody to tap it, and once the session is DONE the tap would do nothing.
  const canContinue = me !== null && s.phase !== 'DONE'

  // Bars are drawn from zero on mount and grown to width one frame later, so the growth
  // is a plain CSS transition rather than a keyframe that would need a fixed end width.
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const top = Math.max(total.A, total.B, 1)

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-4 sm:gap-6">
      <div className="text-center">
        <div className="text-[0.6rem] sm:text-xs uppercase tracking-[0.3em] text-fg/40">{title}</div>
        {flourish}
      </div>

      {/* The totals, as two bars against each other. */}
      <div className="flex flex-col gap-2.5">
        {ORDER.map((p, i) => {
          const them = total[p === 'A' ? 'B' : 'A']
          // Level is not the same as losing: neither bar should go flat grey on a draw.
          const ahead = total[p] >= them
          return (
            <div key={p} className="flex items-center gap-3">
              <span
                className={
                  'w-[5.5rem] sm:w-32 shrink-0 text-sm sm:text-xl font-bold uppercase tracking-tight truncate ' +
                  (ahead ? 'text-accent' : 'text-fg/70')
                }
              >
                {playerName(s, p)}
              </span>
              <span className="flex-1 min-w-0 h-8 sm:h-11 bg-fg/5 rounded-lg overflow-hidden">
                <span
                  className={'block h-full rounded-lg ' + (ahead ? 'bg-accent' : 'bg-fg/25')}
                  style={{
                    width: grown ? `${Math.max(4, (total[p] / top) * 100)}%` : '0%',
                    transition: `width 900ms cubic-bezier(0.22,1,0.36,1) ${i * 140}ms`,
                  }}
                />
              </span>
              <span className="w-10 sm:w-14 shrink-0 text-right text-xl sm:text-3xl font-bold tabular-nums">
                <AnimatedNumber value={total[p]} durationMs={900} delayMs={i * 140} />
              </span>
            </div>
          )
        })}
      </div>

      {/* Where those totals came from, and what's still to come. */}
      <div className="border-t border-fg/15">
        {games.map((g, i) => (
          <div
            key={g.key}
            style={{ animationDelay: `${300 + i * 80}ms` }}
            className={
              'flex items-baseline gap-2 border-b border-fg/10 py-1 sm:py-1.5 animate-fade-up ' +
              'text-[0.7rem] sm:text-base uppercase tracking-wide ' +
              (g.played ? 'text-fg/60' : 'text-fg/25')
            }
          >
            <span className="flex-1 min-w-0 truncate">{g.label}</span>
            {ORDER.map((p) => (
              <span
                key={p}
                className={
                  'w-9 sm:w-12 text-right shrink-0 tabular-nums font-bold ' +
                  (g.played && g.points[p] >= g.points[p === 'A' ? 'B' : 'A'] && g.points[p] > 0
                    ? 'text-accent'
                    : '')
                }
              >
                {g.played ? g.points[p] : '·'}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40 min-w-0 truncate">
          {decider ? 'Dead level · tiebreaker next' : called ? verdict(s) : `Next up · ${GAME_LABELS[next!]}`}
        </span>
        {canContinue && (
          <button
            onClick={() => dispatch({ type: 'CONTINUE', player: me })}
            className="min-h-[48px] px-6 shrink-0 bg-accent text-bg text-base sm:text-xl font-bold uppercase tracking-widest active:translate-y-px rounded-xl"
          >
            {decider ? 'Tiebreaker' : next === 'lights' ? 'Lights out' : next ? 'Ready' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  )
}

function verdict(s: SessionState): string {
  const t = standing(s)
  if (t.A === t.B) return 'Dead level'
  return `${playerName(s, t.A > t.B ? 'A' : 'B')} takes the night`
}
