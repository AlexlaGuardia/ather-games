// BETA M204 (the element comes from COOKING): herb finds, spice + meal items, the hearth's spiced jobs, her 10-slot bar
// (append-only, never resets, locks at 10) and the form gate (3 meals of one element + M201's stat bar).
// Run: npx tsx src/app/shimmer/open/ather/infusions.test.ts
import { readFileSync } from 'node:fs'
import { HERB_OF, TREE_HERB, CRYSTAL_HERB, HERB_FIND_CHANCE, rollHerb, feedMeal, settleForm, mealsOf, mealCounts, mealLean, mealId,
  elementOfMeal, BAR_SLOTS, MEALS_FOR_FORM, ELEMENTS, INFUSION, infusionId, infusionsAt, infusionTake, elementOfInfusion, LEGACY_SPICE, MEAL_UI } from './infusions'
import { itemDef as def2, renameSpices, renameRetiredCrops, newInv, give } from '../shared/inventory'
import { renameRetired, parseGraded, CROPS } from './farming'   // M204 s3
import { adoptBank } from './garden-bank'
import { adoptFarm } from './farmroom'
import { ALC_STATIONS } from './alchemy-set'
import { GEM, CRYSTAL_ITEM } from './prospecting'
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
for (const [el, herb] of [['mana', 'Violetbloom'], ['storm', 'Stormgrass'], ['water', 'Tidepetal']] as const) {
  ok(canon.includes(`**${herb}** (${el[0].toUpperCase()}${el.slice(1)})`), `canon names ${herb} for ${el}`)
  ok(HERB_OF[el] === herb.toLowerCase(), `${el}'s herb is ${herb}`)
}
// M207: ROOTVINE RETIRED (Alex 11-26, "too close to rootbulb"): no herb for earth, no tree or crystal turns it up
ok(HERB_OF.earth === undefined, 'earth has no herb any more (Rootvine retired)')
ok(!Object.values(TREE_HERB).includes('earth') && !Object.values(CRYSTAL_HERB).includes('earth'), 'no node finds an earth herb')

// ── 2. every herb is FOUND somewhere the keeper already works ──────────────────────────────────────────────────────
const found = new Set([...Object.values(TREE_HERB), ...Object.values(CRYSTAL_HERB)])
ok(found.size === 3, 'three herbs have a find (2 trees + the Fuli crystal); Rootvine none')
ok(!('goldwood' in TREE_HERB), 'goldwood (the meadows) carries no herb: canon meadow grows common crops')
ok(rollHerb('storm', () => HERB_FIND_CHANCE - 0.001).map(d => d.id).join() === 'crop:stormgrass:D,seed:stormgrass:D', 'a find = the herb + its seed, grade D')
ok(rollHerb('earth', () => 0).length === 0, 'an earth roll finds nothing (Rootvine retired)')
ok(rollHerb('earth', () => HERB_FIND_CHANCE).length === 0 && rollHerb(undefined, () => 0).length === 0, 'above the odds, or a node with no herb: nothing')
const lo = () => 0.0001   // every roll passes
ok(!prunePlan('shimmeroak', lo).some(d => d.id.includes('rootvine')), 'a pruned shimmeroak never gives Rootvine (retired)')
for (const k of ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood'] as const) ok(!prunePlan(k, lo).some(d => d.id.includes('rootvine')), `${k}: no Rootvine`)
ok(!minePlan('earth', lo).drops.some(d => d.id.includes('rootvine')), 'a Dinloid gives no Rootvine')
ok(prunePlan('starwillow', lo).some(d => d.id === 'seed:tidepetal:D'), 'a pruned starwillow can give Tidepetal')
ok(prunePlan('dawnwood', lo).some(d => d.id === 'crop:stormgrass:D'), 'a pruned dawnwood can give Stormgrass')
ok(!prunePlan('goldwood', lo).some(d => d.id.startsWith('crop:')), 'a goldwood never gives a herb')
ok(minePlan('violet', lo).drops.some(d => d.id === 'crop:violetbloom:D'), 'a broken Fuli can give Violetbloom')
ok(!minePlan('storm', lo).drops.some(d => d.id.startsWith('crop:')), 'other crystals give no herb')
ok(prunePlan('dawnwood', () => 0.99).every(d => !d.id.startsWith('seed:')), 'a high roll: no herb (the odds are real)')

// ── 3. M207: the four INFUSIONS, each at its station from its gem (Alex 11-26) ───────────────────────────────────────
const want = { water: ['aqual_sauce', 'Aqual Sauce', 'crusher', ['shimmerscale_scales', 'water_crystal']]   /* M206: the Filet tab's scales */, earth: ['golden_tonic', 'Golden Glaze', 'still', ['crop:goldleaf', 'earth_crystal']],
  storm: ['storm_broth', 'Storm Broth', 'nook', ['crop:stormgrass', 'storm_crystal']], mana: ['fuli_powder', 'Fuli Powder', 'crusher', ['violet_crystal']] } as const
for (const el of ELEMENTS) {
  const [id, name, at, ins] = want[el], r = INFUSION[el]
  ok(r.id === id && r.name === name && r.at === at, `${el}: ${name} at the ${at}`)
  ok(r.in.map(s => s.id).join() === ins.join() && r.in.every(s => s.n === 1), `${el}: ${name} takes ${ins.join(' + ')}`)
  ok(def2(id).name === name, `${el}: ${name} is a bag item`)
  ok(def2(id).blurb.includes(ALC_STATIONS[at].name), `${el}: the blurb names its station (${ALC_STATIONS[at].name})`)
  ok(elementOfInfusion(id) === el && infusionId(el) === id, `${el}: the infusion knows its element`)
  ok(infusionsAt(at).includes(el), `${el}: listed at the ${at}`)
}
ok(infusionsAt('desk').length === 0 && infusionsAt('crusher').join() === 'mana,water', 'the Crusher makes Fuli Powder + Aqual Sauce; the Desk none')
ok(infusionsAt('still').join() === 'earth' && infusionsAt('nook').join() === 'storm', 'the Still makes Golden Glaze, the Cauldron Nook Storm Broth')
// the gem each one takes is the element's gem (prospecting.ts GEM: Aqual water, Dinloid earth, Fuli mana, Rhyloid storm)
for (const [el, kind] of [['water', 'water'], ['earth', 'earth'], ['storm', 'storm'], ['mana', 'violet']] as const) {
  ok(INFUSION[el].in.some(s => s.id === CRYSTAL_ITEM[kind]), `${el}: takes ${GEM[kind]}`)
  ok(INFUSION[el].name.includes(GEM[kind]) || el === 'earth' || el === 'storm', `${el}: named after ${GEM[kind]} where Alex did`)
}
// what a make spends: exact ids, crops worst grade first, nothing when short
ok(infusionTake('mana', { violet_crystal: 2 })?.map(s => `${s.id}x${s.n}`).join() === 'violet_crystalx1', 'Fuli Powder spends one Fuli')
ok(infusionTake('mana', {}) === null, 'no Fuli: no powder')
ok(infusionTake('water', { shimmerscale_scales: 1 }) === null && infusionTake('water', { water_crystal: 1 }) === null, 'Aqual Sauce needs both the scales and the Aqual')
ok(infusionTake('earth', { 'crop:goldleaf:B': 1, 'crop:goldleaf:D': 1, earth_crystal: 1 })?.map(s => s.id).join() === 'crop:goldleaf:D,earth_crystal', 'Golden Glaze: the worst Goldleaf goes first')
ok(infusionTake('storm', { 'crop:stormgrass:A': 1, storm_crystal: 1 })?.map(s => s.id).join() === 'crop:stormgrass:A,storm_crystal', 'Storm Broth: any grade of Stormgrass')
ok(infusionTake('storm', { 'crop:stormgrass:A': 1 }) === null, 'Storm Broth with no Rhyloid: nothing')

// ── 3b. the hearth cooks infusion + Shimmerscale -> that element's meal; a meal is not the keeper's dish ─────────────
for (const el of ELEMENTS) {
  ok(itemDef(mealId(el)).name.includes('Meal'), `${el}: the meal is a bag item`)
  const j = SPICED.find(x => x.out.id === mealId(el))
  ok(!!j && j.in.some(c => c.id === INFUSION[el].id) && j.in.some(c => c.id === 'shimmerscale') && j.in.length === 2, `${el}: the hearth cooks ${INFUSION[el].name} + Shimmerscale -> meal`)
  ok(HEARTH_JOBS.includes(j!) && ALL_JOBS.some(x => x.id === j!.id), `${el}: the meal job is on the hearth and in the station queue`)
  ok(!isDish(mealId(el)), `${el}: a meal is fed, never eaten by the keeper`)
  ok(elementOfMeal(mealId(el)) === el, `${el}: a meal knows its element`)
}
ok(!SPICED.some(j => j.in.some(c => c.id.endsWith('_spice'))), 'no hearth job asks for a retired spice')
ok(ROAST.every(j => !SPICED.includes(j)), 'the roasts are untouched')

// ── 3c. old saves: an M204 spice in a bag becomes its infusion, count kept; nothing else moves ───────────────────────
let oldBag = newInv(0)
oldBag = give(oldBag, 'earth_spice', 2).inv; oldBag = give(oldBag, 'water_spice', 1).inv; oldBag = give(oldBag, 'crop:rootvine:D', 3).inv
const conv = renameSpices(oldBag)
const cnt = (i: typeof conv, id: string) => i.slots.reduce((a, x) => a + (x?.id === id ? x.n : 0), 0)
ok(cnt(conv, 'golden_tonic') === 2 && cnt(conv, 'aqual_sauce') === 1, 'old spices load as Golden Glaze x2 + Aqual Sauce x1')
ok(!conv.slots.some(x => x?.id.endsWith('_spice')), 'no spice left in the bag')
ok(cnt(conv, 'crop:rootvine:D') === 3, 'renameSpices alone leaves crops alone')
// ── 3d. M204 s3 (canon 35c83eb: Rootvine RETIRED, Goldleaf the earth herb): whatever a keeper holds of Rootvine comes back as
// Goldleaf, grade + count kept: the bag, the garden bank (and every room store, same parser), a growing bed
{
  let b = give(newInv(0), 'crop:rootvine:A', 3).inv; b = give(b, 'seed:rootvine:D', 2).inv; b = give(b, 'crop:goldleaf:A', 1).inv; b = give(b, 'crop:stormgrass:B', 4).inv
  const r = renameRetiredCrops(b)
  ok(cnt(r, 'crop:goldleaf:A') === 4 && cnt(r, 'seed:goldleaf:D') === 2 && cnt(r, 'crop:stormgrass:B') === 4, 'bag: 3 Rootvine A + 2 Rootvine seed D load as Goldleaf A (+1 held = 4) + 2 Goldleaf seed D; Stormgrass untouched')
  ok(!r.slots.some(x => x?.id.includes('rootvine')), 'bag: no Rootvine left')
  ok(r.slots.every((x, k) => !x === !b.slots[k]), 'bag: the slots stay where they were')
  ok(renameRetiredCrops(conv) !== conv && renameRetiredCrops(r) === r, 'bag: one with no Rootvine is returned as is')
  ok(renameRetired('crop:rootvine:S') === 'crop:goldleaf:S' && renameRetired('seed:rootvine:C') === 'seed:goldleaf:C' && renameRetired('rootvine_coil') === 'rootvine_coil' && renameRetired('crop:stormgrass:D') === 'crop:stormgrass:D', 'renameRetired: graded seed/crop ids only, grade kept')
  ok(parseGraded('crop:rootvine:D') === null && !('rootvine' in CROPS), 'Rootvine is gone from the crop roster')
  const bank = adoptBank({ v: 1, stacks: [{ id: 'crop:rootvine:B', n: 7 }, { id: 'crop:goldleaf:B', n: 2 }, { id: 'aqual_sauce', n: 1 }] })
  ok(bank.stacks.length === 3 && bank.stacks[0].id === 'crop:goldleaf:B' && bank.stacks[0].n === 7 && bank.stacks[1].n === 2 && bank.stacks[2].id === 'aqual_sauce', `bank: Rootvine B x7 loads as Goldleaf B x7, in place (${JSON.stringify(bank.stacks)})`)
  const farm = adoptFarm({ v: 1, farm: { beds: [{ crop: 'rootvine', grade: 'A', plantedAt: 1000, watered: true }, { crop: 'stormgrass', grade: 'D', plantedAt: 5, watered: false }], charge: 3 }, starter: true })
  ok(farm.farm.beds[0]?.crop === 'goldleaf' && farm.farm.beds[0]?.grade === 'A' && farm.farm.beds[0]?.plantedAt === 1000 && farm.farm.beds[0]?.watered === true && farm.farm.beds[1]?.crop === 'stormgrass', `farm: a growing Rootvine bed grows on as Goldleaf, grade + planting kept (${JSON.stringify(farm.farm.beds.slice(0, 2))})`)
}
ok(conv.slots.length === oldBag.slots.length && conv.slots.every((x, k) => !x === !oldBag.slots[k]), 'the slots stay where they were')
ok(renameSpices(newInv(0)) === newInv(0) || renameSpices(conv) === conv, 'a bag with no spice is returned as is')
ok(Object.keys(LEGACY_SPICE).length === 4 && ELEMENTS.every(el => LEGACY_SPICE[`${el}_spice`] === INFUSION[el].id), 'every old spice maps to its element\'s infusion')

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

// ── M204 s3: the bar is canon's STEEP (alchemy.md › THE COOKING ROAD: "UI word: *Steep* (e.g. *Steep 6/10*)"), read from the file
{
  const alc = readFileSync('/root/athernyx/CANON/game/alchemy.md', 'utf8'), m = /UI word: \*([A-Za-z]+)\* \(e\.g\. \*([^*]+)\*\)/.exec(alc)
  ok(!!m && MEAL_UI.bar === m[1] && MEAL_UI.steep(6) === m[2], `the bar's word is canon's, word for word (${m?.[1]} / ${m?.[2]} vs ${MEAL_UI.bar} / ${MEAL_UI.steep(6)})`)
  ok(/at \*\*10 meals the Steep is full and SET\*\*/.test(alc) && BAR_SLOTS === 10, 'canon: 10 meals and the Steep is set; the build: 10 slots')
  ok(MEAL_UI.steep(0) === 'Steep 0/10' && MEAL_UI.steep(10) === 'Steep 10/10' && MEAL_UI.fed('Earth', 4) === 'Earth · Steep 4/10', 'Steep n/10 in the panel and the fed line')
}
if (fails.length) { console.error(`FAIL ${fails.length}:\n  ` + fails.join('\n  ')); process.exit(1) }
console.log(`infusions.test ${pass} ok`)
