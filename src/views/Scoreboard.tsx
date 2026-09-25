import { type ReactNode } from 'react'
import type { GameKey, PlayerId, SessionState } from '../engine/state'
import { gameScores, needsDecider, standing } from '../engine/standing'
import { GAME_LABELS, gameOfPhase, nextGame } from '../engine/roster'
import { dispatch, useMyPlayerId } from '../net'
import { AnimatedNumber } from './AnimatedNumber'
import { playerName } from './list'
import { leaderboardView } from './leaderboardView'
import { Avatar, inkOf } from '../ui/Avatar'
import { GameGlyph } from '../ui/GameIcon'
import { card, eyebrow } from '../ui/styles'

// The card that closes every game. Not just this game's score — the shape of the whole
// night so far: the two of you head to head, every game's points, what's next.
//
// Nothing moves it on by itself. Either player taps when they've both finished looking.

const ORDER: PlayerId[] = ['A', 'B']

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
  const lead: PlayerId | null = total.A === total.B ? null : total.A > total.B ? 'A' : 'B'

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      <div className="text-center">
        <div className={eyebrow}>{title}</div>
        <div className="mt-1 font-display text-[1.9rem] sm:text-5xl font-extrabold leading-tight">
          {headline(s, lead, called)}
        </div>
        {flourish}
      </div>

      <section className={card + ' px-5 py-5 flex items-end justify-around'}>
        {ORDER.map((p, i) => (
          <div key={p} className="flex flex-col items-center gap-1.5">
            <span className={'h-6 ' + (lead === p ? 'animate-pop' : 'invisible')} aria-hidden={lead !== p}>
              <Crown />
            </span>
            <Avatar p={p} name={playerName(s, p)} size="lg" />
            <span className={'font-display text-5xl font-extrabold leading-none tabular-nums ' + inkOf(p)}>
              <AnimatedNumber value={total[p]} durationMs={900} delayMs={i * 140} />
            </span>
            <span className="text-sm font-extrabold">{playerName(s, p)}</span>
          </div>
        )).reduce<ReactNode[]>((acc, el, i) => (i === 0 ? [el] : [...acc, <Vs key="vs" />, el]), [])}
      </section>

      <section className="flex flex-col">
        {games.map((g, i) => {
          const isNext = g.key === next
          return (
            <div
              key={g.key}
              style={{ animationDelay: `${250 + i * 60}ms` }}
              className={'flex items-center gap-2.5 py-2 px-1 border-b border-fg/10 last:border-0 animate-fade-up ' + (g.played ? '' : 'text-fg/40')}
            >
              <GameGlyph game={g.key === 'decider' ? 'clock' : (g.key as GameKey)} className={'w-5 h-5 shrink-0 ' + (g.played ? 'text-accent-ink' : '')} />
              <span className="flex-1 min-w-0 truncate text-sm font-bold">{g.label}</span>
              {g.played ? (
                ORDER.map((p) => (
                  <span key={p} className={'w-9 text-right font-display text-base font-extrabold tabular-nums ' + inkOf(p)}>
                    {g.points[p]}
                  </span>
                ))
              ) : (
                <span className="text-xs font-extrabold">{isNext ? 'next' : ''}</span>
              )}
            </div>
          )
        })}
      </section>

      {s.phase === 'DONE' && me && <AllTime s={s} me={me} />}

      {canContinue && (
        called ? (
          <button
            onClick={() => dispatch({ type: 'CONTINUE', player: me })}
            className="w-full min-h-[56px] rounded-2xl bg-fg text-bg font-display text-xl font-extrabold active:translate-y-px"
          >
            {decider ? 'Tiebreaker!' : next === 'lights' ? 'Lights out' : 'Finish'}
          </button>
        ) : (
          <section className="rounded-3xl bg-ink text-paper px-4 py-3.5 flex items-center gap-3">
            <span className="shrink-0 w-11 h-11 rounded-2xl bg-accent/20 text-accent inline-flex items-center justify-center">
              <GameGlyph game={next!} className="w-6 h-6" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[0.65rem] uppercase tracking-[0.18em] font-extrabold text-paper/60">Up next</div>
              <div className="font-display text-xl font-extrabold leading-tight truncate">{GAME_LABELS[next!]}</div>
            </div>
            <button
              onClick={() => dispatch({ type: 'CONTINUE', player: me })}
              className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px"
            >
              Ready
            </button>
          </section>
        )
      )}
      {!canContinue && s.phase !== 'DONE' && !called && (
        <div className="text-center text-sm font-bold text-fg/50">Up next · {GAME_LABELS[next!]}</div>
      )}
    </div>
  )
}

function headline(s: SessionState, lead: PlayerId | null, called: boolean): string {
  if (called && needsDecider(s) && s.phase !== 'DONE') return 'Dead level!'
  if (!lead) return 'Neck and neck'
  const name = playerName(s, lead)
  return called ? `${name} takes the night` : `${name} is ahead`
}

function Vs() {
  return <span className="mb-10 font-display text-base font-extrabold text-fg/25">vs</span>
}

function Crown() {
  return (
    <svg viewBox="0 0 24 18" className="w-7 h-5" fill="#F2B544" stroke="rgb(var(--fg))" strokeWidth={1.6} strokeLinejoin="round" aria-hidden="true">
      <path d="M3 16L2 5l5 4 5-7 5 7 5-4-1 11z" />
    </svg>
  )
}

// The longer run, on this phone: this week, and every night you've played.
function AllTime({ s, me }: { s: SessionState; me: PlayerId }) {
  const v = leaderboardView(s, me)
  return (
    <div className="text-center text-xs font-bold text-fg/55 tabular-nums">
      This week {v.you} {v.weekly.you} – {v.weekly.them} {v.them} · All time {v.allTime.you} – {v.allTime.them}
    </div>
  )
}
