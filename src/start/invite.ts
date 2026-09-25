// An invite link: the app's own address with the pairing code and who it's from —
// "…/couples-party/?pair=ABC234&from=Johnny". Opening it takes the other phone straight
// to a welcome page that pairs them (see Invite.tsx); no code to type.

export type InviteLink = { code: string; from: string }

export function inviteUrl(code: string, from: string): string {
  const url = new URL(window.location.origin + window.location.pathname)
  url.searchParams.set('pair', code)
  if (from.trim()) url.searchParams.set('from', from.trim())
  return url.toString()
}

export function readInvite(search: string): InviteLink | null {
  const p = new URLSearchParams(search)
  const code = (p.get('pair') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (code.length !== 6) return null
  return { code, from: (p.get('from') ?? '').trim().slice(0, 24) }
}

// Once it's been used (or turned out to be no good), take it out of the address bar so a
// reload or a home-screen bookmark doesn't bring the welcome page back.
export function forgetInvite(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('pair')
  url.searchParams.delete('from')
  window.history.replaceState(null, '', url.toString())
}
