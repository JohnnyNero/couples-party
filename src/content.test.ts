import { describe, it, expect } from 'vitest'
// The real shipped file, not a fixture — these tests are worthless unless they
// read what actually goes live. `?raw` keeps it a plain string import, so no
// node types are needed just to open a file.
import shippedContent from '../public/content/game-content.md?raw'
import { parseContent } from './content'
import { chainKey } from './engine/chain'
import { roundsFor } from './engine/roster'

describe('parseContent', () => {
  it('parses a theme with its pool under Shortlist', () => {
    const { themes } = parseContent(`
# Shortlist

## seven things {name} would miss
- coffee
- their charger
- the good pillow
`)
    expect(themes).toHaveLength(1)
    expect(themes[0].text).toBe('seven things {name} would miss')
    expect(themes[0].pool).toEqual(['coffee', 'their charger', 'the good pillow'])
    expect(themes[0].id).toBe('t001')
  })

  it('parses two themes without bleeding items across them', () => {
    const { themes } = parseContent(`
# Shortlist
## first theme
- a
- b
## second theme
- c
- d
`)
    expect(themes).toHaveLength(2)
    expect(themes[0].pool).toEqual(['a', 'b'])
    expect(themes[1].pool).toEqual(['c', 'd'])
    expect(themes[1].id).toBe('t002')
  })

  it('parses Put a Finger Down statements as a flat list', () => {
    const { fingerStatements } = parseContent(`
# Put a Finger Down
- you've stolen the blanket
- you fell asleep first
`)
    expect(fingerStatements).toEqual(["you've stolen the blanket", 'you fell asleep first'])
  })

  it('parses Wavelength pairs split on |', () => {
    const { spectrums } = parseContent(`
# Wavelength
- Waste of time | Good use of time
- Cheap date  |  Expensive date
`)
    expect(spectrums).toEqual([
      { id: 'w01', low: 'Waste of time', high: 'Good use of time' },
      { id: 'w02', low: 'Cheap date', high: 'Expensive date' },
    ])
  })

  it('ignores a Wavelength line missing its | separator', () => {
    const { spectrums } = parseContent(`
# Wavelength
- Waste of time | Good use of time
- this line has no separator
`)
    expect(spectrums).toHaveLength(1)
  })

  it('parses Quick Draw prompts', () => {
    const { drawPrompts } = parseContent(`
# Quick Draw
- a lighthouse
- a shopping trolley
`)
    expect(drawPrompts).toEqual([
      { id: 'd01', text: 'a lighthouse' },
      { id: 'd02', text: 'a shopping trolley' },
    ])
  })

  it('still parses the old Draw Your Love heading', () => {
    const { drawPrompts } = parseContent(`
# Draw Your Love
- a lighthouse
`)
    expect(drawPrompts).toEqual([{ id: 'd01', text: 'a lighthouse' }])
  })

  it('ignores prose, blank lines, and headings that are not list items', () => {
    const { fingerStatements } = parseContent(`
# Put a Finger Down

Add as many as you like, one per line.

- a real statement

Some commentary in the middle.
- another real statement
`)
    expect(fingerStatements).toEqual(['a real statement', 'another real statement'])
  })

  it('ignores an unrecognized section heading and its content', () => {
    const parsed = parseContent(`
# Some Future Game
- this should go nowhere
# Wavelength
- Boring | Thrilling
`)
    expect(parsed.spectrums).toEqual([{ id: 'w01', low: 'Boring', high: 'Thrilling' }])
    expect(parsed.fingerStatements).toEqual([])
    expect(parsed.drawPrompts).toEqual([])
  })

  it('a dash item before any theme heading is dropped rather than crashing', () => {
    const { themes } = parseContent(`
# Shortlist
- orphaned item, no theme yet
## a theme
- real item
`)
    expect(themes).toHaveLength(1)
    expect(themes[0].pool).toEqual(['real item'])
  })

  it('parses the three newer games and Lights Out', () => {
    const parsed = parseContent(`
# Who's More Likely
- cry at an advert
# Mr & Mrs
- Your go-to karaoke song?
# Lights Out
- What made you laugh today?
`)
    expect(parsed.likelyStatements).toEqual(['cry at an advert'])
    expect(parsed.mrmrsQuestions).toEqual(['Your go-to karaoke song?'])
    expect(parsed.lightsQuestions).toEqual(['What made you laugh today?'])
  })

  it('reads the draw section under its current name and both old ones', () => {
    for (const heading of ['Draw Your Answer', 'Quick Draw', 'Draw Your Love']) {
      expect(parseContent(`# ${heading}\n- comfort food`).drawPrompts).toEqual([{ id: 'd01', text: 'comfort food' }])
    }
  })

  it('parses a realistic multi-section file end to end', () => {
    const parsed = parseContent(`
# Shortlist
## seven things {name} would miss
- a
- b
- c
- d
- e
- f
- g

# Put a Finger Down
- statement one
- statement two

# Wavelength
- Low | High

# Quick Draw
- a prompt
`)
    expect(parsed.themes).toHaveLength(1)
    expect(parsed.themes[0].pool).toHaveLength(7)
    expect(parsed.fingerStatements).toHaveLength(2)
    expect(parsed.spectrums).toHaveLength(1)
    expect(parsed.drawPrompts).toHaveLength(1)
  })
})

// The shipped content, held to the shape rules in the file's own header. These
// exist because the content twice drifted into clauses — a trailing "that…" or
// ", not a similar pillow" is where a writer puts the joke, which is exactly the
// job the players are supposed to do. Failing loudly beats a written-down rule
// nobody enforces.
describe('the shipped content keeps its shape', () => {
  const parsed = parseContent(shippedContent)
  const words = (s: string) => s.trim().split(/\s+/).length
  const shortlist = parsed.themes.flatMap((t) => t.pool)

  it('has enough of everything for the longest session to draw from', () => {
    // Every game needs at least as many entries as the full roster plays of it, or a
    // session would repeat itself inside one night.
    const need = (key: Parameters<typeof roundsFor>[1]) => roundsFor({ game: 'full' }, key)
    expect(parsed.themes.length).toBeGreaterThanOrEqual(need('list'))
    for (const t of parsed.themes) expect(t.pool.length).toBeGreaterThanOrEqual(7)
    expect(parsed.likelyStatements.length).toBeGreaterThanOrEqual(need('likely'))
    expect(parsed.fingerStatements.length).toBeGreaterThanOrEqual(need('finger'))
    expect(parsed.mrmrsQuestions.length).toBeGreaterThanOrEqual(need('mrmrs'))
    expect(parsed.spectrums.length).toBeGreaterThanOrEqual(need('wave'))
    expect(parsed.drawPrompts.length).toBeGreaterThanOrEqual(need('draw'))
    expect(parsed.lightsQuestions.length).toBeGreaterThanOrEqual(1)
    expect(parsed.clashCategories.length).toBeGreaterThanOrEqual(need('clash') * 6)
    expect(parsed.chainCategories.length).toBeGreaterThanOrEqual(need('chain'))
  })

  it('gives every Word Chain category a long, clean answer list', () => {
    for (const c of parsed.chainCategories) {
      expect({ name: c.name, n: c.words.length >= 60 }).toEqual({ name: c.name, n: true })
      expect(c.words.filter((w) => w !== w.toLowerCase() || !/^[a-z][a-z' -]*$/.test(w))).toEqual([])
      // Two entries that the game would read as the same word is one entry twice.
      const keys = c.words.map(chainKey)
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([])
    }
  })

  it('keeps Draw Your Answer prompts as bare phrases the app can put "Your" in front of', () => {
    const bad = parsed.drawPrompts
      .map((d) => d.text)
      .filter((t) => words(t) > 4 || /^(your|my|the|a|an)\b/i.test(t) || /[?.]$/.test(t))
    expect(bad).toEqual([])
  })

  it('gives the daily word puzzle enough prompts to choose from, each short', () => {
    expect(parsed.wordPrompts.length).toBeGreaterThanOrEqual(12)
    expect(parsed.wordPrompts.filter((t) => words(t) > 7 || /\?$/.test(t))).toEqual([])
    // Only {name} — any other brace token would show up on screen as-is.
    expect(parsed.wordPrompts.filter((t) => /\{(?!name\})/.test(t))).toEqual([])
  })

  it('gives Their Numbers enough questions, each saying what it counts', () => {
    expect(parsed.numberQuestions.length).toBeGreaterThanOrEqual(15)
    expect(parsed.numberQuestions.filter((t) => words(t) > 12 || /\?$/.test(t))).toEqual([])
    expect(new Set(parsed.numberQuestions).size).toBe(parsed.numberQuestions.length)
  })

  it('keeps the newer games short enough to read at a glance', () => {
    // Who's More Likely is the end of "Who's more likely to…", so it must not repeat it.
    expect(parsed.likelyStatements.filter((t) => words(t) > 8 || /more likely/i.test(t))).toEqual([])
    expect(parsed.mrmrsQuestions.filter((t) => words(t) > 12)).toEqual([])
    expect(parsed.lightsQuestions.filter((t) => words(t) > 14)).toEqual([])
  })

  it('keeps Shortlist items to a bare thing — four words, no clause', () => {
    const tooLong = shortlist.filter((i) => words(i) > 4)
    const clausal = shortlist.filter((i) => i.includes(',') || /\b(that|which)\b/.test(i))
    expect({ tooLong, clausal }).toEqual({ tooLong: [], clausal: [] })
  })

  it('keeps Wavelength poles to one or two words', () => {
    const long = parsed.spectrums.flatMap((s) => [s.low, s.high]).filter((p) => words(p) > 2)
    expect(long).toEqual([])
  })

  it('keeps Draw prompts sketchable and Finger Down statements short', () => {
    expect(parsed.drawPrompts.filter((d) => words(d.text) > 5).map((d) => d.text)).toEqual([])
    expect(parsed.fingerStatements.filter((f) => words(f) > 10)).toEqual([])
  })

  it('names every Shortlist theme after one of the players', () => {
    const nameless = parsed.themes.filter((t) => !t.text.includes('{name}')).map((t) => t.text)
    expect(nameless).toEqual([])
  })

  it('never reuses one Shortlist item across two themes — ranking the same thing twice reads as a bug', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const t of parsed.themes) {
      for (const item of t.pool) {
        if (seen.has(item)) clashes.push(`${item} (${seen.get(item)} / ${t.text})`)
        else seen.set(item, t.text)
      }
    }
    expect(clashes).toEqual([])
  })

  it('never repeats an entry inside one list', () => {
    const dupes = (xs: string[]) => xs.filter((v, i, a) => a.indexOf(v) !== i)
    for (const t of parsed.themes) expect(dupes(t.pool)).toEqual([])
    expect(dupes(parsed.fingerStatements)).toEqual([])
    expect(dupes(parsed.drawPrompts.map((d) => d.text))).toEqual([])
    expect(dupes(parsed.likelyStatements)).toEqual([])
    expect(dupes(parsed.mrmrsQuestions)).toEqual([])
    expect(dupes(parsed.lightsQuestions)).toEqual([])
    expect(dupes(parsed.wordPrompts)).toEqual([])
    expect(dupes(parsed.clashCategories)).toEqual([])
  })
})
