# Supabase setup

The daily puzzle (Their Word) and pairing need two one-off steps in the Supabase
dashboard for this project. Nothing else in the app needs the server — Tonight and
every game still work without it.

## 1. Allow anonymous sign-ins

Authentication → Sign In / Providers → **Allow anonymous sign-ins** → on → Save.

Each phone becomes an anonymous user the first time it opens the Today tab. No email,
no password; pairing is what links two of them. (If a phone's browser data is cleared,
it becomes a new person and has to pair again.)

## 2. Run the migration

SQL Editor → New query → paste the whole of `migrations/0001_pairing_and_daily.sql` →
**Run**. It creates three tables and six functions, and changes nothing else.

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
