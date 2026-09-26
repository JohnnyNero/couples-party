import type { GameKey, SessionState } from '../engine/state'
import { roster, roundsFor } from '../engine/roster'
import { SCORING, shown } from '../engine/standing'
import { CLASH_POINTS } from '../engine/clash'

// Each game's title card: three steps, in plain words, and a line on how long it runs.
// Points on these cards are this session's: every game is worth the same to the night,
// so a game with fewer rounds pays more for each one (see standing.ts).
export function introSteps(s: SessionState, key: Exclude<GameKey, 'lights'>): [string, string, string] {
  const pts = (k: GameKey, raw: number) => shown(s, k, raw)
  const team = (k: GameKey, raw: number) => shown(s, k, raw, 'us')
  const STEPS: Record<Exclude<GameKey, 'lights'>, [string, string, string]> = {
  list: [
    'A theme about one of you, and seven things, one at a time.',
    'The other ranks each one 1 to 7 as it comes. No moving it after.',
    `The one it’s about guesses the order. Spot on scores ${pts('list', SCORING.listExact)}, one out scores ${pts('list', SCORING.listNear)}.`,
  ],
  likely: [
    'A “who’s more likely to…” comes up.',
    'You each tap a name, in secret.',
    'Name the same person and you both score.',
  ],
  finger: [
    'A statement comes up, like “you’ve stolen the blanket”.',
    'Say if it’s true for you — and call whether it’s true for them.',
    `Every right call scores you ${pts('finger', SCORING.calledRight)}, and the team ${team('finger', 1)}.`,
  ],
  wave: [
    'You each get a scale, like Cold ↔ Hot, with a hidden mark on it.',
    'At the same time, you each name one thing that sits right on yours.',
    'Then one at a time, the other slides to where they reckon it is. Closer scores more.',
  ],
  mrmrs: [
    'A question about yourselves, like “your comfort meal?”.',
    'Type your own answer, and your guess at theirs.',
    `They rule on your guess. Right scores you ${pts('mrmrs', SCORING.mrmrsRight)}, and the team ${team('mrmrs', 1)}.`,
  ],
  draw: [
    'You each get a question about yourself — say, your dream pet.',
    'At the same time, answer it in secret and draw your answer. No words.',
    `Then one at a time, the other gets one guess. Getting it scores ${pts('draw', SCORING.drawCorrect)}.`,
  ],
  clash: [
    'A letter and six categories.',
    'A minute to write one for each, starting with that letter.',
    `Unique answers score ${pts('clash', CLASH_POINTS.unique)} each. Say the same thing and it’s a team point instead.`,
  ],
  chain: [
    'A category, and a word to start from.',
    'Take turns naming one that starts with the last word’s last letter.',
    'Run out of time and your partner takes the round.',
  ],
  bluff: [
    'A prompt about yourselves, like “your worst ever present”.',
    'You each write the truth and two believable lies, at the same time.',
    `Then one at a time: spot their truth for ${pts('bluff', SCORING.bluffSpotted)}, or they score ${pts('bluff', SCORING.bluffFooled)} for fooling you.`,
  ],
  meld: [
    'A prompt, like “our go-to takeaway”. You both type an answer at once.',
    'Say the same thing and it’s a mind meld. If not, you see both — go again for the word in between.',
    `Three tries a prompt. It’s a team game: ${team('meld', 3)} for meeting first time, less for each extra try.`,
  ],
  circle: [
    'One go each at drawing a perfect circle.',
    'Lifting your finger sends it.',
    'The rounder one wins 5.',
  ],
  clock: [
    'A target time, then a clock starts on your phone.',
    'It disappears. Tap Stop when you think it’s there.',
    'Closest wins the round.',
  ],
  }
  return STEPS[key]
}

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']
const n = (k: number) => WORDS[k] ?? String(k)

export function introSub(s: SessionState, key: GameKey): string {
  const r = roundsFor(s, key)
  switch (key) {
    case 'list': return r === 2 ? 'Two acts — you each rank once.' : `${n(r)} acts.`
    case 'wave': return r === 2 ? 'One clue each.' : `${n(Math.ceil(r / 2))} rounds — a clue each in every one.`
    case 'draw': return r === 2 ? 'One drawing each.' : `${n(Math.ceil(r / 2))} rounds — a drawing each in every one.`
    case 'circle': return r === 1 ? 'A quick one — thirty seconds.' : `Best of ${r}.`
    case 'clock': return `A quick one — first to ${Math.ceil(r / 2)} rounds.`
    default: return `${n(r)} round${r === 1 ? '' : 's'}.`
  }
}

// "Game 2 of 4" — counting the proper games only; a filler is just a quick one.
export function gameNumber(s: SessionState, key: GameKey): { n: number; of: number } | null {
  const games: GameKey[] = roster(s.game, s.night).map((e) => e.key).filter((k) => k !== 'lights' && k !== 'circle' && k !== 'clock')
  const i = games.indexOf(key)
  return i < 0 || games.length < 2 ? null : { n: i + 1, of: games.length }
}
