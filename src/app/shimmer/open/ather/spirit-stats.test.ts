// M110 s1 the per-spirit stat record (spirit-stats.ts): the cap and gain math. Run: npx tsx src/app/shimmer/open/ather/spirit-stats.test.ts
import { TRAIN, TRAIN_STATS, gainFor, isTrainStat, parseRec, statValue, withFight, withPlay, previewPlay, poolLeft, poolSpent, type StatBook, type StatRec } from './spirit-stats'
import { mayUse, withAssign, parseAssign } from './train-assign'
import { SPECIES_BASE, expNeed } from './spirit-growth'
import { FURNITURE, PIECE_JOBS, REFINE, STONE_REFINE } from './furniture'
import { spiritSheet, SHEET_STATS } from './spirit-sheet'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(TRAIN_STATS.join() === 'pwr,grd,agi,vig', 'canon training stats: PWR / GRD / AGI / VIG only')
ok(TRAIN.gain > 0 && TRAIN.gain <= 2, `a play is a SMALL gain (${TRAIN.gain})`)
ok(TRAIN.cap > 0 && TRAIN.pool > TRAIN.cap && TRAIN.pool < TRAIN.cap * TRAIN_STATS.length, `M118 s2 dials: pool ${TRAIN.pool}, per-stat cap ${TRAIN.cap} (more than one stat, never all four maxed: a choice)`)
// gainFor: the per-stat play cap from both sides (M118 s1: on what PLAY added, never the form; form caps retired)
ok(gainFor(4, 20, 1) === 1, 'under the play cap: the full gain')
ok(gainFor(19.5, 20, 1) === 0.5, 'near the play cap: only up to it')
ok(gainFor(20, 20, 1) === 0, 'AT the play cap: nothing')
ok(gainFor(22, 20, 1) === 0, 'over it (an old save): nothing, and never negative')
ok(gainFor(3, 20, 0) === 0 && gainFor(3, 20, -3) === 0 && gainFor(3, 20, NaN) === 0, 'no gain / a negative gain / NaN: nothing (never lowers)')
// withPlay
const b0: StatBook = {}
const a = withPlay(b0, 'mx', 'axolotl', 'agi')
ok(a.rose === 1 && a.book.mx.g.agi === 1 && a.book.mx.plays === 1, 'first play: +1 AGI, one play')
ok(Object.keys(b0).length === 0, 'the input book is not mutated')
ok(statValue('axolotl', a.book.mx, 'agi') === SPECIES_BASE.axolotl.agi + 1, 'value = rebased species base + gains')
ok(statValue('axolotl', a.book.mx, 'pwr') === SPECIES_BASE.axolotl.pwr && statValue('axolotl', a.book.mx, 'foc') === SPECIES_BASE.axolotl.foc, 'other stats untouched (FOC/RES never train)')
// play to the play cap: lands exactly on it, then stops
let b: StatBook = {}, n = 0
for (; n < 200; n++) { const r = withPlay(b, 'mx', 'axolotl', 'agi'); b = r.book; if (r.rose === 0) break }
ok(b.mx.g.agi === TRAIN.cap && n === TRAIN.cap, `played to the cap: AGI +${b.mx.g.agi} in ${n} gaining plays`)
const atCap = withPlay(b, 'mx', 'axolotl', 'agi')
ok(atCap.rose === 0 && atCap.book.mx.g.agi === TRAIN.cap && atCap.book.mx.plays === b.mx.plays + 1, 'a stat at the play cap does not rise (the play still counts)')
// (5) full power: no form cap holds a spirit back any more: the fox's AGI trains though its OLD base (52) sat past the old 50
ok(withPlay({}, 'vx', 'fox', 'agi').rose === 1, 'no form cap: the Vulnyx AGI trains')
ok(withPlay({ vx: { form: 'base', g: {}, plays: 0, grown: 500 } }, 'vx', 'fox', 'pwr').rose === 1, 'no form cap: a grown spirit still trains')
// the sheet reads the record
const sh = spiritSheet('axolotl', a.book.mx), agi = sh.axes.find(x => x.stat === 'agi')!
ok(agi.value === SPECIES_BASE.axolotl.agi + 1, 'the panel radar reads the record (AGI +1)')
ok(spiritSheet('axolotl').axes.every(x => x.value === SPECIES_BASE.axolotl[x.stat]), 'no record = the rebased species base')
ok(sh.axes.every(x => x.reach > 0 && x.reach <= 1), 'radar reach stays within 0..1')
ok(GARDEN_KEY_SPECS.some(k => k.base === 'ather.spiritStats.v1'), 'the stat record is a registered garden key (cloud save carries it)')

// ── M118 s1: fights fill the bar; old M110 saves migrate; no NaN
{
  const f = withFight({}, ['a', 'b'], expNeed(0))
  ok(f.grew.join() === 'a,b' && f.book.a.grown === 1 && f.book.a.xp === 0, `a full bar each: both grew (${JSON.stringify(f.book.a)})`)
  ok(SHEET_STATS.every(k => statValue('fox', f.book.a, k) > statValue('fox', undefined, k)), 'a growth raises EVERY stat (real values)')
  const half = withFight({}, ['a'], expNeed(0) - 1)
  ok(half.grew.length === 0 && half.book.a.xp === expNeed(0) - 1 && spiritSheet('fox', half.book.a).growth > 0.5, 'part of a bar: no growth, the bar shows it')
  ok(withFight({}, [], 50).grew.length === 0, 'no spirit beside the keeper: nothing')
  const keep = withFight({ a: { form: 'base', g: { agi: 3 }, plays: 4 } }, ['a'], 1)
  ok(keep.book.a.g.agi === 3 && keep.book.a.plays === 4, 'a fight keeps what play added')
  // migration: the M110 record shape, junk, NaN
  const old = parseRec({ form: 'base', g: { agi: 15 }, plays: 3 })!
  ok(old.g.agi === 15 && old.plays === 3 && old.xp === 0 && old.grown === 0, `an M110 save loads: g kept, xp 0, grown 0 (${JSON.stringify(old)})`)
  ok(SHEET_STATS.every(k => Number.isFinite(statValue('axolotl', old, k))), 'an M110 save: every value is a number')
  const junk = parseRec({ form: 'weird', g: { agi: 'x', pwr: -4, grd: 999 }, plays: 'NaN', xp: NaN, grown: 'q' })!
  ok(junk.form === 'base' && !junk.g.agi && !junk.g.pwr && junk.g.grd === TRAIN.cap && junk.plays === 0 && junk.xp === 0 && junk.grown === 0, `junk record cleaned (${JSON.stringify(junk)})`)
  ok(parseRec(null) === null && parseRec([1]) === null && parseRec('s') === null, 'not a record: dropped')
  ok(spiritSheet('fox', junk).axes.every(x => Number.isFinite(x.value) && Number.isFinite(x.reach)), 'the sheet off a junk record: no NaN')
}

// ── M110 s2: each training piece's stat mapping: the four pieces lean to the four stats, one each, a play motion each, a
// recipe of bag goods a keeper already makes, on the bench list; one play at each raises ITS stat only (M118 s1: no form cap any more).
{
  const MAP: Record<string, [string, string]> = { goldwood_hurdle: ['agi', 'leap'], push_stone: ['pwr', 'shove'], guard_posts: ['grd', 'guard'], running_ring: ['vig', 'laps'] }
  const made = new Set([...REFINE, ...STONE_REFINE].map(j => j.out.id))
  for (const [id, [stat, play]] of Object.entries(MAP)) {
    const f = FURNITURE[id]
    ok(!!f && f.train === stat && (f.play ?? 'leap') === play, `${id}: leans to ${stat}, plays '${play}' (${f?.train}/${f?.play ?? 'leap'})`)
    ok(!!f && f.recipe.length > 0 && f.recipe.every(c => made.has(c.id)), `${id}: a recipe of goods the benches already make (${f?.recipe.map(c => c.id).join(',')})`)
    ok(PIECE_JOBS.some(j => j.id === id), `${id}: on the bench's furniture list`)
  }
  const trainers = Object.entries(FURNITURE).filter(([, f]) => f.train)
  ok(trainers.length === 4 && new Set(trainers.map(([, f]) => f.train)).size === 4, `four training pieces, one per stat (${trainers.map(([k, f]) => `${k}:${f.train}`).join(' ')})`)
  // a play at each piece raises THAT stat and no other
  for (const [id, [stat]] of Object.entries(MAP)) {
    if (!isTrainStat(stat)) { ok(false, `${id}: ${stat} not a train stat`); continue }
    const sp = stat === 'vig' ? 'fox' : 'axolotl'
    const r = withPlay({}, 's', sp, stat), others = TRAIN_STATS.filter(k => k !== stat)
    ok(r.rose === 1 && r.book.s.g[stat] === 1 && others.every(k => !r.book.s.g[k]) && others.every(k => statValue(sp, r.book.s, k) === SPECIES_BASE[sp][k]),
      `${id}: one play raises ${sp} ${stat.toUpperCase()} by 1 and nothing else (${JSON.stringify(r.book.s.g)})`)
  }
  ok(withPlay({}, 's', 'axolotl', 'vig').rose === 1 && withPlay({}, 's', 'fox', 'pwr').rose === 1, 'full power: the old past-the-cap stats (Manalotl VIG, Vulnyx PWR) train now')
}


// ── M118 s2: THE TRAINING POOL (fixed, per-stat cap, irreversible) + the preview + the assign gate
{
  // spend the whole pool: AGI to its cap, then PWR until the pool is empty
  let b: StatBook = {}, spentAll = 0, previewsMatch = true, monotone = true, prevLeft = TRAIN.pool
  for (const stat of ['agi', 'pwr', 'grd'] as const) for (let i = 0; i < TRAIN.cap + 5; i++) {
    const before = b.s, pv = previewPlay(before, 'fox', stat), r = withPlay(b, 's', 'fox', stat), after = r.book.s
    if (r.rose !== pv.spend || poolLeft(after) !== pv.left || Math.round(statValue('fox', after, stat)) !== pv.to || Math.round(statValue('fox', before, stat)) !== pv.from) previewsMatch = false
    if (poolLeft(after) > prevLeft || TRAIN_STATS.some(k => (after.g[k] ?? 0) < (before?.g[k] ?? 0))) monotone = false
    prevLeft = poolLeft(after); spentAll += r.rose; b = r.book
  }
  ok(previewsMatch, 'the preview = the actual spend, every play (points, stat before/after, pool after)')
  ok(monotone, 'irreversible: the pool never refills and no stat ever drops')
  ok(spentAll === TRAIN.pool && poolLeft(b.s) === 0 && poolSpent(b.s) === TRAIN.pool, `the pool is fixed: ${spentAll} spent in all, 0 left`)
  ok(b.s.g.agi === TRAIN.cap && b.s.g.pwr === TRAIN.pool - TRAIN.cap && !b.s.g.grd, `per-stat cap then the pool: ${JSON.stringify(b.s.g)}`)
  ok(previewPlay(b.s, 'fox', 'agi').why === 'cap' && previewPlay(b.s, 'fox', 'grd').why === 'pool' && previewPlay(b.s, 'fox', 'vig').spend === 0, 'the preview says why nothing will spend (cap / pool)')
  const fresh = previewPlay(undefined, 'axolotl', 'vig')
  ok(fresh.spend === 1 && fresh.left === TRAIN.pool - 1 && fresh.to === fresh.from + 1 && fresh.why === 'ok', `a fresh spirit: one play = 1 point, +1 (${JSON.stringify(fresh)})`)
  // the gate
  let a = withAssign({}, 'hd', 'vx', true)
  ok(mayUse(a, 'hd', 'vx') && !mayUse(a, 'hd', 'mx') && !mayUse(a, 'ps', 'vx') && !mayUse({}, 'hd', 'vx'), 'only an assigned spirit may use a piece (default: none)')
  a = withAssign(a, 'hd', 'mx', true)
  ok(mayUse(a, 'hd', 'mx') && mayUse(a, 'hd', 'vx'), 'two spirits on one piece')
  const a2 = withAssign(a, 'hd', 'vx', false)
  ok(!mayUse(a2, 'hd', 'vx') && mayUse(a2, 'hd', 'mx') && mayUse(a, 'hd', 'vx'), 'unassign one; the input is not mutated')
  ok(Object.keys(withAssign(withAssign({}, 'hd', 'vx', true), 'hd', 'vx', false)).length === 0, 'an emptied piece drops out')
  ok(JSON.stringify(parseAssign({ hd: ['vx', 'vx', 3, null], ps: 'x', q: [] })) === '{"hd":["vx"]}' && JSON.stringify(parseAssign([1])) === '{}' && JSON.stringify(parseAssign(null)) === '{}', 'junk assign map cleaned')
  ok(GARDEN_KEY_SPECS.some(k => k.base === 'ather.trainAssign.v1'), 'the assign map is a registered garden key')
  // old saves: an M110 record whose g is past the pool (e.g. 20+20+5) loads, nothing lowered, nothing left, no NaN
  const big = parseRec({ form: 'base', g: { agi: 20, pwr: 20, grd: 5 }, plays: 50 }) as StatRec
  ok(big.g.agi === 20 && big.g.grd === 5 && poolLeft(big) === 0 && previewPlay(big, 'fox', 'vig').spend === 0 && Number.isFinite(previewPlay(big, 'fox', 'vig').from), 'an over-pool old save: kept as is, 0 left, no NaN')
}

if (fails.length) { console.error(`spirit-stats: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-stats: ${pass}/0`)
