import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { initialState, type ListAct, type SessionState } from '../engine/state'
import { BoardStage, railText } from './board'
import { Controller } from './controller'
import { reduce } from '../engine/reducer'

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
    expect(html).toContain('Called It')
    expect(html).toContain('Wavelength')
    expect(html).toContain('Draw Your Answer')
    expect(html).not.toContain('More Likely') // parked — see roster.ts
    expect(html).toContain('Mr &amp; Mrs')
    expect(html).toContain('Up next')
  })

  it('calls the night rather than the next game once there is nothing left', () => {
    const html = renderToStaticMarkup(<BoardStage s={session('DONE', revealed())} />)
    expect(html).not.toContain('Up next')
    expect(html).toMatch(/takes the night|Neck and neck/)
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

describe('the fillers and the tiebreaker', () => {
  // Tonight on night 0 with only Lights Out to draw on: the Stop the Clock filler plays,
  // nobody taps, and the night is left level.
  const walk = (until: (s: SessionState) => boolean) => {
    let s = initialState(1, 'tonight', { lightsQuestions: ['Goodnight?'] }, 0)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
    for (let i = 0; i < 60 && !until(s); i++) {
      s = s.phase.endsWith('_RESULT') ? reduce(s, { type: 'CONTINUE', player: 'A' }, i * 1000) : reduce(s, { type: 'TIMEOUT' }, i * 1000)
    }
    return s
  }
  it('renders every Stop the Clock phase, board and phone, without reaching through a null', () => {
    for (const phase of ['CLOCK_READY', 'CLOCK_RUN', 'CLOCK_REVEAL', 'CLOCK_RESULT'] as const) {
      const s = walk((x) => x.phase === phase)
      expect(s.phase).toBe(phase)
      expect(renderToStaticMarkup(<BoardStage s={s} />)).toBeTruthy()
      expect(renderToStaticMarkup(<Controller s={s} me="A" />)).toBeTruthy()
      expect(railText(s)).toMatch(/Stop the Clock/)
    }
  })
  it('says a level night goes to a tiebreaker, then plays it as sudden death', () => {
    // The last scored game's scoreboard, still level at 0–0.
    const cats = ['a drink', 'a colour', 'an animal', 'a film', 'a job', 'a sport']
    // Night 5 ends on Category Clash (Word Chain and Finger Down sit out).
    let last = initialState(1, 'tonight', { lightsQuestions: ['Goodnight?'], clashCategories: cats }, 5)
    last = reduce(last, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    last = reduce(last, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
    for (let i = 0; i < 120 && last.phase !== 'CLASH_RESULT'; i++) {
      last = last.phase.endsWith('_RESULT') ? reduce(last, { type: 'CONTINUE', player: 'A' }, i * 1000) : reduce(last, { type: 'TIMEOUT' }, i * 1000)
    }
    expect(last.phase).toBe('CLASH_RESULT') // the night's last game
    expect(renderToStaticMarkup(<BoardStage s={last} />)).toContain('Dead level!')
    const decider = walk((x) => x.phase === 'DECIDER_READY')
    expect(renderToStaticMarkup(<BoardStage s={decider} />)).toContain('Closest takes the night')
    expect(railText(decider)).toBe('Tiebreaker · sudden death')
    const reveal = walk((x) => x.phase === 'DECIDER_REVEAL')
    expect(renderToStaticMarkup(<BoardStage s={reveal} />)).toContain('Dead heat')
  })
  it('renders every Perfect Circle phase', () => {
    let s = initialState(1, 'circle', {})
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
    expect(renderToStaticMarkup(<BoardStage s={s} />)).toContain('Draw a perfect circle')
    expect(renderToStaticMarkup(<Controller s={s} me="A" />)).toContain('lifting your finger sends it')
    s = reduce(s, { type: 'TIMEOUT' }, 20000)
    expect(s.phase).toBe('CIRCLE_REVEAL')
    expect(renderToStaticMarkup(<BoardStage s={s} />)).toContain('Dead level')
  })
})

describe('Category Clash', () => {
  const cats = ['a drink', 'a colour', 'an animal', 'a film', 'a job', 'a sport', 'a city', 'a game']
  const begin = () => {
    let s = initialState(1, 'clash', { clashCategories: cats })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
  }
  it('shows the letter and categories while writing, never anyone\'s answers', () => {
    let s = begin()
    const round = s.clash!.rounds[0]
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: round.categories.map(() => `${round.letter}secret`) }, 1000)
    const board = renderToStaticMarkup(<BoardStage s={s} />)
    expect(board).toContain(round.categories[0])
    expect(board).not.toContain('secret')
    expect(renderToStaticMarkup(<Controller s={s} me="B" />)).toContain(round.categories[5])
    expect(railText(s)).toBe('Category Clash · Round 1 of 3')
  })
  it('reveals row by row, with the verdict under each answer', () => {
    let s = begin()
    const round = s.clash!.rounds[0]
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'A', answers: round.categories.map((_, i) => `${round.letter}sam${i}`) }, 1000)
    s = reduce(s, { type: 'SUBMIT_CLASH', player: 'B', answers: ['zebra', `${round.letter}sam1`] }, 1000)
    let html = renderToStaticMarkup(<BoardStage s={s} />)
    expect(html).toContain(`${round.letter}sam0`)
    expect(html).toContain('wrong letter')
    expect(html).not.toContain(`${round.letter}sam1`) // not reached yet
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 2000)
    html = renderToStaticMarkup(<BoardStage s={s} />)
    expect(html).toContain('same')
    expect(renderToStaticMarkup(<Controller s={s} me="A" />)).toContain('Next')
  })
})

describe('Word Chain', () => {
  const cat = { name: 'Animals', words: ['tiger', 'rabbit', 'rat', 'toad', 'dog', 'goat', 'turkey', 'yak', 'kangaroo', 'owl', 'lion', 'newt'] }
  const begin = () => {
    let s = initialState(1, 'chain', { chainCategories: [cat] })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
    return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
  }
  it('shows whose go it is and the letter they need, on the board and both phones', () => {
    let s = begin()
    const r = s.chain!.rounds[0]
    const who = r.turn === 'A' ? 'Sam' : 'Alex'
    expect(renderToStaticMarkup(<BoardStage s={s} />)).toContain(`${who} needs`)
    expect(renderToStaticMarkup(<Controller s={s} me={r.turn} />)).toContain('Your go')
    expect(renderToStaticMarkup(<Controller s={s} me={r.turn === 'A' ? 'B' : 'A'} />)).toContain(`${who} needs`)
    s = reduce(s, { type: 'CHAIN_WORD', player: r.turn, word: 'unicorn' }, 100)
    expect(renderToStaticMarkup(<BoardStage s={s} />)).toContain('unicorn')
    expect(railText(s)).toBe('Word Chain · Round 1 of 4')
  })
  it('ends a round on whoever ran out of time', () => {
    const s = reduce(begin(), { type: 'TIMEOUT' }, 20000)
    expect(s.phase).toBe('CHAIN_END')
    expect(renderToStaticMarkup(<BoardStage s={s} />)).toContain('ran out of time')
  })
})
