import { useCallback, useEffect, useState } from 'react'
import { api, DailyError } from './api'
import { localDate } from './dates'
import { Keyboard, TileRow } from './Tiles'
import { cleanWord, loadWords, MAX_LENGTH, MIN_LENGTH } from './wordle'

// Answering today's question: five or six letters on the same keyboard they'll solve it on,
// checked against the word list so it's something they can actually get.
export function WordAnswer({
  partner,
  template,
  question,
  onClose,
  forDate,
}: {
  partner: string
  template: string // the question as stored, with {name} — the server keeps this
  question: string // the same, rendered for you to read
  onClose: () => void
  forDate?: string // who it's for and when: tomorrow, on the Today board
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [words, setWords] = useState<Set<string> | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => { void loadWords().then(setWords) }, [])

  const send = useCallback(async () => {
    if (typed.length < MIN_LENGTH) return setNote('Five or six letters')
    // Wait for the list rather than skip the check — a quick typist mustn't be able to
    // slip a non-word through before it has loaded.
    let list = words
    try {
      list ??= await loadWords()
    } catch {
      return setNote("Couldn't load the word list — try again")
    }
    if (!list.has(typed)) return setNote("Not in the word list — they couldn't guess it")
    setBusy(true)
    setNote(null)
    try {
      await api.setWord(forDate ?? localDate(), template, typed)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [typed, words, template, forDate])

  const onKey = useCallback((key: string) => {
    if (busy || sent) return
    setNote(null)
    if (key === 'Enter') void send()
    else if (key === 'Backspace') setTyped((t) => t.slice(0, -1))
    else if (/^[a-z]$/i.test(key)) setTyped((t) => cleanWord(t + key))
  }, [busy, sent, send])

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-z]$/i.test(e.key)) { e.preventDefault(); onKey(e.key) }
    }
    window.addEventListener('keydown', onDown)
    return () => window.removeEventListener('keydown', onDown)
  }, [onKey])

  return (
    <div className="h-full flex flex-col select-none">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">{`Their Word · ${forDate ? 'tomorrow' : 'today'}'s question`}</div>
          <div className="font-display text-xl font-extrabold leading-tight">{question}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <TileRow letters={typed} length={typed.length} pattern={'g'.repeat(typed.length)} reveal />
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {forDate ? `${partner} gets it tomorrow. You can change it until they start.` : <>{partner} solves it once they've answered too. You can change it until they start.</>}
          </div>
          <button onClick={onClose} className="mt-2 min-h-[52px] px-10 rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px">
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex flex-col justify-center items-center gap-4 px-4">
            <div className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Your answer, in five or six letters</div>
            <TileRow letters={typed} length={MAX_LENGTH} optionalFrom={MIN_LENGTH} active />
            <div className="h-6 text-sm font-bold text-accent-ink text-center">{note}</div>
          </div>
          <div className="shrink-0 px-2 pb-5">
            <Keyboard onKey={onKey} disabled={busy} />
          </div>
        </>
      )}
    </div>
  )
}
