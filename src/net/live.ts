// A preview of what one of you is doing right now — the guesser's slider mid-drag, the
// guess being typed — so the one who set it can watch. `key` says which turn it belongs
// to ("wave:3"), so a stale one from an earlier turn is never shown.
export type Live = { key: string; value: number | string }
