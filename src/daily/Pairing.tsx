import { useState } from 'react'
import { api } from './api'
import { inviteUrl } from '../start/invite'
import { TypingDots } from '../ui/kit'

const NAME_KEY = 'couples-party:name'
const savedName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }

export function PairWaiting({ code, me, onCancel }: { code: string; me: string; onCancel: () => void }) {
  const [copied, setCopied] = useState(false)
  const link = inviteUrl(code, me || savedName())
  // A link they just tap: it opens the app, pairs them and asks for their name and photo.
  const share = () => {
    const text = `${me ? `${me} has` : "I've"} invited you to Coupled — tap to pair up with me`
    if (navigator.share) void navigator.share({ title: 'Coupled', text, url: link }).catch(() => {})
    else void navigator.clipboard?.writeText(link).then(() => setCopied(true))
  }
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-sm text-fg/65">Send them a link — one tap and you’re paired.</div>
      <button onClick={share} className="w-full min-h-[56px] rounded-2xl bg-pa text-white font-display text-xl font-extrabold press">
        {copied ? 'Link copied' : 'Send the invite link'}
      </button>
      <div className="mt-2 text-xs font-bold text-fg/45">Or they can tap <b>I have a code</b> and type</div>
      <div className="rounded-2xl border-2 border-fg bg-card px-5 py-2 font-display text-5xl font-extrabold tracking-[0.18em] text-pa-ink tabular-nums shadow-[4px_4px_0_rgba(0,0,0,0.12)]">{code}</div>
      <div className="text-sm font-bold text-fg/50 inline-flex items-center justify-center gap-1.5">Waiting for them<TypingDots /></div>
      <button
        onClick={async () => { await api.leaveCouple().catch(() => {}); onCancel() }}
        className="px-4 min-h-[44px] rounded-2xl font-bold text-fg/50 press"
      >
        Cancel
      </button>
    </div>
  )
}
