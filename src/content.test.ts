import { describe, it, expect } from 'vitest'
// The real shipped file, not a fixture — these tests are worthless unless they
// read what actually goes live. `?raw` keeps it a plain string import, so no
// node types are needed just to open a file.
import shippedContent from '../public/content/game-content.md?raw'
import { parseContent } from './content'

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

  it('parses Draw Your Love prompts', () => {
    const { drawPrompts } = parseContent(`
# Draw Your Love
- our first date
- the way you dance
`)
    expect(drawPrompts).toEqual([
      { id: 'd01', text: 'our first date' },
      { id: 'd02', text: 'the way you dance' },
    ])
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

# Draw Your Love
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

  it('has enough of everything for every game to draw a full round', () => {
    expect(parsed.themes.length).toBeGreaterThanOrEqual(2)
    for (const t of parsed.themes) expect(t.pool.length).toBeGreaterThanOrEqual(7)
    expect(parsed.fingerStatements.length).toBeGreaterThanOrEqual(5)
    expect(parsed.spectrums.length).toBeGreaterThanOrEqual(7)
    expect(parsed.drawPrompts.length).toBeGreaterThanOrEqual(6)
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

  it('never repeats an entry inside one list', () => {
    const dupes = (xs: string[]) => xs.filter((v, i, a) => a.indexOf(v) !== i)
    for (const t of parsed.themes) expect(dupes(t.pool)).toEqual([])
    expect(dupes(parsed.fingerStatements)).toEqual([])
    expect(dupes(parsed.drawPrompts.map((d) => d.text))).toEqual([])
  })
})
