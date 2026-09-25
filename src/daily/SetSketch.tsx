import { useCallback, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { compactStrokes } from './sketch'
import { yours } from './SketchCard'
import { SketchPad } from './SketchPad'
import type { DrawStroke } from '../engine/state'

// Two steps, same as the live game: the answer first — typed, private — because that's
// what the guesses are checked against, and saying it first stops you drawing something
// easier to draw instead. Then the canvas; nothing leaves the phone until Send.
export function SetSketch({
  partner,
  prompt,
  onClose,
  forDate,
}: {
  partner: string
  prompt: string
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const [answer, setAnswer] = useState('')
  const [drawingNow, setDrawingNow] = useState(false)
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const send = useCallback(async () => {
    if (strokes.length === 0) return setNote('Draw something first')
    setBusy(true)
    setNote(null)
    try {
      await api.setSketch(forDate ?? localDate(), prompt, answer.trim(), compactStrokes(strokes))
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [strokes, prompt, answer, forDate])

  const header = (
    <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
      <button onClick={drawingNow && !sent ? () => setDrawingNow(false) : onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
      <div className="min-w-0">
        <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`Sketch · ${forDate ? 'tomorrow' : 'today'}'s question`}</div>
        <div className="font-display text-xl font-extrabold leading-tight">{yours(prompt)}</div>
      </div>
    </header>
  )

  if (sent) {
    return (
      <div className="h-full flex flex-col select-none">
        {header}
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they start.` : <>{partner} gets three guesses once they've drawn theirs. You can change it until they start.</>}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      </div>
    )
  }

  if (!drawingNow) {
    const go = () => { if (answer.trim()) setDrawingNow(true) }
    return (
      <div className="h-full flex flex-col select-none">
        {header}
        <div className="flex-1 min-h-0 flex flex-col justify-center gap-4 px-6">
          <div className="text-sm text-fg/70 leading-snug">
            Answer it for real, in a word or two — only you see this. Then draw it, and {partner} has
            three goes at guessing what you wrote.
          </div>
          <input
            className="w-full min-h-[56px] rounded-2xl border-2 border-fg bg-card px-4 text-xl font-bold outline-none focus:border-pa placeholder:text-fg/30 placeholder:font-semibold disabled:opacity-60"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') go() }}
            maxLength={30}
            placeholder="your answer"
            autoFocus
            autoComplete="off"
          />
          <button
            className="w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px disabled:opacity-40"
            onClick={go}
            disabled={!answer.trim()}
          >
            Now draw it
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col select-none">
      {header}
      <div className="flex-1 min-h-0 flex flex-col gap-3 px-5 pb-5">
        <div className="text-xl font-display font-extrabold leading-tight">
          Drawing: <span className="text-accent-ink">{answer.trim()}</span>
          <span className="block text-[0.6rem] tracking-[0.3em] text-fg/40 font-normal mt-1">No words, no letters</span>
        </div>
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <SketchPad strokes={strokes} onChange={setStrokes} disabled={busy} />
        </div>
        <div className="h-5 text-sm font-bold text-accent-ink text-center">{note}</div>
        <div className="flex gap-2">
          <button
            className="flex-1 min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px disabled:opacity-30"
            onClick={() => setStrokes((prev) => prev.slice(0, -1))}
            disabled={strokes.length === 0 || busy}
          >
            Undo
          </button>
          <button
            className="flex-[2] min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px disabled:opacity-50"
            onClick={() => void send()}
            disabled={busy}
          >
            Send it
          </button>
        </div>
      </div>
    </div>
  )
}
