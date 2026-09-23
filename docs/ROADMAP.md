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
1. A Supabase project (the owner creates it and supplies the URL + anon key).
2. Pairing: link two phones once, permanently. Also removes the room code from Tonight.
3. Their Word first, with a word list for validating both the setter's word and guesses.
4. A shared couple streak: a day counts when you've both done the daily, one skip a week.
5. Fallback puzzles for a day your partner didn't set one — possibly recycled from your
   own past sessions. Deliberately left for later.

## Done

- Tonight: a five-minute session (Who's More Likely, Mr & Mrs, Draw Your Answer,
  Lights Out) on a two-tab home (Today / Games).
- Who's More Likely, Mr & Mrs (type your answer + predict theirs; the answer's owner
  rules on the prediction), Lights Out.
- Quick Draw reframed as Draw Your Answer.
- Night mode.
- Scoring balanced so every game tops out near 40 over a full session.
