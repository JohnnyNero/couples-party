import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState, type ListAct, type SessionState } from '../engine/state'
import type { Records } from '../memories/records'
import { BoardStage } from './board'

// The rare moments: a stamp for a perfect read, and a banner for a best night — shown
// only when they've been earned.

let before: Records | null = null
vi.mock('../memories/baseline', () => ({ baseline: () => before, fetchBaseline: () => {} }))

const ITEMS = ['the bins', 'your sister', 'my driving', 'the good mug', 'sunday', 'the aux', 'tea']

// A finished Shortlist act: the ranker's slots 1..7, the author's guesses `off` away.
const act = (off: number): ListAct => ({
  author: 'A',
  themeId: 't001',
  items: ITEMS.map((text, i) => ({ id: `A${i}`, text, actualSlot: i + 1, predictedSlot: ((i + off) % 7) + 1 })),
  placeIndex: 6,
  revealIndex: 6,
  displacement: 0,
})

const session = (phase: SessionState['phase'], a: ListAct): SessionState => ({
  ...initialState(1, 'full', { themes: [{ id: 't001', text: 'seven things {name} would miss', pool: ITEMS }] }),
  phase,
  players: { A: { name: 'Sam', connected: true }, B: { name: 'Alex', connected: true } },
  listActs: [a],
})

const records = (best: number | null): Records => ({
  nights: 1,
  together: { tonight: null, full: best === null ? null : { value: best, on: '2026-09-01' }, thisWeek: 0 },
  wins: { you: 0, them: 0, level: 0 },
  bestNight: { tonight: { you: null, them: null }, full: { you: null, them: null } },
  games: [],
  longestChain: null,
})

describe('the Perfect stamp', () => {
  it('comes down on a Shortlist read with every item exact', () => {
    expect(renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', act(0))} />)).toContain('Perfect')
  })
  it('stays away from anything less', () => {
    expect(renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', act(1))} />)).not.toContain('Perfect')
  })
})

describe('the best-night banner', () => {
  it('names a new best, and the one it beat', () => {
    before = records(1)
    const html = renderToStaticMarkup(<BoardStage s={session('DONE', act(0))} />)
    expect(html).toContain('Your best full session yet!')
    expect(html).toContain('beating 1')
  })
  it('marks the first one as the one to beat', () => {
    before = records(null)
    expect(renderToStaticMarkup(<BoardStage s={session('DONE', act(0))} />)).toContain('Your first full session together')
  })
  it('says nothing when the night fell short, or with no records to go on', () => {
    before = records(10_000)
    expect(renderToStaticMarkup(<BoardStage s={session('DONE', act(0))} />)).not.toContain('🏆')
    before = null
    expect(renderToStaticMarkup(<BoardStage s={session('DONE', act(0))} />)).not.toContain('🏆')
  })
})
