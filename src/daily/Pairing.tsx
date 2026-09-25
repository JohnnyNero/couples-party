import { useState } from 'react'
import { api, DailyError } from './api'
import { field } from '../ui/styles'
import { inviteUrl } from '../start/invite'

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

  const input = field
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Your name</span>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
      </label>
      {mode === 'choose' ? (
        <div className="grid grid-cols-2 gap-2 mt-1">
          <button
            disabled={busy}
            onClick={() => run(() => api.createCouple(name.trim()))}
            className="min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px disabled:opacity-50"
          >
            Start
          </button>
          <button
            disabled={busy}
            onClick={() => { setMode('join'); setError(null) }}
            className="min-h-[52px] rounded-2xl border-2 border-fg bg-card font-display text-lg font-extrabold active:translate-y-px"
          >
            I have a code
          </button>
        </div>
      ) : (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] uppercase tracking-[0.22em] font-extrabold text-fg/50">Their code</span>
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
            <button onClick={() => setMode('choose')} className="min-h-[52px] px-4 rounded-2xl border-2 border-fg/15 font-bold text-fg/60 active:translate-y-px">
              Back
            </button>
            <button
              disabled={busy || code.length !== 6}
              onClick={() => run(() => api.joinCouple(code, name.trim()))}
              className="min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold active:translate-y-px disabled:opacity-50"
            >
              Pair
            </button>
          </div>
        </>
      )}
      {error && <div className="text-sm text-accent-ink">{error}</div>}
    </div>
  )
}

export function PairWaiting({ code, me, onCancel }: { code: string; me: string; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)
  const link = inviteUrl(code, me || savedName())
  // A link they just tap: it opens the app, pairs them and asks for their name and photo.
  const share = () => {
    const text = `${me ? `${me} has` : "I've"} invited you to Couples Party — tap to pair up with me`
    if (navigator.share) void navigator.share({ title: 'Couples Party', text, url: link }).catch(() => {})
    else void navigator.clipboard?.writeText(link).then(() => setCopied(true))
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-sm text-fg/65">Send them a link — one tap and you’re paired.</div>
      <button onClick={share} className="w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold active:translate-y-px">
        {copied ? 'Link copied' : 'Send the invite link'}
      </button>
      <div className="mt-2 text-xs font-bold text-fg/45">Or they can tap <b>I have a code</b> and type</div>
      <div className="rounded-2xl border-2 border-fg bg-card px-5 py-2 font-display text-5xl font-extrabold tracking-[0.18em] text-pa-ink tabular-nums shadow-[4px_4px_0_rgba(0,0,0,0.12)]">{code}</div>
      <div className="text-sm font-bold text-fg/50 animate-pulse">Waiting for them…</div>
      <button
        onClick={async () => { await api.leaveCouple().catch(() => {}); onCancel() }}
        className="px-4 min-h-[44px] rounded-2xl font-bold text-fg/50 active:translate-y-px"
      >
        Cancel
      </button>
    </div>
  )
}
