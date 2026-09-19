import { describe, it, expect } from 'vitest'
import { initialState } from './state'
import { reduce } from './reducer'

const bothJoined = () => {
  let s = initialState(1)
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
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
