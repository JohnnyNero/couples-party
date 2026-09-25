import type { ChainRound } from '../engine/state'
import { inkOf, softOf } from '../ui/Avatar'

// The chain so far, newest last, each word a chip in the colour of whoever said it (the
// starter word is nobody's). Each word's handover letter is picked out, so you can see
// how the next one follows. `broken` marks the end of a round someone lost.
export function ChainTrail({ round, max = 8, broken = false }: { round: ChainRound; max?: number; broken?: boolean }) {
  const shown = round.chain.slice(-max)
  const hidden = round.chain.length - shown.length
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-lg sm:text-3xl font-bold capitalize">
      {hidden > 0 && <span className="text-fg/30">…</span>}
      {shown.map((l, i) => {
        const last = i === shown.length - 1
        // The live word marks the letter actually needed next — usually its last, but
        // an earlier one when nothing left starts with the last ("fox" hands over an o).
        const at = last && !broken && round.need ? l.word.toLowerCase().lastIndexOf(round.need) : -1
        const cut = at >= 0 ? at : l.word.length - 1
        const chip = l.by ? `${softOf(l.by)} ${inkOf(l.by)}` : 'bg-fg/10 text-fg'
        return (
          <span key={hidden + i} className="flex items-center gap-1.5">
            {i > 0 && <span className="text-fg/25 text-sm sm:text-xl">→</span>}
            <span className={'rounded-xl px-2.5 py-0.5 ' + chip + (last ? ' ring-2 ring-fg animate-pop' : ' opacity-70')}>
              {l.word.slice(0, cut)}
              <span className="underline decoration-[3px] underline-offset-4">{l.word.slice(cut, cut + 1)}</span>
              {l.word.slice(cut + 1)}
            </span>
          </span>
        )
      })}
      {broken && <span className="text-fg/30 text-sm sm:text-xl">→ <span className="text-pa-ink font-extrabold">✕</span></span>}
    </div>
  )
}
