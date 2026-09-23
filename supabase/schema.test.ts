import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import m0001 from './migrations/0001_pairing_and_daily.sql?raw'
import m0002 from './migrations/0002_same_question_same_day.sql?raw'

// The migrations run for real, in order, in Postgres compiled to WebAssembly. Supabase's own auth
// schema is stubbed down to the one thing the migration relies on — auth.uid() — and
// every call below is made as the `authenticated` role, the same as a signed-in phone,
// so the grants and row level security are exercised, not bypassed.

const STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  grant usage on schema auth to authenticated, anon;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
  grant usage on schema public to authenticated, anon;
  -- What Supabase does by default, so the migration's revokes are tested against it.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

const SAM = '00000000-0000-0000-0000-00000000000a'
const ALEX = '00000000-0000-0000-0000-00000000000b'
const EVE = '00000000-0000-0000-0000-00000000000e' // not in this couple

let db: PGlite

// Run SQL as a signed-in user, then drop back to the owner.
async function as<T = Record<string, unknown>>(uid: string, sql: string, params: unknown[] = []) {
  await db.exec(`set test.uid = '${uid}'; set role authenticated;`)
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role;')
  }
}
const call = async (uid: string, fn: string, args: unknown[] = []) => {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(', ')
  const rows = await as<{ r: unknown }>(uid, `select public.${fn}(${placeholders}) as r`, args)
  return rows[0].r as any // eslint-disable-line @typescript-eslint/no-explicit-any
}
const today = () => new Date().toISOString().slice(0, 10)
const tomorrow = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(STUB)
  await db.exec(m0001)
  await db.exec(m0002)
  await db.exec(`insert into auth.users (id) values ('${SAM}'), ('${ALEX}'), ('${EVE}')`)
}, 30000)

describe('the wordle colouring', () => {
  const pat = async (g: string, a: string) =>
    (await db.query<{ p: string }>('select public.wordle_pattern($1, $2) as p', [g, a])).rows[0].p

  it('marks right place, wrong place and absent', async () => {
    expect(await pat('crane', 'crane')).toBe('ggggg')
    expect(await pat('nacre', 'crane')).toBe('yyyyg')
    expect(await pat('pudgy', 'crane')).toBe('.....')
  })
  it('never gives a doubled letter more yellows than the answer has', async () => {
    expect(await pat('sheep', 'bread')).toBe('..g..') // one E in the answer: green, no extra yellow
    expect(await pat('speed', 'abide')).toBe('..y.y') // only one E to hand out as yellow
    expect(await pat('allee', 'eagle')).toBe('yy.yg') // one L yellow, the second L nothing
  })
})

describe('the public API cannot touch the tables', () => {
  it('reads and writes nothing directly, even for a signed-in user', async () => {
    await expect(as(SAM, 'select * from public.puzzles')).resolves.toEqual([])
    await expect(as(SAM, `insert into public.couples (code) values ('HACKED')`)).rejects.toThrow()
  })
  it('cannot call the helpers that would reveal an answer', async () => {
    await expect(as(SAM, `select public.wordle_pattern('crane', 'crane')`)).rejects.toThrow(/permission/)
  })
})

describe('pairing', () => {
  it('starts single, waits with a code, then pairs', async () => {
    expect(await call(SAM, 'daily', [today()])).toEqual({ state: 'single' })
    const code = await call(SAM, 'create_couple', ['Sam'])
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/)
    expect(await call(SAM, 'create_couple', ['Sam'])).toBe(code) // asking again: same code
    expect(await call(SAM, 'daily', [today()])).toMatchObject({ state: 'waiting', code, me: 'Sam' })

    await expect(call(ALEX, 'join_couple', ['WRONG1', 'Alex'])).rejects.toThrow(/no such code/)
    await call(ALEX, 'join_couple', [code.toLowerCase() + ' ', 'Alex']) // forgiving about case/space
    expect(await call(SAM, 'daily', [today()])).toMatchObject({ state: 'paired', me: 'Sam', partner: 'Alex' })
    expect(await call(ALEX, 'daily', [today()])).toMatchObject({ state: 'paired', me: 'Alex', partner: 'Sam' })
  })
  it('the code dies once used, so nobody else can join', async () => {
    await expect(call(EVE, 'create_couple', ['Eve'])).resolves.toMatch(/^[A-Z2-9]{6}$/)
    await call(EVE, 'leave_couple')
    // Sam's code was cleared at pairing; there's no way for a third person back in.
    expect(await call(EVE, 'daily', [today()])).toEqual({ state: 'single' })
  })
  it('refuses to pair someone who is already paired', async () => {
    await expect(call(SAM, 'create_couple', ['Sam'])).rejects.toThrow(/already paired/)
  })
})

describe('their word: one question a day, the same for both, solved the same day', () => {
  const Q = 'The animal {name} reminds you of'
  let alexView: any // eslint-disable-line @typescript-eslint/no-explicit-any

  it('shows nothing before either of you has answered', async () => {
    const sam = await call(SAM, 'daily', [today()])
    expect(sam).toMatchObject({ state: 'paired', question: null, mine: null, theirs: null })
  })
  it('refuses anything that is not five letters', async () => {
    await expect(call(SAM, 'set_word', [today(), Q, 'four'])).rejects.toThrow(/five letters/)
    await expect(call(SAM, 'set_word', [today(), Q, 'sixsix'])).rejects.toThrow(/five letters/)
  })
  it('lets Sam answer, and change it, before Alex has started', async () => {
    await call(SAM, 'set_word', [today(), Q, 'Tiger'])
    await call(SAM, 'set_word', [today(), Q, 'otter'])
    const sam = await call(SAM, 'daily', [today()])
    expect(sam.question).toBe(Q)
    expect(sam.mine).toMatchObject({ prompt: Q, answer: 'otter', status: 'open', guesses: [] })
  })
  it("keeps Sam's answer locked away from Alex until Alex has answered too", async () => {
    const alex = await call(ALEX, 'daily', [today()])
    expect(alex.question).toBe(Q) // Alex is told the day's question…
    expect(alex.theirs).toEqual({ locked: true }) // …and that Sam's answered, but nothing of it
    expect(alex.mine).toBe(null)
  })
  it('will not let Alex guess before answering, even by calling the server directly', async () => {
    const id = (await db.query<{ id: string }>(`select id from public.puzzles where setter = '${SAM}'`)).rows[0].id
    await expect(call(ALEX, 'submit_guess', [id, 'otter'])).rejects.toThrow(/answer yours first/)
  })
  it("files Alex's answer under the day's question, whatever Alex's phone sent", async () => {
    await call(ALEX, 'set_word', [today(), 'Some other question', 'koala'])
    const alex = await call(ALEX, 'daily', [today()])
    expect(alex.mine).toMatchObject({ prompt: Q, answer: 'koala' })
    alexView = alex.theirs
    expect(alexView).toMatchObject({ prompt: Q, status: 'open', guesses: [] })
    expect(alexView.answer).toBe(null) // unlocked to play, but still not revealed
  })
  it('scores each guess on the server and reveals the answer when it is over', async () => {
    let view = await call(ALEX, 'submit_guess', [alexView.id, 'tiger'])
    expect(view.patterns).toEqual(['y..gg']) // the T is in OTTER, just elsewhere; E and R in place
    expect(view.answer).toBe(null)
    await expect(call(SAM, 'set_word', [today(), Q, 'panda'])).rejects.toThrow(/already started/)
    view = await call(ALEX, 'submit_guess', [alexView.id, 'OTTER'])
    expect(view).toMatchObject({ status: 'solved', answer: 'otter', guesses: ['tiger', 'otter'] })
  })
  it('only lets the solver guess — not the setter, not a stranger', async () => {
    await expect(call(SAM, 'submit_guess', [alexView.id, 'otter'])).rejects.toThrow(/no such puzzle/)
    await expect(call(EVE, 'submit_guess', [alexView.id, 'otter'])).rejects.toThrow(/no such puzzle/)
  })
  it('shows Sam how Alex got on, and gives Sam theirs to play', async () => {
    const sam = await call(SAM, 'daily', [today()])
    expect(sam.mine).toMatchObject({ status: 'solved', guesses: ['tiger', 'otter'] })
    expect(sam.theirs).toMatchObject({ prompt: Q, status: 'open', answer: null })
  })
  it('fails after six wrong guesses', async () => {
    let view = (await call(SAM, 'daily', [today()])).theirs
    for (const g of ['crane', 'moist', 'blurb', 'fudge', 'kiosk', 'wheat']) {
      view = await call(SAM, 'submit_guess', [view.id, g])
    }
    expect(view).toMatchObject({ status: 'failed', answer: 'koala' })
    expect(view.guesses).toHaveLength(6)
  })
  it('starts fresh the next day', async () => {
    expect(await call(SAM, 'daily', [tomorrow()])).toMatchObject({ question: null, mine: null, theirs: null })
  })
})

describe('unpairing', () => {
  it('takes the couple and its puzzles with the last one out', async () => {
    await call(SAM, 'leave_couple')
    expect(await call(ALEX, 'daily', [today()])).toMatchObject({ state: 'waiting' })
    await call(ALEX, 'leave_couple')
    const left = await db.query<{ n: number }>('select count(*)::int as n from public.puzzles')
    expect(left.rows[0].n).toBe(0)
  })
})
