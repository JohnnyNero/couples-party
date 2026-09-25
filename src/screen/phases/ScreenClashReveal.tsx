import type { ClashRound, PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { clashCellPoints, clashRoundPoints, clashVerdict, type ClashVerdict } from '../../engine/clash'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'

// The round's six categories as a table that fills in one row per tap: both answers
// side by side, each marked with what it scored. The live row is where a challenge
// can land — "beans is not a reason to be late" is the argument this game is for.
export function ScreenClashReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.clash!
  const round = g.rounds[g.current]
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.6rem] sm:text-xs uppercase tracking-[0.25em] text-fg/40">
          Round {round.index} of {g.rounds.length} · category {round.revealIndex + 1} of {round.categories.length}
        </span>
        <span className="font-display text-3xl sm:text-5xl font-bold text-accent leading-none">{round.letter}</span>
      </div>

      <div className="flex text-[0.55rem] sm:text-[0.7rem] uppercase tracking-[0.2em] text-fg/40">
        <span className="flex-1 min-w-0" />
        {(['A', 'B'] as const).map((p) => (
          <span key={p} className="w-[6.5rem] sm:w-44 text-center shrink-0 truncate">{playerName(s, p)}</span>
        ))}
      </div>
      <div className="border-t-2 border-fg/80">
        {round.categories.map((cat, i) =>
          i <= round.revealIndex ? (
            <Row key={i} round={round} i={i} cat={cat} live={i === round.revealIndex} />
          ) : (
            <div key={i} className="border-b border-fg/10 h-[2.6rem] sm:h-[3.4rem]" />
          ),
        )}
      </div>

      <div className="flex items-baseline justify-between gap-3 text-base sm:text-2xl font-bold uppercase tracking-tight tabular-nums">
        {(['A', 'B'] as const).map((p) => (
          <span key={p}>{playerName(s, p)} <span className="text-accent">{clashRoundPoints(round, p)}</span></span>
        ))}
      </div>
      {me !== null && s.phase === 'CLASH_REVEAL' && <ClashRevealControls s={s} me={me} />}
    </div>
  )
}

const LABEL: Record<ClashVerdict, string> = {
  scores: '',
  same: 'same',
  blank: '',
  'wrong-letter': 'wrong letter',
  challenged: 'challenged',
}

function Row({ round, i, cat, live }: { round: ClashRound; i: number; cat: string; live: boolean }) {
  return (
    <div className={'flex items-center border-b border-fg/10 py-1.5 sm:py-2 ' + (live ? 'animate-fade-up' : '')}>
      <span className={'flex-1 min-w-0 pr-2 text-[0.65rem] sm:text-sm uppercase tracking-wide truncate ' + (live ? 'text-fg' : 'text-fg/50')}>
        {cat}
      </span>
      {(['A', 'B'] as const).map((p) => {
        const v = clashVerdict(round, p, i)
        const pts = clashCellPoints(round, p, i)
        return (
          <span key={p} className="w-[6.5rem] sm:w-44 shrink-0 text-center leading-tight">
            <span className={'block text-sm sm:text-xl font-bold truncate ' + (v === 'scores' || v === 'challenged' ? '' : 'text-fg/40 line-through decoration-2')}>
              {round.answers[p]?.[i] || '—'}
            </span>
            <span className="block text-[0.55rem] sm:text-xs uppercase tracking-widest text-fg/45">
              {LABEL[v] ? `${LABEL[v]} · ` : ''}<span className={pts ? 'text-accent font-bold' : ''}>{pts ? `+${pts}` : '0'}</span>
            </span>
          </span>
        )
      })}
    </div>
  )
}

// Challenge your partner's answer on the live row (only if it's still scoring), and move
// the reveal on. Shared by the board (phones-only) and the phone (with a TV).
export function ClashRevealControls({ s, me }: { s: SessionState; me: PlayerId }) {
  const g = s.clash!
  const round = g.rounds[g.current]
  const i = round.revealIndex
  const them = other(me)
  const canChallenge = clashVerdict(round, them, i) === 'scores'
  const lastRow = i >= round.categories.length - 1
  const lastRound = g.current >= g.rounds.length - 1
  return (
    <div className="flex gap-2">
      {canChallenge && (
        <button
          onClick={() => dispatch({ type: 'CHALLENGE', player: me, index: i })}
          className="flex-1 min-h-[48px] rounded-xl border-2 border-accent text-accent text-sm sm:text-base font-bold uppercase tracking-wide active:translate-y-px truncate px-2"
        >
          That doesn't count
        </button>
      )}
      <button
        onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}
        className="flex-1 min-h-[48px] rounded-xl bg-accent text-bg text-base sm:text-xl font-bold uppercase tracking-widest active:translate-y-px"
      >
        {!lastRow ? 'Next' : lastRound ? 'Done' : 'Next round'}
      </button>
    </div>
  )
}
