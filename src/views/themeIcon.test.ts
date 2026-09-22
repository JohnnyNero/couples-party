import { describe, it, expect } from 'vitest'
import shippedContent from '../../public/content/game-content.md?raw'
import { parseContent } from '../content'
import { themeGlyph } from './ThemeIcon'

// Icons are matched on a theme's words, so a theme worded slightly differently silently
// falls back to the generic star. That's a safe failure but a dull one — this catches it
// at build time instead of on someone's sofa.
describe('every shipped theme has its own icon', () => {
  const themes = parseContent(shippedContent).themes

  it('matches a distinct glyph for each theme, none falling back', () => {
    const glyphs = themes.map((t) => themeGlyph(t.text))
    expect(new Set(glyphs).size).toBe(themes.length)
  })

  it('falls back rather than throwing on a theme it has never seen', () => {
    expect(themeGlyph('seven unspecified nouns about {name}')).toBeTypeOf('function')
  })
})
