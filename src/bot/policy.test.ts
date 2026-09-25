import { describe, it, expect } from 'vitest'
import { initialState } from '../engine/state'
import { roster } from '../engine/roster'
import { reduce } from '../engine/reducer'
import { makeRng } from '../engine/rng'
import { nextBotAction, type BotBrain } from './policy'

const BRAIN: BotBrain = {
  nouns: ['window', 'ladder'],
}

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const rng = () => makeRng(7)

describe('nextBotAction', () => {
  it('joins when it is not yet connected, and not twice', () => {
    const s = initialState(1)
    expect(nextBotAction(s, 'B', BRAIN, rng())).toEqual({ type: 'JOIN', player: 'B', name: 'BOT' })
    const joined = reduce(s, { type: 'JOIN', player: 'B', name: 'BOT' }, 1)
    expect(nextBotAction(joined, 'B', BRAIN, rng())).toBe(null)
  })
})

describe('the bot plays a whole session through the real reducer', () => {
  // The bot drives BOTH sides here: if a full session cannot be played out by dispatching
  // nothing but bot decisions, the loop has a hole in it the phones would hit too.
  it('reaches DONE without stalling, and nothing it does is illegal', () => {
    const r = makeRng(3)
    let s = initialState(99, 'list', { themes: [
      { id: 't001', text: 'seven things {name} would miss', pool: POOL },
      { id: 't002', text: "seven of {name}'s opinions", pool: POOL },
    ] })
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
    let s = initialState(42, 'finger', { fingerStatements: ['a', 'b', 'c', 'd', 'e', 'f'] })
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

  it('also gets a Wavelength session to DONE with all seven rounds resolved', () => {
    const r = makeRng(17)
    const spectrums = [{ id: 'w01', low: 'Boring', high: 'Thrilling' }, { id: 'w02', low: 'Cheap', high: 'Expensive' }]
    let s = initialState(7, 'wave', { spectrums })
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 400) {
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    expect(s.wave?.rounds).toHaveLength(7)
    expect(s.wave?.rounds.every((round) => round.clue !== null && round.guess !== null)).toBe(true)
    expect(s.wave?.rounds.every((round) => round.distance !== null)).toBe(true)
  })

  it('also gets a Draw Your Love session to DONE with all six rounds resolved', () => {
    const r = makeRng(23)
    const prompts = [{ id: 'd01', text: 'a house' }, { id: 'd02', text: 'a duck' }]
    let s = initialState(9, 'draw', { drawPrompts: prompts })
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 300) {
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    expect(s.draw?.rounds).toHaveLength(6)
    expect(s.draw?.rounds.every((round) => round.guess !== null && round.correct !== null)).toBe(true)
  })

  it('also plays a full session — Shortlist twice, then every other act — start to finish', () => {
    const r = makeRng(29)
    let s = initialState(123, 'full', { themes: [
        { id: 't001', text: 'seven things {name} would miss', pool: POOL },
        { id: 't002', text: "seven of {name}'s opinions", pool: POOL },
      ], fingerStatements: ['a', 'b', 'c', 'd', 'e', 'f'], spectrums: [{ id: 'w01', low: 'Boring', high: 'Thrilling' }, { id: 'w02', low: 'Cheap', high: 'Expensive' }], drawPrompts: [{ id: 'd01', text: 'a house' }, { id: 'd02', text: 'a duck' }] })
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 1500) {
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    expect(s.listActs).toHaveLength(2)
    expect(s.finger?.rounds).toHaveLength(5)
    expect(s.wave?.rounds).toHaveLength(7)
    expect(s.draw?.rounds).toHaveLength(6)
  })
})

describe('the bot can play Tonight', () => {
  it('gets through every night of the rotation to DONE with only its own moves and the clock', () => {
    for (const night of [0, 1, 2, 3, 4]) { // the line-up can vary by night
      const r = makeRng(5 + night)
      let s = initialState(77, 'tonight', {
        likelyStatements: ['snore', 'burn dinner', 'go viral', 'cry at an advert'],
        fingerStatements: ['you have stolen the blanket', 'you have cried at an advert', 'you have lied about being five minutes away'],
        spectrums: [{ id: 'w01', low: 'Cold', high: 'Hot' }, { id: 'w02', low: 'Quiet', high: 'Loud' }],
        mrmrsQuestions: ['Your comfort meal?', 'Your first gig?'],
        drawPrompts: [{ id: 'd01', text: 'comfort food' }],
        lightsQuestions: ['What made you laugh today?'],
      }, night)
      let steps = 0
      while (s.phase !== 'DONE' && steps++ < 400) {
        const a = nextBotAction(s, 'A', BRAIN, r)
        const b = nextBotAction(s, 'B', BRAIN, r)
        const before = s
        if (a) s = reduce(s, a, steps)
        if (b) s = reduce(s, b, steps)
        if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
      }
      expect(s.phase).toBe('DONE')
      const played = roster('tonight', night).map((e) => e.key)
      if (played.includes('likely')) expect(s.likely!.rounds.every((r) => r.picks.A !== null && r.picks.B !== null)).toBe(true)
      if (played.includes('finger')) expect(s.finger!.rounds.every((r) => r.applies.A !== null && r.applies.B !== null)).toBe(true)
      if (played.includes('wave')) expect(s.wave!.rounds.every((r) => r.guess !== null)).toBe(true)
      if (played.includes('mrmrs')) expect(s.mrmrs!.rounds.every((r) => r.verdict.A !== null && r.verdict.B !== null)).toBe(true)
      if (played.includes('draw')) expect(s.draw!.rounds.every((r) => r.answer !== null)).toBe(true)
      expect(s.lights).not.toBe(null)
    }
  })
})

describe('the bot can play the whole night', () => {
  it('walks the full roster, every game in order, to DONE', () => {
    const r = makeRng(8)
    const list = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    let s = initialState(31, 'full', {
      themes: [
        { id: 't001', text: 'seven things {name} would miss', pool: list },
        { id: 't002', text: "seven of {name}'s fears", pool: list },
      ],
      likelyStatements: list,
      fingerStatements: list,
      mrmrsQuestions: list,
      spectrums: list.map((x, i) => ({ id: `w${i}`, low: x, high: x.toUpperCase() })),
      drawPrompts: list.map((x, i) => ({ id: `d${i}`, text: x })),
      lightsQuestions: ['What made you laugh today?'],
    })
    const order: string[] = []
    let steps = 0
    while (s.phase !== 'DONE' && steps++ < 3000) {
      const game = s.phase.split('_')[0]
      if (order[order.length - 1] !== game) order.push(game)
      const a = nextBotAction(s, 'A', BRAIN, r)
      const b = nextBotAction(s, 'B', BRAIN, r)
      const before = s
      if (a) s = reduce(s, a, steps)
      if (b) s = reduce(s, b, steps)
      if (s === before) s = reduce(s, { type: 'TIMEOUT' }, steps)
    }
    expect(s.phase).toBe('DONE')
    // The tiebreaker only turns up on a level night, which depends on the bot's luck.
    expect(order.filter((g) => g !== 'DECIDER')).toEqual(['JOIN', 'LIST', 'FINGER', 'CIRCLE', 'WAVE', 'MM', 'CLOCK', 'DRAW', 'LIGHTS'])
  })
})
