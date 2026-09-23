import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, DailyError } from './api'
import { loadWordPrompts } from '../packs'
import { makeRng, shuffled } from '../engine/rng'
import { Keyboard, TileRow } from './Tiles'
import { cleanWord, loadWords, WORD_LENGTH } from './wordle'

// Setting your partner's word. Three prompts to choose from — one of them usually has a
// five-letter answer that's true — then the same keyboard they'll solve it on.
export function WordSet({
  partner,
  forDate,
  when,
  onClose,
  onDone,
}: {
  partner: string
  forDate: string
  when: 'today' | 'tomorrow'
  onClose: () => void
  onDone: () => void
}) {
  const [allPrompts, setAllPrompts] = useState<string[]>([])
  const [deal, setDeal] = useState(0)
  const [prompt, setPrompt] = useState<string | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [words, setWords] = useState<Set<string> | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    void loadWordPrompts().then(setAllPrompts)
    void loadWords().then(setWords)
  }, [])

  // Seeded by the date and how many times you've asked for others, so the three you
  // see don't reshuffle under your thumb on a re-render.
  const options = useMemo(() => {
    const seed = Number(forDate.replace(/-/g, '')) + deal * 7919
    return shuffled(makeRng(seed), allPrompts).slice(0, 3)
  }, [allPrompts, forDate, deal])

  const send = useCallback(async () => {
    if (!prompt) return
    if (typed.length < WORD_LENGTH) return setNote('Five letters')
    if (words && !words.has(typed)) return setNote("Not in the word list — they couldn't guess it")
    setBusy(true)
    setNote(null)
    try {
      await api.setWord(forDate, prompt, typed)
      setSent(true)
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : "Couldn't send that — try again")
    } finally {
      setBusy(false)
    }
  }, [prompt, typed, words, forDate])

  const onKey = useCallback((key: string) => {
    if (!prompt || busy || sent) return
    setNote(null)
    if (key === 'Enter') void send()
    else if (key === 'Backspace') setTyped((t) => t.slice(0, -1))
    else if (/^[a-z]$/i.test(key)) setTyped((t) => cleanWord(t + key))
  }, [prompt, busy, sent, send])

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
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2 pr-14">
        <button onClick={prompt && !sent ? () => { setPrompt(null); setTyped('') } : onClose} aria-label="Back" className="text-2xl text-fg/60 px-1 active:translate-y-px">←</button>
        <div className="min-w-0">
          <div className="text-[0.6rem] uppercase tracking-[0.3em] text-fg/40">Their Word · for {partner}, {when}</div>
          <div className="text-lg font-bold leading-tight">{prompt ? `“${prompt}”` : 'Pick a question'}</div>
        </div>
      </header>

      {sent ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center animate-fade-up">
          <TileRow letters={typed} pattern="ggggg" reveal />
          <div className="text-xl font-bold">Sent.</div>
          <div className="text-fg/60">
            {partner} gets it {when}, as your answer to “{prompt}”. You can change it until they start.
          </div>
          <button onClick={onDone} className="mt-2 min-h-[52px] px-10 rounded-xl bg-accent text-bg font-bold uppercase tracking-widest active:translate-y-px">
            Done
          </button>
        </div>
      ) : !prompt ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          <p className="text-sm text-fg/60">
            Answer it for real, in exactly five letters. {partner} plays it {when} as a Wordle, with the question as the only clue.
          </p>
          {options.map((p) => (
            <button
              key={p}
              onClick={() => setPrompt(p)}
              className="text-left rounded-2xl border-2 border-fg/15 px-5 py-4 text-lg font-bold active:translate-y-px active:border-accent"
            >
              {p}
            </button>
          ))}
          <button onClick={() => setDeal((d) => d + 1)} className="self-center mt-1 px-4 py-2 text-sm uppercase tracking-widest text-fg/50 active:translate-y-px">
            Other questions
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex flex-col justify-center items-center gap-4 px-4">
            <div className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/40">Your five-letter answer</div>
            <TileRow letters={typed} active />
            <div className="h-6 text-sm font-bold text-accent text-center">{note}</div>
          </div>
          <div className="shrink-0 px-2 pb-5 flex flex-col gap-3">
            <Keyboard onKey={onKey} disabled={busy} />
          </div>
        </>
      )}
    </div>
  )
}
