// BETA M206: the Rinnshop's Filet tab (cooking.ts FILET, rooms.ts filetAt), the fillets' roasts at the hearth, and the
// Shimmerscale scales that Aqual Sauce is ground from at the Crusher. Run: npx tsx src/app/shimmer/open/ather/filet.test.ts
import { FILET, FILLETS, SCALES, ROAST, HEARTH_JOBS, DISHES, isDish } from './cooking'
import { filetAt, roomAccepts, benchCount, type Works } from './rooms'
import { benchTabs, TAB_LABEL } from './bench-tabs'
import { INFUSION, infusionTake } from './infusions'
import { RINN } from './rinning'
import { newInv, give, countOf, isCatch, itemDef, ITEM_GROUP, SLOTS, type Inv } from '../shared/inventory'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const bag = (...xs: [string, number][]) => { let v: Inv = newInv(0); for (const [id, n] of xs) v = give(v, id, n).inv; return v }

// 1. the roster: three rinn filet, all from the Ather's own RINN; only Shimmerscale gives scales; spirit food never fileted
const fish = Object.keys(FILET)
ok(fish.length === 3 && fish.join() === 'shimmerscale,ribboneel,clickclaw', `three rinn filet (${fish})`)
ok(fish.every(id => RINN.some(r => r.id === id)), 'every fileted rinn is on the Ather roster (no new species)')
ok(!FILET.glowfin && !FILET.moonkoi, 'Glowfin + Moonkoi stay raw spirit food (cuisine.md 09-15)')
ok(fish.filter(id => FILET[id].some(o => o.id === SCALES)).join() === 'shimmerscale', 'exactly one rinn gives scales: Shimmerscale')
ok(FILET.shimmerscale.length === 2 && FILET.shimmerscale[0].id === 'shimmerscale_fillet', 'Shimmerscale -> a fillet + its scales')
const outs = fish.flatMap(id => FILET[id].map(o => o.id))
ok(outs.every(id => !!itemDef(id) && itemDef(id).name.length > 0 && !!itemDef(id).icon), 'every Filet output is a bag row with a name + icon')
ok(outs.every(id => !isCatch(id) && ITEM_GROUP[id] === 'cooking'), 'a fillet / scales is not a catch (first-catch quest, bait stay clean); the cooking room keeps it')
ok(outs.every(id => roomAccepts('cooking', id)), 'the cooking room store takes every fillet + the scales')

// 2. each fillet roasts at the hearth into a dish (M234 s2: a spirit dish that gives bond, no longer a keeper heal)
for (const f of Object.keys(FILLETS)) {
  const j = ROAST.find(x => x.in.length === 1 && x.in[0].id === f)
  ok(!!j && isDish(j.out.id) && DISHES[j.out.id].bond > 0 && HEARTH_JOBS.includes(j), `${f}: roasts at the hearth into a dish (${j?.out.id})`)
  ok(!!j && !!itemDef(j.out.id).icon, `${f}: its roast has an icon`)
}

// 3. the Filet tab sits on the Rinnshop bench only
ok(benchTabs('rinnshop').includes('filet') && TAB_LABEL.filet === 'Filet', 'Rinnshop bench has a Filet tab')
ok(!benchTabs('cooking').includes('filet') && !benchTabs('carpentry').includes('filet'), 'no other room has it')

// 4. filetAt: store first, else bag; outputs to the bag; refuses cleanly
const W = { v: 1, rooms: [{ id: 'r1', kind: 'rinnshop', store: [{ id: 'shimmerscale', n: 2 }] }, { id: 'c1', kind: 'cooking', store: [{ id: 'shimmerscale', n: 1 }] }] } as unknown as Works
const a = filetAt(W, 'r1', newInv(0), 'shimmerscale')!
ok(!!a && countOf(a.inv, 'shimmerscale_fillet') === 1 && countOf(a.inv, SCALES) === 1 && benchCount(a.works.rooms[0], a.inv, 'shimmerscale') === 1, 'store first: one Shimmerscale -> fillet + scales in the bag')
const b = filetAt({ v: 1, rooms: [{ id: 'r1', kind: 'rinnshop' }] } as unknown as Works, 'r1', bag(['ribboneel', 2]), 'ribboneel')!
ok(!!b && countOf(b.inv, 'ribboneel') === 1 && countOf(b.inv, 'ribboneel_fillet') === 1, 'bag fallback: a Ribboneel -> a fillet')
const c = filetAt(W, 'r1', bag(['clickclaw', 1]), 'clickclaw')!
ok(!!c && countOf(c.inv, 'clickclaw') === 0 && countOf(c.inv, 'clickclaw_meat') === 1, 'Clickclaw -> its meat')
ok(filetAt(W, 'r1', newInv(0), 'ribboneel') === null, 'nothing in reach = null')
ok(filetAt(W, 'r1', bag(['glowfin', 1]), 'glowfin') === null, 'a rinn with no Filet row = null')
ok(filetAt(W, 'c1', newInv(0), 'shimmerscale') === null, 'only the Rinnshop filets')
// a full bag: nothing spent (pure: the inputs come back unchanged)
let full: Inv = newInv(0); full.slots = full.slots.map((_, i) => (i < SLOTS ? { id: 'blankstone', n: 99 } : null))
full = { ...full, slots: full.slots.map((s, i) => (i === 0 ? { id: 'shimmerscale', n: 1 } : s)) }
ok(filetAt(W, 'r1', full, 'shimmerscale') === null, 'full bag: refused (scales would have nowhere to go)')
ok(countOf(full, 'shimmerscale') === 1, 'full bag: the catch is still there')

// 5. the scales are what the Crusher grinds: Aqual Sauce = scales + an Aqual; a whole Shimmerscale no longer does it
ok(INFUSION.water.at === 'crusher' && INFUSION.water.in.some(s => s.id === SCALES) && INFUSION.water.in.some(s => s.id === 'water_crystal'), 'Aqual Sauce = Shimmerscale scales + Aqual at the Crusher')
ok(!!infusionTake('water', { [SCALES]: 1, water_crystal: 1 }) && infusionTake('water', { shimmerscale: 1, water_crystal: 1 }) === null, 'the scales, not the whole rinn, go into the sauce')

console.log(`filet: ${pass} pass, ${fail} fail`)
if (fail) process.exit(1)
