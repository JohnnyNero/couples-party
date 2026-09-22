import { describe, it, expect } from 'vitest'
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
