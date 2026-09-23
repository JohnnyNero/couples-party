// "Today" means the couple's today — the phone's own calendar — never the server's, or
// a word set at 11pm in London would land on the wrong day.
const pad = (n: number) => String(n).padStart(2, '0')

export function localDate(offsetDays = 0, from: Date = new Date()): string {
  const d = new Date(from)
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
