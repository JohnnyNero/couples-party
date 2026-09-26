import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { WAVE } from './phases'
import { SCORING, shown, standing, teamScore } from './standing'
import { roundsFor } from './roster'

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const THEMES = [
  { id: 't001', text: 'seven things {name} would struggle to give up', pool: POOL },
  { id: 't002', text: "seven of {name}'s strongest opinions", pool: POOL },
]

const bothJoined = (themes = THEMES) => {
  let s = initialState(1, 'full', { themes })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  return s
}

describe('joining', () => {
  it('stays in JOIN until both connected', () => {
    let s = initialState(1)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    expect(s.phase).toBe('JOIN')
    expect(s.players.A.connected).toBe(true)
  })
})

describe('join → act I start', () => {
  it('both joining begins Act III · Shortlist directly, on author A', () => {
    const s = bothJoined()
    expect(s.phase).toBe('LIST_INTRO') // the theme card, then the items
    expect(s.phaseEndsAt).toBe(1000 + 4000)
    expect(s.listActs).toHaveLength(1)
    expect(s.listActs[0].author).toBe('A')
  })
  it('the theme card runs out into the first item, on a fresh clock', () => {
    const s = reduce(bothJoined(), { type: 'TIMEOUT' }, 5000)
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.phaseEndsAt).toBe(5000 + 15000)
    expect(s.listActs[0].placeIndex).toBe(0)
  })
  it('nothing can be placed while the theme card is still up', () => {
    const s = bothJoined()
    const after = reduce(s, { type: 'PLACE_ITEM', player: s.listActs[0].author, slot: 1 }, 2000)
    expect(after).toBe(s)
  })
})

// ---------------------------------------------------------------- Act III · Shortlist

// Every act opens on its theme card; the tests below are about the ranking, so they
// step past it the same way the host's clock does.
const pastIntro = (s: SessionState) =>
  s.phase === 'LIST_INTRO' ? reduce(s, { type: 'TIMEOUT' }, 1000) : s

const atListPlace = () => pastIntro(bothJoined())

// The reveal has no clock — it is walked item by item. Tap it all the way off the end.
const cont = (s: SessionState) => reduce(s, { type: 'CONTINUE', player: 'A' }, 6000)

const tapThroughReveal = (state: SessionState) => {
  let s = state
  for (let i = 0; i < 20 && s.phase === 'LIST_REVEAL'; i++) {
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 4000)
  }
  return s
}

// Places every remaining item, both sides, at the given slots (1..7, in item order).
// `actual` is the ranker's slots, `predicted` the author's guesses.
const placeAll = (state: SessionState, actual: number[], predicted: number[]) => {
  let s = pastIntro(state)
  const act = s.listActs[s.listActs.length - 1]
  const ranker = act.author === 'A' ? 'B' : 'A'
  for (let i = act.placeIndex; i < act.items.length; i++) {
    s = reduce(s, { type: 'PLACE_ITEM', player: ranker, slot: actual[i] }, 1000)
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: predicted[i] }, 1000)
  }
  return s
}

describe('act III · placement', () => {
  it('opens on author A with a theme, seven random items, and a 15s clock', () => {
    const s = atListPlace()
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.phaseEndsAt).toBe(1000 + 15000)
    expect(s.listActs).toHaveLength(1)
    expect(s.listActs[0].author).toBe('A')
    expect(s.listActs[0].placeIndex).toBe(0)
    expect(THEMES.map((t) => t.id)).toContain(s.listActs[0].themeId)
    const theme = THEMES.find((t) => t.id === s.listActs[0].themeId)!
    expect(s.listActs[0].items).toHaveLength(7)
    for (const item of s.listActs[0].items) expect(theme.pool).toContain(item.text)
    expect(new Set(s.listActs[0].items.map((i) => i.text)).size).toBe(7) // no repeats
  })
  it('locks a slot on the live item and ignores a repeat from the same side', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 3 }, 1000)
    expect(s.listActs[0].items[0].predictedSlot).toBe(3)
    expect(s.phase).toBe('LIST_PLACE') // the ranker hasn't gone yet
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 5 }, 1000) // no changing your mind
    expect(s.listActs[0].items[0].predictedSlot).toBe(3)
  })
  it('rejects a slot out of range, or one already spent on an earlier item', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const ranker = act.author === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 0 }, 1000)
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 8 }, 1000)
    expect(s.listActs[0].items[0].predictedSlot).toBe(null)
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 4 }, 1000)
    s = reduce(s, { type: 'PLACE_ITEM', player: ranker, slot: 4 }, 1000) // both done — item two is live
    expect(s.listActs[0].placeIndex).toBe(1)
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 4 }, 1000) // already spent on item one
    expect(s.listActs[0].items[1].predictedSlot).toBe(null)
  })
  it('advances to the next item only once both sides have locked the live one', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const ranker = act.author === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'PLACE_ITEM', player: ranker, slot: 1 }, 1000)
    expect(s.listActs[0].placeIndex).toBe(0)
    expect(s.phaseEndsAt).toBe(1000 + 15000) // unchanged — still waiting on the author
    s = reduce(s, { type: 'PLACE_ITEM', player: act.author, slot: 2 }, 2000)
    expect(s.listActs[0].placeIndex).toBe(1)
    expect(s.phaseEndsAt).toBe(2000 + 15000) // a fresh clock for item two
  })
  it('timing out the live item fills in whoever has not gone with their lowest free slot', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const ranker = act.author === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'PLACE_ITEM', player: ranker, slot: 3 }, 1000) // the author never goes
    s = reduce(s, { type: 'TIMEOUT' }, 2000)
    expect(s.listActs[0].items[0].actualSlot).toBe(3)
    expect(s.listActs[0].items[0].predictedSlot).toBe(1) // the author's lowest free slot
    expect(s.listActs[0].placeIndex).toBe(1)
  })
  it('a full run on both sides opens the reveal with zero displacement', () => {
    const order = [1, 2, 3, 4, 5, 6, 7]
    const s = placeAll(atListPlace(), order, order)
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[0].displacement).toBe(0)
  })
})

describe('act III · the reveal walks item by item', () => {
  const order = [1, 2, 3, 4, 5, 6, 7]
  const atReveal = () => placeAll(atListPlace(), order, order)

  it('opens on the first item with no clock — nothing hurries the arguing', () => {
    const s = atReveal()
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[0].revealIndex).toBe(0)
    expect(s.phaseEndsAt).toBe(null)
  })
  it('steps one item per tap, from either player', () => {
    let s = atReveal()
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 4000)
    expect(s.listActs[0].revealIndex).toBe(1)
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'B' }, 4000)
    expect(s.listActs[0].revealIndex).toBe(2)
    expect(s.phase).toBe('LIST_REVEAL')
  })
  it('tapping past the last item ends the act rather than running off the end', () => {
    let s = atReveal()
    for (let i = 0; i < 6; i++) s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 4000)
    expect(s.listActs[0].revealIndex).toBe(6) // the seventh and last item
    expect(s.phase).toBe('LIST_REVEAL')
    s = reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 5000)
    expect(s.phase).toBe('LIST_INTRO') // straight into run 2's theme card
    expect(s.listActs).toHaveLength(2)
  })
  it('ignores a tap from any other phase', () => {
    const s = atListPlace()
    expect(reduce(s, { type: 'ADVANCE_REVEAL', player: 'A' }, 2000)).toBe(s)
  })
  it('run 2 starts its own reveal back at the first item', () => {
    let s = tapThroughReveal(atReveal())
    s = pastIntro(s)
    s = placeAll(s, order, order)
    expect(s.listActs[1].revealIndex).toBe(0)
    expect(s.listActs[0].revealIndex).toBe(6) // run 1's record is untouched
  })
})

describe('act III · reveal and alternation', () => {
  it('sums displacement across the seven items', () => {
    const s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [2, 1, 3, 4, 5, 7, 6])
    expect(s.listActs[0].displacement).toBe(4)
  })
  it('runs the act again with the roles swapped, on a different theme', () => {
    let s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = tapThroughReveal(s) // reveal -> run 2
    expect(s.phase).toBe('LIST_INTRO') // run 2's own theme card
    expect(s.listActs).toHaveLength(2)
    expect(s.listActs[1].author).toBe('B')
    expect(s.listActs[1].themeId).not.toBe(s.listActs[0].themeId)
    expect(s.listActs[0].displacement).toBe(0) // run 1's record is untouched
  })
  it('a full session carries on to the next game in the roster after the second run', () => {
    let s = initialState(1, 'full', { themes: THEMES, fingerStatements: FINGER_POOL })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = placeAll(s, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = tapThroughReveal(s) // run 2 begins
    s = placeAll(s, [7, 6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 6, 7])
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[1].displacement).toBe(24) // the worst read available
    s = tapThroughReveal(s)
    expect(s.phase).toBe('LIST_RESULT') // the game's own scoreboard first
    s = cont(s)
    // Who's More Likely is next in the full roster, but this session has no statements
    // for it — so it's skipped rather than opened empty, and Finger Down comes up.
    expect(s.phase).toBe('FINGER_ROUND')
  })
  it('a standalone Shortlist-only session ends after the second run', () => {
    let s = initialState(1, 'list', { themes: THEMES })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = placeAll(s, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = tapThroughReveal(s) // run 2 begins
    s = placeAll(s, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    expect(s.phase).toBe('LIST_REVEAL')
    s = tapThroughReveal(s)
    expect(s.phase).toBe('LIST_RESULT')
    s = cont(s)
    expect(s.phase).toBe('DONE')
    expect(s.phaseEndsAt).toBe(null)
  })
})

describe('the scoreboard between games', () => {
  const order = [1, 2, 3, 4, 5, 6, 7]
  // A calls B right every time (B's never true), B calls A wrong — so A takes the whole game.
  const playOutFinger = (state: SessionState) => {
    let s = state
    for (let i = 0; i < 20 && s.phase.startsWith('FINGER') && s.phase !== 'FINGER_RESULT'; i++) {
      if (s.phase === 'FINGER_ROUND') {
        s = reduce(s, { type: 'SUBMIT_CALLED', player: 'A', answer: true, predict: true }, 1000)
        s = reduce(s, { type: 'SUBMIT_CALLED', player: 'B', answer: false, predict: false }, 1000)
      } else {
        s = reduce(s, { type: 'TIMEOUT' }, 2000) // out of the reveal
      }
    }
    return s
  }
  const throughShortlist = () => {
    let s = tapThroughReveal(placeAll(atListPlace(), order, order))
    s = placeAll(pastIntro(s), order, order)
    return tapThroughReveal(s)
  }

  it('every game hands over to a scoreboard, and none of them carries a clock', () => {
    const s = throughShortlist()
    expect(s.phase).toBe('LIST_RESULT')
    expect(s.phaseEndsAt).toBe(null)
  })
  it('walks the full roster one tap at a time', () => {
    // A stocked session, so the roster actually has content to roll on into.
    let s = initialState(1, 'full', { themes: THEMES, fingerStatements: FINGER_POOL, spectrums: SPECTRUMS })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = tapThroughReveal(placeAll(pastIntro(s), order, order))
    s = tapThroughReveal(placeAll(pastIntro(s), order, order))
    expect(s.phase).toBe('LIST_RESULT')
    expect(cont(s).phase).toBe('FINGER_ROUND')
    s = playOutFinger(cont(s))
    expect(s.phase).toBe('FINGER_RESULT')
    expect(s.phaseEndsAt).toBe(null)
    expect(cont(s).phase).toBe('CIRCLE_DRAW') // the filler between Finger Down and Wavelength
  })
  it('ignores a tap from a phase that is not a scoreboard', () => {
    const s = atListPlace()
    expect(reduce(s, { type: 'CONTINUE', player: 'A' }, 2000)).toBe(s)
  })
  it('either player can move it on', () => {
    const s = throughShortlist()
    expect(reduce(s, { type: 'CONTINUE', player: 'A' }, 6000).phase).not.toBe('LIST_RESULT')
    expect(reduce(s, { type: 'CONTINUE', player: 'B' }, 6000).phase).not.toBe('LIST_RESULT')
  })
  it('ends a standalone game at its own scoreboard rather than rolling on', () => {
    let s = initialState(1, 'finger', { fingerStatements: FINGER_POOL })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = playOutFinger(s)
    expect(s.phase).toBe('FINGER_RESULT')
    expect(cont(s).phase).toBe('DONE') // not on into Wavelength
  })
})

describe('game selection', () => {
  it('list-only: both joining goes straight to Shortlist', () => {
    let s = initialState(1, 'list')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('LIST_INTRO')
    expect(reduce(s, { type: 'TIMEOUT' }, 2000).phase).toBe('LIST_PLACE')
  })
  it('list-only: the session ends after the second run instead of moving to Put a Finger Down', () => {
    let s = initialState(1, 'list')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = placeAll(s, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = tapThroughReveal(s) // run 2 begins
    s = placeAll(s, [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = cont(tapThroughReveal(s))
    expect(s.phase).toBe('DONE')
  })
  it('finger-only: both joining goes straight to FINGER_ROUND', () => {
    let s = initialState(1, 'finger', { fingerStatements: FINGER_POOL })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('FINGER_ROUND')
  })
  it('wave-only: both joining goes straight to WAVE_CLUE', () => {
    let s = initialState(1, 'wave', { spectrums: SPECTRUMS })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('WAVE_CLUE')
  })
  it('draw-only: both joining goes straight to DRAW_SKETCH', () => {
    let s = initialState(1, 'draw', { drawPrompts: DRAW_PROMPTS })
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('DRAW_SKETCH')
  })
})

// ---------------------------------------------------------------- Put a Finger Down

const FINGER_POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const atFingerRound = () => {
  let s = initialState(1, 'finger', { fingerStatements: FINGER_POOL })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('called it', () => {
  const send = (s: SessionState, p: 'A' | 'B', answer: boolean, predict: boolean, t = 2000) =>
    reduce(s, { type: 'SUBMIT_CALLED', player: p, answer, predict }, t)
  it('opens on the first statement with a 20s clock', () => {
    const s = atFingerRound()
    expect(s.phase).toBe('FINGER_ROUND')
    expect(s.phaseEndsAt).toBe(1000 + 20000)
    expect(s.finger?.rounds).toHaveLength(roundsFor({ game: 'finger' }, 'finger'))
  })
  it('waits for both, then reveals; sent is sent', () => {
    let s = send(atFingerRound(), 'A', true, false)
    expect(s.phase).toBe('FINGER_ROUND')
    expect(send(s, 'A', false, true)).toBe(s)
    s = send(s, 'B', false, true, 2500)
    expect(s.phase).toBe('FINGER_REVEAL')
    expect(s.finger?.rounds[0]).toMatchObject({ answer: { A: true, B: false }, predict: { A: false, B: true } })
  })
  it('scores a right call to whoever made it, and to the team', () => {
    let s = send(atFingerRound(), 'A', true, false) // A: true for me; B won't be
    s = send(s, 'B', false, false) // B: not me; A won't be — wrong
    const t = standing(s)
    expect(t.A).toBe(shown(s, 'finger', SCORING.calledRight))
    expect(t.B).toBe(0)
    expect(teamScore(s)).toBe(shown(s, 'finger', 1, 'us'))
  })
  it('plays every statement through to its scoreboard', () => {
    let s = atFingerRound()
    for (let i = 0; i < 40 && s.phase !== 'FINGER_RESULT'; i++) {
      if (s.phase === 'FINGER_ROUND') s = send(send(s, 'A', true, true, 1000), 'B', true, true, 1000)
      else s = reduce(s, { type: 'TIMEOUT' }, 1000 + i * 10000)
    }
    expect(s.phase).toBe('FINGER_RESULT')
    const each = roundsFor({ game: 'finger' }, 'finger') * shown(s, 'finger', SCORING.calledRight)
    expect(standing(s)).toEqual({ A: each, B: each })
  })
})

// ---------------------------------------------------------------- Wavelength

const SPECTRUMS = [
  { id: 'w01', low: 'Boring', high: 'Thrilling' },
  { id: 'w02', low: 'Cheap', high: 'Expensive' },
  { id: 'w03', low: 'Predictable', high: 'Shocking' },
]

const atWaveClue = () => {
  let s = initialState(1, 'wave', { spectrums: SPECTRUMS })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('wavelength', () => {
  // Both clues at once, then the pair is guessed one at a time.
  const clues = (s: SessionState, t = 2000) => {
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'A', text: 'ocean' }, t)
    return reduce(s, { type: 'SUBMIT_CLUE', player: 'B', text: 'desert' }, t)
  }
  it('opens on the first pair, both of you giving a clue, with a 25s clock', () => {
    const s = atWaveClue()
    expect(s.phase).toBe('WAVE_CLUE')
    expect(s.phaseEndsAt).toBe(1000 + 25000)
    expect(s.wave?.current).toBe(0)
    expect(s.wave?.rounds).toHaveLength(roundsFor({ game: 'wave' }, 'wave'))
    expect(s.wave?.rounds[0].target).toBeGreaterThanOrEqual(WAVE.targetMin)
    expect(s.wave?.rounds[0].target).toBeLessThanOrEqual(WAVE.targetMax)
  })
  it('gives you one clue each in every pair, swapping who goes first', () => {
    const s = atWaveClue()
    expect(s.wave!.rounds.map((r) => r.psychic)).toEqual(['A', 'B', 'B', 'A', 'A', 'B'])
  })
  it('waits for both clues before anyone guesses', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'B', text: 'desert' }, 2000)
    expect(s.phase).toBe('WAVE_CLUE')
    expect(s.wave?.rounds[1].clue).toBe('desert')
    expect(reduce(s, { type: 'SUBMIT_CLUE', player: 'B', text: 'again' }, 2000)).toBe(s) // one clue each
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'A', text: 'ocean' }, 3000)
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.phaseEndsAt).toBe(3000 + 20000)
    expect(s.wave?.current).toBe(0)
    expect(s.wave?.rounds[0].clue).toBe('ocean')
  })
  it('ignores a guess from the psychic', () => {
    let s = clues(atWaveClue())
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'A', value: 40 }, 2500)
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.wave?.rounds[0].guess).toBe(null)
  })
  it('a guess from the guesser reveals, with distance computed and the value clamped', () => {
    let s = clues(atWaveClue())
    const target = s.wave!.rounds[0].target
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'B', value: 150 }, 3000) // out of range
    expect(s.phase).toBe('WAVE_REVEAL')
    expect(s.phaseEndsAt).toBe(3000 + 5000)
    expect(s.wave?.rounds[0].guess).toBe(100) // clamped to the 0..100 scale
    expect(s.wave?.rounds[0].distance).toBe(Math.abs(target - 100))
  })
  it('goes straight to guessing the second clue of the pair, then on to the next pair', () => {
    let s = clues(atWaveClue())
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'B', value: 50 }, 3000)
    s = reduce(s, { type: 'TIMEOUT' }, 9000)
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.wave?.current).toBe(1)
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'A', value: 50 }, 10000)
    s = reduce(s, { type: 'TIMEOUT' }, 16000)
    expect(s.phase).toBe('WAVE_CLUE')
    expect(s.wave?.current).toBe(2)
  })
  it('a clue nobody gives still lets the round play out, on timeout', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'B', text: 'desert' }, 2000)
    s = reduce(s, { type: 'TIMEOUT' }, 5000) // clue -> guess, A gave no clue
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.wave?.rounds[0].clue).toBe('(no clue)')
    expect(s.wave?.rounds[1].clue).toBe('desert')
    s = reduce(s, { type: 'TIMEOUT' }, 6000) // guess -> reveal, defaults to dead centre
    expect(s.phase).toBe('WAVE_REVEAL')
    expect(s.wave?.rounds[0].guess).toBe(50)
  })
  it('advances through every round to WAVE_RESULT, then DONE (standalone)', () => {
    let s = atWaveClue()
    for (let r = 0; r < roundsFor({ game: 'wave' }, 'wave'); r++) {
      if (s.phase === 'WAVE_CLUE') s = clues(s, 1000)
      const round = s.wave!.rounds[s.wave!.current]
      const guesser = round.psychic === 'A' ? 'B' : 'A'
      s = reduce(s, { type: 'SUBMIT_GUESS', player: guesser, value: round.target }, 1000) // dead on
      expect(s.phase).toBe('WAVE_REVEAL')
      expect(s.wave!.rounds[s.wave!.current].distance).toBe(0)
      s = reduce(s, { type: 'TIMEOUT' }, 1000)
    }
    expect(s.phase).toBe('WAVE_RESULT')
    s = reduce(s, { type: 'TIMEOUT' }, 1000)
    expect(s.phase).toBe('DONE')
  })
})

// ---------------------------------------------------------------- Draw Your Love

const DRAW_PROMPTS = [
  { id: 'd01', text: 'a house' },
  { id: 'd02', text: 'a duck' },
  { id: 'd03', text: 'a sunset' },
]

const atDrawSketch = () => {
  let s = initialState(1, 'draw', { drawPrompts: DRAW_PROMPTS })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

const STROKE = [[0.1, 0.1], [0.9, 0.9]] as [number, number][]

describe('draw your answer', () => {
  // A draws first in the pair, B second; both at once.
  const drawBoth = (s: SessionState, a = 'a house', b = 'a boat', t = 2000) => {
    s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'A', answer: a, strokes: [STROKE] }, t)
    return reduce(s, { type: 'SUBMIT_DRAWING', player: 'B', answer: b, strokes: [STROKE, STROKE] }, t)
  }
  it('opens on the first pair, both of you drawing, with a 50s clock', () => {
    const s = atDrawSketch()
    expect(s.phase).toBe('DRAW_SKETCH')
    expect(s.phaseEndsAt).toBe(1000 + 50000)
    expect(s.draw?.current).toBe(0)
    expect(s.draw?.rounds).toHaveLength(roundsFor({ game: 'draw' }, 'draw'))
  })
  it('gives you one drawing each in every pair, swapping who goes first', () => {
    const s = atDrawSketch()
    expect(s.draw!.rounds.map((r) => r.drawer)).toEqual(['A', 'B', 'B', 'A', 'A', 'B'])
  })
  it('waits for both drawings, then opens the first guess with the strokes locked', () => {
    let s = atDrawSketch()
    s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'A', answer: 'a house', strokes: [STROKE] }, 2000)
    expect(s.phase).toBe('DRAW_SKETCH')
    expect(reduce(s, { type: 'SUBMIT_DRAWING', player: 'A', answer: 'again', strokes: [] }, 2000)).toBe(s)
    s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'B', answer: 'a boat', strokes: [STROKE, STROKE] }, 3000)
    expect(s.phase).toBe('DRAW_GUESS')
    expect(s.phaseEndsAt).toBe(3000 + 20000)
    expect(s.draw?.current).toBe(0)
    expect(s.draw?.rounds[0].strokes).toEqual([STROKE])
    expect(s.draw?.rounds[1].strokes).toEqual([STROKE, STROKE])
  })
  it('ignores a guess from the drawer', () => {
    let s = drawBoth(atDrawSketch())
    s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: 'A', text: 'a house' }, 2500)
    expect(s.phase).toBe('DRAW_GUESS')
    expect(s.draw?.rounds[0].guess).toBe(null)
  })
  it('a correct guess reveals with correct: true', () => {
    let s = drawBoth(atDrawSketch())
    s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: 'B', text: ' A House ' }, 3000)
    expect(s.phase).toBe('DRAW_REVEAL')
    expect(s.phaseEndsAt).toBe(3000 + 8000)
    expect(s.draw?.rounds[0].guess).toBe('A House')
    expect(s.draw?.rounds[0].correct).toBe(true)
  })
  it('a wrong guess reveals with correct: false', () => {
    let s = drawBoth(atDrawSketch())
    s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: 'B', text: 'a boat' }, 3000)
    expect(s.draw?.rounds[0].correct).toBe(false)
  })
  it("checks the guess against the drawer's own answer, not the question", () => {
    let s = drawBoth(atDrawSketch(), 'noodles')
    expect(s.draw?.rounds[0].answer).toBe('noodles')
    s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: 'B', text: 'Noodles' }, 3000)
    expect(s.draw?.rounds[0].correct).toBe(true)
  })
  it('refuses a drawing with no answer — it has to be OF something', () => {
    let s = atDrawSketch()
    s = reduce(s, { type: 'SUBMIT_DRAWING', player: 'A', answer: '   ', strokes: [STROKE] }, 2000)
    expect(s.draw?.rounds[0].answer).toBe(null)
  })
  it('lets the drawer count a near miss, and only the drawer', () => {
    let s = drawBoth(atDrawSketch(), 'noodles')
    s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: 'B', text: 'ramen' }, 3000)
    expect(s.draw?.rounds[0].correct).toBe(false)
    expect(reduce(s, { type: 'COUNT_IT', player: 'B' }, 3500)).toBe(s) // the guesser can't
    s = reduce(s, { type: 'COUNT_IT', player: 'A' }, 3500)
    expect(s.draw?.rounds[0].correct).toBe(true)
  })
  it('will not count a guess nobody made', () => {
    let s = drawBoth(atDrawSketch(), 'noodles')
    s = reduce(s, { type: 'TIMEOUT' }, 3000) // no guess
    expect(reduce(s, { type: 'COUNT_IT', player: 'A' }, 3500)).toBe(s)
  })
  it('a drawing nobody finishes still lets the round play out, on timeout', () => {
    let s = atDrawSketch()
    s = reduce(s, { type: 'TIMEOUT' }, 5000) // sketch -> guess, nothing drawn
    expect(s.phase).toBe('DRAW_GUESS')
    expect(s.draw?.rounds[0].strokes).toEqual([])
    s = reduce(s, { type: 'TIMEOUT' }, 6000) // guess -> reveal, no guess never matches
    expect(s.phase).toBe('DRAW_REVEAL')
    expect(s.draw?.rounds[0].correct).toBe(false)
    s = reduce(s, { type: 'TIMEOUT' }, 7000) // the second drawing of the pair is guessed next
    expect(s.phase).toBe('DRAW_GUESS')
    expect(s.draw?.current).toBe(1)
  })
  it('advances through every round to DRAW_RESULT, then DONE (standalone)', () => {
    let s = atDrawSketch()
    for (let r = 0; r < roundsFor({ game: 'draw' }, 'draw'); r++) {
      if (s.phase === 'DRAW_SKETCH') s = drawBoth(s, 'a house', 'a boat', 1000)
      const round = s.draw!.rounds[s.draw!.current]
      const guesser = round.drawer === 'A' ? 'B' : 'A'
      s = reduce(s, { type: 'SUBMIT_DRAW_GUESS', player: guesser, text: 'whatever' }, 1000)
      expect(s.phase).toBe('DRAW_REVEAL')
      s = reduce(s, { type: 'TIMEOUT' }, 1000)
    }
    expect(s.phase).toBe('DRAW_RESULT')
    s = reduce(s, { type: 'TIMEOUT' }, 1000)
    expect(s.phase).toBe('DONE')
  })
})
