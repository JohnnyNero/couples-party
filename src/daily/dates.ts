// "Today" means the couple's today — the phone's own calendar — never the server's, or
// a word set at 11pm in London would land on the wrong day.
const pad = (n: number) => String(n).padStart(2, '0')

export function localDate(offsetDays = 0, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A "YYYY-MM-DD" as a whole number of days since the epoch — the shared clock every
// daily-pool picker (questionOfTheDay, dialOfTheDay, …) walks by, so they all agree on
// what day it is without needing the same seed.
export function dayIndex(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000)
}
