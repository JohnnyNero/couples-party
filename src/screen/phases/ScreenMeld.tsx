import type { MeldRound, PlayerId, SessionState } from '../../engine/state'
import { MELD } from '../../engine/phases'
import { MELD_POINTS, shown } from '../../engine/standing'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { PromptCard, WhoIsIn } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'
import { Burst, Stamp, at as delay, verdictFx } from '../../ui/fx'
import { useState } from 'react'
import { dispatch, useMyPlayerId } from '../../net'
import { btnOutline } from '../../ui/styles'

const PS: PlayerId[] = ['A', 'B']

// After a miss, the prompt's done its job: what's left is the two words you just said,
// and the one that links them. `t` is the try being played; the pair shown is the last.
export function MeldLink({ s, round, t, big = false }: { s: SessionState; round: MeldRound; t: number; big?: boolean }) {
  const pair = round.tries[t - 1]
  if (!pair) return null
  return (
    <div className="flex items-center justify-center gap-3 flex-wrap">
      {PS.map((p, k) => (
        <span key={p} className="flex items-center gap-3">
          {k === 1 && <span className={'font-display font-extrabold text-fg/30 ' + (big ? 'text-4xl' : 'text-3xl')}>+</span>}
          <span className={'inline-flex items-center gap-2 rounded-2xl border-2 border-fg bg-card px-3 py-2 font-display font-extrabold leading-tight break-words ' + (big ? 'text-3xl sm:text-5xl ' : 'text-2xl ') + inkOf(p)}>
            <Avatar p={p} name={playerName(s, p)} size="sm" />
            {pair[p] || '—'}
          </span>
        </span>
      ))}
    </div>
  )
}

// What the go is about: the prompt on the first try, the last two words after that.
export function MeldAbout({ s, round, t }: { s: SessionState; round: MeldRound; t: number }) {
  return t === 0
    ? <PromptCard over="Say the same thing">{round.prompt}</PromptCard>
    : (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className={eyebrow + ' text-accent-ink'}>Try {t + 1} of {MELD.tries} · what links these?</div>
        <MeldLink s={s} round={round} t={t} big />
      </div>
    )
}

export function ScreenMeldWrite({ s }: { s: SessionState }) {
  const round = s.meld!.rounds[s.meld!.current]
  const t = round.tries.length - 1
  const words = round.tries[t]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <MeldAbout s={s} round={round} t={t} />
      <WhoIsIn s={s} done={{ A: words.A !== null, B: words.B !== null }} waiting={() => 'Thinking…'} big />
    </div>
  )
}

// The two words turn over one after the other; on a meld the cards light up and knock
// together. On a miss, either of you can say it was the same thing really — and it's a
// meld (it lights up there and then).
const MET_AT = 1300

export function ScreenMeldReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.meld!
  const round = g.rounds[g.current]
  const t = round.tries.length - 1
  const words = round.tries[t]
  const met = round.matched === t
  const last = t === MELD.tries - 1
  // Counted by one of you: it lights up now, not after the flip it's already had.
  const [countedHere] = useState(() => !!round.counted)
  const at = round.counted && !countedHere ? 100 : MET_AT
  const canCount = !met && me !== null && s.phase === 'MELD_REVEAL' && !!words.A && !!words.B
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 text-center">
      <div className="flex flex-col items-center gap-2">
        {t === 0 ? <div className={eyebrow}>{round.prompt}</div> : <MeldLink s={s} round={round} t={t} />}
        <div className="text-xs font-bold text-fg/45">Try {t + 1} of {MELD.tries}</div>
      </div>
      <div className="relative grid grid-cols-2 gap-3">
        {PS.map((p, i) => (
          <div
            key={p}
            style={met ? { animation: `light-tan 350ms ease-out ${at}ms both, ${i === 0 ? 'nudge-r' : 'nudge-l'} 420ms ease-in-out ${at}ms both` } : undefined}
            className="rounded-3xl border-2 border-fg bg-card px-3 py-5 flex flex-col items-center gap-2"
          >
            <Avatar p={p} name={playerName(s, p)} />
            <div style={delay(200 + i * 550)} className={'font-display text-3xl sm:text-4xl font-extrabold break-words animate-flip-in ' + inkOf(p)}>{words[p] || '—'}</div>
          </div>
        ))}
        {met && <Burst hearts delay={at + 100} count={16} />}
        {met && t === 0 && <Stamp tone="tan" delay={at + 500}>First try!</Stamp>}
      </div>
      <div key={met ? 'met' : 'missed'} style={delay(at + 150)} className={'font-display text-3xl font-extrabold ' + verdictFx(met) + (met ? ' text-tan-ink' : ' text-fg/60')}>
        {met
          ? `${round.counted ? 'Counted it!' : 'Mind meld!'} 🤝 +${shown(s, 'meld', MELD_POINTS[t], 'us')}`
          : last ? 'Not this time' : 'So close — go again, and meet in the middle'}
      </div>
      {canCount && (
        <div style={delay(MET_AT + 700)} className="animate-fade-up">
          <button onClick={() => dispatch({ type: 'COUNT_MELD', player: me!, try: t })} className={btnOutline + ' w-full !text-lg'}>
            Same thing really? Count it
          </button>
        </div>
      )}
    </div>
  )
}
