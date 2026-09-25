import type { ChainRound } from '../engine/state'

// The chain so far, newest last. Each word's last letter is picked out, so you can see
// how the next one follows. `broken` marks the end of a round someone lost.
export function ChainTrail({ round, max = 8, broken = false }: { round: ChainRound; max?: number; broken?: boolean }) {
  const shown = round.chain.slice(-max)
  const hidden = round.chain.length - shown.length
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-1 text-lg sm:text-3xl font-bold capitalize tracking-tight">
      {hidden > 0 && <span className="text-fg/30">…</span>}
      {shown.map((l, i) => {
        const last = i === shown.length - 1
        // The live word marks the letter actually needed next — usually its last, but
        // an earlier one when nothing left starts with the last ("fox" hands over an o).
        const at = last && !broken && round.need ? l.word.toLowerCase().lastIndexOf(round.need) : -1
        const cut = at >= 0 ? at : l.word.length - 1
        return (
          <span key={hidden + i} className={'flex items-baseline gap-2 ' + (last ? '' : 'text-fg/45')}>
            {i > 0 && <span className="text-fg/25 text-base sm:text-2xl">→</span>}
            <span>
              {l.word.slice(0, cut)}
              <span className="text-accent">{l.word.slice(cut, cut + 1)}</span>
              {l.word.slice(cut + 1)}
            </span>
          </span>
        )
      })}
      {broken && <span className="text-fg/25 text-base sm:text-2xl">→ <span className="text-accent">✕</span></span>}
    </div>
  )
}
