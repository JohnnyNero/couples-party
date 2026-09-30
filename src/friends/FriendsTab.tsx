import { useCallback, useEffect, useState } from 'react'
import { api, DailyError, type FriendCard, type LeaderboardRow, type Person } from '../daily/api'
import { useProfile } from '../profile/store'
import { friendUrl } from '../start/invite'
import { localDate, dayIndex } from '../daily/dates'
import { dailyNumber } from '../share/daily'
import { Avatar } from '../ui/Avatar'
import { card, eyebrow, field } from '../ui/styles'
import { Loading } from '../ui/Loading'
import { Leaderboard } from './Leaderboard'

// Your friend couples: how each is getting on today (their streak, whether they've played
// Today's games and how they did as a team, how many of today's puzzles they've solved),
// and how to add more — your friend link and code to send, or theirs to type in.

export const coupleName = (members: Person[]) => members.map((m) => m.name).join(' & ')

export function CoupleFaces({ members, size = 'md' }: { members: Person[]; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span className="flex shrink-0">
      {members.map((m, i) => (
        <Avatar key={i} p={i === 0 ? 'A' : 'B'} name={m.name} photo={m.photo} size={size} className={(i > 0 ? '-ml-2.5 ' : '') + 'ring-2 ring-card'} />
      ))}
    </span>
  )
}

export function FriendsTab() {
  const profile = useProfile()
  const paired = profile?.state === 'paired' ? profile : null
  const [list, setList] = useState<FriendCard[] | null>(null)
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setError(null)
    api.friends(localDate()).then(setList).catch((e) => setError(e instanceof DailyError ? e.message : 'Couldn’t reach the server.'))
    api.friendLeaderboard(localDate()).then(setBoard).catch(() => setBoard(null)) // hidden until the server has it
  }, [])
  useEffect(() => { if (paired) load() }, [paired?.partner.name, load]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!paired) {
    return (
      <section className={card + ' p-5 text-center flex flex-col gap-2'}>
        <div className="font-display text-xl font-extrabold">Pair up first</div>
        <p className="text-sm text-fg/60">Friends are couple to couple: once you and your partner are paired, you can add other couples here.</p>
      </section>
    )
  }
  return (
    <div className="flex flex-col gap-4">
      {board && <Leaderboard rows={board} />}
      <AddFriends me={`${paired.me.name} & ${paired.partner.name}`} onAdded={load} />
      <div className={eyebrow + ' mt-1'}>Your friends{list && list.length > 0 ? ` · ${list.length}` : ''}</div>
      {error ? (
        <div className="text-sm text-fg/60">{error} <button className="font-bold text-accent-ink" onClick={load}>Try again</button></div>
      ) : !list ? (
        <Loading className="h-24" />
      ) : list.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-fg/20 p-5 text-center text-sm text-fg/55">
          No friends yet. Send your link to another couple — they tap it, and you’re friends.
        </div>
      ) : (
        list.map((f) => <Friend key={f.id} f={f} onRemoved={load} />)
      )}
    </div>
  )
}

function Friend({ f, onRemoved }: { f: FriendCard; onRemoved: () => void }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const n = dailyNumber(dayIndex(localDate()))
  const remove = async () => {
    setBusy(true)
    await api.removeFriend(f.id).catch(() => {})
    onRemoved()
  }
  return (
    <section className={card + ' p-4 flex flex-col gap-3'}>
      <div className="flex items-center gap-3">
        <CoupleFaces members={f.members} />
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-extrabold leading-tight truncate">{coupleName(f.members)}</div>
          <div className="text-xs font-bold text-fg/50">
            {f.streak > 0 ? <><span aria-hidden="true">🔥</span> {f.streak}-day streak</> : 'No streak on the go'}
          </div>
        </div>
        <button onClick={() => setAsking((v) => !v)} aria-label="More" className="shrink-0 w-9 h-9 rounded-full text-fg/40 text-xl press">⋯</button>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className={'rounded-2xl px-3 py-2 ' + (f.today ? 'bg-tan-soft text-tan-ink' : 'bg-fg/[0.05] text-fg/55')}>
          <div className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-70">Today #{n}</div>
          <div className="font-extrabold">{f.today ? (f.today.team != null ? `🤝 ${Math.round(f.today.team)} together` : 'Played') : 'Not played yet'}</div>
        </div>
        <div className={'rounded-2xl px-3 py-2 ' + (f.puzzles > 0 ? 'bg-sage-soft text-sage-ink' : 'bg-fg/[0.05] text-fg/55')}>
          <div className="text-[0.7rem] font-extrabold uppercase tracking-wider opacity-70">Puzzles</div>
          <div className="font-extrabold">{f.puzzles > 0 ? `${f.puzzles} solved today` : 'None yet today'}</div>
        </div>
      </div>
      {asking && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-fg/10 px-3 py-2">
          <span className="text-sm text-fg/65">Remove {coupleName(f.members)} as friends?</span>
          <button onClick={() => void remove()} disabled={busy} className="min-h-[40px] px-3 rounded-xl bg-pa text-white text-sm font-extrabold press disabled:opacity-50">Remove</button>
        </div>
      )}
    </section>
  )
}

// Your link and code to send, and a box for theirs.
function AddFriends({ me, onAdded }: { me: string; onAdded: () => void }) {
  const [code, setCode] = useState<string | null>(null)
  const [theirs, setTheirs] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.friendCode().then(setCode).catch(() => setCode(null)) }, [])

  const share = async () => {
    if (!code) return
    const url = friendUrl(code, me)
    const text = `Add ${me} as friends on Coupled`
    setNote(null)
    if (navigator.share) {
      try { await navigator.share({ title: 'Coupled', text, url }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
    }
    try { await navigator.clipboard.writeText(`${text}: ${url}`); setNote('Link copied — paste it to them.') } catch { setNote(url) }
  }
  const add = async () => {
    setBusy(true)
    setNote(null)
    try {
      const who = await api.friendPreview(theirs)
      if (who.you) setNote('That’s your own code!')
      else if (who.friends) setNote('You’re already friends.')
      else {
        await api.addFriend(theirs)
        setTheirs('')
        setNote(`You’re now friends with ${who.members.map((m) => m.name).join(' & ')}.`)
        onAdded()
      }
    } catch (e) {
      setNote(e instanceof DailyError ? e.message : 'Couldn’t reach the server.')
    } finally {
      setBusy(false)
    }
  }
  const renew = async () => { setCode(await api.newFriendCode().catch(() => code)); setNote('New code made — the old link no longer works.') }

  return (
    <section className="rounded-[1.75rem] bg-ink text-paper p-5 flex flex-col gap-3 shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
      <div>
        <div className="font-display text-2xl font-extrabold leading-tight">Add friends</div>
        <div className="mt-1 text-sm text-paper/65">Send your link to another couple. They see your streak and how you did today — never your answers.</div>
      </div>
      <button onClick={() => void share()} disabled={!code} className="min-h-[52px] rounded-2xl bg-pa text-white font-display text-lg font-extrabold press disabled:opacity-50">
        Send our friend link
      </button>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-paper/60">Our code <b className="font-display text-lg tracking-[0.15em] text-paper tabular-nums">{code ?? '········'}</b></span>
        <button onClick={() => void renew()} className="text-xs font-bold text-paper/50">New code</button>
      </div>
      <div className="flex gap-2">
        <input
          className={field + ' !min-h-[48px] !text-lg uppercase tracking-[0.2em] text-center !bg-paper !text-ink'}
          value={theirs}
          onChange={(e) => setTheirs(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          onKeyDown={(e) => { if (e.key === 'Enter' && theirs.length === 8) void add() }}
          placeholder="Their code"
          autoCapitalize="characters"
          autoComplete="off"
          aria-label="Their friend code"
        />
        <button onClick={() => void add()} disabled={busy || theirs.length !== 8} className="shrink-0 min-h-[48px] px-5 rounded-2xl bg-paper text-ink font-display text-lg font-extrabold press disabled:opacity-40">Add</button>
      </div>
      {note && <div className="text-sm font-bold text-paper/80 break-all" role="status">{note}</div>}
    </section>
  )
}
