import { describe, it, expect } from 'vitest'
import { initialState, type SessionState } from './state'
import { describeWord, reduce } from './reducer'
import { roundsFor } from './roster'
import { shown, standing, teamScore } from './standing'

const WORDS = Array.from({ length: 30 }, (_, i) => `word ${i}`)
const start = () => {
  let s = initialState(2, 'describe', { describeWords: WORDS })
  s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 1000)
  return reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 1000)
}
const turn = (s: SessionState) => s.describe!.turns[s.describe!.current]

describe('describe it', () => {
  it('opens on a get-ready, then the clock runs; only the describer can tap', () => {
    let s = start()
    expect(s.phase).toBe('DESCRIBE_READY')
    s = reduce(s, { type: 'TIMEOUT' }, 7000)
    expect(s.phase).toBe('DESCRIBE_RUN')
    const d = turn(s).describer
    const guesser = d === 'A' ? 'B' : 'A'
    expect(reduce(s, { type: 'DESCRIBE_GOT', player: guesser }, 8000)).toBe(s)
    const first = describeWord(s.describe!)
    s = reduce(s, { type: 'DESCRIBE_GOT', player: d }, 8000)
    s = reduce(s, { type: 'DESCRIBE_SKIP', player: d }, 9000)
    s = reduce(s, { type: 'DESCRIBE_GOT', player: d }, 10000)
    expect(turn(s).got).toHaveLength(2)
    expect(turn(s).got[0]).toBe(first)
    expect(turn(s).skipped).toHaveLength(1)
    // Every word got: the describer's, and the team's.
    expect(standing(s)[d]).toBe(shown(s, 'describe', 2))
    expect(standing(s)[guesser]).toBe(0)
    expect(teamScore(s)).toBe(shown(s, 'describe', 2, 'us'))
  })
  it('swaps describer each turn, never repeats a word, and ends on the scoreboard', () => {
    let s = start()
    const seen = new Set<string>()
    const describers: string[] = []
    for (let i = 0; i < 50 && s.phase !== 'DESCRIBE_RESULT'; i++) {
      if (s.phase === 'DESCRIBE_RUN') {
        describers.push(turn(s).describer)
        for (let w = 0; w < 5; w++) {
          seen.add(describeWord(s.describe!))
          s = reduce(s, { type: 'DESCRIBE_GOT', player: turn(s).describer }, i)
        }
      }
      s = reduce(s, { type: 'TIMEOUT' }, 1000 + i * 100000)
    }
    expect(s.phase).toBe('DESCRIBE_RESULT')
    expect(describers).toHaveLength(roundsFor({ game: 'describe' }, 'describe'))
    expect(describers[0]).not.toBe(describers[1])
    expect(seen.size).toBe(describers.length * 5)
  })
})
