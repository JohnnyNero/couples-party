import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EMPTY_CONTENT, type Content, type Game, type SessionState } from '../engine/state'
import { FakeServer, type FakeClient } from './fakePlayroom'
import { SAVE_VERSION, type Saved } from '../store/progress'

// Two (or three) real copies of playroom.ts — the actual online code — racing each other
// through a pretend Playroom with a delay on every message. What each phone would see is
// its own copy of the room's state.

const CONTENT: Content = {
  ...EMPTY_CONTENT,
  mrmrsQuestions: ['Your comfort meal?', 'Your go-to drink?', 'Your first gig?', 'Your worst habit?', 'Your dream job?'],
  guesstimates: Array.from({ length: 10 }, (_, i) => ({ question: `How many ${i}?`, answer: 100 })),
}

type Phone = { client: FakeClient; device: string; net: typeof import('./playroom'); ready: Promise<void> }

async function phone(server: FakeServer, device: string, game: Game, code = 'COUPLE1', resume: Saved | null = null): Promise<Phone> {
  vi.resetModules()
  const client = server.client()
  vi.doMock('playroomkit', () => client.api())
  vi.doMock('./device', () => ({ deviceKey: () => device }))
  vi.doMock('../packs', () => ({ loadPacks: async () => CONTENT }))
  vi.doMock('../ideas/store', () => ({ ideasForGame: async () => [], withIdeas: (c: Content) => c }))
  const net = await import('./playroom')
  const ready = net.initNet(game, code, resume)
  return { client, device, net, ready }
}

const session = (p: Phone) => p.client.state.session as SessionState | undefined
const seatOf = (p: Phone) => (p.client.state.seats as Record<string, string> | undefined)?.[p.device]
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const leave = (server: FakeServer, p: Phone) => server.leave(p.client)

let server: FakeServer
beforeEach(() => {
  vi.useFakeTimers()
  server = new FakeServer(60)
})
afterEach(() => {
  vi.useRealTimers()
  vi.resetModules()
})

describe('starting a game', () => {
  it('both pressing start at the same moment: one game, a seat each, and it begins', async () => {
    const a = await phone(server, 'devA', 'mrmrs')
    const b = await phone(server, 'devB', 'mrmrs')
    await wait(3000)
    const sa = session(a)!, sb = session(b)!
    expect(sa.seed).toBe(sb.seed)
    expect(new Set([seatOf(a), seatOf(b)])).toEqual(new Set(['A', 'B']))
    expect(sa.players.A.connected && sa.players.B.connected).toBe(true)
    expect(sa.phase).not.toBe('JOIN')
    expect(sb.phase).toBe(sa.phase)
  })

  it('both starting different games at once: you both land in the same one', async () => {
    const a = await phone(server, 'devA', 'mrmrs')
    const b = await phone(server, 'devB', 'guess')
    await wait(3000)
    const sa = session(a)!, sb = session(b)!
    expect(sa.seed).toBe(sb.seed)
    expect(sa.game).toBe(sb.game)
    expect(sa.players.A.connected && sa.players.B.connected).toBe(true)
    expect(sa.phase).not.toBe('JOIN')
  })

  it('one waiting in the lobby, the other arriving later: straight in together', async () => {
    const a = await phone(server, 'devA', 'mrmrs')
    await wait(5000)
    expect(session(a)!.phase).toBe('JOIN')
    const b = await phone(server, 'devB', 'mrmrs')
    await wait(2000)
    expect(session(b)!.seed).toBe(session(a)!.seed)
    expect(session(a)!.phase).not.toBe('JOIN')
  })
})

// Taps through a game with nobody playing: ready on the title card, carry on from every
// scoreboard, and let every clock run out.
async function playToEnd(...phones: Phone[]) {
  for (let i = 0; i < 400; i++) {
    const host = phones.find((p) => p.client.hostId === p.client.id && !p.client.gone) ?? phones[0]
    const s = session(host)
    if (!s || s.phase === 'DONE') return
    if (s.phase === 'INTRO') for (const p of phones) { const seat = seatOf(p); if (seat) p.net.dispatch({ type: 'READY', player: seat as 'A' | 'B' }) }
    else if (s.phase.endsWith('_RESULT')) phones[0].net.dispatch({ type: 'CONTINUE', player: seatOf(phones[0]) as 'A' | 'B' })
    await wait(2000)
  }
}

describe('two phones both acting as host for a moment', () => {
  it('still settles on one game with you both in it', async () => {
    server.splitBrain = true
    const a = await phone(server, 'devA', 'mrmrs')
    const b = await phone(server, 'devB', 'mrmrs')
    await wait(4000)
    const sa = session(a)!, sb = session(b)!
    expect(sa.seed).toBe(sb.seed)
    expect(new Set([seatOf(a), seatOf(b)])).toEqual(new Set(['A', 'B']))
    expect(sa.players.A.connected && sa.players.B.connected).toBe(true)
    expect(sa.phase).not.toBe('JOIN')
  })
})

describe('after a game', () => {
  it('starting the next one while your partner is still on the end screen', async () => {
    const a = await phone(server, 'devA', 'follow')
    const b = await phone(server, 'devB', 'follow')
    await wait(2000)
    await playToEnd(a, b)
    expect(session(a)!.phase).toBe('DONE')
    // B goes home and starts Guesstimate; A's phone sits on the end screen.
    leave(server, b)
    await wait(1000)
    const b2 = await phone(server, 'devB', 'guess')
    await wait(3000)
    const s = session(b2)!
    expect(s.game).toBe('guess')
    expect(s.phase).toBe('JOIN')
    expect(s.players[seatOf(b2) as 'A' | 'B'].connected).toBe(true)
    expect(b2.client.hostId).toBe(b2.client.id) // the new game's clock is on the phone playing it
    // A comes along from Home, into B's game.
    leave(server, a)
    await wait(500)
    const a2 = await phone(server, 'devA', 'guess')
    await wait(3000)
    expect(session(a2)!.seed).toBe(session(b2)!.seed)
    expect(session(b2)!.phase).not.toBe('JOIN')
  })
})

describe('dropping out mid-game', () => {
  const start = async () => {
    const a = await phone(server, 'devA', 'guess')
    const b = await phone(server, 'devB', 'guess')
    await wait(2000)
    for (const p of [a, b]) p.net.dispatch({ type: 'READY', player: seatOf(p) as 'A' | 'B' })
    await wait(1000)
    expect(session(a)!.phase).toBe('GUESS_WRITE')
    return { a, b }
  }

  it('your partner drops and comes back: the game waits, then carries on with you in the same seats', async () => {
    const { a, b } = await start()
    const seatB = seatOf(b)
    leave(server, b)
    await wait(2000)
    expect(session(a)!.paused?.away).toBe(true)
    const b2 = await phone(server, 'devB', 'guess')
    await wait(2000)
    expect(seatOf(b2)).toBe(seatB)
    expect(session(a)!.paused).toBeNull()
    expect(session(a)!.phase).toBe('GUESS_WRITE')
  })

  it('the phone keeping the game drops: the other takes over, and the clock keeps working when they return', async () => {
    const { a, b } = await start()
    const host = a.client.hostId === a.client.id ? a : b
    const other = host === a ? b : a
    const seatHost = seatOf(host)
    leave(server, host)
    await wait(3000)
    expect(other.client.hostId).toBe(other.client.id)
    expect(session(other)!.paused?.away).toBe(true)
    const back = await phone(server, host.device, 'guess')
    await wait(2000)
    expect(seatOf(back)).toBe(seatHost)
    expect(session(other)!.paused).toBeNull()
    // Nobody answers: the clock runs out, on the phone that's now keeping it.
    const round = session(other)!.guess!.current
    await wait(45000)
    expect(session(other)!.guess!.current).toBeGreaterThan(round)
  })

  it('a third device can watch, but never takes a seat', async () => {
    const { a } = await start()
    const c = await phone(server, 'devC', 'guess')
    await wait(2000)
    expect(seatOf(c)).toBeUndefined()
    expect(session(a)!.phase).toBe('GUESS_WRITE')
  })
})

describe('more comings and goings', () => {
  it('leaving the lobby and coming back: still the same lobby, and it starts when your partner arrives', async () => {
    const a = await phone(server, 'devA', 'mrmrs')
    const b = await phone(server, 'devB', 'mrmrs')
    await wait(300) // B's still on its way in
    leave(server, a)
    await wait(1000)
    const a2 = await phone(server, 'devA', 'mrmrs')
    await wait(3000)
    expect(session(a2)!.seed).toBe(session(b)!.seed)
    expect(new Set([seatOf(a2), seatOf(b)])).toEqual(new Set(['A', 'B']))
    expect(session(b)!.phase).not.toBe('JOIN')
  })

  it('your partner waiting in one game, you picking another: you join theirs rather than start a second', async () => {
    const a = await phone(server, 'devA', 'guess')
    await wait(3000)
    const b = await phone(server, 'devB', 'mrmrs')
    await wait(3000)
    expect(session(b)!.game).toBe('guess')
    expect(session(b)!.seed).toBe(session(a)!.seed)
    expect(session(a)!.phase).not.toBe('JOIN')
  })

  it('both phones dropping at once mid-game: the first back picks it up from its own copy, the second joins it', async () => {
    const a = await phone(server, 'devA', 'guess')
    const b = await phone(server, 'devB', 'guess')
    await wait(2000)
    for (const p of [a, b]) p.net.dispatch({ type: 'READY', player: seatOf(p) as 'A' | 'B' })
    await wait(1000)
    const saved = (p: Phone): Saved => ({ v: SAVE_VERSION, game: 'guess', mode: 'duo', seat: seatOf(p) as 'A' | 'B', savedAt: Date.now(), state: session(p)! })
    const keepA = saved(a), keepB = saved(b)
    const seed = keepA.state.seed
    leave(server, a); leave(server, b)
    await wait(5000) // everyone's gone, and the room with them
    const b2 = await phone(server, 'devB', 'guess', 'COUPLE1', keepB)
    await wait(2000)
    expect(session(b2)!.seed).toBe(seed)
    expect(session(b2)!.paused?.away).toBe(true) // waiting for A
    const a2 = await phone(server, 'devA', 'guess', 'COUPLE1', keepA)
    await wait(3000)
    expect(seatOf(a2)).toBe(keepA.seat)
    expect(seatOf(b2)).toBe(keepB.seat)
    expect(session(a2)!.seed).toBe(seed)
    expect(session(b2)!.paused).toBeNull()
    expect(session(b2)!.phase).toBe('GUESS_WRITE')
  })
})

describe('starting together, shaken up', () => {
  it('always ends in one game with you both in it — whatever the delays, the order, or the games picked', async () => {
    let seed = 12345
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
    const games: Game[] = ['mrmrs', 'guess', 'follow']
    for (let trial = 0; trial < 30; trial++) {
      server = new FakeServer(20 + Math.floor(rand() * 280))
      server.splitBrain = rand() < 0.5
      const code = `T${trial}`
      const first = await phone(server, 'devA', games[Math.floor(rand() * 3)], code)
      await wait(Math.floor(rand() * 400))
      const second = await phone(server, 'devB', games[Math.floor(rand() * 3)], code)
      await wait(8000)
      const s1 = session(first)!, s2 = session(second)!
      const why = `trial ${trial}: latency ${server.latency}, split ${server.splitBrain}`
      expect(s1.seed, why).toBe(s2.seed)
      expect(new Set([seatOf(first), seatOf(second)]), why).toEqual(new Set(['A', 'B']))
      expect(s1.players.A.connected && s1.players.B.connected, why).toBe(true)
      expect(s1.phase, why).not.toBe('JOIN')
    }
  })
})
