import type { MeldRound, PlayerId, SessionState } from '../../engine/state'
import { MELD } from '../../engine/phases'
import { MELD_POINTS, shown } from '../../engine/standing'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { PromptCard, WhoIsIn } from '../../ui/kit'
import { eyebrow } from '../../ui/styles'

const PS: PlayerId[] = ['A', 'B']

// The tries so far on this prompt, as pairs of words — what you're both aiming between.
export function MeldTrail({ s, round, upTo }: { s: SessionState; round: MeldRound; upTo: number }) {
  const past = round.tries.slice(0, upTo)
  if (past.length === 0) return null
  return (
    <div className="flex flex-col gap-1.5">
      {past.map((t, i) => (
        <div key={i} className="flex items-center justify-center gap-2 text-sm font-bold text-fg/55">
          {PS.map((p, k) => (
            <span key={p} className="flex items-center gap-1.5">
              {k === 1 && <span className="text-fg/30">·</span>}
              <Avatar p={p} name={playerName(s, p)} size="sm" />
              <span className={inkOf(p)}>{t[p] || '—'}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export function ScreenMeldWrite({ s }: { s: SessionState }) {
  const round = s.meld!.rounds[s.meld!.current]
  const t = round.tries.length - 1
  const words = round.tries[t]
  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-6">
      <PromptCard over={t === 0 ? 'Say the same thing' : `Try ${t + 1} of ${MELD.tries} · meet in the middle`}>{round.prompt}</PromptCard>
      <MeldTrail s={s} round={round} upTo={t} />
      <WhoIsIn s={s} done={{ A: words.A !== null, B: words.B !== null }} waiting={() => 'Thinking…'} big />
    </div>
  )
}

export function ScreenMeldReveal({ s }: { s: SessionState }) {
  const g = s.meld!
  const round = g.rounds[g.current]
  const t = round.tries.length - 1
  const words = round.tries[t]
  const met = round.matched === t
  const last = t === MELD.tries - 1
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-5 text-center">
      <div>
        <div className={eyebrow}>{round.prompt}</div>
        <div className="mt-1 text-xs font-bold text-fg/45">Try {t + 1} of {MELD.tries}</div>
      </div>
      <MeldTrail s={s} round={round} upTo={t} />
      <div className="grid grid-cols-2 gap-3">
        {PS.map((p) => (
          <div key={p} className={'rounded-3xl border-2 px-3 py-5 flex flex-col items-center gap-2 ' + (met ? 'border-tan-ink bg-tan-soft' : 'border-fg bg-card')}>
            <Avatar p={p} name={playerName(s, p)} />
            <div className={'font-display text-3xl sm:text-4xl font-extrabold break-words animate-reveal-pop ' + inkOf(p)}>{words[p] || '—'}</div>
          </div>
        ))}
      </div>
      <div className={'font-display text-3xl font-extrabold animate-pop ' + (met ? 'text-tan-ink' : 'text-fg/60')}>
        {met
          ? `Mind meld! 🤝 +${shown(s, 'meld', MELD_POINTS[t], 'us')}`
          : last ? 'Not this time' : 'So close — go again, and meet in the middle'}
      </div>
    </div>
  )
}
