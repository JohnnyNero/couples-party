import { useEffect, useState } from 'react'
import { DailyError, type IdeaKind } from '../daily/api'
import { GameIcon } from '../ui/GameIcon'
import { btnAccent, eyebrow, field } from '../ui/styles'
import { addIdea, deleteIdea, refreshIdeas, useIdeas } from './store'
import type { GameKey } from '../engine/state'

// Your own cards for the games, one shared list for the two of you. Either of you can
// add or take one off; new ones are dealt in ahead of the built-in cards.

type KindInfo = { label: string; icon: GameKey | 'word'; help: string; example: string }

const KINDS: Record<IdeaKind, KindInfo> = {
  mrmrs: { label: 'Mr & Mrs', icon: 'mrmrs', help: 'A question you each answer about yourself — and guess the other’s answer.', example: 'Your first impression of me?' },
  finger: { label: 'Put a Finger Down', icon: 'finger', help: 'Something one of you might have done. It reads “Put a finger down if…”', example: 'you’ve pretended to like a present' },
  lights: { label: 'Lights Out', icon: 'lights', help: 'The last question of the night, to talk about with the phones down.', example: 'What are you looking forward to this month?' },
  wave: { label: 'Wavelength', icon: 'wave', help: 'Two opposite ends of a scale. One of you names something that sits on it.', example: 'Cringe | Cool' },
  clash: { label: 'Category Clash', icon: 'clash', help: 'A category with lots of answers, for the letter round.', example: 'Things in our fridge' },
  word: { label: 'Their Word', icon: 'word', help: 'A question for the daily word puzzle, answered in five or six letters. Every other day uses one of yours.', example: 'Your go-to takeaway' },
}
const ORDER: IdeaKind[] = ['mrmrs', 'finger', 'lights', 'wave', 'clash', 'word']

export function OurQuestions({ onClose, partner }: { onClose: () => void; partner: string }) {
  const ideas = useIdeas()
  const [kind, setKind] = useState<IdeaKind>('mrmrs')
  useEffect(() => { void refreshIdeas() }, [])
  const info = KINDS[kind]
  const list = ideas.filter((i) => i.kind === kind).slice().reverse() // newest at the top

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col animate-fade-up">
      <header className="shrink-0 flex items-center gap-3 px-5 pt-5 pb-2">
        <button onClick={onClose} aria-label="Back" className="shrink-0 w-10 h-10 rounded-full border-2 border-fg/15 bg-card inline-flex items-center justify-center text-xl text-fg/70 active:translate-y-px">←</button>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold leading-tight">Our questions</h1>
          <div className="text-sm text-fg/55">Shared with {partner}. New ones come up first.</div>
        </div>
      </header>

      <nav className="shrink-0 flex gap-2 overflow-x-auto px-5 py-3 [scrollbar-width:none]" aria-label="Game">
        {ORDER.map((k) => {
          const n = ideas.filter((i) => i.kind === k).length
          const on = k === kind
          return (
            <button
              key={k}
              onClick={() => setKind(k)}
              aria-pressed={on}
              className={
                'shrink-0 flex items-center gap-2 rounded-full border-2 pl-1.5 pr-3 py-1 text-sm font-extrabold whitespace-nowrap ' +
                (on ? 'border-fg bg-card' : 'border-fg/10 text-fg/60')
              }
            >
              <KindIcon icon={KINDS[k].icon} />
              {KINDS[k].label}
              {n > 0 && <span className="rounded-full bg-fg/10 px-1.5 text-xs tabular-nums">{n}</span>}
            </button>
          )
        })}
      </nav>

      <main className="flex-1 min-h-0 overflow-y-auto px-5 pb-10">
        <div className="w-full max-w-md mx-auto flex flex-col gap-4">
          <AddIdea key={kind} kind={kind} info={info} />
          {list.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-fg/15 px-5 py-6 text-center text-sm text-fg/55">
              Nothing here yet. Something like “{info.example}”.
            </div>
          ) : (
            <section className="flex flex-col">
              <div className={eyebrow + ' mb-1'}>{list.length} added</div>
              {list.map((i) => (
                <IdeaRow key={i.id} text={i.text} by={i.mine ? 'You' : partner} onDelete={() => deleteIdea(i.id)} />
              ))}
            </section>
          )}
        </div>
      </main>
    </div>
  )
}

function AddIdea({ kind, info }: { kind: IdeaKind; info: KindInfo }) {
  const [text, setText] = useState('')
  const [low, setLow] = useState('')
  const [high, setHigh] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const scale = kind === 'wave'
  const value = scale ? `${low.trim()} | ${high.trim()}` : text.trim()
  const ready = scale ? low.trim() !== '' && high.trim() !== '' : text.trim().length >= 2
  const [exLow, exHigh] = info.example.split(' | ')

  const add = async () => {
    if (!ready || busy) return
    setBusy(true)
    setNote(null)
    try {
      await addIdea(kind, value)
      setText(''); setLow(''); setHigh('')
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : 'Couldn’t add that — try again.')
    } finally {
      setBusy(false)
    }
  }
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') void add() }

  return (
    <section className="flex flex-col gap-2.5">
      <div className="text-sm text-fg/65 leading-snug">{info.help}</div>
      {scale ? (
        <div className="flex items-center gap-2">
          <input className={field + ' !text-lg'} value={low} onChange={(e) => setLow(e.target.value)} onKeyDown={enter} maxLength={24} placeholder={exLow} aria-label="One end" />
          <span className="font-display text-xl text-fg/35">↔</span>
          <input className={field + ' !text-lg'} value={high} onChange={(e) => setHigh(e.target.value)} onKeyDown={enter} maxLength={24} placeholder={exHigh} aria-label="The other end" />
        </div>
      ) : (
        <div className="flex items-stretch gap-2">
          {kind === 'finger' && <span className="shrink-0 self-center text-sm font-bold text-fg/45">…if</span>}
          <input className={field + ' !text-lg'} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={enter} maxLength={120} placeholder={info.example} aria-label={`New ${info.label} card`} />
        </div>
      )}
      <button className={btnAccent} onClick={() => void add()} disabled={!ready || busy}>Add it</button>
      {note && <div className="text-sm font-bold text-pa-ink">{note}</div>}
    </section>
  )
}

function IdeaRow({ text, by, onDelete }: { text: string; by: string; onDelete: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex items-center gap-3 border-b border-fg/10 last:border-0 py-2.5">
      <div className="flex-1 min-w-0">
        <div className="font-bold leading-snug break-words">{text}</div>
        <div className="text-xs font-bold text-fg/45">Added by {by}</div>
      </div>
      <button
        onClick={() => { setBusy(true); onDelete().catch(() => setBusy(false)) }}
        disabled={busy}
        aria-label={`Remove “${text}”`}
        className="shrink-0 w-9 h-9 rounded-full text-fg/40 inline-flex items-center justify-center active:bg-fg/10 disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
  )
}

function KindIcon({ icon }: { icon: KindInfo['icon'] }) {
  if (icon !== 'word') return <GameIcon game={icon} size="sm" className="!w-7 !h-7 !rounded-full" />
  return (
    <span className="shrink-0 w-7 h-7 rounded-full bg-sage-soft text-sage-ink inline-flex items-center justify-center">
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" opacity=".55" />
        <rect x="3" y="13" width="8" height="8" rx="2" opacity=".55" /><rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    </span>
  )
}
