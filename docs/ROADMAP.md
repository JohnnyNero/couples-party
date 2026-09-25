# Roadmap

Decisions already made, so they survive between sessions. Newest at the top.

## Done: Memories (migration 0012)

A third home tab. Both paired phones save the live session as it goes, at every
scoreboard, Lights Out and the end, so a night stopped halfway is still kept. The TV and
solo play never save. What's kept: the score, Mr & Mrs answers and guesses, drawings with
their answers, Wavelength clues, Shortlist rankings, Category Clash answers, Word Chain
chains, and the Lights Out question. The tab shows those sessions and the past daily
puzzles, answers included once the day is safely over, 30 days at a time. Still open:
fallback puzzles for a missed day could now be drawn from these past answers.

## Done: Word Chain (new-games spec, step 3)

Take turns naming things in a category, each starting with the last letter of the one
before, against a turn clock (10 s, 7 s after ten words, 5 s after twenty). Ten
categories in the content file's "# Word Chain" section, each with its full list of
accepted answers (76 to 260), so every word is checked instantly: case, spacing and a
plural don't matter, and a 5+ letter word one slip off a listed one counts. Two changes
from the spec, both to keep it fair: a word that doesn't pass (wrong letter, already
used, not on the list) is turned back with the reason and you try again while your
clock runs, rather than losing on the spot; and when nothing left starts with the last
letter, the letter before it is used instead of replaying the round. Run out of time
and your partner takes the round's 10. Four rounds in the full session, two in
Tonight, where the pool is now six games and two sit out each night. Only the
categories a session can use travel with it, since the whole session is sent to both
phones on every move.

## Done: Category Clash (new-games spec, step 2)

Scattergories for two: one letter (never Q, X, Z, J, V or Y, and none repeated in a game),
six categories from the content file's new "# Category Clash" section, 60 seconds. At
the reveal, one category per tap, an answer scores 2 if it starts with the letter and
isn't the same as your partner's (case, articles, spacing and a plural "s" ignored),
0 if it is. Either of you can challenge the other's scoring answer ("That doesn't
count"), which halves it to 1. Three rounds in the full session (max 36), two in
Tonight. It joins Tonight's pool, so Tonight rotates again: four of five games a night.

## Done: fillers and the tiebreaker (new-games spec, step 1)

Two 30-second head-to-head fillers slot in between games: **Perfect Circle** (draw one
circle; the host scores roundness from the points) and **Stop the Clock** (tap when a
hidden clock hits the target; each phone times itself, so lag can't affect it). One
filler plays after Tonight's second game, alternating nightly, and there are two in the
full session. A filler pays a flat 5 to its winner, only once it's over. Each is playable
on its own as a best of 5. A multi-game night that ends level goes to a sudden-death
Stop the Clock before Lights Out, worth 1 point. Next: Category Clash, then Word Chain
(spec: the "New Games Spec" doc).

## Done: the Today board (migration 0010)

The Today tab is a scoreboard and all five daily puzzles as compact tiles, every day.
Each tile is solve-then-set: solve the one your partner set you for today, then set
one for them for tomorrow — so there's no "answer yours first" lock any more (what
you're solving was set yesterday, and what you set can't be swayed by it). Day one,
or a day they missed, the tile goes straight to setting.

Scoring is you vs your partner, to whoever solves, out of 10 a puzzle (50 a day):
Their Word 10/8/6/4/3/2 by guesses, The Dial 10 bullseye / 7 within 5 / 4 within 15,
Top 5 and Their Numbers 2 per exact and 1 per close, Sketch 10/6/3 by guesses.
Worked out from the puzzles, never stored. `board()` returns the whole screen in one
call. The streak counts a day once you've both solved one of that day's or set one
for the next. If the server hasn't got `board()` yet the app falls back to the
earlier one-a-day slot below.

## Earlier: daily puzzles (needs Supabase)

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
2. ~~Pairing~~ — done: a six-letter code, anonymous sign-in per phone. ~~Use the pairing
   to drop the room code from Tonight~~ — done (migration 0011). A paired couple gets
   its own persistent room code (distinct from the one-time pairing code, which is
   cleared after use) and "Just two phones" joins straight into it, skipping
   Playroom's own room-code lobby. Unpaired phones and Playroom's own share links are
   unaffected.
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
6. ~~Set today's, not just tomorrow's, when nothing's set yet~~ — done. Day one (or a day
   you both missed) used to only ever let you set for tomorrow, so there was never
   anything to play until day two. Now the tile offers "Set [partner]'s **for today**"
   whenever nothing's been set for today at all (`kinds[k].mine` is empty) — same set
   screens, same server calls, just `forDate` = today instead of tomorrow (the server
   already allowed it: `set_word` and friends accept anything from two days ago to three
   ahead). Once something exists for today, the flow is back to normal: solve today's,
   set tomorrow's. No migration.
7. Fallback puzzles for a day your partner didn't set one — possibly recycled from your
   own past sessions. Deliberately left for later.

## Done

- Tonight: a five-minute session (Who's More Likely, Mr & Mrs, Draw Your Answer,
  Lights Out) on a two-tab home (Today / Games).
- Who's More Likely, Mr & Mrs (type your answer + predict theirs; the answer's owner
  rules on the prediction), Lights Out.
- Quick Draw reframed as Draw Your Answer.
- Night mode.
- Scoring balanced so every game tops out near 40 over a full session.
