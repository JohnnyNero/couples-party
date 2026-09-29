// Seats are kept against an id this phone keeps for good — not Playroom's, which can be
// a new one every time a phone drops out and comes back. With Playroom's, a phone that
// came back could be seated by whoever asked first, and find itself in its partner's
// chair: their score, their questions.
const STORED_DEVICE = 'coupled:device'
let myKey: string | null = null
export function deviceKey(): string {
  if (myKey) return myKey
  try {
    myKey = localStorage.getItem(STORED_DEVICE)
    if (!myKey) {
      myKey = `d${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`
      localStorage.setItem(STORED_DEVICE, myKey)
    }
  } catch {
    myKey ??= `d${Math.random().toString(36).slice(2, 12)}`
  }
  return myKey
}
