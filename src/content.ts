import type { ChainCategory, Content, DrawPrompt, Guesstimate, HigherLower, Theme, Twister, WaveSpectrum } from './engine/state'

// Parses the one plain-text file all the game content lives in (content/game-content.md
// at the repo root, served as a static asset) — so editing what the games say never
// requires touching code or JSON syntax. Deliberately forgiving: a stray or malformed
// line is just skipped rather than breaking the whole file.

// The daily puzzle's prompts ride in the same file but aren't part of a game session.
export type ParsedContent = Content & { wordPrompts: string[]; numberQuestions: string[]; eitherPairs: string[] }

type Section = 'shortlist' | 'finger' | 'wavelength' | 'draw' | 'likely' | 'mrmrs' | 'lights' | 'word' | 'numbers' | 'either' | 'clash' | 'chain' | 'bluff' | 'meld' | 'describe' | 'twist' | 'higher' | 'guess' | null

function sectionFor(heading: string): Section {
  switch (heading.trim().toLowerCase()) {
    case 'shortlist': return 'shortlist'
    case 'called it': case 'put a finger down': return 'finger'
    case 'wavelength': return 'wavelength'
    // Renamed twice (Draw Your Love, then Quick Draw); the old headings still parse so
    // an older copy of the content file doesn't silently ship a game with no prompts.
    case 'draw your answer': case 'quick draw': case 'draw your love': return 'draw'
    case "who's more likely": case 'whos more likely': case 'who is more likely': return 'likely'
    case 'mr & mrs': case 'mr and mrs': return 'mrmrs'
    case 'lights out': return 'lights'
    case 'their word': return 'word'
    case 'their numbers': return 'numbers'
    case 'this or that': return 'either'
    case 'category clash': return 'clash'
    case 'word chain': return 'chain'
    case 'two lies & a truth': case 'two lies and a truth': return 'bluff'
    case 'mind meld': return 'meld'
    case 'describe it': return 'describe'
    case 'tongue twisters': return 'twist'
    case 'higher or lower': return 'higher'
    case 'guesstimate': return 'guess'
    default: return null
  }
}

// "(rude)" at the end of an entry or a Shortlist theme marks it as properly rude: left
// out unless the couple has rude questions switched on (see profile/rude). Ids are
// counted with the rude ones in, so they're the same whichever way it's set.
const RUDE = /\s*\(rude\)\s*$/i

export function parseContent(text: string, { rude = true }: { rude?: boolean } = {}): ParsedContent {
  const themes: Theme[] = []
  const fingerStatements: string[] = []
  const spectrums: WaveSpectrum[] = []
  const drawPrompts: DrawPrompt[] = []
  const likelyStatements: string[] = []
  const mrmrsQuestions: string[] = []
  const lightsQuestions: string[] = []
  const wordPrompts: string[] = []
  const numberQuestions: string[] = []
  const eitherPairs: string[] = [] // "Tea | Coffee", tidied
  const clashCategories: string[] = []
  const bluffPrompts: string[] = []
  const meldPrompts: string[] = []
  const describeWords: string[] = []
  const chainCategories: ChainCategory[] = []
  let currentChain: ChainCategory | null = null
  const twisters: Twister[] = []
  let twistLevel = 1
  const higherLower: HigherLower[] = []
  const guesstimates: Guesstimate[] = []

  let section: Section = null
  let currentTheme: Theme | null = null
  let themeCount = 0
  let spectrumCount = 0
  let drawCount = 0

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()

    // "## theme text" starts a new Shortlist theme — everything else is only
    // recognized inside a section, and a theme only means anything inside Shortlist.
    if (line.startsWith('## ')) {
      const heading = line.slice(3).trim()
      const themeText = heading.replace(RUDE, '')
      if (section === 'shortlist' && themeText.length > 0) {
        const theme = { id: `t${String(++themeCount).padStart(3, '0')}`, text: themeText, pool: [] }
        // A rude theme's entries have nowhere to go.
        currentTheme = rude || !RUDE.test(heading) ? theme : null
        if (currentTheme) themes.push(currentTheme)
      }
      // Inside Tongue Twisters, "## Easy" / "## Medium" / "## Hard" says how hard.
      if (section === 'twist') {
        const t = themeText.toLowerCase()
        twistLevel = t.startsWith('hard') ? 3 : t.startsWith('medium') ? 2 : 1
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
    const entry = line.slice(2).trim()
    const item = entry.replace(RUDE, '')
    if (item.length === 0) continue
    if (!rude && item !== entry) {
      if (section === 'wavelength') spectrumCount++
      if (section === 'draw') drawCount++
      continue
    }

    switch (section) {
      case 'shortlist':
        currentTheme?.pool.push(item)
        break
      case 'finger':
        fingerStatements.push(item)
        break
      case 'wavelength': {
        const [low, high] = item.split('|').map((s) => s.trim())
        if (low && high) spectrums.push({ id: `w${String(++spectrumCount).padStart(2, '0')}`, low, high })
        break
      }
      case 'draw':
        drawPrompts.push({ id: `d${String(++drawCount).padStart(2, '0')}`, text: item })
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
      case 'either': {
        const [a, b, ...rest] = item.split('|').map((x) => x.trim())
        if (a && b && rest.length === 0) eitherPairs.push(`${a} | ${b}`)
        break
      }
      case 'clash':
        clashCategories.push(item)
        break
      case 'bluff':
        bluffPrompts.push(item)
        break
      case 'meld':
        meldPrompts.push(item)
        break
      case 'describe':
        describeWords.push(item)
        break
      case 'chain':
        currentChain?.words.push(item)
        break
      case 'twist':
        twisters.push({ level: twistLevel, text: item })
        break
      // "Which is taller? | The Eiffel Tower | 330 | The Shard | 310 | metres"
      case 'higher': {
        const [question, a, av, b, bv, unit = ''] = item.split('|').map((x) => x.trim())
        const na = Number(av)
        const nb = Number(bv)
        if (question && a && b && Number.isFinite(na) && Number.isFinite(nb) && na !== nb) higherLower.push({ question, a, av: na, b, bv: nb, unit })
        break
      }
      // "How tall is Big Ben's tower, in metres? | 96"
      case 'guess': {
        const [question, answer] = item.split('|').map((x) => x.trim())
        const n = Number(answer)
        if (question && Number.isFinite(n)) guesstimates.push({ question, answer: n })
        break
      }
    }
  }

  return {
    themes, fingerStatements, spectrums, drawPrompts,
    likelyStatements, mrmrsQuestions, lightsQuestions, wordPrompts, numberQuestions, eitherPairs, clashCategories, chainCategories, bluffPrompts, meldPrompts, describeWords,
    twisters, higherLower, guesstimates,
  }
}
