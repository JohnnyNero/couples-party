import { useEffect, useState, type ReactNode } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { followWinner, frenzyRoundWinner, roundWins, spotRoundWinner } from '../../engine/fillers'
import { FRENZY } from '../../engine/phases'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { Pips } from '../../ui/kit'
import { card, eyebrow } from '../../ui/styles'
import { Burst, at, verdictFx } from '../../ui/fx'

// The shared screens for Spot It, Frenzy and Follow Me: the 3-2-1 before a round, and
// the two of you side by side after it.

// ---------------------------------------------------------------- 3-2-1

export function BoardMiniReady({ title, hint }: { title: string; hint: string }) {
  const [left, setLeft] = useState(3)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setLeft(Math.max(1, 3 - Math.floor((Date.now() - t0) / 1000))), 100)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="w-full max-w-3xl mx-auto text-center">
      <div className="font-display text-4xl sm:text-6xl font-extrabold">{title}</div>
      <div className="mt-1 sm:mt-3 text-base sm:text-xl text-fg/60">{hint}</div>
      <div className="mt-8 sm:mt-12 flex justify-center">
        <span key={left} className="w-36 h-36 sm:w-52 sm:h-52 rounded-full bg-pa text-white border-2 border-fg shadow-[5px_5px_0_rgba(0,0,0,0.15)] inline-flex items-center justify-center font-display text-8xl sm:text-9xl font-extrabold animate-pop tabular-nums">
          <span className="translate-y-[0.06em]">{left}</span>
        </span>
      </div>
    </div>
  )
}

export function BoardSpotReady({ s }: { s: SessionState }) {
  const round = s.spot!.rounds[s.spot!.current]
  return <BoardMiniReady title={`Round ${round.index}`} hint={`A ${round.size} × ${round.size} grid · find the odd one out`} />
}

export function BoardFrenzyReady({ s }: { s: SessionState }) {
  const round = s.frenzy!.rounds[s.frenzy!.current]
  return <BoardMiniReady title={s.frenzy!.bestOf > 1 ? `Round ${round.index}` : 'Fingers ready'} hint={`Tap as fast as you can for ${FRENZY.runMs / 1000} seconds`} />
}

// ---------------------------------------------------------------- side by side

function SideBySide({ s, winner, value, sub, headline, footer, good = !!winner }: {
  s: SessionState
  winner: PlayerId | null
  good?: boolean
  value: (p: PlayerId) => ReactNode
  sub: (p: PlayerId) => ReactNode
  headline: string
  footer?: ReactNode
}) {
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="grid grid-cols-2 gap-4 sm:gap-8">
        {(['A', 'B'] as const).map((p, i) => {
          const won = winner === p
          return (
            <div key={p} className={(won ? card : 'rounded-3xl border-2 border-fg/15') + ' px-3 py-4 sm:py-6 flex flex-col items-center gap-1'}>
              <div className="flex items-center gap-2 font-display text-lg sm:text-2xl font-extrabold truncate">
                <Avatar p={p} name={playerName(s, p)} size="sm" /> {playerName(s, p)}
              </div>
              <div style={at(150 + i * 450)} className={'font-display text-4xl sm:text-6xl font-extrabold tabular-nums animate-flip-in ' + (won ? inkOf(p) : 'text-fg/60')}>
                {value(p)}
              </div>
              <div className="text-sm sm:text-lg font-bold text-fg/50 tabular-nums">{sub(p)}</div>
            </div>
          )
        })}
      </div>
      <div className="relative mt-5 sm:mt-8">
        <div style={at(1200)} className={'font-display text-3xl sm:text-5xl font-extrabold leading-tight ' + verdictFx(good)}>{headline}</div>
        {winner && <Burst delay={1300} />}
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </div>
  )
}

export function BoardSpotReveal({ s }: { s: SessionState }) {
  const g = s.spot!
  const round = g.rounds[g.current]
  const winner = spotRoundWinner(round)
  return (
    <>
      <div className={eyebrow + ' mb-4 text-center'}>
        It was <span className="text-2xl align-middle">{round.odd}</span> among the <span className="text-2xl align-middle">{round.base}</span>
      </div>
      <SideBySide
        s={s}
        winner={winner}
        value={(p) => (round.found[p] === null ? '—' : `${(round.found[p]! / 1000).toFixed(2)} s`)}
        sub={(p) => (round.found[p] === null ? 'didn’t find it' : 'to find it')}
        headline={winner ? `${playerName(s, winner)} wins the round` : 'Dead heat · go again'}
        footer={<Pips s={s} wins={roundWins({ kind: 'spot', game: g })} need={Math.ceil(g.bestOf / 2)} />}
      />
    </>
  )
}

export function BoardFrenzyReveal({ s }: { s: SessionState }) {
  const g = s.frenzy!
  const round = g.rounds[g.current]
  const winner = frenzyRoundWinner(round)
  return (
    <SideBySide
      s={s}
      winner={winner}
      value={(p) => round.taps[p] ?? 0}
      sub={(p) => `${((round.taps[p] ?? 0) / (FRENZY.runMs / 1000)).toFixed(1)} a second`}
      headline={winner ? `${playerName(s, winner)} wins the round` : 'Dead level · go again'}
      footer={g.bestOf > 1 ? <Pips s={s} wins={roundWins({ kind: 'frenzy', game: g })} need={Math.ceil(g.bestOf / 2)} /> : undefined}
    />
  )
}

export function BoardFollowReveal({ s }: { s: SessionState }) {
  const g = s.follow!
  const round = g.rounds[g.current]
  const both = (['A', 'B'] as const).every((p) => (round.result[p]?.got ?? 0) >= round.length)
  const winner = followWinner(g)
  const headline = both ? 'You both got it · one more step' : winner ? `${playerName(s, winner)} wins it` : 'Level · nobody takes it'
  return (
    <>
      <div className={eyebrow + ' mb-4 text-center'}>Round {round.index} · {round.length} steps</div>
      <SideBySide
        s={s}
        winner={winner}
        value={(p) => ((round.result[p]?.got ?? 0) >= round.length ? '✓' : `${round.result[p]?.got ?? 0}/${round.length}`)}
        sub={(p) => ((round.result[p]?.got ?? 0) >= round.length ? `in ${((round.result[p]?.ms ?? 0) / 1000).toFixed(1)} s` : 'slipped')}
        headline={headline}
        good={both || !!winner}
      />
    </>
  )
}
