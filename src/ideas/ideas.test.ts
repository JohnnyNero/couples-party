import { describe, it, expect } from 'vitest'
import { withIdeas } from './store'
import { EMPTY_CONTENT, initialState } from '../engine/state'
import { reduce } from '../engine/reducer'
import type { Idea } from '../daily/api'
import { questionOfTheDay } from '../daily/question'

const idea = (kind: Idea['kind'], text: string, id = text): Idea => ({ id, kind, text, mine: true, createdAt: '' })

describe('our questions in the games', () => {
  const base = {
    ...EMPTY_CONTENT,
    mrmrsQuestions: Array.from({ length: 30 }, (_, i) => `Built-in ${i}?`),
    spectrums: [{ id: 'w1', low: 'Cold', high: 'Hot' }, { id: 'w2', low: 'Quiet', high: 'Loud' }],
  }
  const content = withIdeas(base, [
    idea('mrmrs', 'Our first date?'), idea('mrmrs', 'Your worst habit?'),
    idea('wave', 'Cringe | Cool', 'x1'), idea('mrmrs', 'Built-in 3?'), idea('word', 'Your happy place'),
  ])

  it('adds them to the pools once, and marks them as ours', () => {
    expect(content.mrmrsQuestions.filter((q) => q === 'Built-in 3?')).toHaveLength(1)
    expect(content.spectrums[content.spectrums.length - 1]).toEqual({ id: 'ours-x1', low: 'Cringe', high: 'Cool' })
    expect(content.ours).toContain('Our first date?')
    expect(content.ours).not.toContain('Your happy place') // a daily question, not a game card
  })

  it('deals them first, whatever the seed', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      let s = initialState(seed, 'mrmrs', content)
      s = reduce(s, { type: 'JOIN', player: 'A', name: 'Sam' }, 0)
      s = reduce(s, { type: 'JOIN', player: 'B', name: 'Alex' }, 0)
      const first = s.mrmrs!.rounds.slice(0, 3).map((r) => r.question).sort()
      expect(first).toEqual(['Built-in 3?', 'Our first date?', 'Your worst habit?'])
    }
  })

  it('leaves the content alone with no ideas', () => {
    expect(withIdeas(base, [])).toBe(base)
  })
})

describe('Their Word with questions of your own', () => {
  it('uses one of yours every other day, the same on both phones', () => {
    const pool = ['A', 'B', 'C']
    const ours = ['Mine 1', 'Mine 2']
    const days = ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']
    const isOurs = days.map((d) => !!questionOfTheDay(d, pool, ours)?.startsWith('Mine'))
    for (let i = 1; i < isOurs.length; i++) expect(isOurs[i]).not.toBe(isOurs[i - 1])
    // …taking yours in turn.
    const mine = days.map((d) => questionOfTheDay(d, pool, ours)).filter((q) => q?.startsWith('Mine'))
    expect(new Set(mine)).toEqual(new Set(ours))
    expect(questionOfTheDay('2026-09-22', pool, ours)).toBe(questionOfTheDay('2026-09-22', pool, ours))
    expect(questionOfTheDay('2026-09-22', pool)).toBe(questionOfTheDay('2026-09-22', pool, []))
  })
})
