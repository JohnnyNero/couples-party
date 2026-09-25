import { makeRng, shuffled } from '../engine/rng'
import { dayIndex } from './dates'
import { say } from '../say'

// The day's question: the same for both of you (and for every couple, like a daily
// Wordle), picked from the content file's pool by date. The pool is walked in one fixed
// shuffled order, so nothing repeats until every question has had its day.
//
// Once either of you answers, the server pins that question for the couple for the day
// — so if the content file changes mid-day, the second of you still gets the first's
// question. This is only for before anyone has answered.
//
// With questions of your own (Our questions), every other day is one of yours instead,
// taking them in the order you added them.
export function questionOfTheDay(date: string, pool: string[], ours: string[] = []): string | null {
  const day = dayIndex(date)
  if (ours.length > 0 && (day % 2 === 0 || pool.length === 0)) {
    const i = Math.floor(day / 2)
    return ours[((i % ours.length) + ours.length) % ours.length]
  }
  if (pool.length === 0) return null
  const order = shuffled(makeRng(0xc0ffee), pool)
  return order[((day % order.length) + order.length) % order.length]
}

// A question as the person answering it reads it: "you", with {partner} (or the old
// {name}) as the one who'll solve it — Sam sees "The animal Alex reminds you of".
export function renderQuestion(template: string, solverName: string): string {
  return say(template, { self: true, subject: 'you', partner: solverName, legacyName: 'partner' })
}

// …and as the one solving it reads it: the setter by name — Alex sees "Sam's comfort
// food", and "The animal Alex reminds Sam of".
export function questionFromThem(template: string, setterName: string, solverName: string): string {
  return say(template, { self: false, subject: setterName, partner: solverName, legacyName: 'partner' })
}
