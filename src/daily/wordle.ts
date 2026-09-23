// Client-side helpers for Their Word. The scoring itself happens on the server (the
// answer never reaches the phone until the puzzle's over); these only turn what the
// server sent back into things to draw.

// An answer is five letters or six. The solver is told which — it's how many tiles they
// get — and every guess has to match it.
export const MIN_LENGTH = 5
export const MAX_LENGTH = 6
export const MAX_GUESSES = 6

export const lengthWord = (n: number) => (n === 6 ? 'Six' : 'Five')

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

// Just the letters, lower case, no longer than `max` — what the keyboard produces.
export const cleanWord = (s: string, max = MAX_LENGTH) => s.toLowerCase().replace(/[^a-z]/g, '').slice(0, max)

// The five- and six-letter word lists as one set, fetched once when a word screen first
// needs them.
let words: Promise<Set<string>> | null = null
export function loadWords(): Promise<Set<string>> {
  const one = (n: number) =>
    fetch(`${import.meta.env.BASE_URL}content/words-${n}.txt`)
      .then((r) => {
        if (!r.ok) throw new Error(`words-${n}.txt: ${r.status}`)
        return r.text()
      })
      .then((t) => t.split('\n').map((w) => w.trim()).filter((w) => w.length === n))
  words ??= Promise.all([one(5), one(6)])
    .then(([five, six]) => new Set([...five, ...six]))
    // A failed fetch mustn't stick: let the next Enter try again.
    .catch((e) => { words = null; throw e })
  return words
}
