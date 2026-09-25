import type { ChainCategory, Content, DrawPrompt, Theme, WaveSpectrum } from './engine/state'

// Parses the one plain-text file all the game content lives in (content/game-content.md
// at the repo root, served as a static asset) — so editing what the games say never
// requires touching code or JSON syntax. Deliberately forgiving: a stray or malformed
// line is just skipped rather than breaking the whole file.

// The daily puzzle's prompts ride in the same file but aren't part of a game session.
export type ParsedContent = Content & { wordPrompts: string[]; numberQuestions: string[] }

type Section = 'shortlist' | 'finger' | 'wavelength' | 'draw' | 'likely' | 'mrmrs' | 'lights' | 'word' | 'numbers' | 'clash' | 'chain' | null

function sectionFor(heading: string): Section {
  switch (heading.trim().toLowerCase()) {
    case 'shortlist': return 'shortlist'
    case 'put a finger down': return 'finger'
    case 'wavelength': return 'wavelength'
    // Renamed twice (Draw Your Love, then Quick Draw); the old headings still parse so
    // an older copy of the content file doesn't silently ship a game with no prompts.
    case 'draw your answer': case 'quick draw': case 'draw your love': return 'draw'
    case "who's more likely": case 'whos more likely': case 'who is more likely': return 'likely'
    case 'mr & mrs': case 'mr and mrs': return 'mrmrs'
    case 'lights out': return 'lights'
    case 'their word': return 'word'
    case 'their numbers': return 'numbers'
    case 'category clash': return 'clash'
    case 'word chain': return 'chain'
    default: return null
  }
}

export function parseContent(text: string): ParsedContent {
  const themes: Theme[] = []
  const fingerStatements: string[] = []
  const spectrums: WaveSpectrum[] = []
  const drawPrompts: DrawPrompt[] = []
  const likelyStatements: string[] = []
  const mrmrsQuestions: string[] = []
  const lightsQuestions: string[] = []
  const wordPrompts: string[] = []
  const numberQuestions: string[] = []
  const clashCategories: string[] = []
  const chainCategories: ChainCategory[] = []
  let currentChain: ChainCategory | null = null

  let section: Section = null
  let currentTheme: Theme | null = null

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    // "## theme text" starts a new Shortlist theme — everything else is only
    // recognized inside a section, and a theme only means anything inside Shortlist.
    if (line.startsWith('## ')) {
      const themeText = line.slice(3).trim()
      if (section === 'shortlist' && themeText.length > 0) {
        currentTheme = { id: `t${String(themes.length + 1).padStart(3, '0')}`, text: themeText, pool: [] }
        themes.push(currentTheme)
      }
      // Inside Word Chain, "## Name" starts a category and its answer list.
      if (section === 'chain' && themeText.length > 0) {
        currentChain = { name: themeText, words: [] }
        chainCategories.push(currentChain)
      }
      continue
    }
    // "# Section Name" switches which game the following lines belong to.
    if (line.startsWith('# ')) {
      section = sectionFor(line.slice(2))
      currentTheme = null
      currentChain = null
      continue
    }
    // Everything else — blank lines, plain prose instructions — is commentary.
    if (!line.startsWith('- ')) continue
    const item = line.slice(2).trim()
    if (item.length === 0) continue

    switch (section) {
      case 'shortlist':
        currentTheme?.pool.push(item)
        break
      case 'finger':
        fingerStatements.push(item)
        break
      case 'wavelength': {
        const [low, high] = item.split('|').map((s) => s.trim())
        if (low && high) spectrums.push({ id: `w${String(spectrums.length + 1).padStart(2, '0')}`, low, high })
        break
      }
      case 'draw':
        drawPrompts.push({ id: `d${String(drawPrompts.length + 1).padStart(2, '0')}`, text: item })
        break
      case 'likely':
        likelyStatements.push(item)
        break
      case 'mrmrs':
        mrmrsQuestions.push(item)
        break
      case 'lights':
        lightsQuestions.push(item)
        break
      case 'word':
        wordPrompts.push(item)
        break
      case 'numbers':
        numberQuestions.push(item)
        break
      case 'clash':
        clashCategories.push(item)
        break
      case 'chain':
        currentChain?.words.push(item)
        break
    }
  }

  return {
    themes, fingerStatements, spectrums, drawPrompts,
    likelyStatements, mrmrsQuestions, lightsQuestions, wordPrompts, numberQuestions, clashCategories, chainCategories,
  }
}
