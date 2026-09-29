import { Person } from './Tour'
import { card } from '../ui/styles'
import { openWelcome } from './flags'

// Not paired yet: Coupled's for two, so this is the one thing to do — straight into the
// setting-up steps, the code for someone who's been sent one, or the tour again.
export function InviteCard() {
  return (
    <section className={card + ' p-5 flex flex-col gap-4'}>
      <div className="flex items-center gap-4">
        <div className="flex shrink-0">
          <Person className="bg-pa ring-2 ring-card" size="w-12 h-12" glyph="w-7 h-7" />
          <span className="-ml-3 w-12 h-12 rounded-full border-2 border-dashed border-pb/60 bg-pb-soft inline-flex items-center justify-center font-display text-xl font-extrabold text-pb-ink">?</span>
        </div>
        <div className="min-w-0">
          <div className="font-display text-xl font-extrabold leading-tight">Coupled is for two</div>
          <div className="text-sm text-fg/60 leading-snug">Invite your partner and your daily puzzles start.</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button onClick={() => openWelcome('you')} className="min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold press">
          Invite your partner
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => openWelcome('code')} className="min-h-[48px] rounded-2xl border-2 border-fg bg-card font-display text-base font-extrabold press">
            I’ve got a code
          </button>
          <button onClick={() => openWelcome('tour-only')} className="min-h-[48px] rounded-2xl border-2 border-fg/15 font-display text-base font-extrabold text-fg/65 press">
            How it works
          </button>
        </div>
      </div>
    </section>
  )
}
