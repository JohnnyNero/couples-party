import type { GameKey, SessionState } from '../engine/state'
import { roster, roundsFor } from '../engine/roster'

// Each game's title card: three steps, in plain words, and a line on how long it runs.
export const INTRO_STEPS: Record<Exclude<GameKey, 'lights'>, [string, string, string]> = {
  list: [
    'A theme about one of you, and seven things, one at a time.',
    'The other ranks each one 1 to 7 as it comes. No moving it after.',
    'The one it’s about guesses the order. Spot on scores 3, one out scores 1.',
  ],
  likely: [
    'A “who’s more likely to…” comes up.',
    'You each tap a name, in secret.',
    'Name the same person and you both score.',
  ],
  finger: [
    'A confession comes up, like “you’ve stolen the blanket”.',
    'Put a finger down if it’s true. Nobody sees your phone.',
    'Every finger you keep up is worth 8.',
  ],
  wave: [
    'One of you sees a hidden mark on a scale, like Cold ↔ Hot.',
    'They name one thing that sits right on it.',
    'The other slides to where they reckon it is. Closer scores more.',
  ],
  mrmrs: [
    'A question about yourselves, like “your comfort meal?”.',
    'Type your own answer, and your guess at theirs.',
    'They rule on your guess. Right is worth 8.',
  ],
  draw: [
    'You get a question about yourself — say, your dream pet.',
    'Answer it in secret, then draw your answer. No words.',
    'They get one guess. If they get it, they score 6.',
  ],
  clash: [
    'A letter and six categories.',
    'A minute to write one for each, starting with that letter.',
    'Unique answers score 2. Say the same as your partner and neither of you does.',
  ],
  chain: [
    'A category, and a word to start from.',
    'Take turns naming one that starts with the last word’s last letter.',
    'Run out of time and your partner takes the round.',
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

const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven']
const n = (k: number) => WORDS[k] ?? String(k)

export function introSub(s: SessionState, key: GameKey): string {
  const r = roundsFor(s, key)
  switch (key) {
    case 'list': return r === 2 ? 'Two acts — you each rank once.' : `${n(r)} acts.`
    case 'wave': return r === 2 ? 'Two rounds, one each as the one who knows.' : `${n(r)} rounds, taking turns as the one who knows.`
    case 'draw': return r === 2 ? 'Two rounds, one drawing each.' : `${n(r)} rounds, taking turns to draw.`
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
