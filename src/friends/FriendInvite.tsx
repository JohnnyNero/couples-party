import { useEffect, useState } from 'react'
import { api, DailyError, type FriendPreview } from '../daily/api'
import { refreshProfile, useProfile } from '../profile/store'
import { forgetFriendLink, type InviteLink } from '../start/invite'
import { Wordmark } from '../ui/Logo'
import { btnAccent } from '../ui/styles'
import { Burst } from '../ui/fx'
import { CoupleFaces, coupleName } from './FriendsTab'

// Where a friend link lands: "Sam & Roxx want to be friends". Add them — or, before
// you're paired, find out you need to be first (friends are couple to couple).
export function FriendInvite({ link, onDone }: { link: InviteLink; onDone: (added: boolean) => void }) {
  const profile = useProfile()
  const [who, setWho] = useState<FriendPreview | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'added' | 'dead'>('loading')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { void refreshProfile() }, [])
  useEffect(() => {
    api.friendPreview(link.code)
      .then((w) => { setWho(w); setState('ready') })
      .catch((e) => { setNote(e instanceof DailyError ? e.message : 'Couldn’t reach the server.'); setState('dead') })
  }, [link.code])

  const finish = (added: boolean) => { forgetFriendLink(); onDone(added) }
  const add = async () => {
    setBusy(true)
    setNote(null)
    try {
      await api.addFriend(link.code)
      setState('added')
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : 'Couldn’t reach the server.')
    } finally {
      setBusy(false)
    }
  }
  const them = who ? coupleName(who.members) : link.from || 'Another couple'
  const paired = profile?.state === 'paired'

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="min-h-full w-full max-w-md mx-auto px-6 py-10 flex flex-col items-center justify-center text-center gap-6 animate-fade-up">
        <Wordmark className="font-display text-xl font-extrabold" />
        {who && (
          <div className="relative">
            <CoupleFaces members={who.members} size="lg" />
            {state === 'added' && <Burst hearts delay={150} count={18} />}
          </div>
        )}
        <div>
          <h1 className="font-display text-[2rem] font-extrabold leading-tight">
            {state === 'added' ? `You’re friends with ${them}!`
              : state === 'dead' ? 'That link didn’t work'
              : who?.you ? 'That’s your own link'
              : who?.friends ? `You’re already friends with ${them}`
              : `${them} want to be friends`}
          </h1>
          <p className="mt-2 text-fg/65 leading-snug">
            {state === 'added' ? 'You’ll see how each other are getting on in the Friends tab — your streaks and how you did today, never your answers.'
              : state === 'dead' ? (note ?? 'Ask them to send it again.')
              : who?.you || who?.friends ? 'Nothing to do here.'
              : paired ? 'Friends see each other’s streak and how you did today — never your answers.'
              : 'Friends are couple to couple, so pair up with your partner first — then open this link again.'}
          </p>
        </div>
        {state === 'ready' && who && !who.you && !who.friends && paired && (
          <button className={btnAccent} onClick={() => void add()} disabled={busy}>{busy ? 'Adding…' : 'Add as friends'}</button>
        )}
        {state === 'ready' && note && <div className="text-sm font-bold text-pa-ink">{note}</div>}
        <button onClick={() => finish(state === 'added')} className="min-h-[44px] text-sm font-bold text-fg/55">
          {state === 'added' ? 'See your friends' : 'Open the app'}
        </button>
      </div>
    </div>
  )
}
