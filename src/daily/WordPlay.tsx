import { useCallback, useEffect, useState } from 'react'
import { api, DailyError, type PuzzleView } from './api'
import { Keyboard, TileRow } from './Tiles'
import { cleanWord, keyStates, lengthWord, loadWords, MAX_GUESSES } from './wordle'

// Solving the word your partner set. Each guess goes to the server and comes back
// coloured — the answer itself only arrives once it's solved or all six are used.
export function WordPlay({
  puzzle: initial,
  partner,
  question,
  mine,
  onClose,
}: {
  puzzle: PuzzleView
  partner: string
  question: string // rendered for you — it's about you, so it has your name in it
  mine: string | null // what you answered, for the side-by-side at the end
  onClose: () => void
}) {
  const [puzzle, setPuzzle] = useState(initial)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [words, setWords] = useState<Set<string> | null>(null)
  const done = puzzle.status !== 'open'
  // Told by the server. Before migration 0003 it didn't say, and every answer was five.
  const length = puzzle.length ?? 5

  useEffect(() => { void loadWords().then(setWords) }, [])

  const bounce = (msg: string) => {
    setNote(msg)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const submit = useCallback(async () => {
    if (typed.length < length) return bounce(`${lengthWord(length)} letters`)
    let list = words
    try {
      list ??= await loadWords() // never skip the check just because it's still loading
    } catch {
      return bounce("Couldn't load the word list — try again")
    }
    if (!list.has(typed)) return bounce('Not in the word list')
    setBusy(true)
    setNote(null)
    try {
      setPuzzle(await api.submitGuess(puzzle.id, typed))
      setTyped('')
    } catch (e) {
      bounce(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [typed, words, puzzle.id, length])

  const onKey = useCallback((key: string) => {
    if (done || busy) return
    if (key === 'Enter') void submit()
    else if (key === 'Backspace') setTyped((t) => t.slice(0, -1))
    else if (/^[a-z]$/i.test(key)) setTyped((t) => cleanWord(t + key, length))
  }, [done, busy, submit, length])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) { e.preventDefault(); onKey(e.key) }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [onKey])

  const rows = Array.from({ length: MAX_GUESSES }, (_, i) => {
    if (i < puzzle.guesses.length) return { letters: puzzle.guesses[i], pattern: puzzle.patterns[i], last: i === puzzle.guesses.length - 1 }
    if (i === puzzle.guesses.length && !done) return { letters: typed, active: true }
    return { letters: '' }
  })

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Their Word · from {partner}</div>
          {/* The clue is the whole puzzle — it always shows in full, never truncated. */}
          <div className="font-display text-xl font-extrabold leading-tight">{partner}'s answer to “{question}”</div>
        </div>
      </header>
      <div className="flex-1 min-h-0 flex flex-col justify-center gap-1.5 px-4">
        {rows.map((r, i) => (
          <div key={i} className={r.active && shake ? 'animate-[shake_0.35s]' : ''}>
            <TileRow letters={r.letters} pattern={r.pattern} active={r.active} reveal={r.last} length={length} />
          </div>
        ))}
        <div className="h-6 mt-2 text-center text-sm font-bold text-accent-ink">{note}</div>
      </div>
      {done ? (
        <div className="shrink-0 px-6 pb-8 flex flex-col items-center gap-3 text-center animate-fade-up">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">
            {puzzle.status === 'solved' ? `Got it in ${puzzle.guesses.length}` : 'Not this time — it was'}
          </div>
          <div className="font-display text-4xl font-bold uppercase tracking-widest text-accent-ink">{puzzle.answer}</div>
          {mine && (
            <div className="text-sm text-fg/60">
              You said <b className="uppercase tracking-wider text-fg">{mine}</b>
              {mine === puzzle.answer ? ' — same word!' : ''}
            </div>
          )}
          <div className="text-sm text-fg/60">Ask {partner} why.</div>
          <button onClick={onClose} className="mt-2 w-full max-w-sm min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <div className="shrink-0 px-2 pb-5">
          <Keyboard onKey={onKey} states={keyStates(puzzle.guesses, puzzle.patterns)} disabled={busy} />
        </div>
      )}
    </div>
  )
}
