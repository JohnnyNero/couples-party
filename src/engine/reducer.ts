import type {
  Action, ChainCategory, ChainRound, ClashRound, ClockRound, DrawGame, DrawStroke, FingerGame, GameKey, LikelyGame, ListAct, ListItem, MrMrsGame,
  Phase, PlayerId, SessionState, WaveGame,
} from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, oursFirst, pick, shuffled } from './rng'
import { CHAIN, CLASH, CLOCK, DRAW, DURATIONS, FINGER, LIST, MRMRS, WAVE } from './phases'
import { clashVerdict } from './clash'
import { checkWord, nextLetter, turnMs } from './chain'
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
  s.phaseEndsAt = now + DURATIONS.INTRO!
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
    case 'circle': return beginCircle(state, now)
    case 'clock': return beginClock(state, now)
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
  'CLASH_RESULT', 'CHAIN_RESULT', 'CIRCLE_RESULT', 'CLOCK_RESULT', 'LIGHTS_OUT',
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

// ---------------------------------------------------------------- Put a Finger Down

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
    applies: { A: null, B: null } as Record<PlayerId, boolean | null>,
  }))
  if (rounds.length === 0) return skipTo(s, now, 'finger')
  s.finger = { rounds, current: 0, fingersLeft: { A: FINGER.startFingers, B: FINGER.startFingers } }
  s.phase = 'FINGER_ROUND'
  s.phaseEndsAt = now + DURATIONS.FINGER_ROUND!
  return s
}

// A statement nobody answered in time counts as "doesn't apply" for both — an unopened
// hand, not a forced confession.
function toFingerReveal(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const f = s.finger!
  const round = currentFingerRound(f)
  for (const p of PLAYERS) {
    if (round.applies[p]) f.fingersLeft[p] = Math.max(0, f.fingersLeft[p] - 1)
  }
  s.phase = 'FINGER_REVEAL'
  s.phaseEndsAt = now + DURATIONS.FINGER_REVEAL!
  return s
}

// All the statements, then it's over — least fingers down wins, not first to zero.
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

// Generated in full up front — spectrum, psychic and hidden target for every round —
// the same way Put a Finger Down pre-picks its statements, and for the same reason:
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
      psychic: (i % 2 === 0 ? 'A' : 'B') as PlayerId,
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

function toWaveGuess(state: SessionState, now: number, clue: string): SessionState {
  const s = clone(state)
  currentWaveRound(s.wave!).clue = clue
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
  s.wave!.current += 1
  s.phase = 'WAVE_CLUE'
  s.phaseEndsAt = now + DURATIONS.WAVE_CLUE!
  return s
}

// ---------------------------------------------------------------- Draw Your Answer

function currentDrawRound(d: DrawGame) {
  return d.rounds[d.current]
}

// Generated in full up front — question and drawer for every round. Drawers alternate,
// so a two-round Tonight is one drawing each.
function beginDraw(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.drawPrompts.length === 0) return skipTo(s, now, 'draw')
  const rng = makeRng(s.seed ^ 0xd001)
  const prompts = shuffled(rng, s.drawPrompts)
  const rounds = Array.from({ length: roundsFor(s, 'draw') }, (_, i) => ({
    index: i + 1,
    drawer: (i % 2 === 0 ? 'A' : 'B') as PlayerId,
    promptId: prompts[i % prompts.length].id,
    answer: null,
    strokes: [] as DrawStroke[],
    guess: null,
    correct: null,
  }))
  s.draw = { rounds, current: 0 }
  s.phase = 'DRAW_SKETCH'
  s.phaseEndsAt = now + DURATIONS.DRAW_SKETCH!
  return s
}

function toDrawGuess(state: SessionState, now: number, answer: string, strokes: DrawStroke[]): SessionState {
  const s = clone(state)
  const round = currentDrawRound(s.draw!)
  round.answer = answer
  round.strokes = strokes
  s.phase = 'DRAW_GUESS'
  s.phaseEndsAt = now + DURATIONS.DRAW_GUESS!
  return s
}

// Checked against what the drawer SAID they were drawing — their own answer, not a
// fixed word. A near miss can still be counted by the drawer from the reveal.
function toDrawReveal(state: SessionState, now: number, guess: string): SessionState {
  const s = clone(state)
  const round = currentDrawRound(s.draw!)
  round.guess = guess
  round.correct = isMatch(guess, round.answer)
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

// ---------------------------------------------------------------- Word Chain

// Every round is dealt up front — its category, its answer list and the app's opening
// word — but who goes first is only settled when it starts: the loser of the round before.
function newChainRound(cat: ChainCategory, index: number, rng: () => number): ChainRound {
  const opener = pick(rng, cat.words)
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
const UNPAUSABLE = new Set<Phase>(['BOOT', 'JOIN', 'DONE', 'LIGHTS_OUT', 'CLOCK_READY', 'CLOCK_RUN', 'DECIDER_READY', 'DECIDER_RUN'])
export const canPause = (s: SessionState): boolean => !s.paused && !UNPAUSABLE.has(s.phase)

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  if (action.type === 'PAUSE') {
    if (!canPause(state)) return state
    const s = clone(state)
    s.paused = { by: action.player, leftMs: state.phaseEndsAt === null ? null : Math.max(0, state.phaseEndsAt - now) }
    s.phaseEndsAt = null
    return s
  }
  if (action.type === 'RESUME') {
    if (!state.paused) return state
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
      const both = s.players.A.connected && s.players.B.connected
      // Straight into the first game in this session's roster.
      if (both && s.phase === 'JOIN') return beginGame(s, now, roster(s.game, s.night)[0]?.key ?? null)
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
    case 'SUBMIT_FINGER': {
      if (state.phase !== 'FINGER_ROUND') return state
      const f = state.finger
      if (!f) return state
      const round = currentFingerRound(f)
      if (round.applies[action.player] !== null) return state // no changing your mind
      const s = clone(state)
      const sr = currentFingerRound(s.finger!)
      sr.applies[action.player] = action.applies
      if (sr.applies.A !== null && sr.applies.B !== null) return toFingerReveal(s, now)
      return s
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
      const round = currentWaveRound(w)
      if (action.player !== round.psychic || round.clue !== null) return state
      const text = action.text.trim().slice(0, WAVE.clueMaxLen)
      if (text.length === 0) return state
      return toWaveGuess(state, now, text)
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
    case 'SUBMIT_DRAWING': {
      if (state.phase !== 'DRAW_SKETCH') return state
      const d = state.draw
      if (!d) return state
      const round = currentDrawRound(d)
      if (action.player !== round.drawer) return state
      const answer = action.answer.trim().slice(0, DRAW.guessMaxLen)
      if (answer.length === 0) return state // the drawing has to be OF something
      return toDrawGuess(state, now, answer, action.strokes)
    }
    case 'SUBMIT_DRAW_GUESS': {
      if (state.phase !== 'DRAW_GUESS') return state
      const d = state.draw
      if (!d) return state
      const round = currentDrawRound(d)
      if (action.player !== other(round.drawer) || round.guess !== null) return state
      const text = action.text.trim().slice(0, DRAW.guessMaxLen)
      return toDrawReveal(state, now, text)
    }
    case 'COUNT_IT': {
      if (state.phase !== 'DRAW_REVEAL' || !state.draw) return state
      const round = currentDrawRound(state.draw)
      // Only the drawer can wave a guess through, only once, and only a real guess at a
      // real answer.
      if (action.player !== round.drawer || round.correct || !round.guess || !round.answer) return state
      const s = clone(state)
      currentDrawRound(s.draw!).correct = true
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
      round.chain.push({ word: check.word, by: action.player })
      round.reject = null
      const need = nextLetter(round, check.word)
      if (need === null) return toChainEnd(s, now) // nothing left that could follow: nobody's fault
      round.need = need
      round.turn = other(action.player)
      return toChainTurn(s, now)
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
      if (!field || state.phase !== CLOCK_PHASES[field].run) return state
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
        case 'WAVE_CLUE': return toWaveGuess(state, now, currentWaveRound(state.wave!).clue ?? '(no clue)')
        // A guess nobody made defaults to dead centre — a genuinely neutral non-answer.
        case 'WAVE_GUESS': return toWaveReveal(state, now, currentWaveRound(state.wave!).guess ?? 50)
        case 'WAVE_REVEAL': return advanceWave(state, now)
        // A drawing nobody finished still lets the round play out — sketching nothing,
        // of nothing, so no guess can match it.
        case 'DRAW_SKETCH': {
          const round = currentDrawRound(state.draw!)
          return toDrawGuess(state, now, round.answer ?? '', round.strokes)
        }
        // A guess nobody made just misses — an empty guess never accidentally matches.
        case 'DRAW_GUESS': return toDrawReveal(state, now, currentDrawRound(state.draw!).guess ?? '')
        case 'DRAW_REVEAL': return advanceDraw(state, now)
        case 'INTRO': return state.intro ? endIntro(state, now) : state
        case 'CHAIN_TURN': {
          const s = clone(state)
          const round = s.chain!.rounds[s.chain!.current]
          round.loser = round.turn
          return toChainEnd(s, now)
        }
        case 'CHAIN_END': return advanceChain(state, now)
        case 'CLASH_WRITE': return toClashReveal(state)
        case 'CLASH_REVEAL': return advanceClash(state, now)
        case 'CIRCLE_DRAW': return toCircleReveal(state, now)
        case 'CIRCLE_REVEAL': return advanceCircle(state, now)
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
