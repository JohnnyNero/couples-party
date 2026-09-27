import { useState } from 'react'
import { shareFiles } from './shareFiles'

// "Save the replay": makes the GIF on the first tap (a second or so), then shares it on
// the next — a phone only opens its share sheet straight from a tap, and making the
// replay takes longer than it allows.
export function ReplayButton({ make, filename = 'coupled-replay.gif', label = 'Make a replay' }: { make: () => Promise<Blob>; filename?: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'making' | 'ready'>('idle')
  const [gif, setGif] = useState<Blob | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const go = async () => {
    if (state === 'making') return
    if (state === 'idle' || !gif) {
      setState('making')
      try {
        setGif(await make())
        setState('ready')
      } catch {
        setState('idle')
        setNote('Couldn’t make the replay')
      }
      return
    }
    const r = await shareFiles({ file: gif, filename, title: 'Coupled' })
    if (r === 'saved') setNote('Saved to your phone')
    else if (r === 'failed') setNote('Couldn’t share from this browser')
  }
  return (
    <div className="flex flex-col items-center gap-1">
      <button onClick={() => void go()} disabled={state === 'making'} className="press min-h-[44px] px-4 rounded-full border-2 border-fg/20 bg-card text-sm font-extrabold inline-flex items-center gap-2 disabled:opacity-60">
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {state === 'ready' ? <><path d="M12 3v12M8 7l4-4 4 4" /><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8" /></> : <path d="M8 5v14l11-7z" />}
        </svg>
        {state === 'making' ? 'Making it…' : state === 'ready' ? 'Share the replay' : label}
      </button>
      {note && <div className="text-xs font-bold text-fg/55">{note}</div>}
    </div>
  )
}
