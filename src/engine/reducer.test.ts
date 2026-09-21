import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { FINGER } from './phases'

const bothConnected = () => {
  let s = initialState(1)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  return s
}

const bothJoined = () => bothConnected() // both joining starts Act I directly now

describe('joining', () => {
  it('stays in JOIN until both connected', () => {
    let s = initialState(1)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    expect(s.phase).toBe('JOIN')
    expect(s.players.A.connected).toBe(true)
  })
})

describe('join → act I start', () => {
  it('begins MELD_TYPE round 1 once both are connected, with a seed pair', () => {
    const s = bothJoined()
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.phaseEndsAt).toBe(1000 + 20000)
    expect(s.meld?.rounds.length).toBe(1)
    expect(s.meld?.seedPair[0]).not.toBe(s.meld?.seedPair[1])
  })
})

describe('submitting words', () => {
  it('records a word and accumulates meldWords, staying in MELD_TYPE until both', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'moon' }, 2000)
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds[0].words.A).toBe('moon')
    expect(s.meldWords).toContain('moon')
  })
  it('non-matching pair → MELD_REVEAL, not converged, then next round', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'moon' }, 2000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'fork' }, 2500)
    expect(s.phase).toBe('MELD_REVEAL')
    expect(s.meld?.rounds[0].converged).toBe(false)
    s = reduce(s, { type: 'TIMEOUT' }, 6500)
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds.length).toBe(2)
    expect(s.phaseEndsAt).toBe(6500 + 20000)
  })
  it('matching pair → converged reveal → MELD_RESULT with finalWord', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'Cats' }, 2000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'cat' }, 2100)
    expect(s.meld?.rounds[0].converged).toBe(true)
    s = reduce(s, { type: 'TIMEOUT' }, 6100)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(true)
    expect(s.meld?.roundsTaken).toBe(1)
    expect(s.meld?.finalWord).toBe('Cats')
  })
})

describe('timeouts and caps', () => {
  it('round cap of 7 ends the act unconverged', () => {
    let s = bothJoined()
    for (let r = 0; r < 7; r++) {
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: `a${r}` }, 100)
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: `b${r}` }, 100)
      s = reduce(s, { type: 'TIMEOUT' }, 100) // leave reveal
    }
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(false)
    expect(s.meld?.roundsTaken).toBe(7)
  })
  it('two consecutive double-timeouts end the act early', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'TIMEOUT' }, 100) // round 1 type -> reveal (both null)
    s = reduce(s, { type: 'TIMEOUT' }, 200) // reveal -> round 2 type
    s = reduce(s, { type: 'TIMEOUT' }, 300) // round 2 type -> reveal (both null)
    s = reduce(s, { type: 'TIMEOUT' }, 400) // reveal -> should finalize (2 double-timeouts)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(false)
  })
  it('MELD_RESULT timeout opens Act III', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'x' }, 1)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'x' }, 1)
    s = reduce(s, { type: 'TIMEOUT' }, 1) // reveal -> result
    s = reduce(s, { type: 'TIMEOUT' }, 1) // result -> Act III, author A
    expect(s.phase).toBe('LIST_WRITE')
  })
})

describe('mind meld does not touch the leaderboard (co-op)', () => {
  it('converging fast has no effect on standing', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 100)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 100)
    s = reduce(s, { type: 'TIMEOUT' }, 100) // reveal -> result (converged round 1)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.meld?.converged).toBe(true)
    expect(s.listActs).toHaveLength(0)
  })
})

// ---------------------------------------------------------------- Act III · Shortlist

const POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
const THEMES = [
  { id: 't001', text: 'seven things {name} would struggle to give up', pool: POOL },
  { id: 't002', text: "seven of {name}'s strongest opinions", pool: POOL },
]

// Straight to the top of Act III: both joined, Act I converged and timed out.
const atListWrite = () => {
  let s = initialState(1, undefined, THEMES)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 1000)
  s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 1000)
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // meld reveal -> result
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // meld result -> LIST_WRITE
  return s
}

// Picks n pool entries (indices `from`..`from+n-1`) for the current author, one at a time.
const write = (s: SessionState, n: number, from = 0) => {
  const author = s.listActs[s.listActs.length - 1].author
  for (let i = from; i < from + n; i++) {
    s = reduce(s, { type: 'SUBMIT_ITEMS', player: author, poolIndex: i }, 1000)
  }
  return s
}

// Seven picked items -> swap declined -> sitting at the start of placement.
const atListPlace = () => {
  let s = write(atListWrite(), 7)
  const ranker = s.listActs[0].author === 'A' ? 'B' : 'A'
  s = reduce(s, { type: 'SWAP_ITEM', player: ranker, index: null, text: '' }, 1000)
  return s
}

// Each side submits its whole order in one shot. `actual`/`predicted` give the desired
// slot (1..7) for each item in `act.items` order — translated here into the id order
// SUBMIT_ORDER actually takes, so callers can still talk in slots.
const placeAll = (s: SessionState, actual: number[], predicted: number[]) => {
  const act = s.listActs[s.listActs.length - 1]
  const ranker = act.author === 'A' ? 'B' : 'A'
  const orderFor = (slots: number[]) =>
    act.items
      .map((item, i) => ({ id: item.id, slot: slots[i] }))
      .sort((x, y) => x.slot - y.slot)
      .map((x) => x.id)
  s = reduce(s, { type: 'SUBMIT_ORDER', player: ranker, order: orderFor(actual) }, 1000)
  s = reduce(s, { type: 'SUBMIT_ORDER', player: act.author, order: orderFor(predicted) }, 1000)
  return s
}

describe('act III · write', () => {
  it('opens on author A with a theme, a shuffled pool, and a 30s clock', () => {
    const s = atListWrite()
    expect(s.phase).toBe('LIST_WRITE')
    expect(s.phaseEndsAt).toBe(1000 + 30000)
    expect(s.listActs).toHaveLength(1)
    expect(s.listActs[0].author).toBe('A')
    expect(THEMES.map((t) => t.id)).toContain(s.listActs[0].themeId)
    expect([...s.listActs[0].pool].sort()).toEqual([...POOL].sort())
    expect(s.listActs[0].items).toEqual([])
  })
  it('locks one pick at a time and ignores the ranker', () => {
    let s = write(atListWrite(), 2)
    const pool = s.listActs[0].pool
    s = reduce(s, { type: 'SUBMIT_ITEMS', player: 'B', poolIndex: 5 }, 1000) // not the ranker's turn
    expect(s.listActs[0].items).toHaveLength(2)
    expect(s.listActs[0].items.map((i) => i.text)).toEqual([pool[0], pool[1]])
  })
  it('ignores a pool index already picked, or out of range', () => {
    let s = write(atListWrite(), 1)
    s = reduce(s, { type: 'SUBMIT_ITEMS', player: 'A', poolIndex: 0 }, 1000) // already picked
    s = reduce(s, { type: 'SUBMIT_ITEMS', player: 'A', poolIndex: 99 }, 1000) // out of range
    expect(s.listActs[0].items).toHaveLength(1)
  })
  it('the seventh pick ends the phase early — nobody presses next', () => {
    const s = write(atListWrite(), 7)
    expect(s.phase).toBe('LIST_SWAP')
    expect(s.phaseEndsAt).toBe(1000 + 20000)
    expect(s.listActs[0].items).toHaveLength(7)
  })
  it('ignores an eighth pick', () => {
    const s = write(atListWrite(), 8)
    expect(s.listActs[0].items).toHaveLength(7)
  })
  it('pads a short list on timeout — seven slots need seven items', () => {
    let s = write(atListWrite(), 3)
    s = reduce(s, { type: 'TIMEOUT' }, 2000)
    expect(s.phase).toBe('LIST_SWAP')
    expect(s.listActs[0].items).toHaveLength(7)
    expect(s.listActs[0].items.slice(3).every((i) => i.text === '(blank)')).toBe(true)
    expect(s.listActs[0].items.slice(3).every((i) => i.poolIndex === null)).toBe(true)
  })
})

describe('act III · swap', () => {
  it('lets the ranker replace one item and closes the phase', () => {
    let s = write(atListWrite(), 7)
    const before = s.listActs[0].items[2].text
    s = reduce(s, { type: 'SWAP_ITEM', player: 'B', index: 2, text: 'the bins' }, 3000)
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.phaseEndsAt).toBe(3000 + 45000)
    const swapped = s.listActs[0].items.filter((i) => i.swapped)
    expect(swapped).toHaveLength(1)
    expect(swapped[0].text).toBe('the bins')
    expect(swapped[0].poolIndex).toBe(null) // no longer a pool-original pick
    expect(s.listActs[0].items.map((i) => i.text)).not.toContain(before)
  })
  it('ignores the author — the veto is the ranker\'s', () => {
    let s = write(atListWrite(), 7)
    s = reduce(s, { type: 'SWAP_ITEM', player: 'A', index: 0, text: 'nope' }, 3000)
    expect(s.phase).toBe('LIST_SWAP')
    expect(s.listActs[0].items.some((i) => i.swapped)).toBe(false)
  })
  it('a declined veto still closes the phase, changing nothing', () => {
    let s = write(atListWrite(), 7)
    s = reduce(s, { type: 'SWAP_ITEM', player: 'B', index: null, text: '' }, 3000)
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.listActs[0].items.some((i) => i.swapped)).toBe(false)
  })
  it('timing out closes it too, and shuffles into a reveal order neither player set', () => {
    let s = write(atListWrite(), 7)
    const authored = s.listActs[0].items.map((i) => i.text)
    s = reduce(s, { type: 'TIMEOUT' }, 3000)
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.listActs[0].swapDone).toBe(true)
    expect([...s.listActs[0].items.map((i) => i.text)].sort()).toEqual([...authored].sort())
  })
})

describe('act III · placement', () => {
  it('holds the phase until both sides have submitted their whole order', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const ranker = act.author === 'A' ? 'B' : 'A'
    const order = act.items.map((i) => i.id)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: ranker, order }, 1000)
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.listActs[0].items.every((i) => i.actualSlot !== null)).toBe(true)
    expect(s.listActs[0].items.every((i) => i.predictedSlot === null)).toBe(true)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: act.author, order: [...order].reverse() }, 2000)
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[0].items[0].predictedSlot).toBe(7) // first item, last in the reversed order
  })
  it('rejects a second submission, an incomplete order, and a duplicate id', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const ranker = act.author === 'A' ? 'B' : 'A'
    const order = act.items.map((i) => i.id)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: ranker, order }, 1000)
    const firstPass = s.listActs[0].items.map((i) => i.actualSlot)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: ranker, order: [...order].reverse() }, 1000) // no changing your mind
    expect(s.listActs[0].items.map((i) => i.actualSlot)).toEqual(firstPass)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: act.author, order: order.slice(0, 6) }, 1000) // too short
    expect(s.listActs[0].items.every((i) => i.predictedSlot === null)).toBe(true)
    s = reduce(s, { type: 'SUBMIT_ORDER', player: act.author, order: [order[0], ...order] }, 1000) // duplicate id
    expect(s.listActs[0].items.every((i) => i.predictedSlot === null)).toBe(true)
  })
  it('a side that never drags gets the order it was shown, on timeout', () => {
    let s = atListPlace()
    const act = s.listActs[0]
    const shown = act.items.map((i) => i.id)
    const ranker = act.author === 'A' ? 'B' : 'A'
    s = reduce(s, { type: 'SUBMIT_ORDER', player: ranker, order: [...shown].reverse() }, 1000)
    s = reduce(s, { type: 'TIMEOUT' }, 2000) // the author never dragged
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[0].items.map((i) => i.predictedSlot)).toEqual(shown.map((_, i) => i + 1))
  })
  it('a full, matching order on both sides opens the reveal with zero displacement', () => {
    const order = [1, 2, 3, 4, 5, 6, 7]
    const s = placeAll(atListPlace(), order, order)
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[0].displacement).toBe(0)
  })
})

describe('act III · reveal and alternation', () => {
  it('sums displacement across the seven items', () => {
    const s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [2, 1, 3, 4, 5, 7, 6])
    expect(s.listActs[0].displacement).toBe(4)
  })
  it('runs the act again with the roles swapped, on a different theme', () => {
    let s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = reduce(s, { type: 'TIMEOUT' }, 4000) // reveal -> run 2
    expect(s.phase).toBe('LIST_WRITE')
    expect(s.listActs).toHaveLength(2)
    expect(s.listActs[1].author).toBe('B')
    expect(s.listActs[1].themeId).not.toBe(s.listActs[0].themeId)
    expect(s.listActs[0].displacement).toBe(0) // run 1's record is untouched
  })
  it('ends the act after the second run', () => {
    let s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = reduce(s, { type: 'TIMEOUT' }, 4000) // run 2 write
    s = write(s, 7)
    s = reduce(s, { type: 'SWAP_ITEM', player: 'A', index: null, text: '' }, 4000)
    s = placeAll(s, [7, 6, 5, 4, 3, 2, 1], [1, 2, 3, 4, 5, 6, 7])
    expect(s.phase).toBe('LIST_REVEAL')
    expect(s.listActs[1].displacement).toBe(24) // the worst read available
    s = reduce(s, { type: 'TIMEOUT' }, 5000)
    expect(s.phase).toBe('DONE')
    expect(s.phaseEndsAt).toBe(null)
  })
})

describe('game selection', () => {
  it('meld-only: both joining goes straight to MELD_TYPE', () => {
    let s = initialState(1, undefined, [], 'meld')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('MELD_TYPE')
  })
  it('meld-only: the session ends after MELD_RESULT instead of moving to Shortlist', () => {
    let s = initialState(1, undefined, [], 'meld')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 1000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 1000) // converges
    s = reduce(s, { type: 'TIMEOUT' }, 2000) // MELD_REVEAL -> MELD_RESULT
    expect(s.phase).toBe('MELD_RESULT')
    s = reduce(s, { type: 'TIMEOUT' }, 3000) // MELD_RESULT -> DONE, not LIST_WRITE
    expect(s.phase).toBe('DONE')
    expect(s.listActs).toHaveLength(0)
  })
  it('list-only: both joining goes straight to Shortlist, skipping Mind Meld', () => {
    let s = initialState(1, undefined, [], 'list')
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('LIST_WRITE')
    expect(s.meld).toBe(null)
  })
  it('finger-only: both joining goes straight to FINGER_ROUND', () => {
    let s = initialState(1, undefined, [], 'finger', FINGER_POOL)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('FINGER_ROUND')
    expect(s.meld).toBe(null)
  })
})

// ---------------------------------------------------------------- Put a Finger Down

const FINGER_POOL = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

const atFingerRound = () => {
  let s = initialState(1, undefined, [], 'finger', FINGER_POOL)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('put a finger down', () => {
  it('opens on round 1 of 5, a full hand each, and a 15s clock', () => {
    const s = atFingerRound()
    expect(s.phase).toBe('FINGER_ROUND')
    expect(s.phaseEndsAt).toBe(1000 + 15000)
    expect(s.finger?.current).toBe(0)
    expect(s.finger?.rounds).toHaveLength(FINGER.rounds)
    expect(s.finger?.fingersLeft).toEqual({ A: FINGER.startFingers, B: FINGER.startFingers })
  })
  it('holds the round until both answer, then reveals', () => {
    let s = atFingerRound()
    s = reduce(s, { type: 'SUBMIT_FINGER', player: 'A', applies: true }, 2000)
    expect(s.phase).toBe('FINGER_ROUND')
    expect(s.finger?.rounds[0].applies.A).toBe(true)
    s = reduce(s, { type: 'SUBMIT_FINGER', player: 'B', applies: false }, 2500)
    expect(s.phase).toBe('FINGER_REVEAL')
    expect(s.phaseEndsAt).toBe(2500 + 4000)
    // A's finger went down, B's stayed up.
    expect(s.finger?.fingersLeft).toEqual({ A: FINGER.startFingers - 1, B: FINGER.startFingers })
  })
  it('ignores a second answer from the same player', () => {
    let s = atFingerRound()
    s = reduce(s, { type: 'SUBMIT_FINGER', player: 'A', applies: true }, 2000)
    s = reduce(s, { type: 'SUBMIT_FINGER', player: 'A', applies: false }, 2000)
    expect(s.finger?.rounds[0].applies.A).toBe(true)
  })
  it('a statement neither answers counts as "stays up" for both, on timeout', () => {
    let s = atFingerRound()
    s = reduce(s, { type: 'TIMEOUT' }, 5000) // round -> reveal, nobody answered
    expect(s.phase).toBe('FINGER_REVEAL')
    expect(s.finger?.fingersLeft).toEqual({ A: FINGER.startFingers, B: FINGER.startFingers })
  })
  it('advances through all five rounds to FINGER_RESULT, then DONE', () => {
    let s = atFingerRound()
    for (let r = 0; r < FINGER.rounds; r++) {
      s = reduce(s, { type: 'SUBMIT_FINGER', player: 'A', applies: true }, 1000) // A always confesses
      s = reduce(s, { type: 'SUBMIT_FINGER', player: 'B', applies: false }, 1000)
      expect(s.phase).toBe('FINGER_REVEAL')
      s = reduce(s, { type: 'TIMEOUT' }, 1000) // reveal -> next round, or result on the last
    }
    expect(s.phase).toBe('FINGER_RESULT')
    expect(s.finger?.fingersLeft).toEqual({ A: 0, B: FINGER.startFingers })
    s = reduce(s, { type: 'TIMEOUT' }, 1000)
    expect(s.phase).toBe('DONE')
  })
  it('feeds the leaderboard: fewer fingers down wins, not first to zero', () => {
    let s = atFingerRound()
    // A confesses to none, B confesses to two — B ends with fewer fingers but the game
    // still runs all five rounds rather than stopping early.
    for (let r = 0; r < FINGER.rounds; r++) {
      s = reduce(s, { type: 'SUBMIT_FINGER', player: 'A', applies: false }, 1000)
      s = reduce(s, { type: 'SUBMIT_FINGER', player: 'B', applies: r < 2 }, 1000)
      s = reduce(s, { type: 'TIMEOUT' }, 1000)
    }
    expect(s.phase).toBe('FINGER_RESULT')
    expect(s.finger?.fingersLeft).toEqual({ A: FINGER.startFingers, B: FINGER.startFingers - 2 })
  })
})
