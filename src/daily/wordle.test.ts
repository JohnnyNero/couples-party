import { describe, it, expect } from 'vitest'
import shipped from '../../public/content/words-5.txt?raw'
import { cleanWord, keyStates } from './wordle'
import { localDate } from './dates'

describe('keyStates', () => {
  it('keeps the best thing known about each letter', () => {
    const k = keyStates(['party', 'happy'], ['yg..g', 'ggggg'])
    expect(k.get('p')).toBe('g') // yellow first, green later: green wins
    expect(k.get('r')).toBe('.')
    expect(k.get('h')).toBe('g')
  })
  it('never lets a later miss downgrade a letter already found', () => {
    const k = keyStates(['apple', 'lapse'], ['ggy..', 'y....'])
    expect(k.get('a')).toBe('g')
  })
})

describe('cleanWord', () => {
  it('keeps five lower-case letters and nothing else', () => {
    expect(cleanWord(' Hap-py! ')).toBe('happy')
    expect(cleanWord('abcdefgh')).toBe('abcde')
  })
})

describe('the shipped word list', () => {
  const list = new Set(shipped.split('\n').filter(Boolean))
  it('is five-letter lower-case words only', () => {
    expect([...list].filter((w) => !/^[a-z]{5}$/.test(w))).toEqual([])
    expect(list.size).toBeGreaterThan(10000)
  })
  it('has the everyday words people will actually set', () => {
    for (const w of ['tired', 'happy', 'bored', 'pizza', 'curry', 'chips', 'beach', 'sushi', 'tipsy', 'comfy']) {
      expect(list.has(w)).toBe(true)
    }
  })
})

describe('localDate', () => {
  it("reads the phone's own calendar, and rolls over months", () => {
    const lateNight = new Date(2026, 0, 31, 23, 30) // 31 Jan, 11:30pm local
    expect(localDate(0, lateNight)).toBe('2026-01-31')
    expect(localDate(1, lateNight)).toBe('2026-02-01')
  })
})
