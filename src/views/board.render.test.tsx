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
  revealIndex: 0,
  displacement: null,
  ...over,
})

const session = (phase: SessionState['phase'], a: ListAct): SessionState => ({
  ...initialState(1, 'full', { themes: [{ id: 't001', text: 'seven things {name} would miss', pool: ITEMS }] }),
  phase,
  players: { A: { name: 'Sam', connected: true }, B: { name: 'Alex', connected: true } },
  listActs: [a],
})

// The ranker (B) has locked in the live item's real slot; the author (A) has not yet.
const halfPlaced = () =>
  act({ items: act().items.map((i, n) => (n === 0 ? { ...i, actualSlot: 1 } : i)) })

// Every item placed, and the reveal tapped all the way to the last one. The ranker put
// them 1..7; the author guessed one slot later each time, wrapping — so six items are a
// single place out (1 point each) and the last is miles off.
const revealed = (revealIndex = 6) =>
  act({
    placeIndex: 6,
    revealIndex,
    displacement: 4,
    items: act().items.map((i, n) => ({ ...i, actualSlot: n + 1, predictedSlot: ((n + 1) % 7) + 1 })),
  })

describe('board renders every Act III phase', () => {
  const cases: Array<[SessionState['phase'], ListAct]> = [
    ['LIST_INTRO', act()],
    ['LIST_PLACE', halfPlaced()],
    ['LIST_REVEAL', revealed()],
    ['LIST_RESULT', revealed()],
    ['DONE', revealed()],
  ]
  it.each(cases)('%s renders and names the act', (phase, a) => {
    const s = session(phase, a)
    const html = renderToStaticMarkup(<BoardStage s={s} />)
    expect(html.length).toBeGreaterThan(0)
    expect(railText(s)).toMatch(
      phase === 'DONE' ? /session/i : phase === 'LIST_RESULT' ? /score/i : /Shortlist/,
    )
  })

  it('never shows the items on the board while they are still being ranked', () => {
    for (const phase of ['LIST_INTRO', 'LIST_PLACE'] as const) {
      const html = renderToStaticMarkup(<BoardStage s={session(phase, halfPlaced())} />)
      for (const text of ITEMS) expect(html).not.toContain(text)
    }
  })

  it('opens the act on the theme, named after the author, with its own icon', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_INTRO', act())} />)
    expect(html).toContain('seven things Sam would miss')
    expect(html).not.toContain('{name}')
    expect(html).toContain('<svg') // the theme's glyph, drawn not fetched
  })

  it('shows the whole list, both columns and the running score once the reveal is walked', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', revealed())} />)
    for (const text of ITEMS) expect(html).toContain(text)
    // Sam authored the act, so Alex does the real ranking and Sam does the guessing.
    expect(html).toContain('Alex ranked')
    expect(html).toContain('Sam guessed')
  })

  it('reveals one item at a time, holding the rest back', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_REVEAL', revealed(1))} />)
    expect(html).toContain(ITEMS[0])
    expect(html).toContain(ITEMS[1])
    for (const text of ITEMS.slice(2)) expect(html).not.toContain(text)
  })
})

describe('the scoreboard between games', () => {
  it('breaks the night down by game and says what is coming next', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('LIST_RESULT', revealed())} />)
    // Six one-place misses: 6 points to Alex, who authored nothing here — Sam authored.
    expect(html).toContain('Shortlist')
    expect(html).toContain('Put a Finger Down')
    expect(html).toContain('Wavelength')
    expect(html).toContain('Draw Your Answer')
    expect(html).toContain('More Likely')
    expect(html).toContain('Mr &amp; Mrs')
    expect(html).toContain('Next up')
  })

  it('calls the night rather than the next game once there is nothing left', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('DONE', revealed())} />)
    expect(html).not.toContain('Next up')
    expect(html).toMatch(/takes the night|Dead level/)
  })
})

describe('controllers render for both players', () => {
  const phases = ['LIST_INTRO', 'LIST_PLACE', 'LIST_REVEAL', 'LIST_RESULT'] as const
  it.each(phases)('%s renders for author and ranker', (phase) => {
    const a = phase === 'LIST_PLACE' ? halfPlaced() : act()
    for (const me of ['A', 'B'] as const) {
      expect(renderToStaticMarkup(<Controller s={session(phase, a)} me={me} />).length).toBeGreaterThan(0)
    }
  })

  it('shows each side its own ladder and never the other side\'s', () => {
    // B (the ranker) has put the live item in slot 1. A (the author) has placed nothing.
    const s = session('LIST_PLACE', halfPlaced())
    const forRanker = renderToStaticMarkup(<Controller s={s} me="B" />)
    const forAuthor = renderToStaticMarkup(<Controller s={s} me="A" />)
    // B sees their own placement sitting in the ladder, and is told to wait.
    expect(forRanker).toContain(ITEMS[0])
    expect(forRanker).toContain('still placing')
    // A sees the item to place and an empty ladder — nothing of B's choice leaks across.
    expect(forAuthor).toContain(ITEMS[0])
    expect(forAuthor).not.toContain('still placing')
  })
})
