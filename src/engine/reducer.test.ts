import { describe, it, expect } from 'vitest'
import { initialState } from './state'
import { reduce } from './reducer'
import { DEFAULT_SEEDS } from './state'

const bothJoined = () => {
  let s = initialState(1)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  // M2: JOIN now begins the pot (FORFEIT_WRITE -> POT_SHUFFLE) before Act I.
  // Fast-forward through it with no forfeits submitted so these M1-era tests
  // still exercise Act I mind-meld mechanics starting from MELD_TYPE.
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // FORFEIT_WRITE -> extend (under minEach)
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // extended -> POT_SHUFFLE
  s = reduce(s, { type: 'TIMEOUT' }, 1000) // POT_SHUFFLE -> MELD_TYPE
  return s
}

describe('join → act I start', () => {
  it('stays in JOIN until both connected', () => {
    let s = initialState(1)
    s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
    expect(s.phase).toBe('JOIN')
    expect(s.players.A.connected).toBe(true)
  })
  it('begins MELD_TYPE round 1 when both join, with a seed pair', () => {
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
  it('MELD_RESULT timeout goes to DONE', () => {
    let s = bothJoined()
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'x' }, 1)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'x' }, 1)
    s = reduce(s, { type: 'TIMEOUT' }, 1) // reveal -> result
    s = reduce(s, { type: 'TIMEOUT' }, 1) // result -> done
    expect(s.phase).toBe('DONE')
  })
})

const HOUSE = ['makes the tea', 'picks the takeaway', 'loses aux', 'walks the dog']
const startForfeit = () => {
  let s = initialState(1, DEFAULT_SEEDS, HOUSE)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
  return s
}

describe('the pot — forfeit write', () => {
  it('both joined begins FORFEIT_WRITE, not meld', () => {
    const s = startForfeit()
    expect(s.phase).toBe('FORFEIT_WRITE')
    expect(s.phaseEndsAt).toBe(1000 + 45000)
    expect(s.forfeitWriteExtended).toBe(false)
    expect(s.meld).toBe(null)
  })
  it('SUBMIT_FORFEITS appends a pot forfeit authored by the player', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'sings in the shower' }, 2000)
    expect(s.forfeits).toHaveLength(1)
    expect(s.forfeits[0]).toMatchObject({ text: 'sings in the shower', authoredBy: 'A', state: 'pot' })
  })
  it('ignores a 6th forfeit from the same player', () => {
    let s = startForfeit()
    for (let i = 0; i < 7; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: `f${i}` }, 2000)
    expect(s.forfeits.filter((f) => f.authoredBy === 'A')).toHaveLength(5)
  })
  it('both reaching 5 advances to POT_SHUFFLE immediately', () => {
    let s = startForfeit()
    for (const p of ['A', 'B'] as const)
      for (let i = 0; i < 5; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: p, text: `${p}${i}` }, 2000)
    expect(s.phase).toBe('POT_SHUFFLE')
  })
})

describe('the pot — timeout, extension, top-up', () => {
  it('extends once by 20s when under the minimum', () => {
    let s = startForfeit() // nobody submitted
    s = reduce(s, { type: 'TIMEOUT' }, 46000)
    expect(s.phase).toBe('FORFEIT_WRITE')
    expect(s.forfeitWriteExtended).toBe(true)
    expect(s.phaseEndsAt).toBe(46000 + 20000)
  })
  it('after the extension, proceeds and tops up the pot to the floor', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'TIMEOUT' }, 46000) // extend
    s = reduce(s, { type: 'TIMEOUT' }, 67000) // proceed
    expect(s.phase).toBe('POT_SHUFFLE')
    expect(s.forfeits.length).toBeGreaterThanOrEqual(6)
    expect(s.forfeits.some((f) => f.authoredBy === null)).toBe(true) // house forfeits added
  })
  it('does not extend a second time', () => {
    let s = startForfeit()
    s = reduce(s, { type: 'TIMEOUT' }, 46000) // extend
    // one player now meets the min, the other does not — still must not extend again
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'x' }, 50000)
    s = reduce(s, { type: 'SUBMIT_FORFEITS', player: 'A', text: 'y' }, 50000)
    s = reduce(s, { type: 'TIMEOUT' }, 67000)
    expect(s.phase).toBe('POT_SHUFFLE')
  })
})

describe('the pot — POT_SHUFFLE and burn', () => {
  const toMeld = () => {
    let s = startForfeit()
    for (const p of ['A', 'B'] as const)
      for (let i = 0; i < 5; i++) s = reduce(s, { type: 'SUBMIT_FORFEITS', player: p, text: `${p}${i}` }, 2000)
    // now POT_SHUFFLE
    return reduce(s, { type: 'TIMEOUT' }, 3000) // POT_SHUFFLE -> MELD_TYPE
  }
  it('POT_SHUFFLE advances into Act I mind meld', () => {
    const s = toMeld()
    expect(s.phase).toBe('MELD_TYPE')
    expect(s.meld?.rounds).toHaveLength(1)
  })
  it('converging in <=3 rounds burns exactly one pot forfeit', () => {
    let s = toMeld()
    const potBefore = s.forfeits.filter((f) => f.state === 'pot').length
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'same' }, 4000)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'same' }, 4000)
    s = reduce(s, { type: 'TIMEOUT' }, 8000) // reveal -> result (converged round 1)
    expect(s.phase).toBe('MELD_RESULT')
    expect(s.forfeits.filter((f) => f.state === 'burned')).toHaveLength(1)
    expect(s.forfeits.filter((f) => f.state === 'pot')).toHaveLength(potBefore - 1)
  })
  it('no burn when convergence takes more than 3 rounds', () => {
    let s = toMeld()
    for (let r = 0; r < 3; r++) {
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: `a${r}` }, 100)
      s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: `b${r}` }, 100)
      s = reduce(s, { type: 'TIMEOUT' }, 100)
    }
    // round 4 converge
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'A', word: 'zz' }, 100)
    s = reduce(s, { type: 'SUBMIT_WORD', player: 'B', word: 'zz' }, 100)
    s = reduce(s, { type: 'TIMEOUT' }, 100)
    expect(s.meld?.converged).toBe(true)
    expect(s.meld?.roundsTaken).toBe(4)
    expect(s.forfeits.filter((f) => f.state === 'burned')).toHaveLength(0)
  })
})
