import { describe, it, expect } from 'vitest'
import { initialState, type ChainCategory, type ChainRound, type Game, type SessionState } from './state'
import { reduce } from './reducer'
import { chainKey, checkWord, findListed, nextLetter, turnMs } from './chain'
import { standing } from './standing'
import { CHAIN } from './phases'

const ANIMALS: ChainCategory = {
  name: 'Animals',
  words: ['tiger', 'rabbit', 'rat', 'toad', 'dog', 'goat', 'turkey', 'yak', 'kangaroo', 'owl', 'lion', 'newt', 'elephant', 'guinea pig', 'fox'],
}

const roundOf = (over: Partial<ChainRound> = {}): ChainRound => ({
  index: 1, category: 'Animals', words: ANIMALS.words, chain: [{ word: 'tiger', by: null }],
  turn: 'A', need: 'r', loser: null, over: false, reject: null, ...over,
})

describe('checking words', () => {
  it('ignores case, spaces and a plural', () => {
    expect(chainKey('Guinea Pigs')).toBe(chainKey('guinea pig'))
    expect(chainKey('glass')).toBe('glass') // a double s isn't a plural
  })
  it('forgives one slip in a longer word, but not a short one or an ambiguous one', () => {
    expect(findListed('elephnt', ANIMALS.words)).toBe('elephant')
    expect(findListed('kangaro', ANIMALS.words)).toBe('kangaroo')
    expect(findListed('dig', ANIMALS.words)).toBe(null)
  })
  it('says what was wrong: the letter, already used, or not on the list', () => {
    const r = roundOf()
    expect(checkWord(r, 'Rabbit')).toEqual({ ok: true, word: 'rabbit' })
    expect(checkWord(r, 'dog')).toEqual({ ok: false, reason: 'letter' })
    expect(checkWord(roundOf({ chain: [{ word: 'rat', by: null }, { word: 'tiger', by: 'A' }] }), 'rat')).toEqual({ ok: false, reason: 'used' })
    expect(checkWord(r, 'reindeer')).toEqual({ ok: false, reason: 'unknown' })
  })
  it('falls back a letter when nothing left starts with the last one', () => {
    // Nothing starts with x, so "fox" hands over an o.
    expect(nextLetter(roundOf(), 'fox')).toBe('o')
    // Yak is the only y; once it's gone, "turkey" hands over an e.
    expect(nextLetter(roundOf({ chain: [{ word: 'yak', by: null }] }), 'turkey')).toBe('e')
  })
  it('tightens the clock as the chain grows', () => {
    const played = (n: number) => roundOf({ chain: [{ word: 'x', by: null }, ...Array.from({ length: n }, () => ({ word: 'x', by: 'A' as const }))] })
    expect(turnMs(played(0))).toBe(CHAIN.turnMs[0])
    expect(turnMs(played(10))).toBe(CHAIN.turnMs[1])
    expect(turnMs(played(25))).toBe(CHAIN.turnMs[2])
  })
})

const start = (game: Game = 'chain', cats: ChainCategory[] = [ANIMALS]) => {
  let s = initialState(1, game, { chainCategories: cats })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const live = (s: SessionState) => s.chain!.rounds[s.chain!.current]
// A word the current player could legally play right now.
const legal = (s: SessionState) => {
  const r = live(s)
  const used = new Set(r.chain.map((l) => chainKey(l.word)))
  return r.words.find((w) => w[0] === r.need && !used.has(chainKey(w)))!
}

describe('Word Chain', () => {
  it('opens with the app’s own word and a clock on whoever goes first', () => {
    const s = start()
    expect(s.phase).toBe('CHAIN_TURN')
    const r = live(s)
    expect(r.chain).toHaveLength(1)
    expect(r.chain[0].by).toBe(null)
    expect(r.need).toMatch(/^[a-z]$/)
    expect(s.phaseEndsAt).toBe(1000 + CHAIN.turnMs[0])
    expect(s.chainCategories).toEqual([]) // the rounds carry their own lists
    expect(s.chain!.rounds).toHaveLength(4)
  })
  it('only takes a word from the player whose turn it is, and passes the turn on', () => {
    let s = start()
    const first = live(s).turn
    const second = first === 'A' ? 'B' : 'A'
    expect(reduce(s, { type: 'CHAIN_WORD', player: second, word: legal(s) }, 2000)).toBe(s)
    s = reduce(s, { type: 'CHAIN_WORD', player: first, word: legal(s) }, 2000)
    expect(live(s).turn).toBe(second)
    expect(live(s).chain).toHaveLength(2)
    expect(s.phaseEndsAt).toBe(2000 + CHAIN.turnMs[0]) // a fresh clock for them
  })
  it('turns a bad word back with the reason, without stopping the clock', () => {
    let s = start()
    const p = live(s).turn
    const ends = s.phaseEndsAt
    s = reduce(s, { type: 'CHAIN_WORD', player: p, word: 'unicorn' }, 3000)
    expect(live(s).reject).toMatchObject({ player: p, word: 'unicorn' })
    expect(live(s).turn).toBe(p)
    expect(s.phaseEndsAt).toBe(ends)
    s = reduce(s, { type: 'CHAIN_WORD', player: p, word: legal(s) }, 4000)
    expect(live(s).reject).toBe(null)
  })
  it('loses the round to whoever runs out of time; the other scores, and the loser starts the next', () => {
    let s = start()
    const loser = live(s).turn
    const winner = loser === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'TIMEOUT' }, 20000)
    expect(s.phase).toBe('CHAIN_END')
    expect(live(s).loser).toBe(loser)
    expect(standing(s)[winner]).toBe(CHAIN.winPoints)
    s = reduce(s, { type: 'TIMEOUT' }, 30000)
    expect(s.phase).toBe('CHAIN_TURN')
    expect(s.chain!.current).toBe(1)
    expect(live(s).turn).toBe(loser)
  })
  it('plays its four rounds through to a scoreboard', () => {
    let s = start()
    for (let i = 0; i < 20 && s.phase !== 'CHAIN_RESULT'; i++) s = reduce(s, { type: 'TIMEOUT' }, 1000 * i)
    expect(s.phase).toBe('CHAIN_RESULT')
    const t = standing(s)
    expect(t.A + t.B).toBe(4 * CHAIN.winPoints)
  })
  it('skips itself when the content file has no categories', () => {
    expect(start('chain', []).phase).toBe('DONE')
  })
})
