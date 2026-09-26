// Coupled's service worker: what makes the home-screen app open instantly, and open at
// all on a bad signal. It only ever caches Coupled's own files — the live game (Playroom)
// and your puzzles (Supabase) always go to the network, never a stale copy.
//
//   the page itself   network first, the last good copy if offline — so a new version
//                     is picked up on the next open
//   built files       (assets/, named by their contents) cached for good once fetched
//   question packs,   served from the cache straight away and refreshed behind it
//   icons, fonts

const CACHE = 'coupled-v1'
const SHELL = './'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const ours = url.origin === self.location.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname)

  if (req.mode === 'navigate' && ours) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(SHELL, copy)) }
          return res
        })
        .catch(() => caches.match(SHELL).then((r) => r || Response.error())),
    )
    return
  }
  if (ours && url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
      return res
    })))
    return
  }
  if (ours || FONTS.test(req.url)) {
    event.respondWith(caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      })
      if (hit) { event.waitUntil(fresh.catch(() => {})); return hit }
      return fresh
    }))
  }
})
