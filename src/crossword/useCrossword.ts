import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type CrosswordState, type Memories } from '../daily/api'
import { localDate } from '../daily/dates'
import { makeRng } from '../engine/rng'
import { buildCrossword } from './build'
import { balanced, generalCandidates, harvest } from './harvest'

// This week's crossword: fetched, built (by whichever phone opens it first that week),
// and kept in step with your partner's letters. Letters you type show straight away and
// are sent a moment later, in a batch; while the crossword's open, your partner's come
// in every few seconds.

export type Ready = Extract<CrosswordState, { state: 'ready' }>
export type CrosswordStatus =
  | { kind: 'loading' }
  | { kind: 'off' } // not paired, or the project hasn't got the crossword yet
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: Ready; me: string; partner: string }

// The Monday of the week `date` is in: the crossword's week.
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hash = (s: string) => [...s].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7)

type Paired = Extract<Memories, { state: 'paired' }>

// The last two months of your answers, both of you.
async function answers(today: string): Promise<Paired | null> {
  const first = await api.memories(today)
  if (first.state !== 'paired') return null
  const second = await api.memories(today, first.since).catch(() => null)
  if (!second || second.state !== 'paired') return first
  return { ...first, sessions: [...first.sessions, ...second.sessions], puzzles: [...first.puzzles, ...second.puzzles] }
}

async function buildAndStart(week: string, used: string[], today: string): Promise<CrosswordState> {
  const m = await answers(today)
  if (!m) return { state: 'unpaired' }
  const personal = balanced(harvest(m), [m.me, m.partner], used)
  const puzzle = buildCrossword(personal, generalCandidates(used), makeRng(hash(week + m.me + m.partner)))
  if (!puzzle) throw new Error('Couldn’t build this week’s crossword')
  return api.startCrossword(week, puzzle)
}

export function useCrossword(live: boolean) {
  const today = localDate()
  const week = mondayOf(today)
  const [status, setStatus] = useState<CrosswordStatus>({ kind: 'loading' })
  const names = useRef<{ me: string; partner: string }>({ me: '', partner: '' })
  const pending = useRef<Record<string, string>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A fresh copy from the server, with anything you've typed but not sent yet on top.
  const accept = useCallback((st: CrosswordState) => {
    if (st.state === 'unpaired') { setStatus({ kind: 'off' }); return }
    if (st.state !== 'ready') return
    const cells = { ...st.cells }
    for (const [k, l] of Object.entries(pending.current)) {
      if (l) cells[k] = { l, mine: true }
      else delete cells[k]
    }
    setStatus({ kind: 'ready', data: { ...st, cells }, ...names.current })
  }, [])

  const load = useCallback(async () => {
    try {
      const profile = await api.profile()
      if (profile.state !== 'paired') { setStatus({ kind: 'off' }); return }
      names.current = { me: profile.me.name, partner: profile.partner.name }
      let st = await api.crossword(week)
      if (st.state === 'none') st = await buildAndStart(week, st.used, today)
      accept(st)
    } catch (e) {
      const kind = (e as { kind?: string }).kind
      if (kind === 'setup') setStatus({ kind: 'off' })
      else setStatus({ kind: 'error', message: (e as Error).message })
    }
  }, [week, today, accept])

  useEffect(() => { void load() }, [load])

  // Your partner's letters, while it's open.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      api.crossword(week).then(accept).catch(() => {})
    }, 5000)
    return () => clearInterval(id)
  }, [live, week, accept])

  const flush = useCallback(() => {
    timer.current = null
    const batch = pending.current
    if (Object.keys(batch).length === 0) return
    pending.current = {}
    api.fillCrossword(week, batch).then(accept).catch(() => {
      // Couldn't send: keep them to try again with the next letter.
      pending.current = { ...batch, ...pending.current }
    })
  }, [week, accept])

  const fill = useCallback((changes: Record<string, string>) => {
    pending.current = { ...pending.current, ...changes }
    setStatus((s) => {
      if (s.kind !== 'ready') return s
      const cells = { ...s.data.cells }
      for (const [k, l] of Object.entries(changes)) {
        if (l) cells[k] = { l, mine: true }
        else delete cells[k]
      }
      return { ...s, data: { ...s.data, cells } }
    })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, 400)
  }, [flush])

  // Anything still waiting goes before the screen does.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); flush() } }, [flush])

  // Testing: throw this week's away and build it again from your answers as they are now.
  const rebuild = useCallback(async () => {
    pending.current = {}
    setStatus({ kind: 'loading' })
    try {
      await api.resetCrossword(week)
      const st = await api.crossword(week)
      accept(st.state === 'none' ? await buildAndStart(week, st.used, today) : st)
    } catch (e) {
      setStatus({ kind: 'error', message: (e as Error).message })
    }
  }, [week, today, accept])

  return { status, week, fill, rebuild, reload: load }
}
