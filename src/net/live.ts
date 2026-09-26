// A preview of what one of you is doing right now — the guesser's slider mid-drag, the
// guess being typed — so the one who set it can watch. `key` says which turn it belongs
// to ("wave:3"), so a stale one from an earlier turn is never shown.
export type Live = { key: string; value: number | string }

// What one of you is doing right now, when it's something to watch for: typing an
// answer, drawing, or swinging the dial. `key` is the screen it belongs to (screenKey),
// so it lapses by itself when the game moves on — no clocks compared across phones.
export type ActivityKind = 'typing' | 'drawing' | 'deciding' | 'thinking'
export type Activity = { kind: ActivityKind; key: string }
