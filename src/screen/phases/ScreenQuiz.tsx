import type { PlayerId, SessionState } from '../../engine/state'
import { guessBothClose, guessOff, guessWinner, hlAnswer, hlAwards, shown, twistWinner } from '../../engine/standing'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { card, eyebrow } from '../../ui/styles'
import { Burst, at, verdictFx } from '../../ui/fx'

// Tongue Twisters, Higher or Lower and Guesstimate: the reveals.

const PS: PlayerId[] = ['A', 'B']
const fmt = (n: number) => n.toLocaleString('en-GB')

function Headline({ text, good, burst }: { text: string; good: boolean; burst: boolean }) {
  return (
    <div className="relative mt-5">
      <div style={at(1100)} className={'font-display text-3xl sm:text-5xl font-extrabold leading-tight ' + verdictFx(good)}>{text}</div>
      {burst && <Burst delay={1200} />}
    </div>
  )
}

// ---------------------------------------------------------------- Tongue Twisters

export function ScreenTwistReveal({ s }: { s: SessionState }) {
  const round = s.twist!.rounds[s.twist!.current]
  const winner = twistWinner(round)
  const both = round.said.A && round.said.B
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className="font-display text-2xl sm:text-4xl font-extrabold leading-tight text-fg/70">“{round.text}”</div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {PS.map((p, i) => (
          <div key={p} className={(winner === p ? card : 'rounded-3xl border-2 border-fg/15') + ' px-3 py-4 flex flex-col items-center gap-1'}>
            <div className="flex items-center gap-2 font-display text-lg font-extrabold truncate">
              <Avatar p={p} name={playerName(s, p)} size="sm" /> {playerName(s, p)}
            </div>
            <div style={at(150 + i * 450)} className={'font-display text-3xl font-extrabold animate-flip-in ' + (round.said[p] ? inkOf(p) : 'text-fg/45')}>
              {round.said[p] ? 'Nailed it' : 'Tripped'}
            </div>
          </div>
        ))}
      </div>
      <Headline
        text={winner ? `${playerName(s, winner)} takes it · +${shown(s, 'twist', 6)}` : both ? 'You both nailed it · team point' : 'You both tripped!'}
        good={!!winner || !!both}
        burst={!!winner || !!both}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Higher or Lower

export function ScreenHlReveal({ s }: { s: SessionState }) {
  const round = s.higher!.rounds[s.higher!.current]
  const { item } = round
  const answer = hlAnswer(item)
  const awards = hlAwards(round)
  const got = (p: PlayerId) => awards.filter((a) => a!.player === p).reduce((n, a) => n + a!.points, 0)
  const max = Math.max(item.av, item.bv)
  const year = /year/i.test(item.unit)
  const bar = (side: 'a' | 'b', v: number) => (
    <div className={'rounded-2xl px-4 py-3 text-left ' + (answer === side ? 'bg-sage-soft' : 'bg-fg/[0.05]')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-xl font-extrabold leading-tight">{side === 'a' ? item.a : item.b}</span>
        <span className="font-display text-xl font-extrabold tabular-nums whitespace-nowrap">{year ? v : fmt(v)}{item.unit && !year ? ` ${item.unit}` : ''}</span>
      </div>
      {!year && <div className="mt-2 h-2 rounded-full bg-fg/10 overflow-hidden"><div className={'h-full rounded-full animate-sweep ' + (answer === side ? 'bg-sage-ink' : 'bg-fg/30')} style={{ width: `${(v / max) * 100}%` }} /></div>}
      <div className="mt-1 flex gap-1.5">
        {PS.filter((p) => round.pick[p] === side).map((p) => <Avatar key={p} p={p} name={playerName(s, p)} size="sm" />)}
      </div>
    </div>
  )
  const right = PS.filter((p) => round.pick[p] === answer)
  return (
    <div className="w-full max-w-md mx-auto text-center">
      <div className={eyebrow + ' mb-3'}>{item.question}</div>
      <div className="flex flex-col gap-2.5">
        {bar('a', item.av)}
        {bar('b', item.bv)}
      </div>
      <Headline
        text={right.length === 0 ? 'Neither of you!' : right.length === 2 ? `Both right · ${playerName(s, got('A') > got('B') ? 'A' : 'B')} was quicker` : `${playerName(s, right[0])} got it · +${shown(s, 'higher', got(right[0]))}`}
        good={right.length > 0}
        burst={right.length > 0}
      />
    </div>
  )
}

// ---------------------------------------------------------------- Guesstimate

export function ScreenGuessReveal({ s }: { s: SessionState }) {
  const round = s.guess!.rounds[s.guess!.current]
  const winner = guessWinner(round)
  const both = guessBothClose(round)
  return (
    <div className="w-full max-w-2xl mx-auto text-center">
      <div className={eyebrow}>{round.question}</div>
      <div style={at(100)} className="mt-2 font-display text-6xl font-extrabold tabular-nums text-accent-ink animate-slam">{fmt(round.answer)}</div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        {PS.map((p, i) => {
          const off = guessOff(round, p)
          return (
            <div key={p} className={(winner === p ? card : 'rounded-3xl border-2 border-fg/15') + ' px-3 py-4 flex flex-col items-center gap-1'}>
              <div className="flex items-center gap-2 font-display text-lg font-extrabold truncate">
                <Avatar p={p} name={playerName(s, p)} size="sm" /> {playerName(s, p)}
              </div>
              <div style={at(500 + i * 400)} className={'font-display text-4xl font-extrabold tabular-nums animate-flip-in ' + (winner === p ? inkOf(p) : 'text-fg/60')}>
                {round.guess[p] === null ? '—' : fmt(round.guess[p]!)}
              </div>
              <div className="text-sm font-bold text-fg/50 tabular-nums">{off === Infinity ? 'no guess' : off === 0 ? 'spot on!' : `off by ${fmt(off)}`}</div>
            </div>
          )
        })}
      </div>
      <Headline
        text={(winner ? `${playerName(s, winner)} was closer · +${shown(s, 'guess', 5)}` : 'Dead level') + (both ? ' · team point' : '')}
        good={!!winner || both}
        burst={!!winner}
      />
    </div>
  )
}
