// Who "you" is. A prompt that's about one of you (the person answering it — the one who
// set a daily puzzle, the author of a Shortlist act) reads "you" to them and their name
// to everyone else. The content file marks the words that change:
//
//   [you do|@ does]   — the left side for the person it's about, the right for everyone
//                       else, with @ as their name: "five things [you do|@ does] in bed"
//                       reads "five things you do in bed" / "five things Rocko does in bed"
//   {partner}         — the other one of you: "The animal {partner} reminds [you|@] of"
//   {player}          — from Our questions: the name of the answerer's partner (the app
//                       picks who that is — see each game)
//   {name}            — the old single placeholder, still in stored puzzles and older
//                       copies of the content file; `legacyName` says who it meant there

export type Voice = {
  self: boolean // is the reader the person it's about?
  subject: string // the person it's about
  partner: string // the other one
  legacyName?: 'subject' | 'partner'
}

const CHOICE = /\[([^\]|]*)\|([^\]]*)\]/g

export function say(template: string, v: Voice): string {
  const out = template
    .replace(CHOICE, (_, mine: string, theirs: string) => (v.self ? mine : theirs))
    .replace(/@/g, v.subject)
    .replace(/\{partner\}/g, v.partner)
    .replace(/\{player\}/g, v.partner)
    .replace(/\{name\}/g, v.legacyName === 'partner' ? v.partner : v.subject)
  // "[Your|@'s] comfort food" can start a sentence either way; keep the first letter's case.
  return /^[A-Z]/.test(template) || /^\[[A-Z]/.test(template) ? out.charAt(0).toUpperCase() + out.slice(1) : out
}

// The plain "you" reading, for a screen with no one person reading it (a TV).
export const asYou = (template: string, subject = 'you', partner = 'your partner') =>
  say(template, { self: true, subject, partner })

// Does this prompt name anyone? Our questions only ever uses {player}.
export const hasPlayer = (t: string) => t.includes('{player}')
