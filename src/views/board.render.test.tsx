import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState, type ListAct, type SessionState } from '../engine/state'
import { BoardStage, railText } from './board'
import { Controller } from './controller'

// Static renders of every Act III phase. Two things are being checked: that no renderer
// reaches through a null, and — the load-bearing one — that the board never shows the
// items before LIST_REVEAL.

const ITEMS = ['the bins', 'your sister', 'my driving', 'the good mug', 'sunday', 'the aux', 'tea']

const act = (over: Partial<ListAct> = {}): ListAct => ({
  author: 'A',
  themeId: 't001',
  items: ITEMS.map((text, i) => ({ id: `A${i}`, text, actualSlot: null, predictedSlot: null })),
  placeIndex: 0,
  displacement: null,
  ...over,
})

const session = (phase: SessionState['phase'], a: ListAct): SessionState => ({
  ...initialState(1, [{ id: 't001', text: 'seven things {name} would miss', pool: ITEMS }]),
  phase,
  players: { A: { name: 'Sam', connected: true }, B: { name: 'Alex', connected: true } },
  listActs: [a],
})

// The ranker (B) has locked in the live item's real slot; the author (A) has not yet.
const halfPlaced = () =>
  act({ items: act().items.map((i, n) => (n === 0 ? { ...i, actualSlot: 1 } : i)) })

const revealed = () =>
  act({
    placeIndex: 6,
    displacement: 4,
    items: act().items.map((i, n) => ({ ...i, actualSlot: n + 1, predictedSlot: ((n + 1) % 7) + 1 })),
  })

describe('board renders every Act III phase', () => {
  const cases: Array<[SessionState['phase'], ListAct]> = [
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

  it('never shows the items on the board while they are still being ranked', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_PLACE', halfPlaced())} />)
    for (const text of ITEMS) expect(html).not.toContain(text)
  })

  it('shows the whole list, both columns and the award at the reveal', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', revealed())} />)
    for (const text of ITEMS) expect(html).toContain(text)
    expect(html).toContain('Displacement')
    expect(html).toContain('Sam +1') // displacement 4 → author takes 1
  })
})

describe('controllers render for both players', () => {
  const phases = ['LIST_PLACE', 'LIST_REVEAL'] as const
  it.each(phases)('%s renders for author and ranker', (phase) => {
    const a = phase === 'LIST_PLACE' ? halfPlaced() : act()
    for (const me of ['A', 'B'] as const) {
      expect(renderToStaticMarkup(<Controller s={session(phase, a)} me={me} />).length).toBeGreaterThan(0)
    }
  })

  it('shows the live item to whichever side has not placed it, and a waiting message to whoever has', () => {
    const s = session('LIST_PLACE', halfPlaced())
    // B (the ranker) already locked in the live item's real slot.
    expect(renderToStaticMarkup(<Controller s={s} me="B" />)).not.toContain(ITEMS[0])
    // A (the author) has not guessed yet.
    expect(renderToStaticMarkup(<Controller s={s} me="A" />)).toContain(ITEMS[0])
  })
})
