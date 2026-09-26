import { describe, it, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import m0001 from './migrations/0001_pairing_and_daily.sql?raw'
import m0002 from './migrations/0002_same_question_same_day.sql?raw'
import m0003 from './migrations/0003_five_or_six_letters.sql?raw'
import m0004 from './migrations/0004_streak.sql?raw'
import m0005 from './migrations/0005_the_dial.sql?raw'
import m0006 from './migrations/0006_top_5.sql?raw'
import m0007 from './migrations/0007_sketch.sql?raw'
import m0008 from './migrations/0008_their_numbers.sql?raw'
import m0009 from './migrations/0009_streak_any_puzzle.sql?raw'
import m0010 from './migrations/0010_solve_then_set.sql?raw'
import m0011 from './migrations/0011_couple_room_code.sql?raw'
import m0012 from './migrations/0012_memories.sql?raw'
import m0013 from './migrations/0013_profile.sql?raw'
import m0014 from './migrations/0014_our_questions.sql?raw'
import m0015 from './migrations/0015_more_than_one_device.sql?raw'
import m0016 from './migrations/0016_week_and_team.sql?raw'
import m0017 from './migrations/0017_this_or_that.sql?raw'
import m0018 from './migrations/0018_day_prompts.sql?raw'
import m0019 from './migrations/0019_nudge.sql?raw'
import m0020 from './migrations/0020_records.sql?raw'

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
const SAM2 = '00000000-0000-0000-0000-0000000000a2' // Sam's second device, once it's linked

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
  await db.exec(m0003)
  await db.exec(m0004)
  await db.exec(m0005)
  await db.exec(m0006)
  await db.exec(m0007)
  await db.exec(m0008)
  await db.exec(m0009)
  await db.exec(m0010)
  await db.exec(m0011)
  await db.exec(m0012)
  await db.exec(m0013)
  await db.exec(m0014)
  await db.exec(m0015)
  await db.exec(m0016)
  await db.exec(m0017)
  await db.exec(m0018)
  await db.exec(m0019)
  await db.exec(m0020)
  await db.exec(`insert into auth.users (id) values ('${SAM}'), ('${ALEX}'), ('${EVE}'), ('${SAM2}')`)
}, 30000)

describe('the wordle colouring', () => {
  const pat = async (g: string, a: string) =>
    (await db.query<{ p: string }>('select public.wordle_pattern($1, $2) as p', [g, a])).rows[0].p

  it('marks right place, wrong place and absent', async () => {
    expect(await pat('crane', 'crane')).toBe('ggggg')
    expect(await pat('nacre', 'crane')).toBe('yyyyg')
    expect(await pat('pudgy', 'crane')).toBe('.....')
  })
  it('colours six letters just the same', async () => {
    expect(await pat('cheese', 'coffee')).toBe('g.y..g')
    expect(await pat('coffee', 'coffee')).toBe('gggggg')
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
  it('cannot call the streak helper directly either', async () => {
    await expect(as(SAM, `select public.couple_streak(gen_random_uuid(), current_date)`)).rejects.toThrow(/permission/)
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
  it('refuses anything that is not five or six letters', async () => {
    await expect(call(SAM, 'set_word', [today(), Q, 'four'])).rejects.toThrow(/five or six letters/)
    await expect(call(SAM, 'set_word', [today(), Q, 'sevenss'])).rejects.toThrow(/five or six letters/)
    await expect(call(SAM, 'set_word', [today(), Q, 'ott3r'])).rejects.toThrow(/five or six letters/)
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
  it('takes a six-letter answer, tells the solver the length, and holds guesses to it', async () => {
    await call(SAM, 'set_word', [tomorrow(), 'Your mood as weather', 'stormy'])
    await call(ALEX, 'set_word', [tomorrow(), 'Your mood as weather', 'sunny'])
    let view = (await call(ALEX, 'daily', [tomorrow()])).theirs
    expect(view).toMatchObject({ length: 6, answer: null })
    expect((await call(SAM, 'daily', [tomorrow()])).theirs).toMatchObject({ length: 5 })
    await expect(call(ALEX, 'submit_guess', [view.id, 'storm'])).rejects.toThrow(/six letters/)
    await expect(call(SAM, 'submit_guess', [(await call(SAM, 'daily', [tomorrow()])).theirs.id, 'stormy']))
      .rejects.toThrow(/five letters/)
    view = await call(ALEX, 'submit_guess', [view.id, 'cloudy'])
    expect(view.patterns).toEqual(['..g..g']) // the O and the Y are both in place
    view = await call(ALEX, 'submit_guess', [view.id, 'Stormy'])
    expect(view).toMatchObject({ status: 'solved', answer: 'stormy' })
  })
})

describe('the dial: a daily wavelength', () => {
  const SPECTRUM = 'Cold | Hot'
  let alexView: any // eslint-disable-line @typescript-eslint/no-explicit-any

  it('shows nothing before either of you has set one', async () => {
    const sam = await call(SAM, 'daily_dial', [today()])
    expect(sam).toMatchObject({ state: 'paired', prompt: null, mine: null, theirs: null })
  })
  it('rejects a target or clue out of range', async () => {
    await expect(call(SAM, 'set_dial', [today(), SPECTRUM, -1, 'ice'])).rejects.toThrow(/target out of range/)
    await expect(call(SAM, 'set_dial', [today(), SPECTRUM, 101, 'ice'])).rejects.toThrow(/target out of range/)
    await expect(call(SAM, 'set_dial', [today(), SPECTRUM, 50, ''])).rejects.toThrow(/1 to 40 characters/)
  })
  it('lets Sam set one, and change it, before Alex has guessed', async () => {
    await call(SAM, 'set_dial', [today(), SPECTRUM, 80, 'a sauna'])
    await call(SAM, 'set_dial', [today(), SPECTRUM, 82, 'a hot tub'])
    const sam = await call(SAM, 'daily_dial', [today()])
    expect(sam.prompt).toBe(SPECTRUM)
    expect(sam.mine).toMatchObject({ prompt: SPECTRUM, clue: 'a hot tub', status: 'open', guess: null })
    expect(sam.mine.target).toBe(82) // the setter can always see their own mark
  })
  it("keeps Sam's mark locked away from Alex until Alex has set theirs", async () => {
    const alex = await call(ALEX, 'daily_dial', [today()])
    expect(alex.prompt).toBe(SPECTRUM)
    expect(alex.theirs).toEqual({ locked: true })
    expect(alex.mine).toBe(null)
  })
  it("files Alex's mark under the day's spectrum, whatever Alex's phone sent, but Alex's own clue is always visible to Alex", async () => {
    await call(ALEX, 'set_dial', [today(), 'Some other spectrum', 20, 'a snowman'])
    const alex = await call(ALEX, 'daily_dial', [today()])
    expect(alex.mine).toMatchObject({ prompt: SPECTRUM, clue: 'a snowman', target: 20 })
    alexView = alex.theirs
    // Unlocked to play — the clue's the hint, so it's visible, but the mark isn't.
    expect(alexView).toMatchObject({ prompt: SPECTRUM, clue: 'a hot tub', status: 'open' })
    expect(alexView.target).toBe(null)
  })
  it('scores the guess on the server and reveals the mark once placed', async () => {
    const view = await call(ALEX, 'submit_dial', [alexView.id, 70])
    expect(view).toMatchObject({ status: 'solved', target: 82, guess: 70, distance: 12 })
    await expect(call(SAM, 'set_dial', [today(), SPECTRUM, 10, 'ice'])).rejects.toThrow(/already started/)
  })
  it('a repeat guess is a no-op — it just hands back what you already got', async () => {
    expect(await call(ALEX, 'submit_dial', [alexView.id, 5])).toMatchObject({ guess: 70, distance: 12 })
  })
  it('only lets the solver guess — not the setter, not a stranger', async () => {
    await expect(call(SAM, 'submit_dial', [alexView.id, 50])).rejects.toThrow(/no such puzzle/)
    await expect(call(EVE, 'submit_dial', [alexView.id, 50])).rejects.toThrow(/no such puzzle/)
  })
  it('shows Sam how Alex got on, and gives Sam theirs to play', async () => {
    const sam = await call(SAM, 'daily_dial', [today()])
    expect(sam.mine).toMatchObject({ status: 'solved', guess: 70, distance: 12 })
    expect(sam.theirs).toMatchObject({ prompt: SPECTRUM, clue: 'a snowman', status: 'open', target: null })
  })
  it('cannot call the view helper directly', async () => {
    await expect(as(SAM, `select public.dial_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
  })
})

describe('top 5: a daily shortlist', () => {
  const THEME = "five of Sam's small fears"
  const ITEMS = ['moths', 'the dark', 'heights', 'bees', 'lifts']
  let alexView: any // eslint-disable-line @typescript-eslint/no-explicit-any

  it('shows nothing before either of you has ranked one', async () => {
    const sam = await call(SAM, 'daily_top5', [today()])
    expect(sam).toMatchObject({ state: 'paired', prompt: null, mine: null, theirs: null })
  })
  it('rejects anything that is not five items or not a ranking of all five', async () => {
    await expect(call(SAM, 'set_top5', [today(), THEME, ITEMS.slice(0, 4), [0, 1, 2, 3]]))
      .rejects.toThrow(/five items/)
    await expect(call(SAM, 'set_top5', [today(), THEME, ITEMS, [0, 1, 2, 3, 3]]))
      .rejects.toThrow(/not a ranking/)
    await expect(call(SAM, 'set_top5', [today(), THEME, ITEMS, [0, 1, 2, 3, 5]]))
      .rejects.toThrow(/not a ranking/)
  })
  it('lets Sam rank them, and change it, before Alex has guessed', async () => {
    await call(SAM, 'set_top5', [today(), THEME, ITEMS, [4, 3, 2, 1, 0]]) // lifts first, moths last
    // The true order, kept for the rest of this block: moths, the dark, heights, bees,
    // lifts — most afraid of moths, least of lifts.
    await call(SAM, 'set_top5', [today(), THEME, ITEMS, [0, 1, 2, 3, 4]])
    const sam = await call(SAM, 'daily_top5', [today()])
    expect(sam.prompt).toBe(THEME)
    expect(sam.mine).toMatchObject({ prompt: THEME, items: ITEMS, status: 'open', guess: null })
    expect(sam.mine.rank).toEqual([0, 1, 2, 3, 4]) // the setter can always see their own order
  })
  it("keeps Sam's order locked away from Alex until Alex has ranked theirs — but the five items themselves aren't a secret", async () => {
    const alex = await call(ALEX, 'daily_top5', [today()])
    expect(alex.prompt).toBe(THEME)
    expect(alex.theirs).toEqual({ locked: true })
    expect(alex.mine).toBe(null)
  })
  it("files Alex's ranking under the day's five, whatever Alex's phone sent, and unlocks Sam's — items visible, order not", async () => {
    await call(ALEX, 'set_top5', [today(), 'Some other theme', ['a', 'b', 'c', 'd', 'e'], [0, 1, 2, 3, 4]])
    const alex = await call(ALEX, 'daily_top5', [today()])
    expect(alex.mine).toMatchObject({ prompt: THEME, items: ITEMS })
    alexView = alex.theirs
    expect(alexView).toMatchObject({ prompt: THEME, items: ITEMS, status: 'open' })
    expect(alexView.rank).toBe(null)
  })
  it('scores the guess on the server and reveals the order once ranked', async () => {
    // Sam's true order: moths, the dark, heights, bees, lifts (0,1,2,3,4).
    // Alex guesses: heights, the dark, moths, lifts, bees (2,1,0,4,3) — "the dark"
    // lands on the exact rank both gave it (2nd); "bees" and "lifts" are one rank out
    // each; "moths" and "heights" are two out each, so neither counts.
    const view = await call(ALEX, 'submit_top5', [alexView.id, [2, 1, 0, 4, 3]])
    expect(view).toMatchObject({ status: 'solved', rank: [0, 1, 2, 3, 4], guess: [2, 1, 0, 4, 3], exact: 1, near: 2 })
    await expect(call(SAM, 'set_top5', [today(), THEME, ITEMS, [0, 1, 2, 3, 4]])).rejects.toThrow(/already started/)
  })
  it('a repeat guess is a no-op — it just hands back what you already got', async () => {
    expect(await call(ALEX, 'submit_top5', [alexView.id, [4, 3, 2, 1, 0]])).toMatchObject({ exact: 1, near: 2 })
  })
  it('only lets the solver guess — not the setter, not a stranger', async () => {
    await expect(call(SAM, 'submit_top5', [alexView.id, [0, 1, 2, 3, 4]])).rejects.toThrow(/no such puzzle/)
    await expect(call(EVE, 'submit_top5', [alexView.id, [0, 1, 2, 3, 4]])).rejects.toThrow(/no such puzzle/)
  })
  it('shows Sam how Alex got on, and gives Sam theirs to play', async () => {
    const sam = await call(SAM, 'daily_top5', [today()])
    expect(sam.mine).toMatchObject({ status: 'solved', exact: 1, near: 2 })
    expect(sam.theirs).toMatchObject({ prompt: THEME, items: ITEMS, status: 'open', rank: null })
  })
  it('cannot call the view or ordering helpers directly', async () => {
    await expect(as(SAM, `select public.top5_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
    await expect(as(SAM, `select public.is_top5_order(array[0,1,2,3,4])`)).rejects.toThrow(/permission/)
  })
})

describe('sketch: a daily draw your answer', () => {
  const Q = 'comfort food'
  const STROKES = [[[0.1, 0.1], [0.5, 0.5]], [[0.2, 0.8], [0.9, 0.2]]]
  let alexView: any // eslint-disable-line @typescript-eslint/no-explicit-any

  it('forgives case, punctuation, spaces and a leading article — nothing else', async () => {
    const norm = async (t: string) =>
      (await db.query<{ n: string }>('select public.sketch_norm($1) as n', [t])).rows[0].n
    expect(await norm('  Pizza! ')).toBe('pizza')
    expect(await norm('a Hot Dog')).toBe('hotdog')
    expect(await norm('The dark')).toBe('dark')
    expect(await norm('tea')).toBe('tea') // "the" only as a whole word
    expect(await norm('pizzas')).toBe('pizzas')
  })
  it('refuses an empty answer or an empty drawing', async () => {
    await expect(call(SAM, 'set_sketch', [today(), Q, '  ', JSON.stringify(STROKES)])).rejects.toThrow(/1 to 30/)
    await expect(call(SAM, 'set_sketch', [today(), Q, 'pasta', '[]'])).rejects.toThrow(/draw something/)
  })
  it("lets Sam draw, keeps it locked from Alex, for now", async () => {
    await call(SAM, 'set_sketch', [today(), Q, 'Mac and cheese', JSON.stringify(STROKES)])
    const sam = await call(SAM, 'daily_sketch', [today()])
    expect(sam.mine).toMatchObject({ prompt: Q, answer: 'Mac and cheese', strokes: STROKES, status: 'open' })
    expect((await call(ALEX, 'daily_sketch', [today()])).theirs).toEqual({ locked: true })
  })
  it("shows Alex the drawing once Alex has drawn theirs, but not the answer", async () => {
    await call(ALEX, 'set_sketch', [today(), 'another question', 'pizza', JSON.stringify(STROKES)])
    const alex = await call(ALEX, 'daily_sketch', [today()])
    expect(alex.mine.prompt).toBe(Q) // filed under the day's question
    alexView = alex.theirs
    expect(alexView).toMatchObject({ prompt: Q, strokes: STROKES, guesses: [], status: 'open', answer: null })
  })
  it('takes forgiving guesses, and reveals the answer once it lands', async () => {
    let view = await call(ALEX, 'submit_sketch', [alexView.id, 'pasta'])
    expect(view).toMatchObject({ status: 'open', guesses: ['pasta'], answer: null })
    await expect(call(SAM, 'set_sketch', [today(), Q, 'soup', JSON.stringify(STROKES)])).rejects.toThrow(/already started/)
    view = await call(ALEX, 'submit_sketch', [alexView.id, 'mac and CHEESE!'])
    expect(view).toMatchObject({ status: 'solved', answer: 'Mac and cheese' })
  })
  it('fails after three misses', async () => {
    let view = (await call(SAM, 'daily_sketch', [today()])).theirs
    for (const g of ['burger', 'chips', 'curry']) view = await call(SAM, 'submit_sketch', [view.id, g])
    expect(view).toMatchObject({ status: 'failed', answer: 'pizza', guesses: ['burger', 'chips', 'curry'] })
  })
  it('only lets the solver guess, and keeps the helpers private', async () => {
    await expect(call(EVE, 'submit_sketch', [alexView.id, 'x'])).rejects.toThrow(/no such puzzle/)
    await expect(as(SAM, `select public.sketch_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
    await expect(as(SAM, `select public.sketch_norm('x')`)).rejects.toThrow(/permission/)
  })
})

describe('their numbers: five numbers about yourself', () => {
  const QS = ['Countries you have been to', 'Out of 10, how tidy you are', 'Cups of tea a day', 'Pairs of shoes you own', 'Hours of sleep tonight']
  let alexView: any // eslint-disable-line @typescript-eslint/no-explicit-any

  it('marks a guess exact, close (a fifth either way, never under one), or off', async () => {
    const mark = async (g: number, a: number) =>
      (await db.query<{ m: string }>('select public.numbers_mark($1, $2) as m', [g, a])).rows[0].m
    expect(await mark(7, 7)).toBe('exact')
    expect(await mark(6, 7)).toBe('close') // one out of ten — the floor
    expect(await mark(5, 7)).toBe('off')
    expect(await mark(12, 15)).toBe('close') // 3 is a fifth of 15
    expect(await mark(11, 15)).toBe('off')
    expect(await mark(1, 0)).toBe('close')
  })
  it('refuses anything that is not five questions and five whole numbers', async () => {
    await expect(call(SAM, 'set_numbers', [today(), QS.slice(0, 4), [1, 2, 3, 4]])).rejects.toThrow(/five questions/)
    await expect(call(SAM, 'set_numbers', [today(), QS, [1, 2, 3, 4]])).rejects.toThrow(/five whole numbers/)
    await expect(call(SAM, 'set_numbers', [today(), QS, [1, 2, 3, 4, -1]])).rejects.toThrow(/five whole numbers/)
    await expect(call(SAM, 'set_numbers', [today(), QS, [1, 2, 3, 4, 10000]])).rejects.toThrow(/five whole numbers/)
  })
  it("lets Sam answer and change them, locked from Alex for now", async () => {
    await call(SAM, 'set_numbers', [today(), QS, [1, 1, 1, 1, 1]])
    await call(SAM, 'set_numbers', [today(), QS, [15, 7, 3, 12, 8]])
    const sam = await call(SAM, 'daily_numbers', [today()])
    expect(sam.questions).toEqual(QS)
    expect(sam.mine).toMatchObject({ questions: QS, answers: [15, 7, 3, 12, 8], status: 'open', guesses: null })
    expect((await call(ALEX, 'daily_numbers', [today()])).theirs).toEqual({ locked: true })
  })
  it("files Alex's answers under the day's five questions, and shows Alex the questions but not Sam's numbers", async () => {
    await call(ALEX, 'set_numbers', [today(), ['a', 'b', 'c', 'd', 'e'], [2, 5, 1, 30, 7]])
    const alex = await call(ALEX, 'daily_numbers', [today()])
    expect(alex.mine.questions).toEqual(QS)
    alexView = alex.theirs
    expect(alexView).toMatchObject({ questions: QS, status: 'open', answers: null })
  })
  it('marks all five on the server and reveals the answers', async () => {
    const view = await call(ALEX, 'submit_numbers', [alexView.id, [12, 7, 5, 12, 9]])
    expect(view).toMatchObject({
      status: 'solved', answers: [15, 7, 3, 12, 8], guesses: [12, 7, 5, 12, 9],
      marks: ['close', 'exact', 'off', 'exact', 'close'],
    })
    await expect(call(SAM, 'set_numbers', [today(), QS, [1, 1, 1, 1, 1]])).rejects.toThrow(/already started/)
    expect(await call(ALEX, 'submit_numbers', [alexView.id, [0, 0, 0, 0, 0]])).toMatchObject({ guesses: [12, 7, 5, 12, 9] })
  })
  it('only lets the solver guess, and keeps the helpers private', async () => {
    await expect(call(EVE, 'submit_numbers', [alexView.id, [1, 1, 1, 1, 1]])).rejects.toThrow(/no such puzzle/)
    await expect(as(SAM, `select public.numbers_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
    await expect(as(SAM, `select public.numbers_mark(1, 1)`)).rejects.toThrow(/permission/)
  })
})

describe('the board: solve theirs, then set tomorrow', () => {
  const ROBIN = '00000000-0000-0000-0000-00000000000f'
  const JESS = '00000000-0000-0000-0000-000000000010'
  let coupleId: string

  const dayOffset = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  const tomorrowDate = () => dayOffset(1)
  // Rows as the setter would leave them, straight into the table so a history can be
  // built across dates the set_* functions' own window wouldn't allow.
  const put = (setter: string, solver: string, offset: number, kind: string, extra: Record<string, unknown> = {}) =>
    db.query(
      `insert into public.puzzles (couple_id, setter, solver, for_date, kind, prompt, answer, guesses, status, payload, progress)
       values ($1, $2, $3, $4, $5, 'q', $6, $7, $8, $9, $10)`,
      [coupleId, setter, solver, dayOffset(offset), kind, extra.answer ?? '', extra.guesses ?? [],
       extra.status ?? 'open', extra.payload ?? null, extra.progress ?? null],
    )

  beforeAll(async () => {
    await db.exec(`insert into auth.users (id) values ('${ROBIN}'), ('${JESS}')`)
    const code = await call(ROBIN, 'create_couple', ['Robin'])
    await call(JESS, 'join_couple', [code, 'Jess'])
    coupleId = (
      await db.query<{ couple_id: string }>('select couple_id from public.members where user_id = $1', [ROBIN])
    ).rows[0].couple_id
  })

  it('starts empty: nothing to solve, nothing set, no points', async () => {
    const b = await call(ROBIN, 'board', [today()])
    expect(b).toMatchObject({ state: 'paired', me: 'Robin', partner: 'Jess', today: { me: 0, them: 0 }, total: { me: 0, them: 0 }, streak: 0 })
    expect(Object.keys(b.kinds).sort()).toEqual(['dial', 'either', 'numbers', 'sketch', 'top5', 'word'])
    expect(b.kinds.word).toEqual({ solve: null, mine: null, next: null })
  })
  it("sets tomorrow's for the partner, shown as next", async () => {
    await call(ROBIN, 'set_word', [tomorrowDate(), 'Your comfort food', 'pasta'])
    const b = await call(ROBIN, 'board', [today()])
    expect(b.kinds.word.next).toMatchObject({ answer: 'pasta', status: 'open' })
    // …and Jess sees nothing of it until it's tomorrow.
    expect((await call(JESS, 'board', [today()])).kinds.word.solve).toBe(null)
    expect((await call(JESS, 'board', [tomorrowDate()])).kinds.word.solve).toMatchObject({ answer: null, status: 'open', length: 5 })
  })
  it("lets you solve theirs without having set anything first — there's no lock any more", async () => {
    await call(JESS, 'set_dial', [today(), 'Cold | Hot', 40, 'soup'])
    const dial = (await call(ROBIN, 'board', [today()])).kinds.dial.solve
    expect(dial).toMatchObject({ clue: 'soup', target: null, points: null })
    const v = await call(ROBIN, 'submit_dial', [dial.id, 43])
    expect(v).toMatchObject({ distance: 3 })
  })
  it('scores each kind out of 10, to whoever solved it', async () => {
    const pts = async (row: Record<string, unknown>, kind: string) => {
      await put(JESS, ROBIN, -30, kind, row)
      const r = await db.query<{ n: number }>(
        `select public.puzzle_points(p) as n from public.puzzles p where couple_id = $1 and for_date = $2 and kind = $3`,
        [coupleId, dayOffset(-30), kind])
      await db.query(`delete from public.puzzles where couple_id = $1 and for_date = $2`, [coupleId, dayOffset(-30)])
      return r.rows[0].n
    }
    expect(await pts({ status: 'solved', guesses: ['otter'] }, 'word')).toBe(10)
    expect(await pts({ status: 'solved', guesses: ['a', 'b', 'c'] }, 'word')).toBe(6)
    expect(await pts({ status: 'failed', guesses: ['a', 'b', 'c', 'd', 'e', 'f'] }, 'word')).toBe(0)
    expect(await pts({ status: 'solved', progress: { distance: 0 } }, 'dial')).toBe(10)
    expect(await pts({ status: 'solved', progress: { distance: 12 } }, 'dial')).toBe(4)
    expect(await pts({ status: 'solved', progress: { distance: 40 } }, 'dial')).toBe(0)
    expect(await pts({ status: 'solved', progress: { exact: 3, near: 2 } }, 'top5')).toBe(8)
    expect(await pts({ status: 'solved', progress: { guesses: ['a', 'b'] } }, 'sketch')).toBe(6)
    expect(await pts({ status: 'failed', progress: { guesses: ['a', 'b', 'c'] } }, 'sketch')).toBe(0)
    expect(await pts({ status: 'solved', progress: { marks: ['exact', 'close', 'off', 'exact', 'exact'] } }, 'numbers')).toBe(7)
    expect(await pts({ status: 'open' }, 'word')).toBe(0)
  })
  it("adds up today's and all-time points for each of you", async () => {
    await put(ROBIN, JESS, -3, 'word', { status: 'solved', guesses: ['a', 'b'] }) // Jess: 8
    const b = await call(ROBIN, 'board', [today()])
    expect(b.today).toEqual({ me: 7, them: 0 }) // Robin's dial, 3 away
    expect(b.total).toEqual({ me: 7, them: 8 })
    expect(b.kinds.dial.solve.points).toBe(7)
    expect((await call(JESS, 'board', [today()])).kinds.dial.mine).toMatchObject({ points: 7, target: 40 })
  })
  it('counts a streak day once you have both done something — solved that day, or set for the next', async () => {
    // Today: Robin solved Jess's dial, and set tomorrow's word. Jess set today's dial,
    // which is "set for the next day" on yesterday.
    expect(await call(ROBIN, 'streak', [today()])).toBe(0) // Jess hasn't done anything *today*
    await call(JESS, 'set_word', [tomorrowDate(), 'Your comfort food', 'tacos'])
    expect(await call(ROBIN, 'streak', [today()])).toBe(1)
    // A day back with both setting for today counts too; a gap of one is forgiven.
    await put(ROBIN, JESS, 0, 'top5') // Robin had set one for today, too
    expect(await call(ROBIN, 'streak', [today()])).toBe(2) // yesterday (both set for today) + today
    await put(ROBIN, JESS, -2, 'sketch')
    await put(JESS, ROBIN, -2, 'sketch')
    expect(await call(ROBIN, 'streak', [today()])).toBe(3) // -3 counts; -2 missed, forgiven
    await put(ROBIN, JESS, -3, 'numbers')
    await put(JESS, ROBIN, -3, 'numbers')
    await put(ROBIN, JESS, -5, 'dial')
    await put(JESS, ROBIN, -5, 'dial')
    // today, -1, -3 (both set for -2), -4 (both set for -3), -5 missed, -6 (both set for -5)
    expect(await call(ROBIN, 'streak', [today()])).toBe(5)
  })
  it('is zero for someone who is not paired, and keeps the helpers private', async () => {
    expect(await call(EVE, 'streak', [today()])).toBe(0)
    expect(await call(EVE, 'board', [today()])).toEqual({ state: 'single' })
    await expect(as(ROBIN, `select public.puzzle_points(null::public.puzzles)`)).rejects.toThrow(/permission/)
    await expect(as(ROBIN, `select public.any_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
  })
  it('cleans up after itself, so it leaves no puzzles behind for other tests to count', async () => {
    await call(ROBIN, 'leave_couple')
    await call(JESS, 'leave_couple')
    const left = await db.query<{ n: number }>('select count(*)::int as n from public.puzzles where couple_id = $1', [coupleId])
    expect(left.rows[0].n).toBe(0)
  })
})

describe('unpairing', () => {
  it('ends the couple for both of you, and takes its puzzles with it', async () => {
    await call(SAM, 'leave_couple')
    // Not stranded in a couple of one: Alex is back at "pair up" too.
    expect(await call(ALEX, 'daily', [today()])).toEqual({ state: 'single' })
    await call(ALEX, 'leave_couple') // and a second unpair is harmless
    const left = await db.query<{ n: number }>('select count(*)::int as n from public.puzzles')
    expect(left.rows[0].n).toBe(0)
  })
})

describe('my_couple_code', () => {
  it("is null before pairing, then a stable room code shared by both of you — distinct from the one-time pairing code", async () => {
    expect(await call(SAM, 'my_couple_code')).toBe(null)
    const code = await call(SAM, 'create_couple', ['Sam'])
    const room = await call(SAM, 'my_couple_code')
    expect(room).toBeTruthy()
    expect(room).not.toBe(code) // the pairing code is single-use; this one has to keep working
    await call(ALEX, 'join_couple', [code, 'Alex'])
    expect(await call(SAM, 'my_couple_code')).toBe(room) // pairing doesn't roll the room code
    expect(await call(ALEX, 'my_couple_code')).toBe(room) // …and both of you share the same one
    await call(SAM, 'leave_couple'); await call(ALEX, 'leave_couple')
    expect(await call(SAM, 'my_couple_code')).toBe(null)
  })
})

describe('memories', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  const SESSION = { v: 1, game: 'tonight', score: { A: 12, B: 9 }, lights: 'What made you laugh today?' }

  it('keeps a session for the couple, once however many times either phone saves it', async () => {
    expect(await call(SAM, 'memories', [today()])).toEqual({ state: 'single' })
    // Not paired yet: nothing to save to.
    await expect(call(SAM, 'save_moment', ['s1', today(), SESSION])).rejects.toThrow(/not paired/)
    const code = await call(SAM, 'create_couple', ['Sam'])
    await expect(call(SAM, 'save_moment', ['s1', today(), SESSION])).rejects.toThrow(/not paired/) // still waiting
    await call(ALEX, 'join_couple', [code, 'Alex'])

    await call(SAM, 'save_moment', ['s1', today(), SESSION])
    await call(ALEX, 'save_moment', ['s1', today(), { ...SESSION, score: { A: 20, B: 9 } }])
    const mem = await call(ALEX, 'memories', [today()])
    expect(mem).toMatchObject({ state: 'paired', me: 'Alex', partner: 'Sam' })
    expect(mem.sessions).toHaveLength(1)
    expect(mem.sessions[0]).toMatchObject({ key: 's1', playedOn: today(), payload: { score: { A: 20, B: 9 } } })
    // The same for both of you.
    expect((await call(SAM, 'memories', [today()])).sessions).toEqual(mem.sessions)
  })

  it('refuses a far-off date, something that is not a memory, or one that is far too big', async () => {
    await expect(call(SAM, 'save_moment', ['s2', daysAgo(10), SESSION])).rejects.toThrow(/bad date/)
    await expect(call(SAM, 'save_moment', ['s2', today(), [1, 2]])).rejects.toThrow(/bad memory/)
    await expect(call(SAM, 'save_moment', ['s2', today(), { big: 'x'.repeat(310000) }])).rejects.toThrow(/too big/)
  })

  it('never shows one couple another couple’s memories, and is closed to the public', async () => {
    expect(await call(EVE, 'memories', [today()])).toEqual({ state: 'single' })
    await db.exec("set role anon;")
    await expect(db.query('select public.memories($1)', [today()])).rejects.toThrow()
    await db.exec('reset role;')
    expect(await as(SAM, 'select * from public.moments')).toEqual([]) // row level security, no policies
  })

  it('includes past daily puzzles with their answers once the day is over, but never today’s', async () => {
    await call(SAM, 'set_word', [daysAgo(2), 'Your day in one word', 'sunny']) // never solved
    await call(SAM, 'set_word', [today(), 'Your comfort food', 'pasta'])     // still in play
    const mem = await call(ALEX, 'memories', [today()])
    const words = mem.puzzles.filter((p: { kind: string }) => p.kind === 'word')
    expect(words).toHaveLength(1)
    expect(words[0]).toMatchObject({ forDate: daysAgo(2), answer: 'sunny', mine: false })
    expect((await call(SAM, 'memories', [today()])).puzzles[0]).toMatchObject({ mine: true })
    // A phone can't pull today's answer out early by claiming it's tomorrow.
    const early = await call(ALEX, 'memories', [tomorrow()])
    expect(early.puzzles.some((p: { answer?: string }) => p.answer === 'pasta')).toBe(false)
  })

  it('pages back a window of days at a time', async () => {
    const older = await call(SAM, 'memories', [today(), daysAgo(1), 30])
    expect(older.sessions).toEqual([]) // today's session is after the window
    expect(older.puzzles.map((p: { forDate: string }) => p.forDate)).toEqual([daysAgo(2)])
    await call(SAM, 'leave_couple'); await call(ALEX, 'leave_couple')
  })
})

describe('profile', () => {
  const DOT = 'data:image/jpeg;base64,' + 'A'.repeat(200)
  it('says who you are and who you are with, photos included', async () => {
    expect(await call(SAM, 'profile')).toMatchObject({ state: 'single' })
    const code = await call(SAM, 'create_couple', ['Sam'])
    expect(await call(SAM, 'profile')).toMatchObject({ state: 'waiting', code, me: { name: 'Sam', photo: null } })
    await call(ALEX, 'join_couple', [code, 'Alex'])
    await call(SAM, 'set_photo', [DOT])
    expect(await call(ALEX, 'profile')).toMatchObject({
      state: 'paired', me: { name: 'Alex', photo: null }, partner: { name: 'Sam', photo: DOT },
    })
  })
  it('renames you everywhere, within the same limits as pairing', async () => {
    await call(SAM, 'set_name', ['  Samantha '])
    expect((await call(ALEX, 'profile')).partner.name).toBe('Samantha')
    expect((await call(ALEX, 'daily', [today()])).partner).toBe('Samantha')
    await expect(call(SAM, 'set_name', ['   '])).rejects.toThrow(/1 to 24/)
    await expect(call(SAM, 'set_name', ['x'.repeat(25)])).rejects.toThrow(/1 to 24/)
    await expect(call(EVE, 'set_name', ['Eve'])).rejects.toThrow(/not paired/)
  })
  it('only takes a small picture, and null takes it off', async () => {
    await expect(call(SAM, 'set_photo', ['https://example.com/me.jpg'])).rejects.toThrow(/too big/)
    await expect(call(SAM, 'set_photo', ['data:image/jpeg;base64,' + 'A'.repeat(70000)])).rejects.toThrow(/too big/)
    await call(SAM, 'set_photo', [null])
    expect((await call(ALEX, 'profile')).partner.photo).toBe(null)
    await call(SAM, 'leave_couple')
    expect(await call(ALEX, 'profile')).toMatchObject({ state: 'single' })
  })
})

describe('our questions', () => {
  it('is one shared list for the couple, closed to everyone else', async () => {
    expect(await call(SAM, 'ideas')).toEqual([])
    await expect(call(SAM, 'add_idea', ['mrmrs', 'Your best holiday?'])).rejects.toThrow(/not paired/)
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    const a = await call(SAM, 'add_idea', ['mrmrs', '  Your   best holiday? '])
    expect(a).toMatchObject({ kind: 'mrmrs', text: 'Your best holiday?', mine: true })
    await call(ALEX, 'add_idea', ['finger', "you've cried at an advert"])
    const alexSees = await call(ALEX, 'ideas')
    expect(alexSees.map((i: { text: string; mine: boolean }) => [i.text, i.mine])).toEqual([
      ['Your best holiday?', false], ["you've cried at an advert", true],
    ])
    expect(await call(EVE, 'ideas')).toEqual([])
    expect(await as(SAM, 'select * from public.ideas')).toEqual([]) // no policies
  })
  it('checks what goes in: known games, sensible length, no repeats, scales with two ends', async () => {
    await expect(call(SAM, 'add_idea', ['poker', 'hmm'])).rejects.toThrow(/unknown game/)
    await expect(call(SAM, 'add_idea', ['lights', 'x'])).rejects.toThrow(/2 to 120/)
    await expect(call(ALEX, 'add_idea', ['mrmrs', 'your best HOLIDAY?'])).rejects.toThrow(/already on the list/)
    await expect(call(SAM, 'add_idea', ['wave', 'Cringe'])).rejects.toThrow(/two ends/)
    await expect(call(SAM, 'add_idea', ['wave', 'a | b | c'])).rejects.toThrow(/two ends/)
    expect((await call(SAM, 'add_idea', ['wave', 'Cringe|Cool'])).text).toBe('Cringe | Cool')
  })
  it('lets either of you take one off, and goes when you unpair', async () => {
    const [first] = await call(ALEX, 'ideas')
    await expect(call(EVE, 'delete_idea', [first.id])).rejects.toThrow(/not paired/)
    await call(EVE, 'create_couple', ['Eve'])
    await call(EVE, 'delete_idea', [first.id]) // another couple's: quietly nothing
    expect((await call(SAM, 'ideas')).some((i: { id: string }) => i.id === first.id)).toBe(true)
    await call(ALEX, 'delete_idea', [first.id]) // Sam wrote it; Alex can still remove it
    expect((await call(SAM, 'ideas')).some((i: { id: string }) => i.id === first.id)).toBe(false)
    await call(SAM, 'leave_couple')
    const left = await db.query<{ n: number }>('select count(*)::int as n from public.ideas')
    expect(left.rows[0].n).toBe(0)
    await call(EVE, 'leave_couple')
  })
})

describe('more than one device', () => {
  it('makes a linked device the same person: same couple, same puzzles, same name', async () => {
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    await call(SAM, 'set_word', [today(), 'Your comfort food', 'pasta'])
    const link = await call(SAM, 'link_code')
    expect(link).toMatch(/^[A-Z2-9]{6}$/)
    await call(SAM2, 'link_device', [link.toLowerCase()])
    expect(await call(SAM2, 'profile')).toMatchObject({ state: 'paired', linked: true, me: { name: 'Sam' }, partner: { name: 'Alex' } })
    expect((await call(SAM, 'profile')).devices).toBe(1)
    expect((await call(SAM2, 'daily', [today()])).mine).toMatchObject({ answer: 'pasta' }) // Sam's own puzzle, from the other device
    await call(SAM2, 'set_name', ['Samantha'])
    expect((await call(ALEX, 'profile')).partner.name).toBe('Samantha')
    expect(await call(SAM2, 'my_couple_code')).toBe(await call(SAM, 'my_couple_code'))
  })

  it('uses a code once, only before it runs out, and never for a device that is already someone', async () => {
    await expect(call(EVE, 'link_device', ['ZZZZZZ'])).rejects.toThrow(/no such code/)
    const link = await call(SAM, 'link_code')
    await expect(call(ALEX, 'link_device', [link])).rejects.toThrow(/already paired/) // Alex is someone already
    await expect(call(SAM, 'link_device', [link])).rejects.toThrow(/another device/)
    await expect(call(SAM2, 'link_device', [link])).rejects.toThrow(/already linked/)
    await db.exec(`update public.device_codes set expires_at = now() - interval '1 minute'`)
    await expect(call(EVE, 'link_device', [link])).rejects.toThrow(/no such code/)
    expect(await as(SAM, 'select * from public.devices')).toEqual([]) // no policies
  })

  it('lets a device step away, leaving you and your couple as you were', async () => {
    await call(SAM2, 'unlink_device')
    expect(await call(SAM2, 'profile')).toEqual({ state: 'single', linked: false })
    expect(await call(SAM, 'profile')).toMatchObject({ state: 'paired', devices: 0 })
    await call(SAM, 'leave_couple')
  })
})

describe('board_stats', () => {
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
  it('counts this week and last, your best day together, and the days you both played', async () => {
    expect(await call(EVE, 'board_stats', [today()])).toEqual({ state: 'single' })
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    // Yesterday: both set a Dial for each other, and both solved — 10 each on a bullseye.
    await call(SAM, 'set_dial', [day(-1), 'Cold | Hot', 50, 'soup'])
    await call(ALEX, 'set_dial', [day(-1), 'Cold | Hot', 20, 'ice'])
    const y = await call(SAM, 'daily_dial', [day(-1)])
    await call(SAM, 'submit_dial', [y.theirs.id, 20])
    const ya = await call(ALEX, 'daily_dial', [day(-1)])
    await call(ALEX, 'submit_dial', [ya.theirs.id, 45]) // 5 away: 7 points
    const stats = await call(SAM, 'board_stats', [today()])
    expect(stats.bestDay).toBe(17)
    // Both played yesterday (solved) and the day before (set yesterday's).
    expect(stats.daysLast7).toBe(2)
    const monday = new Date(today()); const dow = (monday.getUTCDay() + 6) % 7
    const yesterdayThisWeek = dow >= 1
    expect(stats.week).toEqual(yesterdayThisWeek ? { me: 10, them: 7 } : { me: 0, them: 0 })
    expect(stats.lastWeek).toEqual(yesterdayThisWeek ? { me: 0, them: 0 } : { me: 10, them: 7 })
    expect((await call(ALEX, 'board_stats', [today()])).week).toEqual(yesterdayThisWeek ? { me: 7, them: 10 } : { me: 0, them: 0 })
    await call(SAM, 'leave_couple')
  })
})

describe('this or that: five either/ors about yourself', () => {
  const QS = ['Tea | Coffee', 'Early bird | Night owl', 'Beach | City', 'Sweet | Savoury', 'Call | Text']
  it('pins the pairs, hides the picks, and scores 2 a match', async () => {
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    await expect(call(SAM, 'set_either', [today(), QS.slice(0, 4), [0, 1, 0, 1]])).rejects.toThrow(/five pairs/)
    await expect(call(SAM, 'set_either', [today(), QS, [0, 1, 0, 1, 2]])).rejects.toThrow(/pick one of each/)
    await call(SAM, 'set_either', [today(), QS, [1, 1, 1, 1, 1]])
    await call(SAM, 'set_either', [today(), QS, [0, 1, 0, 1, 0]])
    // Alex's own five land under the same pairs, whatever Alex's phone sent.
    await call(ALEX, 'set_either', [today(), ['a|b', 'c|d', 'e|f', 'g|h', 'i|j'], [1, 1, 0, 0, 1]])
    const alex = await call(ALEX, 'board', [today()])
    expect(Object.keys(alex.kinds)).toContain('either')
    expect(alex.kinds.either.mine).toMatchObject({ questions: QS, answers: [1, 1, 0, 0, 1] })
    const theirs = alex.kinds.either.solve
    expect(theirs).toMatchObject({ kind: 'either', questions: QS, answers: null, status: 'open', points: null })

    const view = await call(ALEX, 'submit_either', [theirs.id, [0, 1, 1, 1, 1]])
    expect(view).toMatchObject({ status: 'solved', answers: [0, 1, 0, 1, 0], guesses: [0, 1, 1, 1, 1], matches: 3 })
    expect(await call(ALEX, 'submit_either', [theirs.id, [0, 0, 0, 0, 0]])).toMatchObject({ matches: 3 })
    await expect(call(SAM, 'set_either', [today(), QS, [1, 1, 1, 1, 1]])).rejects.toThrow(/already started/)
    await expect(call(EVE, 'submit_either', [theirs.id, [0, 0, 0, 0, 0]])).rejects.toThrow(/no such puzzle/)

    const board = await call(ALEX, 'board', [today()])
    expect(board.kinds.either.solve.points).toBe(6)
    expect(board.today.me).toBe(6)
    await expect(as(SAM, `select public.either_view(null::public.puzzles, null::uuid)`)).rejects.toThrow(/permission/)
    await call(SAM, 'leave_couple')
  })
})

describe('day_prompts', () => {
  it("tells you the question your partner already set for a day, never their answer", async () => {
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    expect(await call(ALEX, 'day_prompts', [today()])).toEqual({})
    await call(SAM, 'set_word', [today(), 'Your comfort food', 'pasta'])
    await call(SAM, 'set_top5', [today(), 'five foods', ['a', 'b', 'c', 'd', 'e'], [4, 3, 2, 1, 0]])
    await call(SAM, 'set_either', [today(), ['Tea | Coffee', 'a|b', 'c|d', 'e|f', 'g|h'], [0, 0, 0, 0, 0]])
    const p = await call(ALEX, 'day_prompts', [today()])
    expect(p.word).toEqual({ prompt: 'Your comfort food' })
    expect(p.top5).toEqual({ prompt: 'five foods', items: ['a', 'b', 'c', 'd', 'e'] })
    expect(p.either.questions[0]).toBe('Tea | Coffee')
    expect(JSON.stringify(p)).not.toContain('pasta')
    expect(JSON.stringify(p)).not.toContain('rank')
    // Your own don't come back to you — it's the other one's question you need.
    expect(await call(SAM, 'day_prompts', [today()])).toEqual({})
    expect(await call(EVE, 'day_prompts', [today()])).toEqual({})
    await call(SAM, 'leave_couple')
  })
})

describe('nudge', () => {
  it("shows your partner that you're waiting in a game, and not you", async () => {
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    expect(await call(ALEX, 'nudged', [])).toBeNull()
    await expect(call(SAM, 'nudge', ['tonight; drop', 'duo'])).rejects.toThrow(/no such game/)
    await call(SAM, 'nudge', ['tonight', 'duo'])
    expect(await call(ALEX, 'nudged', [])).toMatchObject({ game: 'tonight', mode: 'duo', from: 'Sam' })
    expect(await call(SAM, 'nudged', [])).toBeNull()
    await expect(call(EVE, 'nudge', ['tonight', 'duo'])).rejects.toThrow(/not paired/)
    // Stale after a quarter of an hour.
    await db.query(`update public.couples set waiting = jsonb_set(waiting, '{at}', to_jsonb(now() - interval '20 minutes'))`)
    expect(await call(ALEX, 'nudged', [])).toBeNull()
    await call(SAM, 'nudge', ['wave', 'duo'])
    await call(ALEX, 'clear_nudge', [])
    expect(await call(ALEX, 'nudged', [])).toBeNull()
    await call(SAM, 'leave_couple')
  })
})

describe('records', () => {
  it('lists every saved night, trimmed to the scores, and takes ideas for the new games', async () => {
    expect(await call(EVE, 'records', [])).toEqual([])
    const code = await call(SAM, 'create_couple', ['Sam'])
    await call(ALEX, 'join_couple', [code, 'Alex'])
    const night = { v: 1, game: 'tonight', players: { A: 'Sam', B: 'Alex' }, score: { A: 30, B: 22 }, team: 41, finished: true,
      games: [{ label: 'Word Chain', points: { A: 10, B: 0 }, team: 12 }], chain: [{ category: 'c', words: ['a', 'b', 'c'], winner: 'A' }],
      draw: [{ strokes: [[[0, 0], [1, 1]]] }] }
    await call(SAM, 'save_moment', ['s1', today(), night])
    const rows = await call(ALEX, 'records', [])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ game: 'tonight', team: 41, finished: true, score: { A: 30, B: 22 }, longestChain: 3 })
    expect(rows[0].draw).toBeUndefined() // no drawings — just the numbers
    expect(await call(SAM, 'add_idea', ['describe', 'our first flat'])).toMatchObject({ kind: 'describe' })
    expect(await call(SAM, 'add_idea', ['meld', 'Our go-to snack'])).toMatchObject({ kind: 'meld' })
    await call(SAM, 'leave_couple')
  })
})
