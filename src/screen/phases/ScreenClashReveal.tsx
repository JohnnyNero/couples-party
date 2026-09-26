import type { ClashRound, PlayerId, SessionState } from '../../engine/state'
import { other } from '../../engine/state'
import { clashCellPoints, clashVerdict, type ClashVerdict } from '../../engine/clash'
import { shown as scaled } from '../../engine/standing'
import { dispatch, useMyPlayerId } from '../../net'
import { playerName } from '../../views/list'
import { Avatar, inkOf } from '../../ui/Avatar'
import { LetterTile } from '../../ui/kit'
import { card, eyebrow } from '../../ui/styles'
import { Stamp, at } from '../../ui/fx'

// The round's six categories as a table that fills in one row per tap: both answers
// side by side, each marked with what it scored. The live row is where a challenge
// can land — "beans is not a reason to be late" is the argument this game is for.
export function ScreenClashReveal({ s }: { s: SessionState }) {
  const me = useMyPlayerId()
  const g = s.clash!
  const round = g.rounds[g.current]
  // Every category scored, once the last row is up: a clean sweep, stamped for whoever
  // did it (both of you, if you both did).
  const lastRow = round.revealIndex >= round.categories.length - 1
  const swept = lastRow ? (['A', 'B'] as const).filter((p) => round.categories.every((_, i) => clashVerdict(round, p, i) === 'scores')) : []
  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <LetterTile letter={round.letter} size="sm" />
        <span className={eyebrow}>
          Category {round.revealIndex + 1} of {round.categories.length}
        </span>
      </div>

      <section className={'relative ' + card + ' px-3 py-1.5'}>
        {swept.length > 0 && <Stamp delay={1200}>{swept.length === 2 ? 'Both swept!' : `${playerName(s, swept[0])} swept it`}</Stamp>}
        <div className="flex items-center py-1.5">
          <span className="flex-1 min-w-0" />
          {(['A', 'B'] as const).map((p) => (
            <span key={p} className="w-[6.5rem] sm:w-44 shrink-0 flex items-center justify-center gap-1.5">
              <Avatar p={p} name={playerName(s, p)} size="sm" />
              <span className={'font-display text-lg sm:text-2xl font-extrabold tabular-nums ' + inkOf(p)}>{scaledRound(s, round, p)}</span>
            </span>
          ))}
        </div>
        {round.categories.map((cat, i) =>
          i <= round.revealIndex ? (
            <Row key={i} s={s} round={round} i={i} cat={cat} live={i === round.revealIndex} />
          ) : (
            <div key={i} className="border-t border-fg/10 h-[2.9rem] sm:h-[3.6rem]" />
          ),
        )}
      </section>
      {me !== null && s.phase === 'CLASH_REVEAL' && <ClashRevealControls s={s} me={me} />}
    </div>
  )
}

// A round's points so far, as the board scores them: each cell scaled on its own.
function scaledRound(s: SessionState, round: ClashRound, p: PlayerId): number {
  let n = 0
  for (let i = 0; i <= round.revealIndex; i++) n += scaled(s, 'clash', clashCellPoints(round, p, i))
  return n
}

const LABEL: Record<ClashVerdict, string> = {
  scores: '',
  same: 'same',
  blank: '',
  'wrong-letter': 'wrong letter',
  challenged: 'challenged',
}

function Row({ s, round, i, cat, live }: { s: SessionState; round: ClashRound; i: number; cat: string; live: boolean }) {
  return (
    <div className={'flex items-center border-t border-fg/10 h-[2.9rem] sm:h-[3.6rem] ' + (live ? 'animate-fade-up' : '')}>
      <span className={'flex-1 min-w-0 pr-2 text-xs sm:text-base font-extrabold leading-tight line-clamp-2 ' + (live ? 'text-fg' : 'text-fg/50')}>
        {cat}
      </span>
      {(['A', 'B'] as const).map((p, k) => {
        const v = clashVerdict(round, p, i)
        const pts = scaled(s, 'clash', clashCellPoints(round, p, i))
        return (
          <span key={p} className="w-[6.5rem] sm:w-44 shrink-0 text-center leading-tight">
            <span
              style={live ? at(150 + k * 300) : undefined}
              className={'block font-display text-base sm:text-2xl font-extrabold leading-tight truncate ' + (live ? 'animate-flip-in ' : '') + (v === 'scores' || v === 'challenged' ? inkOf(p) : 'text-fg/40 line-through decoration-2')}
            >
              {round.answers[p]?.[i] || '—'}
            </span>
            <span
              style={live ? at(800 + k * 120) : undefined}
              className={'block text-[0.65rem] sm:text-sm font-bold text-fg/50 ' + (live ? (pts ? 'animate-slam' : 'animate-wiggle') : '')}
            >
              {LABEL[v] ? `${LABEL[v]} · ` : ''}<span className={pts ? 'text-sage-ink font-extrabold' : ''}>{pts ? `+${pts}` : '0'}</span>
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
          className="flex-1 min-h-[52px] rounded-2xl border-2 border-fg bg-card text-base sm:text-lg font-display font-extrabold press truncate px-2"
        >
          That doesn’t count
        </button>
      )}
      <button
        onClick={() => dispatch({ type: 'ADVANCE_REVEAL', player: me })}
        className="flex-1 min-h-[52px] rounded-2xl bg-fg text-bg font-display text-lg sm:text-2xl font-extrabold press"
      >
        {!lastRow ? 'Next' : lastRound ? 'Done' : 'Next round'}
      </button>
    </div>
  )
}
