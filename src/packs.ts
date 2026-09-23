import type { Content } from './engine/state'
import { parseContent } from './content'

const CONTENT_URL = `${import.meta.env.BASE_URL}content/game-content.md`

// Content never lives in code — it's one plain-text file (content/game-content.md)
// anyone can edit directly on GitHub, fetched fresh at boot and parsed into what the
// engine needs. See parseContent for the format.
export async function loadPacks(): Promise<Content> {
  // The daily puzzle's prompts live in the same file but have no place in a game
  // session, which gets broadcast to both phones on every move — so they're left out.
  const { wordPrompts: _unused, ...content } = parseContent(await fetchContent())
  return content
}

export async function loadWordPrompts(): Promise<string[]> {
  return parseContent(await fetchContent()).wordPrompts
}

// Both calls above can happen in one visit; the file only needs fetching once.
let text: Promise<string> | null = null
function fetchContent(): Promise<string> {
  text ??= fetch(CONTENT_URL).then((res) => res.text())
  return text
}
