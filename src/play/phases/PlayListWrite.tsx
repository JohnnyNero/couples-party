import type { PlayerId, SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { currentAct } from '../../engine/list'
import { dispatch } from '../../net'
import { themeText } from '../../views/list'

// Tap seven from the theme's own pool — nobody has to come up with items cold. Locks
// one at a time, like the cold open did: no changing your mind once it's tapped.
export function PlayListWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const theme = themeText(s, act)

  if (me !== act.author) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-3">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">They're picking</div>
        <div className="text-xl font-bold uppercase tracking-tight">{theme}</div>
        <div className="text-sm uppercase tracking-wide text-fg/45">You'll rank them</div>
      </div>
    )
  }

  const done = act.items.length
  const picked = new Set(act.items.map((i) => i.poolIndex))
  const full = done >= LIST.items

  return (
    <div className="h-full flex flex-col p-5 gap-3">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          {done} of {LIST.items} picked
        </div>
        <div className="text-xl font-bold uppercase tracking-tight">{theme}</div>
      </div>
      <div className="flex gap-1">
        {act.items.map((i) => (
          <span key={i.id} className="h-2 flex-1 bg-accent" />
        ))}
        {Array.from({ length: LIST.items - done }, (_, k) => (
          <span key={`e${k}`} className="h-2 flex-1 border-2 border-fg/25" />
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-auto flex flex-col gap-1.5">
        {act.pool.map((text, i) => {
          const taken = picked.has(i)
          return (
            <button
              key={i}
              disabled={taken || full}
              onClick={() => dispatch({ type: 'SUBMIT_ITEMS', player: me, poolIndex: i })}
              className={
                'min-h-[48px] w-full text-left px-4 uppercase border-2 active:translate-y-px ' +
                (taken
                  ? 'border-fg/10 text-fg/20 line-through'
                  : 'border-fg/25 bg-fg text-bg')
              }
            >
              {text}
            </button>
          )
        })}
      </div>
      <div className="text-xs uppercase tracking-wide text-fg/40">Tap seven — no changing your mind</div>
    </div>
  )
}
