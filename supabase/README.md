# Supabase setup

The daily puzzle (Their Word) and pairing need two one-off steps in the Supabase
dashboard for this project. Nothing else in the app needs the server — Tonight and
every game still work without it.

## 1. Allow anonymous sign-ins

Authentication → Sign In / Providers → **Allow anonymous sign-ins** → on → Save.

Each phone becomes an anonymous user the first time it opens the Today tab. No email,
no password; pairing is what links two of them. (If a phone's browser data is cleared,
it becomes a new person and has to pair again.)

## 2. Run the migrations, in order, once each

SQL Editor → New query → paste the whole file → **Run**.

1. `migrations/0001_pairing_and_daily.sql` — three tables and six functions.
2. `migrations/0002_same_question_same_day.sql` — replaces three of those functions:
   one question a day for both of you, solved the same day, locked until you've
   answered yours. No tables change.
3. `migrations/0003_five_or_six_letters.sql` — replaces four functions so an answer can
   be five letters or six, and tells the solver which. No tables change.
4. `migrations/0004_streak.sql` — adds one function and has `daily()` report a `streak`
   alongside everything else: consecutive days you've both answered, one missed day
   forgiven. No tables change.
5. `migrations/0005_the_dial.sql` — adds The Dial, a daily Wavelength, as its own card
   next to Their Word (see docs/ROADMAP.md for why it's separate for now). Widens the
   `puzzles.kind` check and adds two jsonb columns (`payload`, `progress`) the later
   puzzle types will reuse; adds `dial_view`, `set_dial`, `submit_dial`, `daily_dial`.
6. `migrations/0006_top_5.sql` — adds Top 5, a daily Shortlist, its own card too. Widens
   `puzzles.kind` again; reuses 0005's `payload`/`progress` columns unchanged. Adds
   `top5_view`, `is_top5_order`, `set_top5`, `submit_top5`, `daily_top5`.

Run a new one before deploying the app that needs it — the app and the functions
have to agree on what the daily card looks like.

## Why the anon key is in the repo

`src/daily/config.ts` holds the project URL and the **anon** key. That key is designed
to be public — every visitor's browser gets it. On its own it can do nothing here: the
tables have row level security with no policies, so the only way in is the six
functions, each of which checks who is calling and only touches that person's couple.

Never commit the **service_role** key. It bypasses all of the above.

## Tests

`schema.test.ts` runs the migration in Postgres-in-WebAssembly (PGlite) with Supabase's
auth stubbed, calling everything as the `authenticated` role — so the grants and the
answer-hiding are tested for real, not assumed.
