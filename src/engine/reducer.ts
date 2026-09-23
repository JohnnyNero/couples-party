import type {
  Action, DrawGame, DrawStroke, FingerGame, GameKey, LikelyGame, ListAct, ListItem, MrMrsGame,
  PlayerId, SessionState, WaveGame,
} from './state'
import { other } from './state'
import { isMatch } from './match'
import { makeRng, pick, shuffled } from './rng'
import { DRAW, DURATIONS, FINGER, LIST, MRMRS, WAVE } from './phases'
import { lowestFreeSlot, usedSlots } from './list'
import { gameOfPhase, nextGame, roster, roundsFor } from './roster'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const PLAYERS: PlayerId[] = ['A', 'B']

// ---------------------------------------------------------------- The roster

// Start a game by key. Every begin* below returns the session parked on that game's
// first phase — or, if the content file gave it nothing to play, hands straight on to
// the next game rather than opening an empty one.
function beginGame(state: SessionState, now: number, key: GameKey | null): SessionState {
  switch (key) {
    case 'list': return beginList(state, now, 'A')
    case 'likely': return beginLikely(state, now)
    case 'finger': return beginFinger(state, now)
    case 'mrmrs': return beginMrMrs(state, now)
    case 'wave': return beginWave(state, now)
    case 'draw': return beginDraw(state, now)
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
  'LIGHTS_OUT',
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

function beginFinger(state: SessionState, now: number): SessionState {
  const s = clone(state)
  const pool = shuffled(makeRng(s.seed ^ 0x9001), s.fingerStatements)
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
  const questions = shuffled(makeRng(s.seed ^ 0x3303), s.mrmrsQuestions)
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
  const spectrums = shuffled(rng, s.spectrums)
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

// ---------------------------------------------------------------- Lights Out

function beginLights(state: SessionState, now: number): SessionState {
  const s = clone(state)
  if (s.lightsQuestions.length === 0) return skipTo(s, now, 'lights')
  s.lights = { question: pick(makeRng(s.seed ^ 0x0ff), s.lightsQuestions) }
  s.phase = 'LIGHTS_OUT'
  s.phaseEndsAt = null
  return s
}

// ---------------------------------------------------------------- reduce

export function reduce(state: SessionState, action: Action, now: number): SessionState {
  switch (action.type) {
    case 'JOIN': {
      const s = clone(state)
      s.players[action.player] = { name: action.name, connected: true }
      const both = s.players.A.connected && s.players.B.connected
      // Straight into the first game in this session's roster.
      if (both && s.phase === 'JOIN') return beginGame(s, now, roster(s.game)[0]?.key ?? null)
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
      // Only the drawer can wave a guess through, only once, and only a real guess.
      if (action.player !== round.drawer || round.correct || !round.guess) return state
      const s = clone(state)
      currentDrawRound(s.draw!).correct = true
      return s
    }
    case 'CONTINUE': {
      if (!TAP_THROUGH.has(state.phase)) return state
      return afterScoreboard(state, now)
    }
    case 'ADVANCE_REVEAL': {
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
        // The tap-through phases still answer to TIMEOUT, so the debug skip works on them.
        default:
          return TAP_THROUGH.has(state.phase) ? afterScoreboard(state, now) : state
      }
    }
    default:
      return state
  }
}
