// The play mode is chosen once (launch picker or a shared link's ?mode= param) and
// determines how the transport is initialised. It lives in the URL query string so
// Playroom's share link — which is `location.href` up to the hash + "#r=CODE" —
// carries it to the joining device.
export type PlayMode = 'screen' | 'duo'

export function resolveMode(search: string): PlayMode | null {
  const m = new URLSearchParams(search).get('mode')
  return m === 'screen' || m === 'duo' ? m : null
}

export function stampMode(mode: PlayMode): void {
  const url = new URL(window.location.href)
  url.searchParams.set('mode', mode)
  window.history.replaceState(null, '', url.toString())
}
