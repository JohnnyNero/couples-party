import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { reduce } from './reducer'
import { FINGER, WAVE } from './phases'

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
    expect(s.phase).toBe('LIST_PLACE')
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
const atListPlace = () => {
  let s = initialState(1, undefined, THEMES)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 1000)
  s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 1000)
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // meld reveal -> result
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // meld result -> LIST_PLACE
  return s
}

// Places every remaining item, both sides, at the given slots (1..7, in item order).
// `actual` is the ranker's slots, `predicted` the author's guesses.
const placeAll = (s: SessionState, actual: number[], predicted: number[]) => {
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

describe('act III · reveal and alternation', () => {
  it('sums displacement across the seven items', () => {
    const s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [2, 1, 3, 4, 5, 7, 6])
    expect(s.listActs[0].displacement).toBe(4)
  })
  it('runs the act again with the roles swapped, on a different theme', () => {
    let s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = reduce(s, { type: 'TIMEOUT' }, 4000) // reveal -> run 2
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.listActs).toHaveLength(2)
    expect(s.listActs[1].author).toBe('B')
    expect(s.listActs[1].themeId).not.toBe(s.listActs[0].themeId)
    expect(s.listActs[0].displacement).toBe(0) // run 1's record is untouched
  })
  it('ends the act after the second run', () => {
    let s = placeAll(atListPlace(), [1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7])
    s = reduce(s, { type: 'TIMEOUT' }, 4000) // run 2 begins
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
    expect(s.phase).toBe('LIST_PLACE')
    expect(s.meld).toBe(null)
  })
  it('finger-only: both joining goes straight to FINGER_ROUND', () => {
    let s = initialState(1, undefined, [], 'finger', FINGER_POOL)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('FINGER_ROUND')
    expect(s.meld).toBe(null)
  })
  it('wave-only: both joining goes straight to WAVE_CLUE', () => {
    let s = initialState(1, undefined, [], 'wave', [], SPECTRUMS)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
    expect(s.phase).toBe('WAVE_CLUE')
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

// ---------------------------------------------------------------- Wavelength

const SPECTRUMS = [
  { id: 'w01', low: 'Boring', high: 'Thrilling' },
  { id: 'w02', low: 'Cheap', high: 'Expensive' },
  { id: 'w03', low: 'Predictable', high: 'Shocking' },
]

const atWaveClue = () => {
  let s = initialState(1, undefined, [], 'wave', [], SPECTRUMS)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}

describe('wavelength', () => {
  it('opens on round 1 of 7, A as psychic, and a 25s clock', () => {
    const s = atWaveClue()
    expect(s.phase).toBe('WAVE_CLUE')
    expect(s.phaseEndsAt).toBe(1000 + 25000)
    expect(s.wave?.current).toBe(0)
    expect(s.wave?.rounds).toHaveLength(WAVE.rounds)
    expect(s.wave?.rounds[0].psychic).toBe('A')
    expect(s.wave?.rounds[0].target).toBeGreaterThanOrEqual(WAVE.targetMin)
    expect(s.wave?.rounds[0].target).toBeLessThanOrEqual(WAVE.targetMax)
  })
  it('alternates psychic every round', () => {
    const s = atWaveClue()
    expect(s.wave!.rounds.map((r) => r.psychic)).toEqual(['A', 'B', 'A', 'B', 'A', 'B', 'A'])
  })
  it('ignores a clue from the guesser', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'B', text: 'nope' }, 2000)
    expect(s.phase).toBe('WAVE_CLUE')
    expect(s.wave?.rounds[0].clue).toBe(null)
  })
  it('a clue from the psychic opens the guess, and locks the clue', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'A', text: 'ocean' }, 2000)
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.phaseEndsAt).toBe(2000 + 20000)
    expect(s.wave?.rounds[0].clue).toBe('ocean')
  })
  it('ignores a guess from the psychic', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'A', text: 'ocean' }, 2000)
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'A', value: 40 }, 2500)
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.wave?.rounds[0].guess).toBe(null)
  })
  it('a guess from the guesser reveals, with distance computed and the value clamped', () => {
    let s = atWaveClue()
    const target = s.wave!.rounds[0].target
    s = reduce(s, { type: 'SUBMIT_CLUE', player: 'A', text: 'ocean' }, 2000)
    s = reduce(s, { type: 'SUBMIT_GUESS', player: 'B', value: 150 }, 3000) // out of range
    expect(s.phase).toBe('WAVE_REVEAL')
    expect(s.phaseEndsAt).toBe(3000 + 5000)
    expect(s.wave?.rounds[0].guess).toBe(100) // clamped to the 0..100 scale
    expect(s.wave?.rounds[0].distance).toBe(Math.abs(target - 100))
  })
  it('a clue nobody gives still lets the round play out, on timeout', () => {
    let s = atWaveClue()
    s = reduce(s, { type: 'TIMEOUT' }, 5000) // clue -> guess, no clue given
    expect(s.phase).toBe('WAVE_GUESS')
    expect(s.wave?.rounds[0].clue).toBe('(no clue)')
    s = reduce(s, { type: 'TIMEOUT' }, 6000) // guess -> reveal, defaults to dead centre
    expect(s.phase).toBe('WAVE_REVEAL')
    expect(s.wave?.rounds[0].guess).toBe(50)
  })
  it('advances through all seven rounds to WAVE_RESULT, then DONE', () => {
    let s = atWaveClue()
    for (let r = 0; r < WAVE.rounds; r++) {
      const round = s.wave!.rounds[s.wave!.current]
      s = reduce(s, { type: 'SUBMIT_CLUE', player: round.psychic, text: 'clue' }, 1000)
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
