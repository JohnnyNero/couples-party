# Two-Player Party Game — Build Spec

2026-09-19 · @Someone

## Scope and non-goals

A two-player game played on one shared screen with two phones. One sitting, roughly 25 minutes, three acts. The currency is **forfeits**, not points.

This is a greybox. Its purpose is to find out whether the loops are fun, not to ship a product. Type, flat colour and layout only.

### Explicit non-goals

- **No narrator, voice-over or jingle.** Written comedy is the one thing that cannot be done cheaply or alone.
- **No character art, illustration or mascot.** If a screen needs a drawing, the screen is wrong.
- **No accounts, no persistence between sessions.** Everything lives in room state and dies with the room.
- **No 3+ player support.** Two players, hard-coded. The engine may generalise later; this build must not pay for that now.
- **No editorialising by the screen.** The host screen states results and says nothing about them. With two people in the room, the screen is the only neutral party; the moment it takes a side, one player is being ganged up on.

### The one-sentence pitch

*You bet chores on how well you know each other.*

Any feature that cannot be justified against that sentence does not go in.

## Stack and architecture

### Stack

- **React + Vite + TypeScript**, one app, two routes.
- **Tailwind** for layout. No component library.
- **Playroom Kit in Stream Mode** for transport. Stream Mode exists specifically for the phones-as-controllers-plus-shared-screen case; it removes the lobby, room codes, QR and reconnection work from the build.
- **No database.** All state is room state.

If Playroom proves restrictive, the fallback is a Cloudflare Worker with a Durable Object per room and plain WebSockets. Do not build that first.

### Two clients

| Route | Runs on | Shows |
| --- | --- | --- |
| `/screen` | Laptop, TV, or a second browser window | Public truth: phase, prompt, timer, pot, reveals |
| `/play` | Each phone | Private truth: this player's input for the current phase |

The screen is a **pure renderer**. It holds no logic and makes no decisions. Every state transition is computed in one place and broadcast.

### Authority

Player A's client is the authority. It owns the reducer, the timers and the RNG seed. Player B's phone and the screen are subscribers. This is a two-player game in one room, so host-authority cheating is not a threat model worth spending on.

### Repo layout

```
src/
  screen/          # host renderer, one component per phase
  play/            # phone renderer, one component per phase
  engine/
    state.ts       # SessionState type
    reducer.ts     # (state, action) => state — pure, no I/O
    phases.ts      # phase graph and durations
    rng.ts         # seeded, so a session is reproducible
  packs/
    gap.json
    stake.json
  net/
    playroom.ts    # the only file that imports the SDK
```

Two rules that matter more than the rest:

1. **`reducer.ts` imports nothing.** Pure functions over `SessionState`. It must be testable in Node with no network and no React.
2. **Content never lives in code.** Every prompt, statement and category sits in `packs/*.json`, loaded at boot.

### Dev harness

A `?debug=1` flag on `/screen` that adds: skip-phase, force-reveal, fill-both-players-with-dummy-input, and a phase jump menu. Build this on day one. Reaching Act III by hand every time is the single biggest tax on iteration speed.

## Core data model

```ts
type PlayerId = 'A' | 'B';

type Forfeit = {
  id: string;
  text: string;          // "makes coffee every morning for a week"
  authoredBy: PlayerId;  // never shown
  state: 'pot' | 'burned' | 'owed';
  owedBy?: PlayerId;
};

type MeldRound = {
  index: number;
  words: Record<PlayerId, string | null>;
  converged: boolean;
};

type MeldResult = {
  rounds: MeldRound[];
  roundsTaken: number;       // 7 = failed
  converged: boolean;
  finalWord: string | null;
};

type GapRound = {
  index: number;             // 1..6
  statementId: string;
  selfRating: number | null;    // 1..7, subject
  guessRating: number | null;   // 1..7, guesser
  isLie: boolean;               // subject spent their lie here
  called: boolean;              // guesser pressed CALL this round
};

type GapAct = {
  subject: PlayerId;
  rounds: GapRound[];
  lieSpent: boolean;
  callSpent: boolean;
  outcome: 'caught' | 'missed' | 'never-called' | null;
};

type ListItem = {
  id: string;
  text: string;                 // 40 chars
  swapped: boolean;             // replaced by the ranker
  actualSlot: number | null;    // 1..7
  predictedSlot: number | null; // 1..7
};

type ListAct = {
  author: PlayerId;
  themeId: string;
  items: ListItem[];            // exactly 7, in reveal order
  displacement: number | null;  // 0..24
};

type SessionState = {
  seed: number;
  phase: Phase;
  phaseEndsAt: number | null;
  players: Record<PlayerId, { name: string; connected: boolean }>;
  forfeits: Forfeit[];
  doubledBy: PlayerId | null;   // set on the current resolution, cleared after
  meld: MeldResult | null;
  gapActs: GapAct[];            // two, one per subject
  listActs: ListAct[];          // two, one per author
  meldWords: string[];
};
```

### Rules the model enforces

- **No score field anywhere.** Standing is derived from `forfeits` — count the ones `owedBy` each player. If a number appears on screen that isn't a forfeit count, something has gone wrong.
- **Forfeits are never destroyed, only re-stated.** `burned` forfeits stay in the array so the souvenir can show what was nearly owed.
- **`authoredBy` is never rendered.** Once a forfeit is in the pot, who wrote it is hidden for the rest of the session. Knowing your partner wrote the cruel one changes how you bet, and not in a fun way.
- **`meldWords` accumulates everything**, including the misses. The near-misses are funnier than the convergence, and Act III draws from the whole list.

### Actions

Every input is one of: `SUBMIT_FORFEITS`, `SUBMIT_WORD`, `SUBMIT_RATING`, `TOGGLE_LIE`, `CALL`, `SUBMIT_ITEMS`, `SWAP_ITEM`, `PLACE_ITEM`, `DOUBLE`, `TIMEOUT`. Ten actions, whole game. If the list grows past a dozen, a feature has crept in.

`SUBMIT_RATING` carries the slider and, for the subject, the lie flag — they are one submission, so a lie can never be toggled after seeing anything.

## Session state machine

One linear graph. No menus, no player choice about what comes next — the running order is the show.

```
BOOT
  └─ JOIN                      untimed, until both connected
       └─ FORFEIT_WRITE        45s
            └─ POT_SHUFFLE     4s, screen only
                 └─ ACT I · MIND MELD ──────────────────┐
                      MELD_TYPE        20s              │ loops up to
                      MELD_REVEAL      4s               │ 7 times
                 ─────────────────────────────────────┘
                      MELD_RESULT      6s
                 └─ ACT II · THE GAP ───────────────────┐
                      GAP_STATEMENT    3s               │ x6
                      GAP_INPUT        20s              │ ends early
                      GAP_CALL         6s               │ on a call
                      GAP_REVEAL       7s               │
                      GAP_RESULT       6s               │
                 ──── run twice, roles swapped ───────┘
                 └─ ACT III · SHORTLIST ────────────────┐
                      LIST_WRITE       60s              │
                      LIST_SWAP        20s              │
                      LIST_PLACE       15s x7           │
                      LIST_REVEAL      15s              │
                 ──── run twice, roles swapped ───────┘
                      └─ SUDDEN_DEATH   only if level
                           └─ SOUVENIR  untimed, terminal
```

### Transition rules

- A timed phase advances when **both players have submitted** or the timer expires, whichever is first.
- `TIMEOUT` produces a null submission, and null is always a legal value. Each phase's section defines what null means there.
- **Nobody presses next.** There is no continue button anywhere in the game.
- `phaseEndsAt` is an absolute epoch timestamp set by the authority and broadcast. Clients render a countdown from it. Never broadcast a decrementing number.
- Act II ends early on a correct call. The second run of the act still happens.

### Alternation

Each act runs twice with roles swapped, so both players end the session having been on both sides of everything. Mind Meld is co-op and needs no swap.

Order of roles: Act II subject A then B, Act III author A then B.

## Doubling — a global layer, not an act

Any reveal in the game can be doubled.

- A **DOUBLE** button sits on both phones during `GAP_CALL` and `LIST_PLACE`'s final item, and during `MELD_TYPE` from round 4 onward.
- Either player may press it. First press wins. It is announced on the screen **with the presser's name**, before the reveal.
- Doubling multiplies the forfeits moving in that resolution by two. It does not change what the resolution is.
- Capped by the pot: you cannot double against a pot that can't pay.

This is what's left of the old Act III. The wager was the good part of Stake; the quiz around it was scaffolding. Spreading the wager across the evening means the pot drains gradually and the escalation comes from the pot getting thin, not from a designed difficulty curve.

Announcing the presser's name before the reveal is the whole value: it converts a private confidence into public information, which is the only thing that makes it a decision rather than a free multiplier.

## Cold open — The Pot

**Purpose:** harvest the entire content bank for the session from the two players, in under a minute, before anyone is invested.

### Loop

**`FORFEIT_WRITE` — 45 seconds**

- *Screen:* the instruction, a countdown, and two counters showing how many each player has submitted so far. Never the text.
- *Phone:* five text fields, submitted individually. Placeholder rotates through examples — *makes coffee for a week*, *loses aux privileges for a day*, *has to text their mum a compliment*.
- Each field: 60 characters max, single line.
- Submitting a field locks it. No editing. This keeps it fast and keeps the first instinct, which is the funny one.

**`POT_SHUFFLE` — 4 seconds, screen only**

- Ten face-down cards animate into a pile. Count visible, contents not.
- This is the only animation in the game and it exists for one reason: it makes the pot feel like an object, so losing one later feels like losing something.

### Rules

- **Target is five each, minimum is two each.** Below two, the phase extends by 20 seconds once and then proceeds with what exists.
- **If the pot has fewer than 6 forfeits total,** top up from a house list in `packs/stake.json` — deliberately bland ones, so the player-written ones stand out.
- **`authoredBy` is recorded and never displayed.** Not in play, not in the souvenir.
- Forfeits are drawn from the pot **at random**, never chosen. Nobody gets to aim a specific forfeit at their partner.

### Why this shape

The entire couples-app category is a question dispenser — Lovewick ships a thousand-plus prompts, Paired ships thousands more — and none of them have stakes. The viral version of this on TikTok always attaches a forfeit. This phase is the difference between the two, and it costs 45 seconds and no writing.

### Test

Does the pair laugh while writing the forfeits? If the cold open is already funny, the rest of the evening has somewhere to fall from. If it's silent and dutiful, the stake framing is wrong and no amount of Act III will rescue it.

## Act I — Mind Meld

**Pitch:** say the same word at the same time. You won't. Now meet in the middle.

**Co-op.** No forfeit changes hands in Act I. You are playing together to *burn* one out of the pot. This matters structurally: the pair are on the same side before they are on opposite sides, which makes Act II land softer.

### Loop

**`MELD_TYPE` — 20 seconds**

- *Screen:* the two words from the previous round, side by side, large. Round 1 shows the two seed words instead. A countdown. Two dots that fill when each player submits.
- *Phone:* one text field, one submit button. Above it, the same two words, because a phone-only player shouldn't have to look up.
- Round 1 seeds: two unrelated nouns drawn from a seed list. Everything after is generated by play.

**`MELD_REVEAL` — 4 seconds**

- Both words appear simultaneously. Never staggered — staggering invents a winner.
- Match: the word appears once, centred, and the act ends.
- No match: the two words slide up into the history rail and the next round begins automatically.

**`MELD_RESULT` — 6 seconds**

- The chain of every word pair, in order, top to bottom.
- The outcome line: burned a forfeit, or didn't.

### Rules

| Rule | Value |
| --- | --- |
| Round cap | 7 |
| Burn threshold | converge in **3 or fewer** → one random forfeit is burned |
| Converge in 4–7 | nothing burned, nothing lost |
| Fail to converge by 7 | nothing burned, nothing lost |

### Matching

Case-insensitive, trimmed, plurals folded (`cats` = `cat`), and a small synonym-free stem. **Do not be clever about this.** A near-miss that the game rejects produces a better reaction than a near-miss the game generously accepts, because the players get to argue about it. Err strict.

### Edge cases

- **Repeat words.** A player typing a word already used in this session by either player is rejected on the phone with *already said* and the field stays open. Without this, the death spiral is `cat`/`dog`/`cat`/`dog` forever.
- **Empty submission on timeout.** Counts as a non-match; the round burns and the chain continues.
- **Both players time out.** Same as above. Two consecutive double-timeouts end the act early.
- **Converging on round 1.** Possible, rare, spectacular. Burn the forfeit and let the screen sit on it for the full 6 seconds.

### What it feeds forward

Every word either player typed is pushed to `meldWords`, including the failures. Act III reads from this array. This is the cheapest structural trick in the spec — one array — and it's the thing that makes the session feel like one game rather than three.

### Test

Does the reveal produce an involuntary noise? Landing on the same word from two unrelated starts is either electric or it isn't, and a greybox with two words in Helvetica will tell you the truth immediately.

## Act II — The Gap

**Pitch:** six statements about you. You answer five honestly and one you don't. They get one chance to catch it.

Six rounds, one subject throughout, then the act runs again with roles swapped. The only currency in the act is the CALL.

### Loop

**`GAP_STATEMENT` — 3 seconds**

Screen shows the statement with the subject's name substituted: *Sam would rather be right than happy.* No input yet. Both players read it at the same time.

**`GAP_INPUT` — 20 seconds**

- *Subject's phone:* a 1–7 slider, and a small persistent marker showing whether they have spent their lie yet.
- *Guesser's phone:* a 1–7 slider — where they think the subject really sits.

**`GAP_CALL` — 6 seconds**

One button on the guesser's phone: **CALL**. Available every round until spent. The subject's phone shows a waiting state that does not reveal whether a call is incoming.

The call must land before the reveal. Afterwards it is free information and worthless.

**`GAP_REVEAL` — 7 seconds**

One horizontal line, 1 to 7, two pins:

- `selfRating` — solid
- `guessRating` — hollow

The distance between them is the only clue the guesser gets. A big gap is either a lie or a genuine misread, and the game never says which.

If a call was made, the reveal also shows whether the round was the lie, and the act ends there.

### The lie

The subject must answer dishonestly exactly once across the six rounds. They choose when.

- Their phone carries a **LIE** toggle alongside the slider. Toggling it marks this round as the dishonest one and spends it.
- If they reach round 6 without spending it, round 6 is forced — the toggle is on and cannot be turned off.
- The toggle is never visible to the guesser, and never appears on the host screen.

Spending it early means lying while the guesser is freshest and most willing to burn their call. Holding it means five honest rounds during which the guesser is watching you not lie. Both players are working the same clock from opposite ends, which is the reason this act exists.

### The call

| Outcome | Result |
| --- | --- |
| Correct | Guesser takes **3** forfeits. Act ends immediately. |
| Wrong | Subject takes **1**. Guesser's button is dead for the rest of the act. |
| Never called | Guesser loses **2** at the end of the act. |

The never-called penalty is load-bearing. Without it the safe play is to sit on the button forever, and the act has no decision in it.

### What was cut and why

The earlier version scored every round on distance and added a third pin — the subject predicting the guess. Both are gone.

Six rounds of arithmetic plus a hidden role is two systems stacked, and stacking is what made Stake collapse. The act now has one mechanic. The third pin was a good idea in a different game and is logged in Open Questions rather than deleted from the record.

### Rules

- A null rating from the subject counts as honest and wastes nothing.
- A null rating from the guesser is just a bad guess.
- Statements must be judgements, not facts — see Content packs.
- The act runs twice, once per subject. A guesser's spent call does not carry over.

### Test

Watch the guesser's thumb during `GAP_CALL`. If they hover and don't press, the act works. If they forget the button exists, the reveal isn't giving them enough to reason with and the statements are too bland.

## Act III — Shortlist

**Pitch:** they write seven stupid things about you. You rank them, one at a time, with no idea what's coming next. They try to call the order.

Two rounds, one per author. This is the closer, and it ends on a list, which is the most screenshot-friendly output in the game.

### Loop

**`LIST_WRITE` — 60 seconds**

- Screen shows a theme: *seven things Sam would struggle to give up*, *seven of Sam's opinions*, *seven people Sam would call at 3am*.
- Author's phone: seven fields.
- Ranker's phone: a waiting state showing the theme only.

No pack, no suggestions, no autocomplete. The author writes all seven themselves. A prompt list would sand the edges off exactly the items this act needs.

**`LIST_SWAP` — 20 seconds**

Ranker sees all seven and may **replace one** with anything they like. Free, no cost, no explanation.

This is the guardrail. The act is built to be offensive and the swap keeps the door open without anyone having to say *that's too far*.

**`LIST_PLACE` — 7 iterations, 15 seconds each**

Items are revealed **one at a time**, in an order neither player controls.

- *Ranker's phone:* the item, and seven slots numbered 1 to 7. Slots already used are shown and unavailable. Tap one to commit.
- *Author's phone:* the same item, the same seven slots, the same occupancy — predicting where the ranker will put it.

Both commit simultaneously. Neither sees the other's choice. The screen shows the item and the two grids of occupied-or-not, never the contents of a slot.

**This is the whole act.** Committing rank 2 to the third item and then discovering what item five is — that's the game. A drag-to-sort at the end would be a sorting task; this is a sequence of irreversible bets.

**`LIST_REVEAL` — 15 seconds**

Two columns side by side, 1 to 7, actual against predicted. Matching rows highlighted. Total displacement at the bottom.

### Scoring

Total displacement is the sum of `|actualSlot − predictedSlot|` across all seven items. Range 0 to 24.

| Displacement | Result |
| --- | --- |
| 0 | Author takes **3** forfeits |
| 1–4 | Author takes **1** |
| 5–12 | Nothing moves |
| 13+ | Ranker takes **1** — being read that badly deserves something |

### Rules

- Seven items, seven slots, one item per slot. Enforced on the phone: a used slot is not tappable.
- **Last item is forced.** By item seven there is one slot left. This is correct and should not be hidden — watching someone realise their last item is going somewhere absurd is part of it.
- A timed-out placement takes the lowest-numbered free slot.
- Item order is drawn from the seed and is the same on both phones.
- Item text: 40 characters, one line.

### Why it works

The bend is in the **authoring**, not the ranking. Seven sensible items produce a sensible ordering and a boring round. Slipping in something absurd or pointed — *my driving*, *your sister*, *the smell of the bins* — makes the round funny and your own prediction much harder. You are choosing between being funny and being right, before the ranking even starts.

And it needs no content bank at all beyond a handful of theme lines.

### Test

Does the pair argue about the *result*? Not the score — the ordering itself. If the bins beating the sister starts a conversation, the act has done its job, and the score is only there to end the round.

## Sudden death and the souvenir

### `SUDDEN_DEATH` — only when the forfeit count is level

One round, whole pot.

- Both players see the same question — a Gap statement, not a Stake question, because it needs no adjudicator at the end of the night.
- Both set a slider. Closest to the subject's self-rating takes everything.
- Subject alternates from whoever went last. Still tied after: split the pot, and the screen says so without comment.

Skip the whole phase if the pot is empty.

### `SOUVENIR` — terminal, untimed

One screen, built to be photographed. This is the distribution strategy, not decoration: the TikTok couples format spreads on exactly this kind of result card, and no app in the category produces one.

What it shows, in order:

1. **Who owes what.** Each player's name, the forfeits they owe, in full text. This is the headline.
2. **The word.** The Mind Meld chain's final word, or the chain's last pair if it never converged.
3. **Biggest gap of the night.** One statement, the three numbers, the two names. The single most screenshot-worthy line in the game.
4. **Burned.** Forfeits that went into the pot and never got claimed, greyed. Small, at the bottom, and worth including — *nearly* having to text your mum a compliment is funny.

### Constraints on the souvenir

- **One screen, no scroll**, at 16:9 and at phone aspect. If it doesn't fit, cut item 4 then item 2.
- **Typographic only.** Numbers and names at scale. No chart, no illustration, no confetti.
- **A `?souvenir=<sessionId>` route** that re-renders it standalone, so a phone can open it and screenshot without the TV in frame. Cheap to build, and it's the difference between a screenshot of a television and a shareable image.
- **Still no editorialising.** *Sam owes 4* — not *Sam got destroyed*.

## Content packs

Two JSON files. Everything else in the game is generated by the players.

### `packs/gap.json`

```json
{
  "version": 1,
  "seedWords": ["spaghetti", "handcuffs", "cathedral", "lawnmower"],
  "statements": [
    { "id": "g001", "text": "{name} would rather be cold than hot", "tags": ["light"] },
    { "id": "g002", "text": "{name} is the more stubborn one", "tags": ["spicy"] },
    { "id": "g003", "text": "{name} checks the weather before leaving", "tags": ["light"] }
  ]
}
```

**`{name}` is substituted with the subject's name.** Statements are written in the third person so the same string works for either player.

**The filter every statement must pass:** could two reasonable people who know each other well put this in different places on a 1–7 scale? *Is taller* fails. *Is the more stubborn one* passes. Facts are dead rounds.

**Tag policy:** `light` and `spicy`. Act II draws four `light` and two `spicy`, spicy never in round 1. Keep the ratio in `phases.ts`, not in the pack.

**Seed target: 60 statements.** That's a couple of hours of writing and it never goes stale, because the content is the couple, not the prompt.

### `packs/list.json`

```json
{
  "version": 1,
  "houseForfeits": [
    "makes the next round of tea",
    "picks up the next takeaway"
  ],
  "themes": [
    { "id": "t001", "text": "seven things {name} would struggle to give up" },
    { "id": "t002", "text": "seven of {name}'s opinions" },
    { "id": "t003", "text": "seven people {name} would call at 3am" }
  ]
}
```

**Twenty themes total.** That's the entire Act III content bank — the seven items are written live by the author every time.

**Themes must permit absurd answers.** *Seven of Sam's fears* is fine; *seven countries Sam has visited* is not, because it admits only sensible entries and the act dies without them. Test each theme by asking whether a stupid answer would fit alongside a serious one.

**Themes must produce comparable items.** A theme that mixes people, objects and abstractions gives an unrankable mess. Constrain to one kind of thing per theme.

**House forfeits are deliberately bland.** They exist to pad a thin pot, and their blandness makes the player-written ones land harder.

### Validation script

`npm run packs:check` — verifies unique ids, `{name}` present in every gap statement and theme, ≥20 themes, no line over 90 characters. Run in CI. A malformed pack should fail the build, not the game.

## UI contract

### Visual language

**Sports results board.** Not a fight card, not a game show — a league table. Fixed-width type, one accent colour, heavy rules between regions, everything left-aligned. It reads from across a room, it costs nothing to make, and it stays deadpan while the content gets personal. That contrast is doing the work.

- One typeface, two weights. A grotesque with real numerals.
- Three colours: background, foreground, one accent. The accent is only ever used for *whose turn it is*.
- No rounded corners, no shadows, no gradients, no icons.

### Host screen — persistent regions

Four regions, fixed for the whole session. They never move, only their contents change.

| Region | Position | Holds |
| --- | --- | --- |
| Act rail | Top, one line | `ACT II · ROUND 3 OF 6` |
| Stage | Centre, 70% | The prompt, the sliders, the reveal — whatever this phase is |
| Pot | Bottom left | `POT 7` and the two players' owed counts |
| Clock | Bottom right | Seconds remaining, or blank if untimed |

The pot region is visible for the entire session, from `POT_SHUFFLE` onward. It is the board.

### Phone — one screen per phase, no navigation

No tabs, no back button, no menu. The phone shows exactly what this phase needs from this player and nothing else. When a player has submitted, the phone shows a waiting state — **never the other player's status**, and never a re-editable field.

| Phase | Player 1 | Player 2 |
| --- | --- | --- |
| `FORFEIT_WRITE` | 5 fields | 5 fields |
| `MELD_TYPE` | 1 field | 1 field |
| `GAP_INPUT` | slider + LIE toggle (subject) | slider (guesser) |
| `GAP_CALL` | waiting (subject) | CALL + DOUBLE (guesser) |
| `LIST_WRITE` | 7 fields (author) | waiting (ranker) |
| `LIST_SWAP` | waiting (author) | 7 items, tap one to replace |
| `LIST_PLACE` | item + 7 slots (author predicts) | item + 7 slots (ranker commits) |

### Rules

- **Nothing private ever renders on the host screen.** Submitted-yet counts only, never contents.
- **Phone targets ≥ 48px.** People are on a sofa, half-watching the TV.
- **The slider is the one interaction worth overspending on.** Seven detents, snapping, haptic on each. It carries all of Act II and a bad one will read as the game being bad.
- **No text input on the phone after the cold open except Mind Meld.** Typing kills pace.
- Assume the screen is a laptop across the room at 1280×720. Design at that, not at 4K.

## Rules that must never be skipped

Five things that look like polish and are actually load-bearing. Implement them with the phase they belong to, not in a cleanup pass.

### 1. Auto-advance, always

Every timed phase advances on expiry regardless of what's been submitted. Jackbox codifies this — the program moves on without a player who takes too long — and it's what makes eight-player games survivable.

It matters *more* with two players, for a different reason: it stops one person sitting in silence over-thinking an answer about the relationship. The timer is doing emotional work. It gives you permission to answer fast and badly, and fast and bad is the honest answer.

### 2. The player always knows the game is waiting

Every phase, on every phone, answers three questions without being read: what am I doing, how long have I got, has it been received. A submitted state that looks identical to an unsubmitted one will produce double-taps and lost inputs.

### 3. The veto is always reachable in Act III

Covered above; repeated here because it is the rule most likely to get dropped for a demo. Zero cost, no explanation, no attribution on screen.

### 4. Reconnection is invisible

A phone that sleeps, backgrounds, or drops Wi-Fi mid-round must rejoin into the current phase with its prior submission intact.

- Persist `{ playerId, sessionId }` to `localStorage` on join.
- On load, if both are present, rejoin silently — no name screen, no room code.
- Heartbeat; mark `connected: false` after 10s of silence but **never pause the game for it**.
- A disconnected player's phase input is treated as a timeout. Rejoining mid-phase restores the input UI if the phase is still open.

This is the most common failure in the open-source Jackbox-likes and the one that ends playtests early. Phones sleeping is not an edge case; it's what phones do.

### 5. Absolute timestamps, one clock

`phaseEndsAt` is epoch milliseconds, set once by the authority, broadcast, never recomputed by a client. Clients render `phaseEndsAt − Date.now()`. A ticking integer in the broadcast means two devices disagree about the countdown, which looks broken even when it isn't.

## Build order

Six milestones. Each one ends at something playable. Do not start the next until the current one has been played with a real second person.

### M0 — Skeleton

Vite app, two routes, Playroom Stream Mode connected, `SessionState` and a reducer with one phase. Two devices show the same number when one taps a button. Plus the `?debug=1` harness.

*Done when:* a phone changes something on the screen.

### M1 — Mind Meld, standalone

Join → `MELD_TYPE` → `MELD_REVEAL` → loop → `MELD_RESULT`. No pot, no forfeits, no styling. Grey boxes and system type.

*Done when:* you and your girlfriend have played it four times in a row without being asked to.

**This is the real gate.** Mind Meld needs no content pack, no forfeits and no scoring. If it isn't fun as grey rectangles, the problem is upstream of everything else in this document, and the rest of the build should wait.

### M2 — The pot

`FORFEIT_WRITE`, `POT_SHUFFLE`, the pot region on the host screen, burn-on-converge wired into Act I.

*Done when:* burning a forfeit produces a reaction.

### M3 — Shortlist

All four Act III phases, the one-at-a-time placement grid, the swap, `packs/list.json` with 8 themes.

Built before The Gap deliberately: it has no content bank, and the placement grid is the only genuinely new interaction in the game.

*Done when:* the pair argue about the resulting order rather than the score.

### M4 — The Gap

All five Act II phases, the two-pin reveal, the LIE toggle, the CALL button and its three outcomes, `packs/gap.json` with 20 statements.

*Done when:* the guesser hovers over CALL and doesn't press.

### M5 — Tail and polish

Doubling as a global layer, sudden death, souvenir screen, the `?souvenir=` route, reconnection hardening, full 60-statement gap pack and 20 themes, the sports-board visual pass.

*Done when:* someone screenshots the end screen without being prompted.

### Sequencing notes

- **Reconnection lands in M5, but `localStorage` persistence lands in M0.** Retrofitting identity is painful; the rest of reconnection is not.
- **Write no content until M3.** Prompts written before the loop is proven are prompts written for a loop that changed.
- **The visual pass is last and should take a day.** If it takes a week, the constraint list at the top has been abandoned.

## Open questions

Every number in this document is a guess. These are the ones to settle by playing, not by deciding.

| Question | Current guess | How you'll know |
| --- | --- | --- |
| Mind Meld round cap | 7 | Players give up before the cap, or feel cut off by it |
| Burn threshold | ≤3 rounds | Burns every game (too easy) or never (pointless) |
| Gap scale | 1–7 | 7 feels indecisive → try 6, no midpoint |
| Never-called penalty | 2 forfeits | Nobody ever holds → too harsh; nobody ever calls → too soft |
| Gap rounds | 6 | Whether the lie has room to hide in fewer |
| Shortlist items | 7 | 7 slots on a phone may be too fiddly → 6 |
| Placement timer | 15s | Long enough to agonise, short enough to panic |
| Total runtime | \~25 min | Overrunning means cutting a Gap run, not a Shortlist run |

### The two that could change the design

**Does the pot actually create tension?** The whole spec assumes forfeits beat points. If the pair treat the forfeits as a joke and never intend to honour them, the currency is decorative and the game is a quiz with a gimmick. Watch whether anyone *plays differently* when the wager is high. If not, the honest response is to make the forfeits real — agree before the session that they'll be done — rather than adding scoring on top.

**Are The Gap and Shortlist too alike?** Both are *commit to an ordering, partner predicts it*. They look different enough on paper — Gap's real core is hunting the lie, Shortlist's is the authoring — but if an evening playing both feels repetitive, cut The Gap. Shortlist has no content bank and a better closing image.

**Logged, not deleted:** the Gap's original third pin — the subject predicting the guesser's rating — was cut for stacking two systems. It produced the best single moment in the earlier design (*you thought I'd say that?*). If the lie mechanic underdelivers, that pin is the first thing to try putting back, and the two are mutually exclusive.

### Deliberately unresolved

Whether this generalises to 3–8 players. It probably does — Mind Meld scales cleanly, The Gap becomes an average, Stake becomes a table vote. But designing for that now would compromise every decision above. Revisit after the two-player version is proven or abandoned.
