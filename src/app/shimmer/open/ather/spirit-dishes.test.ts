// BETA M234 s2: food feeds spirits, potions heal keepers. The first dish, Firewort, Moonberry, the bond cap.
// Run: npx tsx src/app/shimmer/open/ather/spirit-dishes.test.ts
import { readFileSync } from 'node:fs'
import { DISHES, GRILLED, GRILL, HEARTH_JOBS, ROAST, SPICED, FIERY_SPICE, MOONBERRY, MOONBERRY_BOND, isDish } from './cooking'
import { dishOf, feedDish, bondOf, bondToday, bondRoom, isSpiritDish, SPIRIT_DISH_IDS, BOND_DAY_CAP, BOND_MAX, MEAL_BOND } from './spirit-dishes'
import { INFUSION, SPICE_MIXES, spiceMixesAt, recipeTake, mealsOf, mealCounts, BAR_SLOTS, MEALS_FOR_FORM, TREE_SPICE_HERB } from './infusions'
import { CROPS, cropId, seedId } from './farming'
import { prunePlan } from './forestry'
import { heldUse } from './held-use'
import { ALL_JOBS } from './station-queue'
import { itemDef, ITEM_GROUP, newInv, give } from '../shared/inventory'
import { existsSync } from 'node:fs'
import type { Pot } from './spirit-seeds'
import type { Species } from '../../spirits/spirit'
import { seedOf } from './seed-items'
import { parseBook } from './grimoire-book'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. canon: the names shown are canon's, word for word, read from alchemy.md ───────────────────────────────────────
const canon = readFileSync('/root/athernyx/CANON/game/alchemy.md', 'utf8')
const sitDown = canon.slice(canon.indexOf('THE RECIPES SIT-DOWN'), canon.indexOf('## The Infusions are the spine'))
ok(sitDown.length > 500, 'the sit-down section was found')
for (const w of ['Grilled Rinn', 'Aqual Sauce', 'Fuli Powder', 'Firewort', 'Moonberry']) ok(sitDown.includes(w), `canon names ${w}`)
ok(sitDown.includes('Grilled Rinn with Aqual Sauce') && GRILLED.grilled_rinn.name === 'Grilled Rinn with Aqual Sauce', 'the first dish carries canon\'s name word for word')
ok(INFUSION.water.name === 'Aqual Sauce' && INFUSION.mana.name === 'Fuli Powder' && CROPS.firewort.name === 'Firewort', 'Aqual Sauce, Fuli Powder, Firewort word for word')
ok(/Food is for spirits; potions are for keepers/.test(sitDown), 'canon still rules food is for spirits')

// ── 2. roasts stop healing the keeper: they are spirit dishes ──────────────────────────────────────────────────────
for (const id of Object.keys(DISHES)) {
  ok(!('heal' in DISHES[id]), `${id}: no heal left`)
  ok(heldUse(id, 'wilds') === null && heldUse(id, 'plot') === null, `${id}: nothing to do with it in hand (no eat)`)
  const d = dishOf(id)
  ok(!!d && d.steep.length === 0 && d.bond === DISHES[id].bond && d.bond > 0, `${id}: a spirit dish, bond only`)
}
ok(['roast_rinn', 'roast_eggs', 'roast_drifthorn', 'roast_tuskroot'].every(isSpiritDish), 'the 4 hearth roasts are spirit dishes')
ok(!isSpiritDish('shimmerscale') && !isSpiritDish('aqual_sauce') && !isSpiritDish(null) && !isSpiritDish('potion:health:D'), 'raw food, a sauce, a potion: not a dish')
ok(SPIRIT_DISH_IDS.every(isSpiritDish) && new Set(SPIRIT_DISH_IDS).size === SPIRIT_DISH_IDS.length, 'the dish list is all dishes, no repeats')

// ── 3. the first dish: Grilled Rinn + Aqual Sauce (Water), its spicy variant (Firewort), the Moonberry one ─────────────
const gr = GRILLED.grilled_rinn
ok(gr.in.some(c => c.id === 'shimmerscale') && gr.in.some(c => c.id === INFUSION.water.id) && gr.in.length === 2, 'Grilled Rinn = a Shimmerscale + Aqual Sauce')
ok(gr.steep.length === MEALS_FOR_FORM && gr.steep.every(e => e === 'water'), 'one Grilled Rinn fills her Water (MEALS_FOR_FORM Water slots)')
const spicy = GRILLED.grilled_rinn_spicy
ok(spicy.in.some(c => c.id === FIERY_SPICE) && spicy.steep.filter(e => e === 'water').length === gr.steep.length && spicy.steep.filter(e => e === 'mana').length === 1, 'spicy: same Water + a touch of Mana')
const mb = GRILLED.grilled_rinn_moonberry
ok(mb.in.some(c => c.id === MOONBERRY) && mb.bond === gr.bond + MOONBERRY_BOND && MOONBERRY_BOND > 0, 'a Moonberry dish gives a little more bond')
ok(mb.bond <= BOND_DAY_CAP, 'and stays under the daily cap')
ok(Object.values(GRILLED).map(g => g.steep.length).some(n => n !== 1) && MEAL_BOND > 0, 'dish element values vary (a meal 1, the grill 3+)')
for (const j of GRILL) ok(HEARTH_JOBS.includes(j) && ALL_JOBS.some(x => x.id === j.id) && j.out.id in GRILLED, `${j.id}: on the hearth + the station queue`)
ok(!SPICED.some(j => j.out.id === 'water_meal') && ROAST.every(j => !GRILL.includes(j)), 'the grill replaced the water meal job; the roasts are their own jobs')
for (const id of [...Object.keys(GRILLED), FIERY_SPICE, MOONBERRY]) ok(itemDef(id).name !== id.replace(/_/g, ' ') && ITEM_GROUP[id] === 'cooking' && existsSync(`public${itemDef(id).icon}`), `${id}: a bag row with an icon`)

// ── 4. Firewort: a crop (M241: wild forage at the Scald's edge, forage.test.ts; no longer a Goldwood find), ground with Fuli Powder at the Crusher Table ───────────────────────────
ok(CROPS.firewort.tier === 2 && existsSync(`public${itemDef(seedId('firewort')).icon}`) && existsSync(`public${itemDef(cropId('firewort')).icon}`), 'Firewort grows like a herb, seed + crop icons')
ok(TREE_SPICE_HERB.goldwood === undefined, 'M241: a Goldwood no longer turns up Firewort (stand-in retired)')
const lo = () => 0
ok(!prunePlan('goldwood', lo).some(d => d.id.includes('firewort')), 'M241: even a lucky goldwood prune gives no Firewort')
ok(!prunePlan('goldwood', () => 0.99).some(d => d.id.includes('firewort')), 'not every prune')
const fiery = SPICE_MIXES.find(m => m.id === FIERY_SPICE)!
ok(!!fiery && fiery.at === 'crusher' && spiceMixesAt('crusher').includes(fiery), 'the spice mix is made at the Crusher Table')
ok(fiery.in.some(c => c.id === INFUSION.mana.id) && fiery.in.some(c => c.id === 'crop:firewort'), 'Fuli Powder + Firewort')
ok(recipeTake(fiery, { fuli_powder: 1, 'crop:firewort:B': 1 })?.map(s => s.id).join() === 'fuli_powder,crop:firewort:B', 'any grade of Firewort')
ok(recipeTake(fiery, { fuli_powder: 1 }) === null && recipeTake(fiery, { 'crop:firewort:D': 1 }) === null, 'needs both')

// ── 5. feeding: steep + bond, the daily cap, the bar still sets at 10 ──────────────────────────────────────────────
const sp: Species = 'axolotl', low = () => 0, high = () => 999
const base: Pot = { seed: seedOf(sp), at: 1, bloomed: true }
const D = 100
ok(!feedDish({ ...base, bloomed: undefined }, sp, 'roast_rinn', low, D).ok, 'an unbloomed pot takes no dish')
ok(feedDish(base, sp, 'shimmerscale', low, D).ok === false, 'raw food is not fed here')
const r1 = feedDish(base, sp, 'roast_rinn', low, D)
ok(r1.ok && r1.bond === DISHES.roast_rinn.bond && r1.steep.length === 0 && mealsOf(r1.pot).length === 0, 'a roast: bond, no steep')
ok(r1.ok && bondOf(r1.pot) === DISHES.roast_rinn.bond && bondToday(r1.pot, D) === DISHES.roast_rinn.bond && bondToday(r1.pot, D + 1) === 0, 'bond lands; today\'s count is per day')
const g1 = feedDish(base, sp, 'grilled_rinn', low, D)
ok(g1.ok && mealCounts(mealsOf(g1.pot)).water === MEALS_FOR_FORM && g1.bond === gr.bond, 'Grilled Rinn: a Water dish fills her Water in one meal')
const g2 = feedDish(base, sp, 'grilled_rinn', high, D)
ok(g2.ok && g2.evolved === 'water' && g2.pot.element === 'water', 'with her stat met, one Grilled Rinn takes her Water form')
const s1 = feedDish(base, sp, 'grilled_rinn_spicy', low, D)
ok(s1.ok && mealCounts(mealsOf(s1.pot)).mana === 1 && mealCounts(mealsOf(s1.pot)).water === MEALS_FOR_FORM, 'spicy: Water + a touch of Mana')
const m1 = feedDish(base, sp, 'grilled_rinn_moonberry', low, D)
ok(m1.ok && g1.ok && m1.bond > g1.bond, 'a Moonberry dish gives more bond than the plain one')
// the cap: feed until nothing lands
let p: Pot = base, gained = 0, n = 0
for (; n < 20; n++) { const r = feedDish(p, sp, 'grilled_rinn_moonberry', low, D); if (!r.ok) break; gained += r.bond; p = r.pot }
ok(gained === BOND_DAY_CAP && bondToday(p, D) === BOND_DAY_CAP, `bond is capped per day (${gained} / ${BOND_DAY_CAP})`)
ok(mealsOf(p).length === BAR_SLOTS, 'the bar still sets at 10 (never more)')
const capped = feedDish(p, sp, 'roast_tuskroot', low, D)
ok(!capped.ok && capped.why === 'full', 'bar full + today\'s bond spent: refused, the dish stays in the bag')
const tomorrow = feedDish(p, sp, 'roast_tuskroot', low, D + 1)
ok(tomorrow.ok && tomorrow.bond === DISHES.roast_tuskroot.bond && bondToday(tomorrow.pot, D + 1) === DISHES.roast_tuskroot.bond, 'the next day she takes bond again')
ok(bondRoom({ ...base, bond: BOND_MAX - 1 }, D) === 1, 'bond never passes its ceiling')
const part = feedDish({ ...base, meals: Array(BAR_SLOTS - 1).fill('earth') }, sp, 'grilled_rinn', low, D)
ok(part.ok && mealsOf(part.pot).length === BAR_SLOTS && part.steep.length === 1, 'a dish past a nearly-full bar takes only the slots left')
const evolvedLocked = feedDish({ ...base, element: 'earth', meals: Array(BAR_SLOTS).fill('earth') }, sp, 'water_meal', low, D)
ok(evolvedLocked.ok && evolvedLocked.steep.length === 0 && evolvedLocked.bond === MEAL_BOND && evolvedLocked.pot.element === 'earth', 'a full bar: a meal still gives bond, her element never moves')

// ── 5b. her bond survives a save + load (grimoire-book.ts parseBook); junk drops
{
  const back = parseBook(JSON.parse(JSON.stringify({ pots: { a: tomorrow.ok ? tomorrow.pot : base, b: { ...base, bond: 'x', bondDay: -1 } } }))).pots
  ok(tomorrow.ok && back.a.bond === tomorrow.pot.bond && back.a.bondDay === D + 1 && back.a.bondToday === DISHES.roast_tuskroot.bond, `bond + today's tally load back (${JSON.stringify(back.a)})`)
  ok(back.b.bond === undefined && back.b.bondDay === undefined, 'a junk bond is dropped')
}

// ── 6. old saves: a roast already in a bag still loads (now a dish) ────────────────────────────────────────────────
{
  let inv = newInv(0)
  for (const id of ['roast_rinn', 'roast_tuskroot', 'water_meal']) inv = give(inv, id, 2).inv
  const has = (i: typeof inv, id: string) => i.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0)
  ok(has(inv, 'roast_rinn') === 2 && isDish('roast_rinn') && isSpiritDish('roast_rinn') && isSpiritDish('water_meal'), 'an old bag\'s roasts + water meal are still items, and dishes now')
}

if (fails.length) { console.log(`FAIL ${fails.length}:`); for (const f of fails) console.log('  ' + f); process.exit(1) }
console.log(`spirit-dishes.test ${pass} ok`)
