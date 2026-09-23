# Roadmap

Decisions already made, so they survive between sessions. Newest at the top.

## Next: daily puzzles (needs Supabase)

The home screen's **Today** tab becomes the daily habit: each day you solve a puzzle
your partner made from an answer they gave yesterday, then set tomorrow's for them.
Your partner is the level designer, so the content never runs out.

One puzzle per day, on a fixed weekday rotation. The line-up:

| Puzzle | Borrowed from | They set it by… | You solve it by… |
|---|---|---|---|
| Their Word | Wordle | a 5-letter answer to a prompt ("how today felt") | Wordle, with the prompt as the clue |
| The Dial | Wavelength | a clue for a hidden point on a scale | placing their clue |
| Top 5 | Shortlist | ranking 5 things | guessing their order |
| Sketch | Draw Your Answer | drawing their answer to a question | guessing it |
| Their Numbers | — | 5 number questions about themselves | guessing each; closer scores more |

Needs, in order:
1. ~~A Supabase project~~ — done; see `supabase/README.md` for the two dashboard steps.
2. ~~Pairing~~ — done: a six-letter code, anonymous sign-in per phone.
   Still to do: use the pairing to drop the room code from Tonight.
3. ~~Their Word~~ — done. One question a day, the same for both of you (spun in from the
   content file's pool by date), answered in five or six letters, and solved the same day.
   Your partner's answer stays locked until you've given yours — enforced on the
   server. Changeable until they start. Scored on the server.
4. ~~A shared couple streak~~ — done. A day counts once you've both answered it (not
   solved — just answered). Forgives a single missed day; two in a row end it there.
   Shown as a badge on the Their Word card once it's at least 1.
5. The other four puzzle types — in progress, one at a time, each landing as its own
   standing card next to Their Word rather than the final rotation (below) until all
   four exist:
   - ~~The Dial~~ — done. A daily Wavelength: a mark is rolled at random (nobody
     chooses it, same as the live game) and you name a clue for it; your partner
     slides to guess, once. Reuses Wavelength's own spectrum pool. `payload`/
     `progress` jsonb columns were added to `puzzles` generically enough that Top 5,
     Sketch and Their Numbers can reuse them rather than reshaping the table again.
   - Top 5 (Shortlist, 5 not 7) — next.
   - Sketch (Draw Your Answer, solved async — no one live to judge a near miss, so
     it's an exact match on what you typed, same spirit as Wordle's "ask them why").
   - Their Numbers.
   - Once all four exist: one migration merges them into a single rotating slot
     (`daily()` picking the day's kind itself, same day-index approach as
     `questionOfTheDay`/`dialOfTheDay`), and the standalone `daily_dial()` (etc.)
     RPCs retire. Not before then — a partial rotation would leave real nights with
     nothing to play.
6. Fallback puzzles for a day your partner didn't set one — possibly recycled from your
   own past sessions. Deliberately left for later.

## Done

- Tonight: a five-minute session (Who's More Likely, Mr & Mrs, Draw Your Answer,
  Lights Out) on a two-tab home (Today / Games).
- Who's More Likely, Mr & Mrs (type your answer + predict theirs; the answer's owner
  rules on the prediction), Lights Out.
- Quick Draw reframed as Draw Your Answer.
- Night mode.
- Scoring balanced so every game tops out near 40 over a full session.
