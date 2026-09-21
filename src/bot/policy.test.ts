import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from '../engine/state'
import { reduce } from '../engine/reducer'
import { makeRng } from '../engine/rng'
import { nextBotAction, meldWord, type BotBrain } from './policy'

const BRAIN: BotBrain = {
  words: {
    spaghetti: ['sauce', 'fork', 'dinner'],
    handcuffs: ['metal', 'fork', 'police'],
    fork: ['knife', 'metal'],
  },
  nouns: ['window', 'ladder'],
  items: ['the bins', 'cold toast', 'my driving', 'the good mug', 'sunday', 'the aux', 'socks'],
}

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const THEMES = [{ id: 't001', text: 'seven things {name} would miss', pool: POOL }]
const rng = () => makeRng(7)

describe('meldWord', () => {
  const never = () => false
  it('prefers a word both sides point at — that is the middle', () => {
    expect(meldWord(BRAIN, ['spaghetti', 'handcuffs'], never, rng())).toBe('fork')
  })
  it('falls back to a neighbour of either when there is no overlap', () => {
    expect(['knife', 'metal', 'sauce', 'fork', 'dinner']).toContain(
      meldWord(BRAIN, ['spaghetti', 'fork'], never, rng()),
    )
  })
  it('falls back to a plain noun when it knows neither word', () => {
    expect(BRAIN.nouns).toContain(meldWord(BRAIN, ['quark', 'gusset'], never, rng()))
  })
  it('never repeats a word the session has already used', () => {
    const taken = (w: string) => w === 'fork'
    expect(meldWord(BRAIN, ['spaghetti', 'handcuffs'], taken, rng())).not.toBe('fork')
  })
  it('never echoes one of the two words on screen', () => {
    const word = meldWord({ ...BRAIN, words: { a: ['b'], b: ['a'] } }, ['a', 'b'], never, rng())
    expect(['a', 'b']).not.toContain(word)
  })
  it('says something rather than nothing when its whole vocabulary is spent', () => {
    expect(meldWord(BRAIN, ['spaghetti', 'handcuffs'], () => true, rng()).length).toBeGreaterThan(0)
  })
})

describe('nextBotAction', () => {
  it('joins when it is not yet connected, and not twice', () => {
    const s = initialState(1)
    expect(nextBotAction(s, 'B', BRAIN, rng())).toEqual({ type: 'JOIN', player: 'B', name: 'BOT' })
    const joined = reduce(s, { type: 'JOIN', player: 'B', name: 'BOT' }, 1)
    expect(nextBotAction(joined, 'B', BRAIN, rng())).toBe(null)
  })
  it('submits one word per round and then waits', () => {
    const s = running()
    const action = nextBotAction(s, 'B', BRAIN, rng())
    expect(action?.type).toBe('SUBMIT_WORD')
    const after = reduce(s, action!, 1)
    expect(nextBotAction(after, 'B', BRAIN, rng())).toBe(null)
  })
})

// A session parked in MELD_TYPE with the bot as player B.
function running(): SessionState {
  let s = initialState(1, undefined, THEMES)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'BOT' }, 1)
}

describe('the bot plays a whole session through the real reducer', () => {
  // The bot drives BOTH sides here: if a full session cannot be played out by dispatching
  // nothing but bot decisions, the loop has a hole in it the phones would hit too.
  it('reaches DONE without stalling, and nothing it does is illegal', () => {
    const r = makeRng(3)
    let s = initialState(99, undefined, [
      { id: 't001', text: 'seven things {name} would miss', pool: POOL },
      { id: 't002', text: "seven of {name}'s opinions", pool: POOL },
    ])
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 800) {
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      // Neither side had anything to say: the clock is what moves the game on.
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    expect(s.listActs).toHaveLength(2)
    expect(s.listActs.every((act) => act.items.length === 7)).toBe(true)
    expect(s.listActs.every((act) => act.displacement !== null)).toBe(true)
    // Every slot filled exactly once, both grids, both runs.
    for (const act of s.listActs) {
      for (const byAuthor of [true, false]) {
        const slots = act.items.map((i) => (byAuthor ? i.predictedSlot : i.actualSlot))
        expect([...slots].sort((x, y) => x! - y!)).toEqual([1, 2, 3, 4, 5, 6, 7])
      }
    }
  })

  it('also gets a Finger Down session to DONE with a real five-round hand', () => {
    const r = makeRng(11)
    let s = initialState(42, undefined, [], 'finger', ['a', 'b', 'c', 'd', 'e', 'f'])
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 200) {
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    expect(s.finger?.rounds).toHaveLength(5)
    expect(s.finger?.fingersLeft.A).toBeGreaterThanOrEqual(0)
    expect(s.finger?.fingersLeft.B).toBeGreaterThanOrEqual(0)
    expect(s.finger?.rounds.every((round) => round.applies.A !== null && round.applies.B !== null)).toBe(true)
  })
})
