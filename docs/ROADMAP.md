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
4. A shared couple streak: a day counts when you've both done the daily, one skip a week.
5. The other four puzzle types.
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
