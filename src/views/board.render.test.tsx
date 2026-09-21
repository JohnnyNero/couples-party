import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState, type ListAct, type SessionState } from '../engine/state'
import { BoardStage, railText } from './board'
import { Controller } from './controller'

// Static renders of every Act III phase. Two things are being checked: that no renderer
// reaches through a null, and — the load-bearing one — that the board never shows the
// items before LIST_REVEAL.

const ITEMS = ['the bins', 'your sister', 'my driving', 'the good mug', 'sunday', 'the aux', 'tea']
const POOL = [...ITEMS, 'extra one', 'extra two', 'extra three']

const act = (over: Partial<ListAct> = {}): ListAct => ({
  author: 'A',
  themeId: 't001',
  pool: POOL,
  items: ITEMS.map((text, i) => ({
    id: `A${i}`, text, swapped: false, poolIndex: i, actualSlot: null, predictedSlot: null,
  })),
  swapDone: false,
  displacement: null,
  ...over,
})

const session = (phase: SessionState['phase'], a: ListAct): SessionState => ({
  ...initialState(1, undefined, [{ id: 't001', text: 'seven things {name} would miss', pool: POOL }]),
  phase,
  players: { A: { name: 'Sam', connected: true }, B: { name: 'Alex', connected: true } },
  listActs: [a],
})

// The ranker (B) has locked in their real order; the author (A) has not submitted yet.
const halfPlaced = () =>
  act({
    swapDone: true,
    items: act().items.map((i, n) => ({ ...i, actualSlot: n + 1, predictedSlot: null })),
  })

const revealed = () =>
  act({
    swapDone: true,
    displacement: 4,
    items: act().items.map((i, n) => ({ ...i, actualSlot: n + 1, predictedSlot: ((n + 1) % 7) + 1 })),
  })

describe('board renders every Act III phase', () => {
  const cases: Array<[SessionState['phase'], ListAct]> = [
    ['LIST_WRITE', act({ items: act().items.slice(0, 3) })],
    ['LIST_SWAP', act()],
    ['LIST_PLACE', halfPlaced()],
    ['LIST_REVEAL', revealed()],
    ['DONE', revealed()],
  ]
  it.each(cases)('%s renders and names the act', (phase, a) => {
    const s = session(phase, a)
    const html = renderToStaticMarkup(<BoardStage s={s} />)
    expect(html.length).toBeGreaterThan(0)
    expect(railText(s)).toMatch(phase === 'DONE' ? /session/i : /Act III/)
  })

  it('never shows the items while they are still being picked, vetoed, or ranked', () => {
    const cases: Array<[SessionState['phase'], ListAct]> = [
      ['LIST_WRITE', act()],
      ['LIST_SWAP', act()],
      ['LIST_PLACE', halfPlaced()],
    ]
    for (const [phase, a] of cases) {
      const html = renderToStaticMarkup(<BoardStage s={session(phase, a)} />)
      for (const text of ITEMS) expect(html).not.toContain(text)
    }
  })

  it('shows the whole list, both columns and the award at the reveal', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', revealed())} />)
    for (const text of ITEMS) expect(html).toContain(text)
    expect(html).toContain('Displacement')
    expect(html).toContain('Sam +1') // displacement 4 → author takes 1
  })
})

describe('controllers render for both players', () => {
  const phases = ['LIST_WRITE', 'LIST_SWAP', 'LIST_PLACE', 'LIST_REVEAL'] as const
  it.each(phases)('%s renders for author and ranker', (phase) => {
    const a = phase === 'LIST_PLACE' ? halfPlaced() : act()
    for (const me of ['A', 'B'] as const) {
      expect(renderToStaticMarkup(<Controller s={session(phase, a)} me={me} />).length).toBeGreaterThan(0)
    }
  })

  it('shows the ranker the items to veto, and the author nothing', () => {
    const s = session('LIST_SWAP', act())
    expect(renderToStaticMarkup(<Controller s={s} me="B" />)).toContain(ITEMS[0])
    expect(renderToStaticMarkup(<Controller s={s} me="A" />)).not.toContain(ITEMS[0])
  })

  it('a player who has already submitted sees no list, only a waiting message', () => {
    const s = session('LIST_PLACE', halfPlaced()) // B (the ranker) has already submitted
    const ranker = renderToStaticMarkup(<Controller s={s} me="B" />)
    const author = renderToStaticMarkup(<Controller s={s} me="A" />)
    for (const text of ITEMS) expect(ranker).not.toContain(text)
    expect(author).toContain(ITEMS[0]) // still dragging their own guess
  })
})
