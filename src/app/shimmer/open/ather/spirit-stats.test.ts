// M110 s1 the per-spirit stat record (spirit-stats.ts): the cap and gain math. Run: npx tsx src/app/shimmer/open/ather/spirit-stats.test.ts
import { FORM_CAP, TRAIN, TRAIN_STATS, gainFor, isTrainStat, statValue, withPlay, type StatBook } from './spirit-stats'
import { FURNITURE, PIECE_JOBS, REFINE, STONE_REFINE } from './furniture'
import { spiritSheet } from './spirit-sheet'
import { SPECIES_STATS_V2 } from '../../engine/party-stats'
import { GARDEN_KEY_SPECS } from '@/lib/keeper-key-specs'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(FORM_CAP.base === 50 && FORM_CAP.second === 75 && FORM_CAP.awakened === 100, 'canon caps: Base 50 / 2nd 75 / Awakened 100')
ok(TRAIN_STATS.join() === 'pwr,grd,agi,vig', 'canon training stats: PWR / GRD / AGI / VIG only')
ok(TRAIN.gain > 0 && TRAIN.gain <= 2, `a play is a SMALL gain (${TRAIN.gain})`)
// gainFor: the cap from both sides
ok(gainFor(34, 50, 1) === 1, 'under the cap: the full gain')
ok(gainFor(49.5, 50, 1) === 0.5, 'near the cap: only up to it')
ok(gainFor(50, 50, 1) === 0, 'AT the cap: nothing')
ok(gainFor(52, 50, 1) === 0, 'over the cap (a species base past it): nothing, and never negative')
ok(gainFor(30, 50, 0) === 0 && gainFor(30, 50, -3) === 0 && gainFor(30, 50, NaN) === 0, 'no gain / a negative gain / NaN: nothing (never lowers)')
ok(gainFor(74, 75, 5) === 1 && gainFor(99, 100, 5) === 1, 'the 2nd / Awakened caps hold the same way')
// withPlay
const b0: StatBook = {}
const a = withPlay(b0, 'mx', 'axolotl', 'agi')
ok(a.rose === 1 && a.book.mx.g.agi === 1 && a.book.mx.plays === 1 && a.book.mx.form === 'base', 'first play: starts from the species base, +1 AGI, one play')
ok(Object.keys(b0).length === 0, 'the input book is not mutated')
ok(statValue('axolotl', a.book.mx, 'agi') === SPECIES_STATS_V2.axolotl.agi + 1, 'value = species base + gains')
ok(statValue('axolotl', a.book.mx, 'pwr') === SPECIES_STATS_V2.axolotl.pwr && statValue('axolotl', a.book.mx, 'foc') === SPECIES_STATS_V2.axolotl.foc, 'other stats untouched (FOC/RES never train)')
// play to the cap: lands exactly on 50, then stops
let b: StatBook = {}, n = 0
for (; n < 200; n++) { const r = withPlay(b, 'mx', 'axolotl', 'agi'); b = r.book; if (r.rose === 0) break }
ok(statValue('axolotl', b.mx, 'agi') === FORM_CAP.base, `played to the cap: AGI ends exactly at ${FORM_CAP.base} (${statValue('axolotl', b.mx, 'agi')})`)
ok(n === FORM_CAP.base - SPECIES_STATS_V2.axolotl.agi, `took ${FORM_CAP.base - SPECIES_STATS_V2.axolotl.agi} gaining plays (${n})`)
const atCap = withPlay(b, 'mx', 'axolotl', 'agi')
ok(atCap.rose === 0 && statValue('axolotl', atCap.book.mx, 'agi') === FORM_CAP.base && atCap.book.mx.plays === b.mx.plays + 1, 'a stat at the cap does not rise (the play still counts)')
// a species already over the Base cap (the Vulnyx's AGI 52): never rises, never lowered
const v = withPlay({}, 'vx', 'fox', 'agi')
ok(SPECIES_STATS_V2.fox.agi > FORM_CAP.base && v.rose === 0 && statValue('fox', v.book.vx, 'agi') === SPECIES_STATS_V2.fox.agi, `a base already past the cap stays (fox AGI ${SPECIES_STATS_V2.fox.agi})`)
ok(withPlay({}, 'vx', 'fox', 'grd').rose === 1, 'the same spirit still grows a stat under the cap (fox GRD)')
// the second form lifts the cap: only evolving does
const evo = withPlay({ mx: { ...b.mx, form: 'second' } }, 'mx', 'axolotl', 'agi')
ok(evo.rose === 1, 'in a 2nd form the same stat rises again (only evolving lifts the cap)')
// the sheet reads the record
const sh = spiritSheet('axolotl', a.book.mx), agi = sh.axes.find(x => x.stat === 'agi')!
ok(agi.value === SPECIES_STATS_V2.axolotl.agi + 1, 'the panel radar reads the record (AGI +1)')
ok(spiritSheet('axolotl').axes.every(x => x.value === SPECIES_STATS_V2.axolotl[x.stat]), 'no record = the species base')
ok(sh.axes.every(x => x.reach > 0 && x.reach <= 1), 'radar reach stays within 0..1')
ok(GARDEN_KEY_SPECS.some(k => k.base === 'ather.spiritStats.v1'), 'the stat record is a registered garden key (cloud save carries it)')

// ── M110 s2: each training piece's stat mapping: the four pieces lean to the four stats, one each, a play motion each, a
// recipe of bag goods a keeper already makes, on the bench list; one play at each raises ITS stat only (never past the cap).
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
  // a play at each piece on a spirit below the cap raises THAT stat and no other (the Manalotl: PWR 30, GRD 46, AGI 34; VIG 54 is past the cap)
  for (const [id, [stat]] of Object.entries(MAP)) {
    if (!isTrainStat(stat)) { ok(false, `${id}: ${stat} not a train stat`); continue }
    const sp = stat === 'vig' ? 'fox' : 'axolotl'   // the fox's VIG 44 is under the cap, the Manalotl's 54 is past it
    const r = withPlay({}, 's', sp, stat), others = TRAIN_STATS.filter(k => k !== stat)
    ok(r.rose === 1 && r.book.s.g[stat] === 1 && others.every(k => !r.book.s.g[k]) && others.every(k => statValue(sp, r.book.s, k) === SPECIES_STATS_V2[sp][k]),
      `${id}: one play raises ${sp} ${stat.toUpperCase()} by 1 and nothing else (${JSON.stringify(r.book.s.g)})`)
  }
  ok(withPlay({}, 's', 'axolotl', 'vig').rose === 0 && withPlay({}, 's', 'fox', 'pwr').rose === 0, 'past the cap at the ring / the stone: no gain (Manalotl VIG 54, Vulnyx PWR 54)')
}

if (fails.length) { console.error(`spirit-stats: ${pass} pass, ${fails.length} FAIL`); for (const f of fails) console.error('  ✗ ' + f); process.exit(1) }
console.log(`spirit-stats: ${pass}/0`)
