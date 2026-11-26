// BETA M204 (the element comes from COOKING): herb finds, spice + meal items, the hearth's spiced jobs, her 10-slot bar
// (append-only, never resets, locks at 10) and the form gate (3 meals of one element + M201's stat bar).
// Run: npx tsx src/app/shimmer/open/ather/infusions.test.ts
import { readFileSync } from 'node:fs'
import { HERB_OF, TREE_HERB, CRYSTAL_HERB, HERB_FIND_CHANCE, rollHerb, feedMeal, settleForm, mealsOf, mealCounts, mealLean, spiceId, mealId,
  elementOfMeal, BAR_SLOTS, MEALS_FOR_FORM, ELEMENTS } from './infusions'
import { prunePlan } from './forestry'
import { minePlan } from './prospecting'
import { parseBook } from './grimoire-book'
import { itemDef } from '../shared/inventory'
import { SPICED, HEARTH_JOBS, ROAST, isDish } from './cooking'
import { ALL_JOBS } from './station-queue'
import { SECOND_FORM_BAR, GATE_STAT } from '../../spirits/second-form-gate'
import type { FormElement } from '../../spirits/second-form-gate'
import type { Pot } from './spirit-seeds'
import type { Species } from '../../spirits/spirit'
import { seedOf } from './seed-items'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. canon: the four herbs, by element (CANON/game/alchemy.md 07-30), read from the canon file ──────────────────
const canon = readFileSync('/root/athernyx/CANON/game/alchemy.md', 'utf8')
for (const [el, herb] of [['mana', 'Violetbloom'], ['storm', 'Stormgrass'], ['earth', 'Rootvine'], ['water', 'Tidepetal']] as const) {
  ok(canon.includes(`**${herb}** (${el[0].toUpperCase()}${el.slice(1)})`), `canon names ${herb} for ${el}`)
  ok(HERB_OF[el] === herb.toLowerCase(), `${el} infusion is fed by ${herb}`)
}

// ── 2. every herb is FOUND somewhere the keeper already works ──────────────────────────────────────────────────────
const found = new Set([...Object.values(TREE_HERB), ...Object.values(CRYSTAL_HERB)])
ok(found.size === 4, 'all four herbs have a find (3 trees + the Fuli crystal)')
ok(!('goldwood' in TREE_HERB), 'goldwood (the meadows) carries no herb: canon meadow grows common crops')
ok(rollHerb('earth', () => HERB_FIND_CHANCE - 0.001).map(d => d.id).join() === 'crop:rootvine:D,seed:rootvine:D', 'a find = the herb + its seed, grade D')
ok(rollHerb('earth', () => HERB_FIND_CHANCE).length === 0 && rollHerb(undefined, () => 0).length === 0, 'above the odds, or a node with no herb: nothing')
const lo = () => 0.0001   // every roll passes
ok(prunePlan('shimmeroak', lo).some(d => d.id === 'crop:rootvine:D'), 'a pruned shimmeroak can give Rootvine')
ok(prunePlan('starwillow', lo).some(d => d.id === 'seed:tidepetal:D'), 'a pruned starwillow can give Tidepetal')
ok(prunePlan('dawnwood', lo).some(d => d.id === 'crop:stormgrass:D'), 'a pruned dawnwood can give Stormgrass')
ok(!prunePlan('goldwood', lo).some(d => d.id.startsWith('crop:')), 'a goldwood never gives a herb')
ok(minePlan('violet', lo).drops.some(d => d.id === 'crop:violetbloom:D'), 'a broken Fuli can give Violetbloom')
ok(!minePlan('storm', lo).drops.some(d => d.id.startsWith('crop:')), 'other crystals give no herb')
ok(prunePlan('shimmeroak', () => 0.99).every(d => !d.id.startsWith('seed:')), 'a high roll: no herb (the odds are real)')

// ── 3. the spice + the meal are real bag items; the hearth cooks every meal; a meal is not the keeper's dish ──────
for (const el of ELEMENTS) {
  ok(!itemDef(spiceId(el)).name.startsWith('Unknown') && itemDef(spiceId(el)).name.includes('Spice'), `${el}: the spice is a bag item`)
  ok(itemDef(mealId(el)).name.includes('Meal'), `${el}: the meal is a bag item`)
  const j = SPICED.find(x => x.out.id === mealId(el))
  ok(!!j && j.in.some(c => c.id === spiceId(el)) && j.in.some(c => c.id === 'shimmerscale'), `${el}: the hearth cooks spice + Shimmerscale -> meal`)
  ok(HEARTH_JOBS.includes(j!) && ALL_JOBS.some(x => x.id === j!.id), `${el}: the meal job is on the hearth and in the station queue`)
  ok(!isDish(mealId(el)), `${el}: a meal is fed, never eaten by the keeper`)
  ok(elementOfMeal(mealId(el)) === el, `${el}: a meal knows its element`)
}
ok(ROAST.every(j => !SPICED.includes(j)), 'the roasts are untouched')

// ── 4. her bar: append-only, never resets, never changes, locks at 10 ─────────────────────────────────────────────
const sp: Species = 'axolotl'
const low = () => 0      // no stat ever meets a bar
const high = () => 999   // every bar met
const base: Pot = { seed: seedOf(sp), at: 1, bloomed: true }
ok(!feedMeal({ ...base, bloomed: undefined }, sp, 'earth', high).ok, 'an unbloomed pot takes no meal')
let pot = base
const order: FormElement[] = ['earth', 'water', 'storm', 'earth', 'mana', 'water', 'water', 'earth', 'storm', 'mana']
for (let k = 0; k < order.length; k++) {
  const before = mealsOf(pot)
  const r = feedMeal(pot, sp, order[k], low)
  ok(r.ok, `meal ${k + 1} lands`)
  if (!r.ok) break
  ok(r.slot === k, `meal ${k + 1} takes slot ${k}`)
  ok(before.every((m, i) => mealsOf(r.pot)[i] === m), `meal ${k + 1}: every earlier slot is unchanged`)
  ok(mealsOf(r.pot).length === k + 1, `meal ${k + 1}: one slot more`)
  ok(r.locked === (k + 1 === BAR_SLOTS), `meal ${k + 1}: locked only at ${BAR_SLOTS}`)
  pot = r.pot
}
ok(mealsOf(pot).join() === order.join(), 'the bar is the meals in the order she was fed')
const full = feedMeal(pot, sp, 'mana', high)
ok(!full.ok && full.why === 'locked', 'a full bar refuses the 11th meal (the meal stays in the bag)')
ok(mealsOf(pot).length === BAR_SLOTS, 'a full bar stays full')
// the save keeps it, a bad value is dropped, and nothing in the parse can shorten a good bar
const saved = parseBook(JSON.parse(JSON.stringify({ pots: { p1: pot, p2: { ...base, meals: ['earth', 'fire', 7, 'water'] }, p3: { ...base, meals: [...order, 'earth', 'earth'] } } })))
ok(mealsOf(saved.pots.p1).join() === order.join(), 'the bar survives a save + load')
ok(mealsOf(saved.pots.p2).join() === 'earth,water', 'a bad slot is dropped, never guessed')
ok(mealsOf(saved.pots.p3).length === BAR_SLOTS, 'a save past 10 reads as 10')
ok(mealCounts(order).earth === 3 && mealCounts(order).water === 3, 'counts per element')
ok(mealLean(order) === null, 'tied: no lean')

// ── 5. the gate: MEALS_FOR_FORM of one element + M201's stat bar ──────────────────────────────────────────────────
ok(MEALS_FOR_FORM >= 3 && MEALS_FOR_FORM <= 4, 'a second form asks 3-4 meals (Alex 11-26)')
let q = base
for (let k = 0; k < MEALS_FOR_FORM - 1; k++) { const r = feedMeal(q, sp, 'storm', high); ok(r.ok && !r.evolved, `storm meal ${k + 1}: too few, no form`); if (r.ok) q = r.pot }
ok(!q.element, 'below the meal count she stays base, even with every stat met')
const atBelow = feedMeal(q, sp, 'storm', low)
ok(atBelow.ok && !atBelow.evolved && !atBelow.pot.element, 'enough meals but her stat below the bar: no form yet')
if (atBelow.ok) {
  const need = SECOND_FORM_BAR[sp].storm, stat = GATE_STAT.storm
  const st = settleForm(atBelow.pot, sp, k => (k === stat ? need : 0))
  ok(!!st && st.evolved === 'storm' && st.pot.element === 'storm', 'her stat reaches the bar later: she takes her form then')
  ok(settleForm(atBelow.pot, sp, k => (k === stat ? need - 1 : 0)) === null, 'one short of the bar: no form')
}
const ev = feedMeal(q, sp, 'storm', high)
ok(ev.ok && ev.evolved === 'storm' && ev.pot.element === 'storm' && !!ev.formName, `the ${MEALS_FOR_FORM}th storm meal with her bar met: storm form`)
if (ev.ok) {
  let e = ev.pot
  for (const el of Array(BAR_SLOTS - MEALS_FOR_FORM).fill('earth') as FormElement[]) { const r = feedMeal(e, sp, el, high); ok(r.ok && r.pot.element === 'storm' && !r.evolved, 'her element never changes once set'); if (r.ok) e = r.pot }
  ok(mealsOf(e).length === BAR_SLOTS && feedMeal(e, sp, 'storm', high).ok === false, 'evolved and fed to 10: locked')
  ok(settleForm(e, sp, high) === null, 'a settled spirit is never re-settled')
}

// ── 6. canon words: no brew left behind; the herbs are canon's ─────────────────────────────────────────────────────
const src = readFileSync('src/app/shimmer/open/ather/infusions.ts', 'utf8')
ok(!/Infusion'|Pour /.test(src), 'no brewed-Infusion words left in the cooking file')

if (fails.length) { console.error(`FAIL ${fails.length}:\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`infusions.test ${pass} ok`)
