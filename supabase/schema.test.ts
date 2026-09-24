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
  await db.exec(m0003)
  await db.exec(m0004)
  await db.exec(m0005)
  await db.exec(m0006)
  await db.exec(m0007)
  await db.exec(m0008)
  await db.exec(m0009)
  await db.exec(m0010)
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
    expect(Object.keys(b.kinds).sort()).toEqual(['dial', 'numbers', 'sketch', 'top5', 'word'])
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
  it('takes the couple and its puzzles with the last one out', async () => {
    await call(SAM, 'leave_couple')
    expect(await call(ALEX, 'daily', [today()])).toMatchObject({ state: 'waiting' })
    await call(ALEX, 'leave_couple')
    const left = await db.query<{ n: number }>('select count(*)::int as n from public.puzzles')
    expect(left.rows[0].n).toBe(0)
  })
})
