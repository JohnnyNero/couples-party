import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState, type ListAct, type SessionState } from '../engine/state'
import { BoardStage, railText } from './board'
import { Controller } from './controller'

// Static renders of every Act III phase. Two things are being checked: that no renderer
// reaches through a null, and — the load-bearing one — that the board never shows the
// items before LIST_PLACE reveals them one at a time.

const ITEMS = ['the bins', 'your sister', 'my driving', 'the good mug', 'sunday', 'the aux', 'tea']

const act = (over: Partial<ListAct> = {}): ListAct => ({
  author: 'A',
  themeId: 't001',
  items: ITEMS.map((text, i) => ({
    id: `A${i}`, text, swapped: false, actualSlot: null, predictedSlot: null,
  })),
  placeIndex: 0,
  swapDone: false,
  displacement: null,
  ...over,
})

const session = (phase: SessionState['phase'], a: ListAct): SessionState => ({
  ...initialState(1, undefined, [{ id: 't001', text: 'seven things {name} would miss' }]),
  phase,
  players: { A: { name: 'Sam', connected: true }, B: { name: 'Alex', connected: true } },
  stake: 'loser does the dishes',
  listActs: [a],
})

const placed = () =>
  act({
    swapDone: true,
    placeIndex: 2,
    items: act().items.map((i, n) => ({
      ...i,
      actualSlot: n < 2 ? n + 1 : null,
      predictedSlot: n < 2 ? 7 - n : null,
    })),
  })

const revealed = () =>
  act({
    swapDone: true,
    placeIndex: 6,
    displacement: 4,
    items: act().items.map((i, n) => ({ ...i, actualSlot: n + 1, predictedSlot: ((n + 1) % 7) + 1 })),
  })

describe('board renders every Act III phase', () => {
  const cases: Array<[SessionState['phase'], ListAct]> = [
    ['LIST_WRITE', act({ items: act().items.slice(0, 3) })],
    ['LIST_SWAP', act()],
    ['LIST_PLACE', placed()],
    ['LIST_REVEAL', revealed()],
    ['DONE', revealed()],
  ]
  it.each(cases)('%s renders and names the act', (phase, a) => {
    const s = session(phase, a)
    const html = renderToStaticMarkup(<BoardStage s={s} />)
    expect(html.length).toBeGreaterThan(0)
    expect(railText(s)).toMatch(phase === 'DONE' ? /session/i : /Act III/)
  })

  it('never shows the items while they are still being written or vetoed', () => {
    for (const phase of ['LIST_WRITE', 'LIST_SWAP'] as const) {
      const html = renderToStaticMarkup(<BoardStage s={session(phase, act())} />)
      for (const text of ITEMS) expect(html).not.toContain(text)
    }
  })

  it('shows only the item on the table during placement, not the ones to come', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_PLACE', placed())} />)
    expect(html).toContain(ITEMS[2]) // placeIndex 2 — the one being bet on
    expect(html).not.toContain(ITEMS[3])
    expect(html).not.toContain(ITEMS[6])
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
    const a = phase === 'LIST_PLACE' ? placed() : act()
    for (const me of ['A', 'B'] as const) {
      expect(renderToStaticMarkup(<Controller s={session(phase, a)} me={me} />).length).toBeGreaterThan(0)
    }
  })

  it('shows the ranker the items to veto, and the author nothing', () => {
    const s = session('LIST_SWAP', act())
    expect(renderToStaticMarkup(<Controller s={s} me="B" />)).toContain(ITEMS[0])
    expect(renderToStaticMarkup(<Controller s={s} me="A" />)).not.toContain(ITEMS[0])
  })

  it('never shows a player the other one\'s placement', () => {
    const s = session('LIST_PLACE', placed())
    // The ranker has taken slots 1 and 2; the author predicted 7 and 6. Neither grid
    // may leak the other's occupancy: the ranker's own view offers 3..7.
    const ranker = renderToStaticMarkup(<Controller s={s} me="B" />)
    expect(ranker).toContain('disabled')
    expect((ranker.match(/disabled/g) ?? []).length).toBe(2)
  })
})
