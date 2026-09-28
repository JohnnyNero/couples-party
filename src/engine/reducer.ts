import type {
  Action, BluffGame, FrenzyRound, SpotRound, DescribeGame, MeldGame, ChainCategory, ChainRound, ClashRound, ClockRound, DrawGame, DrawStroke, FingerGame, GameKey, LikelyGame, ListAct, ListItem, MrMrsGame,
  Phase, PlayerId, SessionState, WaveGame,
} from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, oursFirst, pick, shuffled } from './rng'
import { BLUFF, MELD, CHAIN, CLASH, CLOCK, DRAW, DURATIONS, FOLLOW, FRENZY, LIST, MRMRS, SPOT, WAVE } from './phases'
import { clashVerdict } from './clash'
import { chainKey, checkWord, listFor, nextLetter, rejectable, turnMs } from './chain'
import { circleScore, clockRoundWinner, fillerOver, keepCircle } from './fillers'
import { needsDecider } from './standing'
import { lowestFreeSlot, usedSlots } from './list'
import { gameOfPhase, nextGame, roster, roundsFor } from './roster'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const PLAYERS: PlayerId[] = ['A', 'B']

// ---------------------------------------------------------------- The roster

// Start a game by key. Every begin* below returns the session parked on that game's
// first phase — or, if the content file gave it nothing to play, hands straight on to
// the next game rather than opening an empty one.
function beginGame(state: SessionState, now: number, key: GameKey | null): SessionState {
  // The scored games are done: a level night gets its tiebreaker before Lights Out.
  if ((key === 'lights' || key === null) && needsDecider(state)) return beginDecider(state, now)
  const began = startGame(state, now, key)
  // A title card in front of the game's first round — only if the game actually began
  // (one with nothing to play has already handed on to the next, which got its own).
  if (!state.intros || key === null || key === 'lights' || gameOfPhase(began.phase) !== key) return began
  const s = clone(began)
  s.intro = {
    key,
    ready: { A: false, B: false },
    resume: began.phase,
    resumeMs: began.phaseEndsAt === null ? null : began.phaseEndsAt - now,
  }
  s.phase = 'INTRO'
  // No clock: it waits until you've both tapped ready. (A TIMEOUT still ends it — that's
  // the debug skip; the host's timer never sends one without a deadline.)
  s.phaseEndsAt = null
  return s
}

function endIntro(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const intro = s.intro!
  s.phase = intro.resume
  s.phaseEndsAt = intro.resumeMs === null ? null : now + intro.resumeMs
  s.intro = null
  return s
}

function startGame(state: SessionState, now: number, key: GameKey | null): SessionState {
  switch (key) {
    case 'list': return beginList(state, now, 'A')
    case 'likely': return beginLikely(state, now)
    case 'finger': return beginFinger(state, now)
    case 'mrmrs': return beginMrMrs(state, now)
    case 'wave': return beginWave(state, now)
    case 'draw': return beginDraw(state, now)
    case 'clash': return beginClash(state, now)
    case 'chain': return beginChain(state, now)
    case 'bluff': return beginBluff(state, now)
    case 'meld': return beginMeld(state, now)
    case 'describe': return beginDescribe(state, now)
    case 'circle': return beginCircle(state, now)
    case 'clock': return beginClock(state, now)
    case 'spot': return beginSpot(state, now)
    case 'frenzy': return beginFrenzy(state, now)
    case 'follow': return beginFollow(state, now)
    case 'twist': return beginTwist(state, now)
    case 'higher': return beginHigher(state, now)
    case 'guess': return beginGuess(state, now)
    case 'lights': return beginLights(state, now)
    default: return finishSession(state)
  }
}

function skipTo(state: SessionState, now: number, after: GameKey): SessionState {
  return beginGame(state, now, nextGame(state, after))
}

// Every scored game ends on one of these, and none of them carries a clock — the whole
// point is to sit and look at the numbers for as long as you like.
function toScoreboard(state: SessionState, phase: SessionState['phase']): SessionState {
  const s = clone(state)
  s.phase = phase
  s.phaseEndsAt = null
  return s
}

// The phases that wait for a tap (CONTINUE) instead of a clock.
const TAP_THROUGH = new Set([
  'LIST_RESULT', 'LIKELY_RESULT', 'FINGER_RESULT', 'MM_RESULT', 'WAVE_RESULT', 'DRAW_RESULT',
  'CLASH_RESULT', 'CHAIN_RESULT', 'BLUFF_RESULT', 'MELD_RESULT', 'DESCRIBE_RESULT', 'CIRCLE_RESULT', 'CLOCK_RESULT', 'SPOT_RESULT', 'FRENZY_RESULT', 'FOLLOW_RESULT', 'TWIST_RESULT', 'HL_RESULT', 'GUESS_RESULT', 'LIGHTS_OUT',
])

// What a tap on a scoreboard does: into the next game in this session's roster, or the
// end of the night.
function afterScoreboard(state: SessionState, now: number): SessionState {
  const current = gameOfPhase(state.phase)
  return current ? skipTo(state, now, current) : finishSession(state)
}

function finishSession(state: SessionState): SessionState {
  const s = clone(state)
  s.phase = 'DONE'
  s.phaseEndsAt = null
  return s
}

// ---------------------------------------------------------------- Shortlist

function currentList(state: SessionState): ListAct | undefined {
  return state.listActs[state.listActs.length - 1]
}

// Seeded so a session stays reproducible, and offset per run so the second author never
// draws the first one's theme.
function pickTheme(state: SessionState, run: number): string {
  const used = new Set(state.listActs.map((a) => a.themeId))
  const pool = state.themes.filter((t) => !used.has(t.id))
  if (pool.length === 0) return state.themes[0]?.id ?? ''
  return pick(makeRng((state.seed ^ 0x1157) + run), pool).id
}

function beginList(state: SessionState, now: number, author: PlayerId): SessionState {
  const s = clone(state)
  const themeId = pickTheme(s, s.listActs.length)
  const theme = s.themes.find((t) => t.id === themeId)
  const drawn = shuffled(makeRng((s.seed ^ 0x7331) + s.listActs.length), theme?.pool ?? [])
    .slice(0, LIST.items)
  const items: ListItem[] = drawn.map((text, i) => ({
    id: `${author}${i}`,
    text,
    actualSlot: null,
    predictedSlot: null,
  }))
  // A theme whose pool comes up short of seven still needs seven slots filled.
  while (items.length < LIST.items) {
    items.push({ id: `${author}${items.length}`, text: LIST.blank, actualSlot: null, predictedSlot: null })
  }
  s.listActs.push({ author, themeId, items, placeIndex: 0, revealIndex: 0, displacement: null })
  // The theme card first: both phones show the same thing, nobody is asked for
  // anything, and the first item doesn't land on someone still reading the theme.
  s.phase = 'LIST_INTRO'
  s.phaseEndsAt = now + DURATIONS.LIST_INTRO!
  return s
}

function toListPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'LIST_PLACE'
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

function toReveal(state: SessionState): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  act.displacement = act.items.reduce(
    (sum, i) => sum + Math.abs((i.actualSlot ?? 0) - (i.predictedSlot ?? 0)),
    0,
  )
  act.revealIndex = 0
  s.phase = 'LIST_REVEAL'
  // No clock. The reveal goes item by item on a tap, so nothing cuts an argument short.
  s.phaseEndsAt = null
  return s
}

// One tap walks the reveal to the next item, or off the end of the act. Either player
// can drive it — they're looking at the same list.
function advanceReveal(state: SessionState, now: number): SessionState {
  const act = currentList(state)
  if (!act) return state
  if (act.revealIndex >= act.items.length - 1) return afterListReveal(state, now)
  const s = clone(state)
  currentList(s)!.revealIndex += 1
  return s
}

const bothPlaced = (item: ListItem): boolean =>
  item.actualSlot !== null && item.predictedSlot !== null

// The live item is locked on both sides — move to the next one, or to the reveal once
// all seven are done.
function advancePlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  if (act.placeIndex >= act.items.length - 1) return toReveal(s)
  act.placeIndex += 1
  s.phaseEndsAt = now + DURATIONS.LIST_PLACE!
  return s
}

// Whoever didn't lock the live item in time gets its lowest free slot — the same thing
// a distracted phone would land on anyway.
function timeoutPlace(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const act = currentList(s)!
  const item = act.items[act.placeIndex]
  if (item.predictedSlot === null) item.predictedSlot = lowestFreeSlot(act, true)
  if (item.actualSlot === null) item.actualSlot = lowestFreeSlot(act, false)
  return advancePlace(s, now)
}

// Shortlist runs as many acts as the roster asks for, roles swapping each time, then
// hands over to its own scoreboard.
function afterListReveal(state: SessionState, now: number): SessionState {
  const last = currentList(state)!
  if (state.listActs.length < roundsFor(state, 'list')) return beginList(state, now, other(last.author))
  return toScoreboard(state, 'LIST_RESULT')
}

// ---------------------------------------------------------------- Who's More Likely

function beginLikely(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const statements = shuffled(makeRng(s.seed ^ 0x11ce), s.likelyStatements)
    .slice(0, roundsFor(s, 'likely'))
  if (statements.length === 0) return skipTo(s, now, 'likely')
  s.likely = {
    rounds: statements.map((statement, i) => ({
      index: i + 1,
      statement,
      picks: { A: null, B: null },
    })),
    current: 0,
  }
  s.phase = 'LIKELY_ROUND'
  s.phaseEndsAt = now + DURATIONS.LIKELY_ROUND!
  return s
}

const currentLikely = (g: LikelyGame) => g.rounds[g.current]

// A name nobody tapped in time stays unpicked — which never counts as agreeing.
function toLikelyReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'LIKELY_REVEAL'
  s.phaseEndsAt = now + DURATIONS.LIKELY_REVEAL!
  return s
}

function advanceLikely(state: SessionState, now: number): SessionState {
  const g = state.likely!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'LIKELY_RESULT')
  const s = clone(state)
  s.likely!.current += 1
  s.phase = 'LIKELY_ROUND'
  s.phaseEndsAt = now + DURATIONS.LIKELY_ROUND!
  return s
}

// ---------------------------------------------------------------- Called It (key 'finger')

function currentFingerRound(f: FingerGame) {
  return f.rounds[f.current]
}

const text = (t: string) => t

// A card both of you read the same way that names one of you ({player}, from Our
// questions): the session picks who by its seed, and it's filled in as it's dealt, so
// both phones, the TV and Memories all say the same name.
function namedFor(s: SessionState, t: string): string {
  if (!t.includes('{player}')) return t
  const p: PlayerId = s.seed % 2 === 0 ? 'A' : 'B'
  return t.split('{player}').join(s.players[p].name || p)
}

function beginFinger(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const pool = oursFirst(makeRng(s.seed ^ 0x9001), s.fingerStatements, s.ours, text)
  const rounds = pool.slice(0, roundsFor(s, 'finger')).map((statementId, i) => ({
    index: i + 1,
    statementId,
    answer: { A: null, B: null } as Record<PlayerId, boolean | null>,
    predict: { A: null, B: null } as Record<PlayerId, boolean | null>,
  }))
  if (rounds.length === 0) return skipTo(s, now, 'finger')
  s.finger = { rounds, current: 0 }
  s.phase = 'FINGER_ROUND'
  s.phaseEndsAt = now + DURATIONS.FINGER_ROUND!
  return s
}

function toFingerReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'FINGER_REVEAL'
  s.phaseEndsAt = now + DURATIONS.FINGER_REVEAL!
  return s
}

function advanceFinger(state: SessionState, now: number): SessionState {
  const f = state.finger!
  if (f.current >= f.rounds.length - 1) return toScoreboard(state, 'FINGER_RESULT')
  const s = clone(state)
  s.finger!.current += 1
  s.phase = 'FINGER_ROUND'
  s.phaseEndsAt = now + DURATIONS.FINGER_ROUND!
  return s
}

// ---------------------------------------------------------------- Mr & Mrs

function beginMrMrs(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const questions = oursFirst(makeRng(s.seed ^ 0x3303), s.mrmrsQuestions, s.ours, text)
    .slice(0, roundsFor(s, 'mrmrs'))
  if (questions.length === 0) return skipTo(s, now, 'mrmrs')
  s.mrmrs = {
    rounds: questions.map((question, i) => ({
      index: i + 1,
      question,
      answer: { A: null, B: null },
      predict: { A: null, B: null },
      verdict: { A: null, B: null },
    })),
    current: 0,
  }
  s.phase = 'MM_ANSWER'
  s.phaseEndsAt = now + DURATIONS.MM_ANSWER!
  return s
}

const currentMm = (g: MrMrsGame) => g.rounds[g.current]

// Into the reveal. The easy calls are made for you — a prediction that matches word for
// word is right, and a blank one (or one about an answer that never came) is wrong — so
// the only thing left to judge is the "close enough?" in between.
function toMmJudge(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = currentMm(s.mrmrs!)
  for (const p of PLAYERS) {
    const guess = round.predict[p]
    const truth = round.answer[other(p)]
    if (!guess || !truth) round.verdict[p] = false
    else if (isMatch(guess, truth)) round.verdict[p] = true
  }
  s.phase = 'MM_JUDGE'
  s.phaseEndsAt = allJudged(round) ? now + DURATIONS.MM_JUDGE! : null
  return s
}

const allJudged = (round: MrMrsGame['rounds'][number]) =>
  round.verdict.A !== null && round.verdict.B !== null

function advanceMm(state: SessionState, now: number): SessionState {
  const g = state.mrmrs!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'MM_RESULT')
  const s = clone(state)
  s.mrmrs!.current += 1
  s.phase = 'MM_ANSWER'
  s.phaseEndsAt = now + DURATIONS.MM_ANSWER!
  return s
}

// ---------------------------------------------------------------- Wavelength

function currentWaveRound(w: WaveGame) {
  return w.rounds[w.current]
}

// Wavelength and Draw Your Answer go in pairs of turns, one each: you both set yours at
// once (a clue, a drawing), then they're solved one at a time — the first of the pair,
// then the second — with whoever set it watching. Who goes first swaps every pair.
export const setterOf = (i: number): PlayerId => {
  const first: PlayerId = Math.floor(i / 2) % 2 === 0 ? 'A' : 'B'
  return i % 2 === 0 ? first : other(first)
}
// The turns being set together: the live one and, if it opens a pair, the next.
export const pairOf = <R,>(g: { rounds: R[]; current: number }): R[] =>
  g.current % 2 === 0 ? g.rounds.slice(g.current, g.current + 2) : [g.rounds[g.current]]
// After a reveal: the second of the pair is already set, so straight to solving it.
const secondOfPair = (g: { rounds: unknown[]; current: number }) =>
  g.current % 2 === 0 && g.current + 1 < g.rounds.length

// Generated in full up front — spectrum, psychic and hidden target for every round —
// the same way Called It pre-picks its statements, and for the same reason:
// exactly the roster's number of rounds happen, no branching on how any of them go.
function beginWave(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.spectrums.length === 0) return skipTo(s, now, 'wave')
  const rng = makeRng(s.seed ^ 0xa001)
  const spectrums = oursFirst(rng, s.spectrums, s.ours, (w) => `${w.low} | ${w.high}`)
  const rounds = Array.from({ length: roundsFor(s, 'wave') }, (_, i) => {
    const spectrum = spectrums[i % spectrums.length]
    const span = WAVE.targetMax - WAVE.targetMin
    return {
      index: i + 1,
      psychic: setterOf(i),
      spectrumId: spectrum.id,
      target: WAVE.targetMin + Math.round(rng() * span),
      clue: null,
      guess: null,
      distance: null,
    }
  })
  s.wave = { rounds, current: 0 }
  s.phase = 'WAVE_CLUE'
  s.phaseEndsAt = now + DURATIONS.WAVE_CLUE!
  return s
}

// Both clues are in (or the clock ran out — a missing one plays as no clue at all).
function toWaveGuess(state: SessionState, now: number): SessionState {
  const s = clone(state)
  for (const round of pairOf(s.wave!)) round.clue ??= '(no clue)'
  s.phase = 'WAVE_GUESS'
  s.phaseEndsAt = now + DURATIONS.WAVE_GUESS!
  return s
}

function toWaveReveal(state: SessionState, now: number, guess: number): SessionState {
  const s = clone(state)
  const round = currentWaveRound(s.wave!)
  round.guess = guess
  round.distance = Math.abs(round.target - guess)
  s.phase = 'WAVE_REVEAL'
  s.phaseEndsAt = now + DURATIONS.WAVE_REVEAL!
  return s
}

function advanceWave(state: SessionState, now: number): SessionState {
  const w = state.wave!
  if (w.current >= w.rounds.length - 1) return toScoreboard(state, 'WAVE_RESULT')
  const s = clone(state)
  const second = secondOfPair(w)
  s.wave!.current += 1
  s.phase = second ? 'WAVE_GUESS' : 'WAVE_CLUE'
  s.phaseEndsAt = now + DURATIONS[s.phase]!
  return s
}

// ---------------------------------------------------------------- Draw Your Answer

function currentDrawRound(d: DrawGame) {
  return d.rounds[d.current]
}

// Generated in full up front — question and drawer for every round, taking turns — so a
// two-round Tonight is one drawing each.
function beginDraw(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.drawPrompts.length === 0) return skipTo(s, now, 'draw')
  const rng = makeRng(s.seed ^ 0xd001)
  const prompts = shuffled(rng, s.drawPrompts)
  const rounds = Array.from({ length: roundsFor(s, 'draw') }, (_, i) => ({
    index: i + 1,
    drawer: setterOf(i),
    promptId: prompts[i % prompts.length].id,
    answer: null,
    strokes: [] as DrawStroke[],
    guesses: [] as string[],
    hitAt: null,
    guess: null,
    correct: null,
  }))
  s.draw = { rounds, current: 0 }
  s.phase = 'DRAW_SKETCH'
  s.phaseEndsAt = now + DURATIONS.DRAW_SKETCH!
  return s
}

// The answer's in: now it's drawn, with the other watching and guessing.
function toDrawGuess(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.phase = 'DRAW_GUESS'
  s.phaseEndsAt = now + DURATIONS.DRAW_GUESS!
  return s
}

// Got it, out of guesses, or out of time (or no answer was ever picked — then there's
// nothing to have got). The guess shown is the one that got it, else the last one.
function toDrawReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = currentDrawRound(s.draw!)
  const guesses = round.guesses ?? []
  round.answer ??= ''
  round.hitAt ??= null
  round.correct = round.hitAt !== null
  round.guess = round.hitAt !== null ? guesses[round.hitAt - 1] : guesses[guesses.length - 1] ?? null
  s.phase = 'DRAW_REVEAL'
  s.phaseEndsAt = now + DURATIONS.DRAW_REVEAL!
  return s
}

function advanceDraw(state: SessionState, now: number): SessionState {
  const d = state.draw!
  if (d.current >= d.rounds.length - 1) return toScoreboard(state, 'DRAW_RESULT')
  const s = clone(state)
  s.draw!.current += 1
  s.phase = 'DRAW_SKETCH'
  s.phaseEndsAt = now + DURATIONS.DRAW_SKETCH!
  return s
}

// Kept to a sane size however long the drawer keeps going: the newest strokes win.
function keepStrokes(strokes: DrawStroke[]): DrawStroke[] {
  const out: DrawStroke[] = []
  let n = 0
  for (let i = strokes.length - 1; i >= 0; i--) {
    const stroke = strokes[i].filter((pt) => Array.isArray(pt) && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))
    if (n + stroke.length > DRAW.maxPoints) break
    n += stroke.length
    out.unshift(stroke.map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as [number, number]))
  }
  return out
}

// ---------------------------------------------------------------- Category Clash

// Letters and categories are dealt for every round up front, so no letter and no
// category comes up twice in one game.
function beginClash(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const rounds = roundsFor(s, 'clash')
  if (s.clashCategories.length < CLASH.categories) return skipTo(s, now, 'clash')
  const letters = shuffled(makeRng(s.seed ^ 0xc1a5), CLASH.letters.split(''))
  const cats = oursFirst(makeRng(s.seed ^ 0xca75), s.clashCategories, s.ours, text)
  s.clash = {
    rounds: Array.from({ length: rounds }, (_, r): ClashRound => {
      const categories = Array.from({ length: CLASH.categories }, (_, i) => namedFor(s, cats[(r * CLASH.categories + i) % cats.length]))
      return {
        index: r + 1,
        letter: letters[r % letters.length],
        categories,
        answers: { A: null, B: null },
        challenged: { A: categories.map(() => false), B: categories.map(() => false) },
        revealIndex: 0,
      }
    }),
    current: 0,
  }
  s.phase = 'CLASH_WRITE'
  s.phaseEndsAt = now + DURATIONS.CLASH_WRITE!
  return s
}

// Whatever never came in is six blanks. The reveal has no clock: an argument about
// whether beans are "a reason to be late" can run as long as it likes.
function toClashReveal(state: SessionState): SessionState {
  const s = clone(state)
  const round = s.clash!.rounds[s.clash!.current]
  for (const p of PLAYERS) round.answers[p] ??= round.categories.map(() => '')
  s.phase = 'CLASH_REVEAL'
  s.phaseEndsAt = null
  return s
}

function advanceClash(state: SessionState, now: number): SessionState {
  const g = state.clash!
  const round = g.rounds[g.current]
  const s = clone(state)
  if (round.revealIndex < round.categories.length - 1) {
    s.clash!.rounds[g.current].revealIndex += 1
    return s
  }
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'CLASH_RESULT')
  s.clash!.current += 1
  s.phase = 'CLASH_WRITE'
  s.phaseEndsAt = now + DURATIONS.CLASH_WRITE!
  return s
}

// ---------------------------------------------------------------- Two Lies & a Truth

// Prompts and the order each person's three will be shown in are dealt up front. Who
// goes first swaps every round.
function beginBluff(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const prompts = shuffled(makeRng(s.seed ^ 0xb1f5), s.bluffPrompts).slice(0, roundsFor(s, 'bluff'))
  if (prompts.length === 0) return skipTo(s, now, 'bluff')
  const rng = makeRng(s.seed ^ 0x3b1f)
  s.bluff = {
    rounds: prompts.map((prompt, i) => {
      const first: PlayerId = (s.seed + i) % 2 === 0 ? 'A' : 'B'
      return {
        index: i + 1,
        prompt,
        first,
        turn: first,
        entry: { A: null, B: null },
        order: { A: shuffled(rng, [0, 1, 2]), B: shuffled(rng, [0, 1, 2]) },
        pick: { A: null, B: null },
      }
    }),
    current: 0,
  }
  s.phase = 'BLUFF_WRITE'
  s.phaseEndsAt = now + DURATIONS.BLUFF_WRITE!
  return s
}

const currentBluff = (g: BluffGame) => g.rounds[g.current]

// On to whoever's three haven't been guessed yet — first this round's opener, then the
// other. Anyone whose three never came in is skipped; once nobody's left, the next round
// (or the scoreboard).
function nextBluffStep(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const g = s.bluff!
  const round = currentBluff(g)
  for (const owner of [round.first, other(round.first)]) {
    if (round.entry[owner] && round.pick[owner] === null) {
      round.turn = owner
      s.phase = 'BLUFF_PICK'
      s.phaseEndsAt = now + DURATIONS.BLUFF_PICK!
      return s
    }
  }
  if (g.current >= g.rounds.length - 1) return toScoreboard(s, 'BLUFF_RESULT')
  g.current += 1
  s.phase = 'BLUFF_WRITE'
  s.phaseEndsAt = now + DURATIONS.BLUFF_WRITE!
  return s
}

// The pick is in (or the clock ran out): show the truth. No clock — "wait, really?"
// is the whole point.
function toBluffReveal(state: SessionState, choice: number): SessionState {
  const s = clone(state)
  const round = currentBluff(s.bluff!)
  round.pick[round.turn] = choice
  s.phase = 'BLUFF_REVEAL'
  s.phaseEndsAt = null
  return s
}

// ---------------------------------------------------------------- Mind Meld

function beginMeld(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const prompts = oursFirst(makeRng(s.seed ^ 0x3e1d), s.meldPrompts, s.ours, text).slice(0, roundsFor(s, 'meld'))
  if (prompts.length === 0) return skipTo(s, now, 'meld')
  s.meld = {
    rounds: prompts.map((prompt, i) => ({ index: i + 1, prompt: namedFor(s, prompt), tries: [{ A: null, B: null }], matched: null })),
    current: 0,
  }
  s.phase = 'MELD_WRITE'
  s.phaseEndsAt = now + DURATIONS.MELD_WRITE!
  return s
}

const currentMeld = (g: MeldGame) => g.rounds[g.current]

// Both words in (or the clock ran out — a missing word never matches): side by side.
function toMeldReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = currentMeld(s.meld!)
  const t = round.tries.length - 1
  const words = round.tries[t]
  for (const p of PLAYERS) words[p] ??= ''
  if (words.A && words.B && isMatch(words.A, words.B)) round.matched = t
  s.phase = 'MELD_REVEAL'
  // A miss stays up longer: time to argue it was the same thing really (COUNT_MELD).
  s.phaseEndsAt = now + (round.matched === null ? MELD.missRevealMs : DURATIONS.MELD_REVEAL!)
  return s
}

// Met, or out of tries: the next prompt. Otherwise, another go at meeting in the middle.
function advanceMeld(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const g = s.meld!
  const round = currentMeld(g)
  if (round.matched === null && round.tries.length < MELD.tries) {
    round.tries.push({ A: null, B: null })
  } else if (g.current >= g.rounds.length - 1) {
    return toScoreboard(s, 'MELD_RESULT')
  } else {
    g.current += 1
  }
  s.phase = 'MELD_WRITE'
  s.phaseEndsAt = now + DURATIONS.MELD_WRITE!
  return s
}

// ---------------------------------------------------------------- Describe It

function beginDescribe(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.describeWords.length === 0) return skipTo(s, now, 'describe')
  const deck = oursFirst(makeRng(s.seed ^ 0xde5c), s.describeWords, s.ours, text)
  s.describe = {
    turns: Array.from({ length: roundsFor(s, 'describe') }, (_, i) => ({
      index: i + 1,
      describer: (s.seed + i) % 2 === 0 ? 'A' : 'B',
      got: [],
      skipped: [],
    })),
    current: 0,
    deck,
    next: 0,
  }
  s.phase = 'DESCRIBE_READY'
  s.phaseEndsAt = now + DURATIONS.DESCRIBE_READY!
  return s
}

const currentDescribe = (g: DescribeGame) => g.turns[g.current]
export const describeWord = (g: DescribeGame) => g.deck[g.next % g.deck.length]

function afterDescribeTurn(state: SessionState, now: number): SessionState {
  const g = state.describe!
  if (g.current >= g.turns.length - 1) return toScoreboard(state, 'DESCRIBE_RESULT')
  const s = clone(state)
  s.describe!.current += 1
  // The word the last describer was stuck on goes: the next one starts on a fresh word,
  // not one they've both just heard half-described.
  s.describe!.next += 1
  s.phase = 'DESCRIBE_READY'
  s.phaseEndsAt = now + DURATIONS.DESCRIBE_READY!
  return s
}

// ---------------------------------------------------------------- Word Chain

// Every round is dealt up front — its category, its answer list and the app's opening
// word — but who goes first is only settled when it starts: the loser of the round before.
function newChainRound(cat: ChainCategory, index: number, rng: () => number): ChainRound {
  const opener = pick(rng, listFor(cat))
  const round: ChainRound = {
    index,
    category: cat.name,
    words: cat.words,
    chain: [{ word: opener, by: null }],
    turn: 'A',
    need: '',
    loser: null,
    over: false,
    reject: null,
  }
  const need = nextLetter(round, opener)
  if (need === null) round.over = true
  else round.need = need
  return round
}

function beginChain(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.chainCategories.length === 0) return skipTo(s, now, 'chain')
  const rng = makeRng(s.seed ^ 0xc4a1)
  const cats = shuffled(rng, s.chainCategories)
  const rounds = Array.from({ length: roundsFor(s, 'chain') }, (_, i) => newChainRound(cats[i % cats.length], i + 1, rng))
  rounds[0].turn = rng() < 0.5 ? 'A' : 'B'
  s.chain = { rounds, current: 0 }
  // The rounds now carry the lists they need; the rest needn't ride along on every move.
  s.chainCategories = []
  return rounds[0].over ? toChainEnd(s, now) : toChainTurn(s, now)
}

function toChainTurn(s: SessionState, now: number): SessionState {
  const round = s.chain!.rounds[s.chain!.current]
  s.phase = 'CHAIN_TURN'
  s.phaseEndsAt = now + turnMs(round)
  return s
}

function toChainEnd(s: SessionState, now: number): SessionState {
  s.chain!.rounds[s.chain!.current].over = true
  s.phase = 'CHAIN_END'
  s.phaseEndsAt = now + DURATIONS.CHAIN_END!
  return s
}

function advanceChain(state: SessionState, now: number): SessionState {
  const g = state.chain!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'CHAIN_RESULT')
  const s = clone(state)
  const prev = s.chain!.rounds[s.chain!.current]
  const starter = prev.chain[1]?.by ?? prev.turn
  s.chain!.current += 1
  const round = s.chain!.rounds[s.chain!.current]
  round.turn = prev.loser ?? other(starter)
  return round.over ? toChainEnd(s, now) : toChainTurn(s, now)
}

// ---------------------------------------------------------------- Perfect Circle

function newCircleRound(index: number) {
  return { index, drawn: { A: null, B: null }, score: { A: null, B: null } }
}

function beginCircle(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.circle = { rounds: [newCircleRound(1)], current: 0, bestOf: roundsFor(s, 'circle') }
  s.phase = 'CIRCLE_DRAW'
  s.phaseEndsAt = now + DURATIONS.CIRCLE_DRAW!
  return s
}

// Scored by the host from what was drawn; a circle that never came in is an empty one.
function toCircleReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = s.circle!.rounds[s.circle!.current]
  for (const p of PLAYERS) {
    round.drawn[p] ??= []
    round.score[p] = circleScore(round.drawn[p])
  }
  s.phase = 'CIRCLE_REVEAL'
  s.phaseEndsAt = now + DURATIONS.CIRCLE_REVEAL!
  return s
}

function advanceCircle(state: SessionState, now: number): SessionState {
  if (fillerOver({ kind: 'circle', game: state.circle! })) return toScoreboard(state, 'CIRCLE_RESULT')
  const s = clone(state)
  const c = s.circle!
  c.rounds.push(newCircleRound(c.rounds.length + 1))
  c.current = c.rounds.length - 1
  s.phase = 'CIRCLE_DRAW'
  s.phaseEndsAt = now + DURATIONS.CIRCLE_DRAW!
  return s
}

// ---------------------------------------------------------------- Spot It

// Pairs that are the same at a glance and different on a look — easier ones first.
const SPOT_PAIRS: [string, string][][] = [
  [['🍎', '🍏'], ['🐶', '🐱'], ['🌞', '🌝'], ['🚗', '🚕'], ['🍋', '🍊'], ['⭐', '🌟']],
  [['😀', '😃'], ['🕐', '🕑'], ['🌑', '🌒'], ['💛', '🧡'], ['🌷', '🌹'], ['🐻', '🐨'], ['🍩', '🥯']],
  [['😐', '😑'], ['🙂', '😊'], ['🔵', '🟣'], ['🕒', '🕓'], ['⏳', '⌛'], ['😄', '😁'], ['🚙', '🚗'], ['🌖', '🌗']],
]

function newSpotRound(s: SessionState, index: number): SpotRound {
  const rng = makeRng((s.seed ^ 0x5b07) + index * 104729)
  const tier = SPOT_PAIRS[Math.min(SPOT_PAIRS.length - 1, index - 1)]
  const [a, b] = tier[Math.floor(rng() * tier.length)]
  const [base, odd] = rng() < 0.5 ? [a, b] : [b, a]
  const size = Math.min(SPOT.maxSize, SPOT.firstSize + index - 1)
  return { index, size, base, odd, at: Math.floor(rng() * size * size), found: { A: null, B: null } }
}

function beginSpot(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.spot = { rounds: [newSpotRound(s, 1)], current: 0, bestOf: roundsFor(s, 'spot') }
  s.phase = 'SPOT_READY'
  s.phaseEndsAt = now + DURATIONS.SPOT_READY!
  return s
}

function toSpotStep(state: SessionState, now: number, phase: 'SPOT_READY' | 'SPOT_RUN' | 'SPOT_REVEAL'): SessionState {
  const s = clone(state)
  s.phase = phase
  s.phaseEndsAt = now + DURATIONS[phase]!
  return s
}

function advanceSpot(state: SessionState, now: number): SessionState {
  if (fillerOver({ kind: 'spot', game: state.spot! })) return toScoreboard(state, 'SPOT_RESULT')
  const s = clone(state)
  const g = s.spot!
  g.rounds.push(newSpotRound(s, g.rounds.length + 1))
  g.current = g.rounds.length - 1
  s.phase = 'SPOT_READY'
  s.phaseEndsAt = now + DURATIONS.SPOT_READY!
  return s
}

// ---------------------------------------------------------------- Frenzy

const newFrenzyRound = (index: number): FrenzyRound => ({ index, taps: { A: null, B: null } })

function beginFrenzy(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.frenzy = { rounds: [newFrenzyRound(1)], current: 0, bestOf: roundsFor(s, 'frenzy') }
  s.phase = 'FRENZY_READY'
  s.phaseEndsAt = now + DURATIONS.FRENZY_READY!
  return s
}

function toFrenzyStep(state: SessionState, now: number, phase: 'FRENZY_RUN' | 'FRENZY_REVEAL'): SessionState {
  const s = clone(state)
  s.phase = phase
  s.phaseEndsAt = now + (phase === 'FRENZY_RUN' ? FRENZY.runMs + FRENZY.graceMs : DURATIONS.FRENZY_REVEAL!)
  return s
}

function advanceFrenzy(state: SessionState, now: number): SessionState {
  if (fillerOver({ kind: 'frenzy', game: state.frenzy! })) return toScoreboard(state, 'FRENZY_RESULT')
  const s = clone(state)
  const g = s.frenzy!
  g.rounds.push(newFrenzyRound(g.rounds.length + 1))
  g.current = g.rounds.length - 1
  s.phase = 'FRENZY_READY'
  s.phaseEndsAt = now + DURATIONS.FRENZY_READY!
  return s
}

// ---------------------------------------------------------------- Follow Me

export const followShowMs = (length: number) => FOLLOW.showLeadMs + length * FOLLOW.stepMs
export const followPlayMs = (length: number) => FOLLOW.playLeadMs + length * FOLLOW.playMsPerStep

function toFollowShow(s: SessionState, now: number): SessionState {
  const g = s.follow!
  s.phase = 'FOLLOW_SHOW'
  s.phaseEndsAt = now + followShowMs(g.rounds[g.current].length)
  return s
}

function beginFollow(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const rng = makeRng(s.seed ^ 0xf011)
  // No pad twice in a row: a repeat flash is too easy to miss.
  const sequence: number[] = []
  while (sequence.length < FOLLOW.maxLength) {
    const pad = Math.floor(rng() * FOLLOW.pads)
    if (pad !== sequence[sequence.length - 1]) sequence.push(pad)
  }
  s.follow = { sequence, rounds: [{ index: 1, length: FOLLOW.firstLength, result: { A: null, B: null } }], current: 0, bestOf: 1 }
  return toFollowShow(s, now)
}

function toFollowPlay(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const g = s.follow!
  s.phase = 'FOLLOW_PLAY'
  s.phaseEndsAt = now + followPlayMs(g.rounds[g.current].length)
  return s
}

// Whoever never finished playing it back got none of it right in time.
function toFollowReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const round = s.follow!.rounds[s.follow!.current]
  for (const p of ['A', 'B'] as PlayerId[]) round.result[p] ??= { got: 0, ms: followPlayMs(round.length) }
  s.phase = 'FOLLOW_REVEAL'
  s.phaseEndsAt = now + DURATIONS.FOLLOW_REVEAL!
  return s
}

function advanceFollow(state: SessionState, now: number): SessionState {
  if (fillerOver({ kind: 'follow', game: state.follow! })) return toScoreboard(state, 'FOLLOW_RESULT')
  const s = clone(state)
  const g = s.follow!
  const last = g.rounds[g.current]
  g.rounds.push({ index: last.index + 1, length: last.length + 1, result: { A: null, B: null } })
  g.current = g.rounds.length - 1
  return toFollowShow(s, now)
}

// ---------------------------------------------------------------- Tongue Twisters

// Harder as it goes: the rounds climb from easy to hard across the game, each drawn from
// its level (or the nearest level that has any left).
function beginTwist(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const n = roundsFor(s, 'twist')
  const rng = makeRng(s.seed ^ 0x7157)
  const byLevel = [1, 2, 3].map((l) => shuffled(rng, (s.twisters ?? []).filter((t) => t.level === l)))
  const texts: string[] = []
  for (let i = 0; i < n; i++) {
    const want = Math.min(3, 1 + Math.floor((i * 3) / n))
    const order = [want, want + 1, want - 1, want + 2, want - 2].filter((l) => l >= 1 && l <= 3)
    const level = order.find((l) => byLevel[l - 1].length > 0)
    if (level === undefined) break
    texts.push(byLevel[level - 1].shift()!.text)
  }
  if (texts.length === 0) return skipTo(s, now, 'twist')
  const first: PlayerId = rng() < 0.5 ? 'A' : 'B'
  s.twist = {
    rounds: texts.map((text, i) => {
      const f = i % 2 === 0 ? first : other(first)
      return { index: i + 1, text, first: f, turn: f, said: { A: null, B: null } }
    }),
    current: 0,
  }
  s.twisters = [] // dealt: no need to carry the rest about
  s.phase = 'TWIST_SAY'
  s.phaseEndsAt = now + DURATIONS.TWIST_SAY!
  return s
}

// The judge has called it (or not in time — then it stands): the other's go, or the reveal.
function afterTwistTurn(state: SessionState, now: number, nailed: boolean): SessionState {
  const s = clone(state)
  const round = s.twist!.rounds[s.twist!.current]
  round.said[round.turn] = nailed
  const next = other(round.turn)
  if (round.said[next] === null) {
    round.turn = next
    s.phase = 'TWIST_SAY'
    s.phaseEndsAt = now + DURATIONS.TWIST_SAY!
  } else {
    s.phase = 'TWIST_REVEAL'
    s.phaseEndsAt = now + DURATIONS.TWIST_REVEAL!
  }
  return s
}

function advanceTwist(state: SessionState, now: number): SessionState {
  const g = state.twist!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'TWIST_RESULT')
  const s = clone(state)
  s.twist!.current += 1
  s.phase = 'TWIST_SAY'
  s.phaseEndsAt = now + DURATIONS.TWIST_SAY!
  return s
}

// ---------------------------------------------------------------- Higher or Lower

function beginHigher(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const items = shuffled(makeRng(s.seed ^ 0x41b1), s.higherLower ?? []).slice(0, roundsFor(s, 'higher'))
  if (items.length === 0) return skipTo(s, now, 'higher')
  s.higher = {
    rounds: items.map((item, i) => ({ index: i + 1, item, pick: { A: null, B: null }, ms: { A: null, B: null } })),
    current: 0,
  }
  s.higherLower = []
  s.phase = 'HL_PICK'
  s.phaseEndsAt = now + DURATIONS.HL_PICK!
  return s
}

function advanceHigher(state: SessionState, now: number): SessionState {
  const g = state.higher!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'HL_RESULT')
  const s = clone(state)
  s.higher!.current += 1
  s.phase = 'HL_PICK'
  s.phaseEndsAt = now + DURATIONS.HL_PICK!
  return s
}

// ---------------------------------------------------------------- Guesstimate

function beginGuess(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const items = shuffled(makeRng(s.seed ^ 0x6e55), s.guesstimates ?? []).slice(0, roundsFor(s, 'guess'))
  if (items.length === 0) return skipTo(s, now, 'guess')
  s.guess = {
    rounds: items.map((q, i) => ({ index: i + 1, question: q.question, answer: q.answer, guess: { A: null, B: null } })),
    current: 0,
  }
  s.guesstimates = []
  s.phase = 'GUESS_WRITE'
  s.phaseEndsAt = now + DURATIONS.GUESS_WRITE!
  return s
}

function advanceGuess(state: SessionState, now: number): SessionState {
  const g = state.guess!
  if (g.current >= g.rounds.length - 1) return toScoreboard(state, 'GUESS_RESULT')
  const s = clone(state)
  s.guess!.current += 1
  s.phase = 'GUESS_WRITE'
  s.phaseEndsAt = now + DURATIONS.GUESS_WRITE!
  return s
}

const toStep = (state: SessionState, now: number, phase: Phase): SessionState => {
  const s = clone(state)
  s.phase = phase
  s.phaseEndsAt = now + DURATIONS[phase]!
  return s
}

// ---------------------------------------------------------------- Stop the Clock

// The same clock runs two things: the filler (s.clock) and a level night's tiebreaker
// (s.decider). Each has its own phases, so the screens can tell them apart.
type ClockField = 'clock' | 'decider'
const CLOCK_PHASES = {
  clock: { ready: 'CLOCK_READY', run: 'CLOCK_RUN', reveal: 'CLOCK_REVEAL' },
  decider: { ready: 'DECIDER_READY', run: 'DECIDER_RUN', reveal: 'DECIDER_REVEAL' },
} as const

function clockFieldOf(phase: SessionState['phase']): ClockField | null {
  if (phase.startsWith('CLOCK_')) return 'clock'
  if (phase.startsWith('DECIDER_')) return 'decider'
  return null
}

// Seeded per round, so a replayed dead heat gets a fresh target.
function newClockRound(s: SessionState, field: ClockField, index: number): ClockRound {
  const rng = makeRng((s.seed ^ (field === 'clock' ? 0xc10c : 0xdec1)) + index * 7919)
  const tenths = (CLOCK.targetMax - CLOCK.targetMin) / 100
  const targetMs = CLOCK.targetMin + 100 * Math.floor(rng() * (tenths + 1))
  const hideAfterMs = field === 'decider' ? CLOCK.deciderHideAfter : (CLOCK.hideAfter[index - 1] ?? 0)
  return { index, targetMs, hideAfterMs, stopped: { A: null, B: null } }
}

function toClockReady(s: SessionState, now: number, field: ClockField): SessionState {
  s.phase = CLOCK_PHASES[field].ready
  s.phaseEndsAt = now + DURATIONS[CLOCK_PHASES[field].ready]!
  return s
}

function beginClock(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.clock = { rounds: [newClockRound(s, 'clock', 1)], current: 0, bestOf: roundsFor(s, 'clock') }
  return toClockReady(s, now, 'clock')
}

function beginDecider(state: SessionState, now: number): SessionState {
  const s = clone(state)
  s.decider = { rounds: [newClockRound(s, 'decider', 1)], current: 0, bestOf: 1 }
  return toClockReady(s, now, 'decider')
}

// Long enough for a tap at twice the target, plus a margin for the phone that got the
// start a moment late.
function toClockRun(state: SessionState, now: number, field: ClockField): SessionState {
  const s = clone(state)
  const g = s[field]!
  s.phase = CLOCK_PHASES[field].run
  s.phaseEndsAt = now + 2 * g.rounds[g.current].targetMs + CLOCK.graceMs
  return s
}

// No tap is the furthest miss there is.
function toClockReveal(state: SessionState, now: number, field: ClockField): SessionState {
  const s = clone(state)
  const g = s[field]!
  const round = g.rounds[g.current]
  for (const p of PLAYERS) round.stopped[p] ??= 2 * round.targetMs
  s.phase = CLOCK_PHASES[field].reveal
  s.phaseEndsAt = now + DURATIONS[CLOCK_PHASES[field].reveal]!
  return s
}

function nextClockRound(state: SessionState, now: number, field: ClockField): SessionState {
  const s = clone(state)
  const g = s[field]!
  g.rounds.push(newClockRound(s, field, g.rounds.length + 1))
  g.current = g.rounds.length - 1
  return toClockReady(s, now, field)
}

function advanceClock(state: SessionState, now: number, field: ClockField): SessionState {
  const g = state[field]!
  if (field === 'clock') {
    if (fillerOver({ kind: 'clock', game: g })) return toScoreboard(state, 'CLOCK_RESULT')
    return nextClockRound(state, now, field)
  }
  // The tiebreaker: sudden death, replayed on a dead heat — but not forever.
  const decided = clockRoundWinner(g.rounds[g.current]) !== null
  if (!decided && g.rounds.length < CLOCK.deciderMaxRounds) return nextClockRound(state, now, field)
  const endsOnLights = roster(state.game, state.night).some((e) => e.key === 'lights')
  return beginGame(state, now, endsOnLights ? 'lights' : null)
}

// ---------------------------------------------------------------- Lights Out

function beginLights(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.lightsQuestions.length === 0) return skipTo(s, now, 'lights')
  s.lights = { question: namedFor(s, oursFirst(makeRng(s.seed ^ 0x0ff), s.lightsQuestions, s.ours, text)[0]) }
  s.phase = 'LIGHTS_OUT'
  s.phaseEndsAt = null
  return s
}

// ---------------------------------------------------------------- reduce

// Where a pause makes sense: mid-game. Not before it starts or after it ends, and not
// during Stop the Clock's run — each phone times that on its own clock, which can't be
// stopped from here, so a pause there would cost someone the round.
const UNPAUSABLE = new Set<Phase>([
  'BOOT', 'JOIN', 'DONE', 'LIGHTS_OUT', 'CLOCK_READY', 'CLOCK_RUN', 'DECIDER_READY', 'DECIDER_RUN',
  'SPOT_READY', 'SPOT_RUN', 'FRENZY_READY', 'FRENZY_RUN', 'FOLLOW_SHOW', 'FOLLOW_PLAY',
])
export const canPause = (s: SessionState): boolean => !s.paused && !UNPAUSABLE.has(s.phase)

const bothHere = (s: SessionState) => s.players.A.connected && s.players.B.connected

// Nothing's in play before the game starts or after it's over, so leaving then doesn't
// pause anything — it just marks you gone.
const NOTHING_TO_HOLD = new Set<Phase>(['BOOT', 'JOIN', 'DONE'])

// Paused for someone who's away: the clock stops where it was, and (see JOIN) starts
// again when you're both back.
function holdFor(state: SessionState, player: PlayerId, now: number): SessionState {
  const s = clone(state)
  s.players[player].connected = false
  if (NOTHING_TO_HOLD.has(s.phase)) return s
  s.paused = s.paused
    ? { ...s.paused, away: true }
    : { by: player, leftMs: state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - now), away: true }
  s.phaseEndsAt = null
  return s
}

// A saved game, picked up again (from the room, or from a phone's own copy): nobody's in
// it yet, so it waits — paused, clock stopped — until you've both joined.
export function adopt(saved: SessionState, now: number): SessionState {
  let s = saved
  for (const p of PLAYERS) s = holdFor({ ...s, players: { ...s.players, [p]: { ...s.players[p], connected: true } } }, p, now)
  return s
}

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  if (action.type === 'AWAY') {
    if (!state.players[action.player].connected) return state
    return holdFor(state, action.player, now)
  }
  if (action.type === 'PAUSE') {
    if (!canPause(state)) return state
    const s = clone(state)
    s.paused = { by: action.player, leftMs: state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - now) }
    s.phaseEndsAt = null
    return s
  }
  if (action.type === 'RESUME') {
    if (!state.paused) return state
    if (state.paused.away && !bothHere(state)) return state // not without them
    const s = clone(state)
    // At least a couple of seconds back on the clock, so nobody resumes into a timeout.
    s.phaseEndsAt = state.paused.leftMs === null ? null : now + Math.max(state.paused.leftMs, 2000)
    s.paused = null
    return s
  }
  // Paused: nothing moves. A JOIN still lands (a phone reconnecting, or a rename).
  if (state.paused && action.type !== 'JOIN') return state
  return step(state, action, now)
}

function step(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = bothHere(s)
      // Straight into the first game in this session's roster.
      if (both && s.phase === 'JOIN') return beginGame(s, now, roster(s.game, s.night)[0]?.key ?? null)
      // Back after leaving: once you're both here again, carry on — with a few seconds
      // back on the clock to find your place.
      if (both && s.paused?.away) {
        s.phaseEndsAt = s.paused.leftMs === null ? null : now + Math.max(s.paused.leftMs, 5000)
        s.paused = null
      }
      return s
    }
    case 'PLACE_ITEM': {
      if (state.phase !== 'LIST_PLACE') return state
      const act = currentList(state)
      if (!act) return state
      const item = act.items[act.placeIndex]
      const byAuthor = action.player === act.author
      const already = byAuthor ? item.predictedSlot !== null : item.actualSlot !== null
      if (already) return state // no changing your mind once it lands
      if (action.slot < 1 || action.slot > LIST.items) return state
      if (usedSlots(act, byAuthor).has(action.slot)) return state // spent on an earlier item
      const s = clone(state)
      const mine = currentList(s)!
      const mineItem = mine.items[mine.placeIndex]
      if (byAuthor) mineItem.predictedSlot = action.slot
      else mineItem.actualSlot = action.slot
      return bothPlaced(mineItem) ? advancePlace(s, now) : s
    }
    case 'PICK_LIKELY': {
      if (state.phase !== 'LIKELY_ROUND' || !state.likely) return state
      if (currentLikely(state.likely).picks[action.player] !== null) return state // no changing your mind
      const s = clone(state)
      const round = currentLikely(s.likely!)
      round.picks[action.player] = action.pick
      return round.picks.A !== null && round.picks.B !== null ? toLikelyReveal(s, now) : s
    }
    case 'SUBMIT_CALLED': {
      if (state.phase !== 'FINGER_ROUND' || !state.finger) return state
      if (currentFingerRound(state.finger).answer[action.player] !== null) return state // sent is sent
      const s = clone(state)
      const round = currentFingerRound(s.finger!)
      round.answer[action.player] = !!action.answer
      round.predict[action.player] = !!action.predict
      return round.answer.A !== null && round.answer.B !== null ? toFingerReveal(s, now) : s
    }
    case 'SUBMIT_MRMRS': {
      if (state.phase !== 'MM_ANSWER' || !state.mrmrs) return state
      if (currentMm(state.mrmrs).answer[action.player] !== null) return state // sent is sent
      const answer = action.answer.trim().slice(0, MRMRS.maxLen)
      if (answer.length === 0) return state // your own answer can't be blank
      const s = clone(state)
      const round = currentMm(s.mrmrs!)
      round.answer[action.player] = answer
      round.predict[action.player] = action.predict.trim().slice(0, MRMRS.maxLen) || null
      return round.answer.A !== null && round.answer.B !== null ? toMmJudge(s, now) : s
    }
    case 'JUDGE': {
      if (state.phase !== 'MM_JUDGE' || !state.mrmrs) return state
      // You rule on the prediction ABOUT you, which was made by the other player.
      const predictor = other(action.player)
      if (currentMm(state.mrmrs).verdict[predictor] !== null) return state
      const s = clone(state)
      const round = currentMm(s.mrmrs!)
      round.verdict[predictor] = action.correct
      // Both ruled on: give the result a moment on screen, then move on.
      if (allJudged(round)) s.phaseEndsAt = now + DURATIONS.MM_JUDGE!
      return s
    }
    case 'SUBMIT_CLUE': {
      if (state.phase !== 'WAVE_CLUE') return state
      const w = state.wave
      if (!w) return state
      const i = pairOf(w).findIndex((r) => r.psychic === action.player && r.clue === null)
      if (i < 0) return state
      const text = action.text.trim().slice(0, WAVE.clueMaxLen)
      if (text.length === 0) return state
      const s = clone(state)
      const pair = pairOf(s.wave!)
      pair[i].clue = text
      return pair.every((r) => r.clue !== null) ? toWaveGuess(s, now) : s
    }
    case 'SUBMIT_GUESS': {
      if (state.phase !== 'WAVE_GUESS') return state
      const w = state.wave
      if (!w) return state
      const round = currentWaveRound(w)
      if (action.player !== other(round.psychic) || round.guess !== null) return state
      const value = Math.max(0, Math.min(100, Math.round(action.value)))
      return toWaveReveal(state, now, value)
    }
    case 'PICK_DRAW_ANSWER': {
      if (state.phase !== 'DRAW_SKETCH' || !state.draw) return state
      const round = currentDrawRound(state.draw)
      if (action.player !== round.drawer || round.answer !== null) return state
      const answer = action.answer.trim().slice(0, DRAW.guessMaxLen)
      if (answer.length === 0) return state // the drawing has to be OF something
      const s = clone(state)
      currentDrawRound(s.draw!).answer = answer
      return toDrawGuess(s, now)
    }
    case 'DRAW_STROKES': {
      if (state.phase !== 'DRAW_GUESS' || !state.draw) return state
      if (action.player !== currentDrawRound(state.draw).drawer) return state
      const s = clone(state)
      currentDrawRound(s.draw!).strokes = keepStrokes(action.strokes ?? [])
      return s
    }
    case 'SUBMIT_DRAW_GUESS': {
      if (state.phase !== 'DRAW_GUESS' || !state.draw) return state
      const round = currentDrawRound(state.draw)
      const guesses = round.guesses ?? []
      if (action.player !== other(round.drawer) || round.hitAt || guesses.length >= DRAW.maxGuesses) return state
      const text = action.text.trim().slice(0, DRAW.guessMaxLen)
      if (text.length === 0) return state
      // The same guess twice (a resend, a double tap) isn't a second go.
      if (guesses.some((g) => g.toLowerCase() === text.toLowerCase())) return state
      const s = clone(state)
      const r = currentDrawRound(s.draw!)
      r.guesses = [...guesses, text]
      if (isMatch(text, r.answer)) {
        r.hitAt = r.guesses.length
        return toDrawReveal(s, now)
      }
      return r.guesses.length >= DRAW.maxGuesses ? toDrawReveal(s, now) : s
    }
    case 'COUNT_IT': {
      if (state.phase !== 'DRAW_REVEAL' || !state.draw) return state
      const round = currentDrawRound(state.draw)
      const guesses = round.guesses ?? (round.guess ? [round.guess] : [])
      const i = action.index ?? guesses.length - 1
      // Only the drawer can wave a guess through, only once, and only a real guess at a
      // real answer.
      if (action.player !== round.drawer || round.correct || !round.answer || !guesses[i]) return state
      const s = clone(state)
      const r = currentDrawRound(s.draw!)
      r.hitAt = i + 1
      r.guess = guesses[i]
      r.correct = true
      return s
    }
    case 'SUBMIT_CLASH': {
      if (state.phase !== 'CLASH_WRITE' || !state.clash) return state
      const round = state.clash.rounds[state.clash.current]
      if (round.answers[action.player] !== null) return state // sent is sent
      const s = clone(state)
      const mine = s.clash!.rounds[s.clash!.current]
      mine.answers[action.player] = mine.categories.map((_, i) =>
        String(action.answers[i] ?? '').trim().slice(0, CLASH.maxLen))
      return mine.answers.A !== null && mine.answers.B !== null ? toClashReveal(s) : s
    }
    case 'CHALLENGE': {
      if (state.phase !== 'CLASH_REVEAL' || !state.clash) return state
      const round = state.clash.rounds[state.clash.current]
      // Any category the reveal has reached, and only an answer that's still scoring —
      // a blank, a wrong letter or a match is already worth nothing.
      if (action.index < 0 || action.index > round.revealIndex) return state
      const owner = other(action.player)
      if (clashVerdict(round, owner, action.index) !== 'scores') return state
      const s = clone(state)
      s.clash!.rounds[s.clash!.current].challenged[owner][action.index] = true
      return s
    }
    case 'SUBMIT_BLUFF': {
      if (state.phase !== 'BLUFF_WRITE' || !state.bluff) return state
      if (currentBluff(state.bluff).entry[action.player] !== null) return state // sent is sent
      const clean = (t: unknown) => String(t ?? '').trim().slice(0, BLUFF.maxLen)
      const truth = clean(action.truth)
      const lies: [string, string] = [clean(action.lies?.[0]), clean(action.lies?.[1])]
      if (!truth || !lies[0] || !lies[1]) return state
      const s = clone(state)
      const round = currentBluff(s.bluff!)
      round.entry[action.player] = { truth, lies }
      return round.entry.A && round.entry.B ? nextBluffStep(s, now) : s
    }
    case 'PICK_BLUFF': {
      if (state.phase !== 'BLUFF_PICK' || !state.bluff) return state
      const round = currentBluff(state.bluff)
      // Only the guesser picks, once, and only one of the three.
      if (action.player === round.turn || round.pick[round.turn] !== null) return state
      if (![0, 1, 2].includes(action.choice)) return state
      return toBluffReveal(state, action.choice)
    }
    case 'SUBMIT_MELD': {
      if (state.phase !== 'MELD_WRITE' || !state.meld) return state
      const live = currentMeld(state.meld)
      const t = live.tries.length - 1
      if (live.tries[t][action.player] !== null) return state // sent is sent
      const word = String(action.word ?? '').trim().slice(0, MELD.maxLen)
      if (!word) return state
      const s = clone(state)
      const words = currentMeld(s.meld!).tries[t]
      words[action.player] = word
      return words.A !== null && words.B !== null ? toMeldReveal(s, now) : s
    }
    case 'COUNT_MELD': {
      if (state.phase !== 'MELD_REVEAL' || !state.meld) return state
      const round = currentMeld(state.meld)
      const t = round.tries.length - 1
      const words = round.tries[t]
      if (round.matched !== null || action.try !== t || !words.A || !words.B) return state
      const s = clone(state)
      const mine = currentMeld(s.meld!)
      mine.matched = t
      mine.counted = true
      // A moment to enjoy it before the next prompt.
      s.phaseEndsAt = now + DURATIONS.MELD_REVEAL!
      return s
    }
    case 'DESCRIBE_GOT':
    case 'DESCRIBE_SKIP': {
      if (state.phase !== 'DESCRIBE_RUN' || !state.describe) return state
      if (currentDescribe(state.describe).describer !== action.player) return state
      // For a word already dealt with (a slow tap, a second press): nothing more to do.
      if (action.at !== undefined && action.at !== state.describe.next) return state
      const s = clone(state)
      const g = s.describe!
      const turn = currentDescribe(g)
      ;(action.type === 'DESCRIBE_GOT' ? turn.got : turn.skipped).push(describeWord(g))
      g.next += 1
      return s
    }
    case 'CHAIN_WORD': {
      if (state.phase !== 'CHAIN_TURN' || !state.chain) return state
      const live = state.chain.rounds[state.chain.current]
      if (live.over || live.turn !== action.player) return state
      const typed = action.word.trim().slice(0, CHAIN.maxLen)
      if (!typed) return state
      const s = clone(state)
      const round = s.chain!.rounds[s.chain!.current]
      const check = checkWord(round, typed)
      // Turned back, with the reason on screen — but the clock doesn't stop for it.
      if (!check.ok) {
        round.reject = { player: action.player, word: typed, reason: check.reason }
        return s
      }
      round.chain.push({ word: check.word, by: action.player, listed: check.listed, need: round.need })
      round.reject = null
      const need = nextLetter(round, check.word)
      if (need === null) return toChainEnd(s, now) // nothing left that could follow: nobody's fault
      round.need = need
      round.turn = other(action.player)
      return toChainTurn(s, now)
    }
    case 'CHAIN_REJECT': {
      if (state.phase !== 'CHAIN_TURN' || !state.chain) return state
      const live = state.chain.rounds[state.chain.current]
      if (live.turn !== action.player) return state
      const last = rejectable(live)
      if (!last) return state
      const s = clone(state)
      const round = s.chain!.rounds[s.chain!.current]
      round.chain.pop()
      round.banned = [...(round.banned ?? []), chainKey(last.word)]
      round.turn = last.by!
      round.need = last.need ?? round.need
      round.reject = { player: last.by!, word: last.word, reason: 'rejected' }
      return toChainTurn(s, now)
    }
    case 'TWIST_JUDGE': {
      if (state.phase !== 'TWIST_SAY' || !state.twist) return state
      const round = state.twist.rounds[state.twist.current]
      if (action.player === round.turn) return state // not your own go
      return afterTwistTurn(state, now, !!action.nailed)
    }
    case 'HL_PICK': {
      if (state.phase !== 'HL_PICK' || !state.higher) return state
      const round = state.higher.rounds[state.higher.current]
      if (round.pick[action.player] !== null || (action.pick !== 'a' && action.pick !== 'b')) return state
      const s = clone(state)
      const r = s.higher!.rounds[s.higher!.current]
      r.pick[action.player] = action.pick
      r.ms[action.player] = Math.max(0, Math.round(action.ms) || 0)
      return r.pick.A !== null && r.pick.B !== null ? toStep(s, now, 'HL_REVEAL') : s
    }
    case 'GUESS_SUBMIT': {
      if (state.phase !== 'GUESS_WRITE' || !state.guess) return state
      const round = state.guess.rounds[state.guess.current]
      if (round.guess[action.player] !== null || !Number.isFinite(action.value) || action.value < 0) return state
      const s = clone(state)
      const r = s.guess!.rounds[s.guess!.current]
      r.guess[action.player] = Math.round(action.value)
      return r.guess.A !== null && r.guess.B !== null ? toStep(s, now, 'GUESS_REVEAL') : s
    }
    case 'SPOT_FOUND': {
      if (state.phase !== 'SPOT_RUN' || !state.spot) return state
      const round = state.spot.rounds[state.spot.current]
      if (round.found[action.player] !== null || !(action.ms >= 0)) return state
      const s = clone(state)
      const r = s.spot!.rounds[s.spot!.current]
      r.found[action.player] = Math.round(action.ms)
      return r.found.A !== null && r.found.B !== null ? toSpotStep(s, now, 'SPOT_REVEAL') : s
    }
    case 'FRENZY_TAPS': {
      if (state.phase !== 'FRENZY_RUN' || !state.frenzy) return state
      const round = state.frenzy.rounds[state.frenzy.current]
      if (round.taps[action.player] !== null) return state
      const s = clone(state)
      const r = s.frenzy!.rounds[s.frenzy!.current]
      r.taps[action.player] = Math.max(0, Math.min(FRENZY.maxTaps, Math.round(action.taps) || 0))
      return r.taps.A !== null && r.taps.B !== null ? toFrenzyStep(s, now, 'FRENZY_REVEAL') : s
    }
    case 'FOLLOW_DONE': {
      if (state.phase !== 'FOLLOW_PLAY' || !state.follow) return state
      const round = state.follow.rounds[state.follow.current]
      if (round.result[action.player] !== null) return state
      const s = clone(state)
      const r = s.follow!.rounds[s.follow!.current]
      r.result[action.player] = { got: Math.max(0, Math.min(r.length, Math.round(action.got) || 0)), ms: Math.max(0, Math.round(action.ms) || 0) }
      return r.result.A !== null && r.result.B !== null ? toFollowReveal(s, now) : s
    }
    case 'SUBMIT_CIRCLE': {
      if (state.phase !== 'CIRCLE_DRAW' || !state.circle) return state
      const round = state.circle.rounds[state.circle.current]
      if (round.drawn[action.player] !== null) return state // one go
      const s = clone(state)
      const mine = s.circle!.rounds[s.circle!.current]
      mine.drawn[action.player] = keepCircle(action.strokes)
      return mine.drawn.A !== null && mine.drawn.B !== null ? toCircleReveal(s, now) : s
    }
    case 'STOP_CLOCK': {
      const field = clockFieldOf(state.phase)
      if (!field) return state
      // A tap that only reached the host after it called time: the reveal is up, with this
      // player down as not having tapped — but they did, so it counts.
      if (state.phase === CLOCK_PHASES[field].reveal) {
        const g = state[field]!
        const round = g.rounds[g.current]
        const ms = Math.round(Math.max(0, action.elapsedMs))
        if (round.stopped[action.player] !== 2 * round.targetMs || ms >= 2 * round.targetMs) return state
        const s = clone(state)
        s[field]!.rounds[s[field]!.current].stopped[action.player] = ms
        return s
      }
      if (state.phase !== CLOCK_PHASES[field].run) return state
      const g = state[field]!
      const round = g.rounds[g.current]
      if (round.stopped[action.player] !== null) return state // one tap
      const s = clone(state)
      const mine = s[field]!.rounds[s[field]!.current]
      mine.stopped[action.player] = Math.round(Math.min(2 * round.targetMs, Math.max(0, action.elapsedMs)))
      return mine.stopped.A !== null && mine.stopped.B !== null ? toClockReveal(s, now, field) : s
    }
    case 'READY': {
      if (state.phase !== 'INTRO' || !state.intro || state.intro.ready[action.player]) return state
      const s = clone(state)
      s.intro!.ready[action.player] = true
      return s.intro!.ready.A && s.intro!.ready.B ? endIntro(s, now) : s
    }
    case 'CONTINUE': {
      if (!TAP_THROUGH.has(state.phase)) return state
      return afterScoreboard(state, now)
    }
    case 'ADVANCE_REVEAL': {
      if (state.phase === 'CLASH_REVEAL') return advanceClash(state, now)
      if (state.phase === 'BLUFF_REVEAL') return nextBluffStep(state, now)
      if (state.phase !== 'LIST_REVEAL') return state
      return advanceReveal(state, now)
    }
    case 'TIMEOUT': {
      switch (state.phase) {
        case 'LIST_INTRO': return toListPlace(state, now)
        case 'LIST_PLACE': return timeoutPlace(state, now)
        case 'LIST_REVEAL': return advanceReveal(state, now)
        case 'LIKELY_ROUND': return toLikelyReveal(state, now)
        case 'LIKELY_REVEAL': return advanceLikely(state, now)
        case 'FINGER_ROUND': return toFingerReveal(state, now)
        case 'FINGER_REVEAL': return advanceFinger(state, now)
        // Whatever was typed in time goes to the reveal; a missing answer can't be
        // guessed at, so the prediction about it simply misses.
        case 'MM_ANSWER': return toMmJudge(state, now)
        // Reached either after both rulings (the short linger) or from the debug skip —
        // anything still unruled on counts as a miss.
        case 'MM_JUDGE': {
          const s = clone(state)
          const round = currentMm(s.mrmrs!)
          for (const p of PLAYERS) if (round.verdict[p] === null) round.verdict[p] = false
          return advanceMm(s, now)
        }
        // A clue nobody gave still lets the round play out — a blind guess costs nothing
        // it wouldn't have anyway.
        case 'WAVE_CLUE': return toWaveGuess(state, now)
        // A guess nobody made defaults to dead centre — a genuinely neutral non-answer.
        case 'WAVE_GUESS': return toWaveReveal(state, now, currentWaveRound(state.wave!).guess ?? 50)
        case 'WAVE_REVEAL': return advanceWave(state, now)
        // A drawing nobody finished still lets the round play out — sketching nothing,
        // of nothing, so no guess can match it.
        case 'DRAW_SKETCH': return toDrawReveal(state, now) // no answer, nothing to draw
        // A guess nobody made just misses — an empty guess never accidentally matches.
        case 'DRAW_GUESS': return toDrawReveal(state, now)
        case 'DRAW_REVEAL': return advanceDraw(state, now)
        case 'INTRO': return state.intro ? endIntro(state, now) : state
        case 'CHAIN_TURN': {
          const s = clone(state)
          const round = s.chain!.rounds[s.chain!.current]
          round.loser = round.turn
          return toChainEnd(s, now)
        }
        case 'CHAIN_END': return advanceChain(state, now)
        // Only what came in gets guessed at; anyone whose three never came is skipped.
        case 'DESCRIBE_READY': {
          const s = clone(state)
          s.phase = 'DESCRIBE_RUN'
          s.phaseEndsAt = now + DURATIONS.DESCRIBE_RUN!
          return s
        }
        case 'DESCRIBE_RUN': return afterDescribeTurn(state, now)
        case 'MELD_WRITE': return toMeldReveal(state, now)
        case 'MELD_REVEAL': return advanceMeld(state, now)
        case 'BLUFF_WRITE': return nextBluffStep(state, now)
        // No pick in time counts as fooled.
        case 'BLUFF_PICK': return toBluffReveal(state, -1)
        case 'BLUFF_REVEAL': return nextBluffStep(state, now)
        case 'CLASH_WRITE': return toClashReveal(state)
        case 'CLASH_REVEAL': return advanceClash(state, now)
        case 'CIRCLE_DRAW': return toCircleReveal(state, now)
        case 'CIRCLE_REVEAL': return advanceCircle(state, now)
        case 'TWIST_SAY': return afterTwistTurn(state, now, true) // not called in time: it stands
        case 'TWIST_REVEAL': return advanceTwist(state, now)
        case 'HL_PICK': return toStep(state, now, 'HL_REVEAL')
        case 'HL_REVEAL': return advanceHigher(state, now)
        case 'GUESS_WRITE': return toStep(state, now, 'GUESS_REVEAL')
        case 'GUESS_REVEAL': return advanceGuess(state, now)
        case 'SPOT_READY': return toSpotStep(state, now, 'SPOT_RUN')
        case 'SPOT_RUN': return toSpotStep(state, now, 'SPOT_REVEAL')
        case 'SPOT_REVEAL': return advanceSpot(state, now)
        case 'FRENZY_READY': return toFrenzyStep(state, now, 'FRENZY_RUN')
        case 'FRENZY_RUN': return toFrenzyStep(state, now, 'FRENZY_REVEAL')
        case 'FRENZY_REVEAL': return advanceFrenzy(state, now)
        case 'FOLLOW_SHOW': return toFollowPlay(state, now)
        case 'FOLLOW_PLAY': return toFollowReveal(state, now)
        case 'FOLLOW_REVEAL': return advanceFollow(state, now)
        case 'CLOCK_READY': return toClockRun(state, now, 'clock')
        case 'CLOCK_RUN': return toClockReveal(state, now, 'clock')
        case 'CLOCK_REVEAL': return advanceClock(state, now, 'clock')
        case 'DECIDER_READY': return toClockRun(state, now, 'decider')
        case 'DECIDER_RUN': return toClockReveal(state, now, 'decider')
        case 'DECIDER_REVEAL': return advanceClock(state, now, 'decider')
        // The tap-through phases still answer to TIMEOUT, so the debug skip works on them.
        default:
          return TAP_THROUGH.has(state.phase) ? afterScoreboard(state, now) : state
      }
    }
    default:
      return state
  }
}
