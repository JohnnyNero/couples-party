# Roadmap

Decisions already made, so they survive between sessions. Newest at the top.

## Next

1. **Couple leaderboards**, among friend couples.
2. **Release readiness**, still open from the release critique:
   - pairing codes that expire;
   - the room code left out of links the lobby shares;
   - strong randomness for the older codes (pairing, room), as friend codes already use;
   - register a Playroom game id;
   - a privacy notice, error reporting, hiding the testing-only links, and a domain of
     our own (which would also let email move from Gmail to a proper sender).
3. Maybe: a small alert when someone in one of your *other* couples is waiting in a
   lobby or has nudged you — today you only see it once you switch to that couple.

## Done: more than one couple (migration 0028)

You can be in several couples (a partner, a friend, a sibling, a parent) and switch
between them. One is the one you're using; the whole app is that couple's.

How: in each couple you're a different *persona*, with its own id; your first is your
own account id, so nothing that existed moved. `person()`, which every function already
asks "who is this?", now answers with the persona you're using, so none of the games' or
puzzles' functions changed. New: `my_couples()`, `switch_couple()`, `add_couple()`.
Decisions:
- One couple at a time, chosen on the server (not per request), so every existing
  function works as it was.
- Your name and photo are the same in every couple; a new couple brings your photo.
- Unpairing ends only the couple you're using, then you're in your next one.
  Deleting your account ends all of them.
- You can't pair with yourself (another of your own personas). Up to ten couples.
- Switching reloads the app. What the phone keeps for a couple (Our questions cache, a
  game in progress, the getting-started list…) is put aside under that couple and
  brought back when you return (`src/couples/store.ts`).
- In the app: Profile → "Your couples" (switch, or "Add another couple"); a ▾ on
  Today's title when you're in more than one; an invite link opened by someone already
  paired offers "Add them as another couple".

## Done: rude questions switch (migration 0027)

About twenty properly rude entries in the content file are tagged `(rude)` (on an entry
or a Shortlist theme). A couple has one switch for them, shared by both phones, in
Profile → Settings. New couples start with it off; couples that already existed kept it
on. Flirty entries stay in for everyone. Considered and dropped: a filter by
relationship type (dating, married…), since the content already assumes nothing about
living together, marriage, kids or gender.

## Done: friend couples (migration 0026)

A Friends tab. Each couple has a friend link and an eight-character code (strong
randomness); opening a link or entering a code shows who it is before adding. Friends
see only names, photos, the streak, whether you've played Today's games (and your team
score) and how many of today's puzzles you've solved — never answers, puzzles or
Memories. Friendships are between couples, up to 100 each, and go with the couple.

## Done: real accounts (migration 0025)

Sign in with an email code (or its link); Google is built in and shows once it's switched
on in Supabase. A guest's anonymous account is upgraded in place, so nothing moves.
Replaces the old device-linking codes. Every tester makes an account before pairing (no
"skip for now"). Profile shows who you're signed in as, Sign out, and Delete account.
Email goes through Gmail SMTP for now, since there's no domain yet.

## Done, in brief: from Profile to Game night (migrations 0013–0024)

- **Profile** (0013): name, photo, unpairing; **Our questions** (0014), your own questions
  dealt in ahead of the built-in ones; **invite links** that pair in one tap.
- **Today**: a weekly crown and team total, a kinder streak (0016); **This or That**, the
  sixth daily puzzle (0017); the same question for both of you (0018); a numbered daily
  session, the same for every couple, with a share card.
- **Live games**: Two Lies & a Truth, Called It (replacing Put a Finger Down), Mind Meld,
  Describe It, Tongue Twisters, Higher or Lower, Guesstimate, and fillers (Spot It,
  Frenzy, Follow Me alongside Perfect Circle and Stop the Clock). Team points, with every
  game worth the same to the night. Games sorted into kinds (about you two / play /
  filler) and sessions built from slots of each. Game night picks its length (short,
  medium, long) and can reroll its games in the lobby.
- **Playing together**: save a game and carry on later; nudge your partner from the
  lobby (0019), and they see you waiting without one; a game closes at its end so the
  next starts cleanly; a two-phone simulator (`src/net/fakePlayroom.ts`) and fixes for
  the races it found. The TV mode was removed.
- **Stats** from the Today scoreboard (0020); **the crossword**: weekly, built from your
  answers, solved separately, with an archive (0021–0024).
- **Onboarding**: a tour, setting up, inviting your partner, and a getting-started list.
- Our own on-screen keyboard; installing to the home screen; transitions, touch feedback
  and celebrations.

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
