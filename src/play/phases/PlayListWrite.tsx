import { useState } from 'react'
import type { PlayerId, SessionState } from '../../engine/state'
import { LIST } from '../../engine/phases'
import { currentAct } from '../../engine/list'
import { dispatch } from '../../net'
import { themeText } from '../../views/list'

// Fields lock one at a time, like the cold open did: a phone that sleeps or a clock that
// runs out keeps whatever was already written. No editing — the first instinct is the
// funny one.
export function PlayListWrite({ s, me }: { s: SessionState; me: PlayerId }) {
  const act = currentAct(s)!
  const [text, setText] = useState('')
  const theme = themeText(s, act)

  if (me !== act.author) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-3">
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">They're writing</div>
        <div className="text-xl font-bold uppercase tracking-tight">{theme}</div>
        <div className="text-sm uppercase tracking-wide text-fg/45">You'll rank them</div>
      </div>
    )
  }

  const done = act.items.length
  const submit = () => {
    const t = text.trim()
    if (t.length === 0) return
    dispatch({ type: 'SUBMIT_ITEMS', player: me, text: t })
    setText('')
  }

  return (
    <div className="h-full flex flex-col justify-center p-6 gap-3">
      <div>
        <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40 mb-1">
          {done} of {LIST.items} locked
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
      <input
        className="w-full min-h-[56px] text-lg bg-fg text-bg px-4 outline-none border-b-4 border-accent placeholder:text-bg/30"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
        maxLength={LIST.maxLen}
        placeholder={`item ${Math.min(done + 1, LIST.items)}`}
        autoComplete="off"
        autoFocus
      />
      <button
        className="w-full min-h-[56px] bg-accent text-bg text-xl font-bold uppercase tracking-widest active:translate-y-px"
        onClick={submit}
      >
        Lock it in
      </button>
      <div className="text-xs uppercase tracking-wide text-fg/40">No editing after you lock it</div>
    </div>
  )
}
