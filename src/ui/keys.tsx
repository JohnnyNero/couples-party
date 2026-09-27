import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { buzz } from './haptics'
import type { Mark } from '../daily/wordle'

// Our own keyboard, for every game and puzzle. The phone's keyboard covers half the
// screen, pushes the page about, and looks different on every phone; this one is always
// the same size, sits in the same place, and leaves the game above it where it was.
//
// A screen wraps itself in <Keys>, and uses <KeyField> where it would use <input>. The
// keyboard shows while one of its fields is active, pinned under everything else.
// Profile, pairing and the like keep the phone's own keyboard — they aren't games.

type Mode = 'text' | 'number'
type Caps = 'sentence' | 'words' | 'none'

type Field = {
  el: HTMLElement | null
  value: string
  onChange: (v: string) => void
  max: number
  mode: Mode
  caps: Caps
  onEnter?: () => void
  action: boolean // Enter does something here (maybe not yet — nothing typed)
}

// What the keyboard needs to draw itself, from whichever field is active.
type Look = { mode: Mode; enter: string | null; action: boolean; canEnter: boolean; upper: boolean; disabled: boolean }

type Ctx = {
  active: string | null
  activate: (id: string | null) => void
  fields: Map<string, Field>
  show: (id: string, look: Look) => void
  drop: (id: string) => void
}
const KeysCtx = createContext<Ctx | null>(null)

// Whether the next letter should be a capital, without Shift.
function autoUpper(value: string, caps: Caps): boolean {
  if (caps === 'none') return false
  if (value.trim() === '') return true
  if (caps === 'words') return value.endsWith(' ')
  return /[.!?]\s+$/.test(value)
}

// The fields in the order they sit on the screen.
function ordered(fields: Map<string, Field>): string[] {
  return [...fields.entries()]
    .filter(([, f]) => f.el)
    .sort(([, a], [, b]) => (a.el!.compareDocumentPosition(b.el!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map(([id]) => id)
}

export function Keys({ children, className = '', bodyClassName = '' }: { children: ReactNode; className?: string; bodyClassName?: string }) {
  const fields = useRef(new Map<string, Field>()).current
  const [active, setActive] = useState<string | null>(null)
  const [look, setLook] = useState<Look | null>(null)
  const [shift, setShift] = useState(false)
  const [symbols, setSymbols] = useState(false)
  const activeRef = useRef(active)
  activeRef.current = active

  const activate = useCallback((id: string | null) => {
    setActive(id)
    setShift(false)
    setSymbols(false)
    if (id === null) setLook(null)
  }, [])
  const show = useCallback((id: string, next: Look) => {
    if (activeRef.current !== id) return
    setLook((prev) => (prev && Object.keys(next).every((k) => prev[k as keyof Look] === next[k as keyof Look]) ? prev : next))
  }, [])

  const drop = useCallback((id: string) => {
    fields.delete(id)
    if (activeRef.current === id) activate(null)
  }, [fields, activate])

  const press = useCallback((key: string) => {
    const id = activeRef.current
    const f = id ? fields.get(id) : undefined
    if (!id || !f) return
    const put = (v: string) => { f.value = v; f.onChange(v) }
    if (key === 'Enter') {
      if (f.action) { f.onEnter?.(); return }
      const order = ordered(fields)
      activate(order[order.indexOf(id) + 1] ?? null)
      return
    }
    if (key === 'Backspace') { put(f.value.slice(0, -1)); return }
    if (key === 'Shift') { setShift((s) => !s); return }
    if (key === 'Symbols') { setSymbols((s) => !s); return }
    if (f.value.length >= f.max) { buzz('tap'); return }
    if (f.mode === 'number') {
      if (/^\d$/.test(key)) put(f.value + key)
      return
    }
    if (key === ' ' && (f.value === '' || f.value.endsWith(' '))) return
    let ch = key
    if (/^[a-z]$/.test(key)) {
      ch = shift || autoUpper(f.value, f.caps) ? key.toUpperCase() : key
      setShift(false)
    }
    put(f.value + ch)
  }, [fields, activate, shift])

  // A real keyboard works too (a laptop, or a keyboard plugged into the phone).
  useEffect(() => {
    if (active === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if (e.key === 'Enter' || e.key === 'Backspace') { e.preventDefault(); press(e.key); return }
      if (e.key === 'Tab') {
        e.preventDefault()
        const order = ordered(fields)
        activate(order[(order.indexOf(active) + (e.shiftKey ? -1 : 1) + order.length) % order.length] ?? null)
        return
      }
      if (e.key.length !== 1) return
      e.preventDefault()
      const f = fields.get(active)
      if (!f) return
      if (/^[a-z]$/i.test(e.key)) {
        // As typed: capitals where Shift was held, otherwise the field's own rule.
        const lower = e.key.toLowerCase()
        const v = f.value + (e.key !== lower || autoUpper(f.value, f.caps) ? e.key.toUpperCase() : lower)
        if (f.value.length < f.max) { f.value = v; f.onChange(v) }
        return
      }
      press(e.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, fields, press, activate])

  const ctx = useMemo(() => ({ active, activate, fields, show, drop }), [active, activate, fields, show, drop])
  const hasNext = active !== null && (() => { const o = ordered(fields); return o.indexOf(active) < o.length - 1 })()

  return (
    <KeysCtx.Provider value={ctx}>
      <div className={'flex flex-col ' + className}>
        <div className={'flex-1 min-h-0 overflow-y-auto flex flex-col ' + bodyClassName}>{children}</div>
        {active !== null && look && (
          <Keyboard
            look={look}
            enter={look.enter ?? (hasNext ? 'Next' : 'Done')}
            shift={shift}
            symbols={symbols}
            onKey={press}
          />
        )}
      </div>
    </KeysCtx.Provider>
  )
}

// A box you type into with our keyboard: tap it and the keyboard's yours. The caret
// always sits at the end — these are a word or a line, not an essay.
export function KeyField({
  value,
  onChange,
  maxLength = 60,
  placeholder,
  className = '',
  activeClassName = '!border-pa',
  autoFocus = false,
  mode = 'text',
  caps = 'sentence',
  onEnter,
  enter,
  canEnter = true,
  disabled = false,
  label,
}: {
  value: string
  onChange: (v: string) => void
  maxLength?: number
  placeholder?: string
  className?: string
  activeClassName?: string
  autoFocus?: boolean
  mode?: Mode
  caps?: Caps
  onEnter?: () => void // what the keyboard's Enter does here; without it, Enter moves on
  enter?: string // the Enter key's label: Send, Go, Lock in…
  canEnter?: boolean
  disabled?: boolean
  label?: string
}) {
  const ctx = useContext(KeysCtx)
  if (!ctx) throw new Error('KeyField needs to be inside <Keys>')
  const id = useId()
  const el = useRef<HTMLDivElement>(null)
  const on = ctx.active === id
  const { fields, activate, show, drop } = ctx

  // Keep the keyboard's copy of this field current: the value it adds to, and what
  // Enter does.
  useLayoutEffect(() => {
    fields.set(id, { el: el.current, value, onChange, max: maxLength, mode, caps, onEnter: onEnter && canEnter && !disabled ? onEnter : undefined, action: !!onEnter })
  })
  useLayoutEffect(() => () => drop(id), [drop, id])
  useLayoutEffect(() => {
    if (!on) return
    show(id, { mode, enter: enter ?? null, action: !!onEnter, canEnter: !onEnter || (canEnter && !disabled), upper: mode === 'text' && autoUpper(value, caps), disabled })
  }, [on, id, show, mode, enter, onEnter, canEnter, disabled, value, caps])
  useEffect(() => { if (autoFocus) activate(id) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The box you're in stays in sight above the keyboard.
  useEffect(() => {
    if (!on) return
    const r = requestAnimationFrame(() => el.current?.scrollIntoView({ block: 'nearest' }))
    return () => cancelAnimationFrame(r)
  }, [on])

  return (
    <div
      ref={el}
      role="textbox"
      aria-label={label ?? placeholder}
      aria-disabled={disabled || undefined}
      tabIndex={-1}
      onPointerDown={() => { if (!disabled) activate(id) }}
      className={'flex items-center text-left cursor-text overflow-hidden ' + className + (on ? ' ' + activeClassName : '') + (disabled ? ' opacity-60' : '')}
    >
      <span className={'min-w-0 break-words ' + (mode === 'number' ? 'mx-auto' : '')}>
        {value || (!on && placeholder ? <span className="text-fg/30 font-semibold">{placeholder}</span> : null)}
        {on && <span className="inline-block w-[2px] h-[1.1em] -mb-[0.15em] ml-px bg-pa animate-caret" aria-hidden="true" />}
        {value === '' && on && placeholder && mode === 'text' && <span className="text-fg/30 font-semibold">{placeholder}</span>}
      </span>
    </div>
  )
}

const LETTERS = ['qwertyuiop', 'asdfghjkl', ['Shift', ...'zxcvbnm', 'Backspace'], ['Symbols', ' ', "'", 'Enter']] as const
const SYMBOLS = ['1234567890', '-/:;()£&@"', ['?', '!', ',', "'", '#', '+', '=', 'Backspace'], ['Symbols', ' ', '.', 'Enter']] as const
const NUMBERS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['Backspace', '0', 'Enter']] as const
// Letters only, for grids of letters: Their Word and the crossword.
const PAD = ['qwertyuiop', 'asdfghjkl', ['Enter', ...'zxcvbnm', 'Backspace']] as const

// The same keys with letters only — for Their Word (coloured by your guesses so far) and
// the crossword, which each place it themselves and handle the keys their own way.
export function LetterPad({ onKey, marks, disabled = false }: { onKey: (k: string) => void; marks?: Map<string, Mark>; disabled?: boolean }) {
  return (
    <Keyboard
      look={{ mode: 'text', enter: 'Enter', action: false, canEnter: true, upper: true, disabled }}
      enter="Enter"
      shift={false}
      symbols={false}
      onKey={onKey}
      pad
      marks={marks}
    />
  )
}

function Keyboard({ look, enter, shift, symbols, onKey, pad = false, marks }: {
  look: Look; enter: string; shift: boolean; symbols: boolean; onKey: (k: string) => void; pad?: boolean; marks?: Map<string, Mark>
}) {
  const rows = pad ? PAD : look.mode === 'number' ? NUMBERS : symbols ? SYMBOLS : LETTERS
  const upper = shift || look.upper
  const [down, setDown] = useState<string | null>(null)
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stop = () => {
    setDown(null)
    if (repeat.current) clearTimeout(repeat.current)
    repeat.current = null
  }
  useEffect(() => stop, [])

  const key = (k: string, i: number) => {
    const enterKey = k === 'Enter'
    const off = look.disabled || (enterKey && !look.canEnter)
    const letter = k.length === 1 && k !== ' '
    const shown =
      k === 'Enter' ? enter
        : k === 'Backspace' ? '⌫'
        : k === 'Shift' ? '⇧'
        : k === 'Symbols' ? (symbols ? 'ABC' : '123')
        : k === ' ' ? 'space'
        : upper && look.mode === 'text' && !symbols ? k.toUpperCase() : k
    const grow =
      look.mode === 'number' ? 'flex-1'
        : k === ' ' ? 'flex-[5]'
        : pad && (enterKey || k === 'Backspace') ? 'flex-[1.5]'
        : enterKey ? 'flex-[2.2]'
        : k === 'Shift' || k === 'Backspace' || k === 'Symbols' ? 'flex-[1.5]'
        : 'flex-1'
    const mark = marks?.get(k)
    const tone =
      mark === 'g' ? 'bg-correct text-white'
        : mark === 'y' ? 'bg-present text-white'
        : mark === '.' ? 'bg-absent text-white'
        : enterKey ? (look.action ? 'bg-pa text-white' : 'bg-fg/25 text-fg')
        : k === 'Shift' && shift ? 'bg-fg text-bg'
        : letter || look.mode === 'number' ? 'bg-fg/10 text-fg'
        : 'bg-fg/20 text-fg'
    return (
      <button
        key={`${k}${i}`}
        type="button"
        disabled={off}
        aria-label={k === 'Backspace' ? 'Delete' : k === 'Shift' ? 'Shift' : k === ' ' ? 'Space' : k === 'Symbols' ? (symbols ? 'Letters' : 'Numbers and symbols') : shown}
        onPointerDown={(e) => {
          if (off) return
          e.preventDefault()
          buzz('tap')
          setDown(`${k}${i}`)
          onKey(k)
          // Holding delete keeps deleting.
          if (k === 'Backspace') {
            const again = (wait: number) => { repeat.current = setTimeout(() => { onKey('Backspace'); again(70) }, wait) }
            again(420)
          }
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        onPointerLeave={stop}
        onClick={(e) => { if (e.detail === 0 && !off) onKey(k) }} // Enter/Space on a focused key
        className={
          'relative h-12 min-w-0 rounded-md font-bold select-none touch-manipulation transition-transform duration-75 disabled:opacity-40 ' +
          grow + ' ' + tone + ' ' +
          (look.mode === 'number' ? 'text-2xl font-display font-extrabold' : letter ? 'text-base' : enterKey ? 'text-sm font-extrabold px-1' : 'text-sm') +
          (down === `${k}${i}` ? ' scale-95 brightness-95' : '')
        }
      >
        <span className="truncate">{shown}</span>
        {/* The letter pops up above your thumb, so you can see what you hit. */}
        {letter && look.mode === 'text' && down === `${k}${i}` && (
          <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+4px)] z-10 min-w-[2.6rem] h-12 px-2 rounded-xl bg-card border-2 border-fg text-fg font-display text-3xl font-extrabold inline-flex items-center justify-center shadow-lg animate-key-pop">
            {shown}
          </span>
        )}
      </button>
    )
  }

  const keys = (
    <div className={'flex flex-col gap-1.5 w-full mx-auto ' + (look.mode === 'number' ? 'max-w-xs' : 'max-w-md')}>
      {rows.map((row, r) => (
        <div key={r} className={'flex gap-1 ' + (look.mode === 'text' && r === 1 && !symbols ? 'px-[4.5%]' : '')}>
          {[...row].map((k, i) => key(k, i))}
        </div>
      ))}
    </div>
  )
  // The letter pad sits in a bar its screen makes; the full keyboard brings its own.
  if (pad) return <div data-activity="typing" className="select-none">{keys}</div>
  return (
    <div
      data-activity="typing"
      className="shrink-0 border-t border-fg/10 bg-bg px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)] animate-keys-up"
    >
      {keys}
    </div>
  )
}
