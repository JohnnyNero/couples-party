import type { Content } from './engine/state'
import { parseContent } from './content'

const CONTENT_URL = `${import.meta.env.BASE_URL}content/game-content.md`

// Content never lives in code — it's one plain-text file (content/game-content.md)
// anyone can edit directly on GitHub, fetched fresh at boot and parsed into what the
// engine needs. See parseContent for the format.
export async function loadPacks(): Promise<Content> {
  const res = await fetch(CONTENT_URL)
  const text = await res.text()
  return parseContent(text)
}
