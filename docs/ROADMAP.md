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
4. ~~A shared couple streak~~ — done. A day counts once you've both answered that day's
   puzzle, whatever kind (not solved, just answered). Forgives a single missed day;
   two in a row end it there. Shown as a badge on the day's card once it's at least 1.
5. The other four puzzle types — in progress, one at a time, each landing as its own
   standing card next to Their Word rather than the final rotation (below) until all
   four exist:
   - ~~The Dial~~ — done. A daily Wavelength: a mark is rolled at random (nobody
     chooses it, same as the live game) and you name a clue for it; your partner
     slides to guess, once. Reuses Wavelength's own spectrum pool. `payload`/
     `progress` jsonb columns were added to `puzzles` generically enough that Top 5,
     Sketch and Their Numbers can reuse them rather than reshaping the table again.
   - ~~Top 5~~ — done. A daily Shortlist: five items from a theme (the same five, same
     order, on both phones — day-picked like everything else), ranked for real; your
     partner guesses the order, once. `{name}` renders as the solver, same convention
     as Their Word, so the setter is genuinely ranking their honest opinion of their
     partner — matching what the live game's ranker/author roles actually do, just
     asynchronous. Reuses the `payload`/`progress` columns 0005 added, unchanged.
   - ~~Sketch~~ — done. A daily Draw Your Answer: answer a question about yourself in
     a word or two, then draw it; your partner gets three guesses. Nobody's live to
     wave a near miss through, so a guess counts once case, punctuation, spacing and
     a leading "a/an/the" are set aside ("tent!" is "A tent") — anything looser is for
     "ask them why". Reuses Draw Your Answer's prompt pool.
   - ~~Their Numbers~~ — done. Five number questions about yourself a day (its own
     content section), your partner guesses all five at once; each is exact, close
     (within a fifth of your number, never tighter than one either side) or off.
   - ~~One rotating slot~~ — done. The Today tab shows one daily puzzle, walking all
     five kinds a day at a time (src/daily/rotation.ts: Their Word, The Dial, Top 5,
     Sketch, Their Numbers). The day's kind is worked out from the date on each phone,
     the same way the questions are, so both agree without asking the server, and each
     kind keeps its own server functions (`daily_dial` and the rest) rather than
     folding them into `daily()`. That turned out to be simpler than the merge
     planned here, and it needed no migration. Their Word is the fallback: it carries
     pairing, and it's what shows if the day's kind isn't set up on the server yet.
     The streak now counts a day whichever kind it was (migration 0009).
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
