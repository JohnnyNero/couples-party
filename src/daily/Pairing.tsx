import { useState } from 'react'
import { api, DailyError } from './api'

const NAME_KEY = 'couples-party:name'
const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }
const saveName = (n: string) => { try { localStorage.setItem(NAME_KEY, n) } catch { /* private mode */ } }

// Linking two phones, once. One of you starts and gets a six-letter code; the other
// types it in. After that the phones know each other for good (well — until the browser
// data is cleared), and the daily puzzle can pass between them.
export function PairStart({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(savedName)
  const [mode, setMode] = useState<'choose' | 'join'>('choose')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (fn: () => Promise<unknown>) => {
    const n = name.trim()
    if (!n) { setError('Your name first.'); return }
    saveName(n)
    setBusy(true)
    setError(null)
    try {
      await fn()
      onDone()
    } catch (e) {
      setError(e instanceof DailyError ? e.message : "Couldn't reach the server.")
    } finally {
      setBusy(false)
    }
  }

  const input =
    'w-full min-h-[52px] rounded-xl bg-fg/5 border-2 border-fg/15 px-4 text-lg outline-none focus:border-accent'
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/50">Your name</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
      </label>
      {mode === 'choose' ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            disabled={busy}
            onClick={() => run(() => api.createCouple(name.trim()))}
            className="min-h-[52px] rounded-xl bg-accent text-bg font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-50"
          >
            Start
          </button>
          <button
            disabled={busy}
            onClick={() => { setMode('join'); setError(null) }}
            className="min-h-[52px] rounded-xl border-2 border-fg/25 font-bold uppercase tracking-widest active:translate-y-px"
          >
            I have a code
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-fg/50">Their code</span>
            <input
              className={input + ' uppercase tracking-[0.4em] font-bold text-center'}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="ABC234"
            />
          </label>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button onClick={() => setMode('choose')} className="min-h-[52px] px-4 rounded-xl border-2 border-fg/15 text-fg/60 active:translate-y-px">
              Back
            </button>
            <button
              disabled={busy || code.length !== 6}
              onClick={() => run(() => api.joinCouple(code, name.trim()))}
              className="min-h-[52px] rounded-xl bg-accent text-bg font-bold uppercase tracking-widest active:translate-y-px disabled:opacity-50"
            >
              Pair
            </button>
          </div>
        </>
      )}
      {error && <div className="text-sm text-accent">{error}</div>}
    </div>
  )
}

export function PairWaiting({ code, onCancel }: { code: string; onCancel: () => void }) {
  const share = () => {
    const text = `Pair with me on Couples Party — the code is ${code}`
    if (navigator.share) void navigator.share({ text, url: location.origin + location.pathname }).catch(() => {})
    else void navigator.clipboard?.writeText(code)
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-sm text-fg/60">Get them to tap <b>I have a code</b> and type:</div>
      <div className="font-display text-5xl font-bold tracking-[0.2em] text-accent tabular-nums">{code}</div>
      <div className="text-xs uppercase tracking-[0.25em] text-fg/40 animate-pulse">Waiting for them…</div>
      <div className="flex gap-2 w-full mt-1">
        <button onClick={share} className="flex-1 min-h-[48px] rounded-xl border-2 border-fg/25 font-bold uppercase tracking-widest active:translate-y-px">
          Send it
        </button>
        <button
          onClick={async () => { await api.leaveCouple().catch(() => {}); onCancel() }}
          className="px-4 min-h-[48px] rounded-xl text-fg/50 active:translate-y-px"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
