// BETA M233 CLASH v2c: FIGHT MEMORY (clash-lessons.ts + the tactic hunks in clash-fight.ts decide()/react()).
// Run: npx tsx src/app/shimmer/open/ather/clash-lessons.test.ts
import { LESSONS, LESSON_IDS, LESSON_CAP, LEARN_CHANCE, LESSON_UI, factsOf, triggered, learnFrom, tacticsOf, parseLessons, type BoutRecord } from './clash-lessons'
import { createFight, runFight, step, tentEntrant, type FightEvent, type Tactic, type Entrant } from './clash-fight'
import { CLASH_SPECIES } from './fair-clash'
import { ELEMENTS, type Species, type Element } from '../../spirits/spirit'
import { parseBook } from './grimoire-book'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }

// ── 1. each lesson triggers off a crafted event log (and its near miss does not) ──
const H = (side: 0 | 1, move: 'melee' | 'bonded', eff = 1): FightEvent => ({ kind: 'hit', side, move, dmg: 5, eff })
const rec = (o: Partial<BoutRecord> & { ev: FightEvent[] }): BoutRecord => ({ side: 0, foe: { species: 'fox', element: 'base' }, won: true, hpEnd: 0.6, ...o })
const owl = { species: 'owl' as Species, element: 'base' as Element }, frog = { species: 'frog' as Species, element: 'base' as Element }
const cases: [string, BoutRecord, BoutRecord][] = [
  ['stung', rec({ ev: [H(1, 'bonded', 2)] }), rec({ ev: [H(1, 'bonded', 1), H(0, 'bonded', 2)] })],
  ['caught', rec({ ev: [H(1, 'bonded'), H(1, 'bonded')] }), rec({ ev: [H(1, 'bonded'), { kind: 'evaded', side: 0, move: 'bonded' }] })],
  ['kited', rec({ won: false, foe: owl, ev: [] }), rec({ won: false, foe: frog, ev: [] })],
  ['crowded', rec({ won: false, foe: frog, ev: [H(1, 'melee'), H(1, 'melee'), H(1, 'melee')] }), rec({ won: true, foe: frog, ev: [H(1, 'melee'), H(1, 'melee'), H(1, 'melee')] })],
  ['reach', rec({ ev: [H(0, 'bonded'), H(0, 'bonded'), H(0, 'melee')] }), rec({ ev: [H(0, 'bonded'), H(0, 'bonded'), H(0, 'melee'), H(0, 'melee')] })],
  ['brawl', rec({ ev: [H(0, 'melee'), H(0, 'melee'), H(0, 'melee')] }), rec({ won: false, ev: [H(0, 'melee'), H(0, 'melee'), H(0, 'melee')] })],
  ['rally', rec({ ev: [{ kind: 'cheer', side: 0 }] }), rec({ ev: [{ kind: 'cheer', side: 1 }] })],
  ['close_call', rec({ hpEnd: 0.1, ev: [] }), rec({ hpEnd: 0.3, ev: [] })],
  ['whiff', rec({ ev: [{ kind: 'miss', side: 0, move: 'bonded' }, { kind: 'miss', side: 0, move: 'melee' }] }), rec({ ev: [{ kind: 'miss', side: 1 }, { kind: 'miss', side: 0 }] })],
  ['walled', rec({ ev: [{ kind: 'guarded', side: 0, move: 'melee' }, { kind: 'guarded', side: 0, move: 'melee' }] }), rec({ ev: [{ kind: 'guarded', side: 1 }, { kind: 'guarded', side: 1 }] })],
  ['dodged', rec({ ev: [{ kind: 'evaded', side: 1, move: 'melee' }, { kind: 'evaded', side: 1, move: 'bonded' }] }), rec({ ev: [{ kind: 'evaded', side: 0 }, { kind: 'evaded', side: 0 }] })],
  ['snared', rec({ ev: [{ kind: 'rider', side: 1, rider: 'slow' }, { kind: 'rider', side: 1, rider: 'dot' }] }), rec({ ev: [{ kind: 'rider', side: 1, rider: 'slow' }, { kind: 'rider', side: 1, rider: 'mend' }] })],
]
ok(cases.length === LESSONS.length && LESSONS.every(l => cases.some(c => c[0] === l.id)), 'every lesson has a crafted case')
for (const [id, hit, miss] of cases) {
  ok(triggered(hit).includes(id), `${id}: its log triggers it`)
  ok(!triggered(miss).includes(id), `${id}: the near miss does not`)
}
// seat 1: the same log read from the other side
ok(triggered({ ...rec({ ev: [H(0, 'bonded', 2)] }), side: 1 }).includes('stung'), 'side 1 reads the foe as seat 0')
ok(factsOf(rec({ ev: [H(1, 'melee'), H(0, 'melee')] })).tookMelee === 1, 'facts count her side only')

// ── 2. learning: once, capped, one a bout, a loss teaches more ──
const busy = rec({ won: false, foe: owl, hpEnd: 0, ev: [H(1, 'bonded', 2), H(1, 'bonded'), { kind: 'miss', side: 0 }, { kind: 'miss', side: 0 }] })
let lostN = 0, wonN = 0
for (let s = 1; s <= 2000; s++) {
  const l = learnFrom([], busy, s)
  if (l) { lostN++; ok(triggered(busy).includes(l), 'learns only a triggered lesson') }
}
// one trigger (whiff), won vs lost: the rate follows LEARN_CHANCE
const whiff = (won: boolean) => rec({ won, foe: frog, ev: [{ kind: 'miss', side: 0 }, { kind: 'miss', side: 0 }] })
for (let s = 1; s <= 2000; s++) { if (learnFrom([], whiff(true), s)) wonN++; if (learnFrom([], whiff(false), s)) lostN -= 0 }
let lostW = 0
for (let s = 1; s <= 2000; s++) if (learnFrom([], whiff(false), s)) lostW++
ok(lostW > wonN * 1.5, `a loss teaches more (${lostW} vs ${wonN} of 2000)`)
ok(Math.abs(lostW / 2000 - LEARN_CHANCE.lost) < 0.05 && Math.abs(wonN / 2000 - LEARN_CHANCE.won) < 0.05, 'learn rate = LEARN_CHANCE')
ok(lostN > 0, 'a busy loss teaches')
ok(LEARN_CHANCE.lost > LEARN_CHANCE.won, 'loss chance above win chance')
ok(learnFrom([], busy, 7) === learnFrom([], busy, 7), 'seeded: the same bout learns the same')
const all = triggered(busy)
ok(learnFrom(all, busy, 3) === null, 'never relearns one she has')
ok([...Array(200)].every((_, s) => { const l = learnFrom(['stung'], busy, s); return l !== 'stung' }), 'stung once')
const full = LESSON_IDS.filter(id => id !== 'whiff').slice(0, LESSON_CAP)
ok([...Array(300)].every((_, s) => learnFrom(full, whiff(false), s) === null), 'capped at LESSON_CAP')
ok([...Array(300)].some((_, s) => learnFrom(full.slice(1), whiff(false), s) === 'whiff'), 'under the cap she still learns')
ok(LESSON_CAP < LESSONS.length, 'the cap makes her list a choice')

// ── 3. storage ──
ok(JSON.stringify(parseLessons(['stung', 'stung', 'nope', 3, 'whiff'])) === '["stung","whiff"]', 'parse drops junk + repeats')
ok(parseLessons([...LESSON_IDS])!.length === LESSON_CAP, 'parse caps')
ok(parseLessons('stung') === undefined && parseLessons([]) === undefined, 'parse: not a list = none')
const book = parseBook({ v: 1, pages: [], met: [], pots: { p1: { seed: 'mana_seed_fox', at: 1, bloomed: true, lessons: ['kited', 'bogus'] }, p2: { seed: 'mana_seed_fox', at: 1, lessons: ['kited'] } } })
ok(JSON.stringify(book.pots.p1?.lessons) === '["kited"]', 'parseBook keeps her lessons')
ok(book.pots.p2 && !('lessons' in book.pots.p2), 'an unbloomed pot carries none')
ok(LESSONS.every(l => typeof LESSON_UI.name[l.id] === 'string' && LESSON_UI.name[l.id].length < 48), 'every lesson has a short readable label')
ok(JSON.stringify(tacticsOf(['kited', 'x', 'stung'])) === '["pressKiter","saveDefense"]', 'tacticsOf maps ids')

// ── 4. NEVER a stat: a learned fighter is the same fighter, number for number ──
const tac: Tactic[] = LESSONS.map(l => l.tactic)
for (const sp of CLASH_SPECIES) {
  const F = tentEntrant(sp, 'base', 'easy'), L: Entrant = { ...F, tactics: tac }
  const a = createFight(L, F, 11), b = createFight(F, F, 11)
  const strip = (f: typeof a.f[0]) => { const { tac: _t, ...rest } = f._; return JSON.stringify({ ...f, _: rest }) }
  ok(strip(a.f[0]) === strip(b.f[0]), `${sp}: learned = fresh in every number (hp, stats, speed, read, cooldowns, bonded)`)
}

// ── 5. the tactic shift is visible in the engine's choice: a 'tactic' event (her pick differed from the one without it) ──
const seen = new Map<Tactic, number>()
for (const t of tac) {
  let n = 0
  outer: for (const tier of ['easy', 'average'] as const) for (const a of CLASH_SPECIES) for (const b of CLASH_SPECIES) {
    const el: Element = tier === 'easy' ? 'base' : ELEMENTS[(a.length + b.length) % ELEMENTS.length]
    const elb: Element = tier === 'easy' ? 'base' : ELEMENTS[(a.length * 3 + 1) % ELEMENTS.length]
    const r = runFight({ ...tentEntrant(a, el, tier), tactics: [t] }, tentEntrant(b, elb, tier), a.length * 100 + b.length, { keepLog: true })
    const ev = r.log.flatMap(l => l.ev).filter(e => e.kind === 'tactic')
    if (ev.some(e => e.side === 1)) { ok(false, `${t}: the fresh side never shows a tactic`); break outer }
    n += ev.filter(e => e.tactic === t).length
    if (n >= 3) break outer
  }
  seen.set(t, n)
  ok(n >= 1, `${t}: shifts her choice in a real fight (${n})`)
}
// a fight with no lessons logs no tactic and plays exactly as before
const f0 = runFight(tentEntrant('fox', 'base', 'easy'), tentEntrant('owl', 'base', 'easy'), 42, { keepLog: true })
ok(!f0.log.some(l => l.ev.some(e => e.kind === 'tactic')), 'no lessons = no tactic events')
const f1 = runFight({ ...tentEntrant('fox', 'base', 'easy'), tactics: [] }, tentEntrant('owl', 'base', 'easy'), 42)
ok(f1.seconds === f0.seconds && f1.winner === f0.winner, 'an empty lesson list plays the same fight')

// a crafted moment: pressKiter makes her step IN on a far kind where she would hold her range
{
  const mk = (t: Tactic[]) => {
    const s = createFight({ ...tentEntrant('fox', 'base', 'easy'), tactics: t }, tentEntrant('owl', 'base', 'easy'), 5)
    const [me, foe] = s.f
    me.x = -1.5; me.z = 0; foe.x = 1.5; foe.z = 0
    me.cd.melee = 0.5; me.cd.bonded = 5; me._.nextDecide = 0; foe._.nextDecide = 99; foe.cd.bonded = 5; foe.cd.melee = 5
    const l = step(s)
    return { l, dx: s.f[0].act.dx ?? 0, kind: s.f[0].act.kind }
  }
  const a = mk(['pressKiter']), b = mk([])
  ok(a.l.ev.some(e => e.kind === 'tactic' && e.tactic === 'pressKiter' && e.side === 0), 'crafted: pressKiter logged')
  ok(a.kind === 'reposition' && a.dx > b.dx, `crafted: she heads further in (${a.dx.toFixed(3)} > ${b.dx.toFixed(3)})`)
}
// crafted: waitGuard = no strike into a raised guard
{
  const mk = (t: Tactic[]) => {
    const s = createFight({ ...tentEntrant('frog', 'base', 'easy'), tactics: t }, tentEntrant('turtle', 'base', 'easy'), 5)
    const [me, foe] = s.f
    me.x = -0.6; foe.x = 0.6; me.cd.melee = 0; me.cd.bonded = 9; me._.nextDecide = 0; foe._.nextDecide = 99
    foe.act = { kind: 'guard', phase: 'active', t: 0, dur: 2 }
    step(s)
    return s.f[0].act.kind
  }
  ok(mk([]) === 'melee' && mk(['waitGuard']) === 'reposition', 'crafted: waitGuard holds the strike while the guard is up')
}

console.log(`clash-lessons.test: ${pass} passed, ${fail} failed`)
console.log('tactic shifts seen:', [...seen].map(([k, v]) => `${k}:${v}`).join(' '))
process.exit(fail ? 1 : 0)
