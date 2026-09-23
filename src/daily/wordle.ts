// Client-side helpers for Their Word. The scoring itself happens on the server (the
// answer never reaches the phone until the puzzle's over); these only turn what the
// server sent back into things to draw.

export const WORD_LENGTH = 5
export const MAX_GUESSES = 6

export type Mark = 'g' | 'y' | '.'

// Best thing known about each letter so far, for colouring the keyboard. A letter that
// was green anywhere is green, even if a later guess put it in the wrong place.
export function keyStates(guesses: string[], patterns: string[]): Map<string, Mark> {
  const rank: Record<Mark, number> = { g: 3, y: 2, '.': 1 }
  const out = new Map<string, Mark>()
  guesses.forEach((guess, gi) => {
    const pattern = patterns[gi] ?? ''
    for (let i = 0; i < guess.length; i++) {
      const letter = guess[i]
      const mark = (pattern[i] ?? '.') as Mark
      const had = out.get(letter)
      if (!had || rank[mark] > rank[had]) out.set(letter, mark)
    }
  })
  return out
}

// Just the letters, lower case — what the keyboard and the input field produce.
export const cleanWord = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, WORD_LENGTH)

// The five-letter word list, fetched once when a word screen first needs it.
let words: Promise<Set<string>> | null = null
export function loadWords(): Promise<Set<string>> {
  words ??= fetch(`${import.meta.env.BASE_URL}content/words-5.txt`)
    .then((r) => r.text())
    .then((t) => new Set(t.split('\n').map((w) => w.trim()).filter((w) => w.length === WORD_LENGTH)))
  return words
}
