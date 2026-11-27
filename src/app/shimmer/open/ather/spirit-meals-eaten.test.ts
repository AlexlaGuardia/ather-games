// BETA M244 (Magii a5ad0b0): her LIFETIME meals-eaten count, for a future awakening feat ("eat 99 meals"). Hidden: shown nowhere.
// +1 on every dish/meal/snack she takes through feedDish (the one rule feedSpirit uses: the hand and her panel); a refused
// dish is not eaten; an old save (no field) starts at 0; the count rides on her pot (no new storage key).
// Run: npx tsx src/app/shimmer/open/ather/spirit-meals-eaten.test.ts
import { readFileSync } from 'node:fs'
import { feedDish, mealsEatenOf, BOND_DAY_CAP } from './spirit-dishes'
import { BAR_SLOTS } from './infusions'
import { seedOf } from './seed-items'
import type { Pot } from './spirit-seeds'
import type { Species } from '../../spirits/spirit'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const sp: Species = 'axolotl', low = () => 0, D = 100
const base: Pot = { seed: seedOf(sp), at: 1, bloomed: true }

// save-safe: an old pot (no field) = 0; junk = 0; a whole number kept
ok(mealsEatenOf(base) === 0 && mealsEatenOf(undefined) === 0, 'an old save starts at 0')
ok(mealsEatenOf({ ...base, mealsEaten: -3 }) === 0 && mealsEatenOf({ ...base, mealsEaten: NaN }) === 0 && mealsEatenOf({ ...base, mealsEaten: 'x' as unknown as number }) === 0, 'junk reads as 0')
ok(mealsEatenOf({ ...base, mealsEaten: 41.7 }) === 41, 'a whole count')

// every feed path counts: a roast (bond only), an element meal (steep), the grill (3 steep), a Moonberry dish
for (const id of ['roast_rinn', 'water_meal', 'grilled_rinn', 'grilled_rinn_moonberry']) {
  const r = feedDish(base, sp, id, low, D)
  ok(r.ok && mealsEatenOf(r.pot) === 1, `${id}: eaten = +1`)
}
// a SNACK (Steep full 10/10, bond only) counts
const full: Pot = { ...base, meals: Array(BAR_SLOTS).fill('earth'), element: 'earth', mealsEaten: 10 }
const snack = feedDish(full, sp, 'roast_rinn', low, D)
ok(snack.ok && snack.snack && mealsEatenOf(snack.pot) === 11, 'a snack counts')
// a meal when today's bond is spent but her Steep has room counts (steep only)
const spent: Pot = { ...base, bond: 50, bondDay: D, bondToday: BOND_DAY_CAP, mealsEaten: 5 }
const steepOnly = feedDish(spent, sp, 'water_meal', low, D)
ok(steepOnly.ok && steepOnly.bond === 0 && mealsEatenOf(steepOnly.pot) === 6, 'a steep-only meal (bond spent) counts')

// REFUSED = not eaten: Steep full AND bond spent; unbloomed; not a dish. The pot is untouched.
const refused = feedDish({ ...full, bond: 50, bondDay: D, bondToday: BOND_DAY_CAP }, sp, 'roast_rinn', low, D)
ok(!refused.ok && refused.why === 'full', 'full + bond spent: refused')
ok(!feedDish({ ...base, bloomed: undefined, mealsEaten: 3 }, sp, 'roast_rinn', low, D).ok, 'unbloomed: refused')
ok(!feedDish(base, sp, 'shimmerscale', low, D).ok, 'raw food: not a dish')

// lifetime: it keeps counting across days and never resets with the bar or the day cap
let p: Pot = base, n = 0
for (let day = D; day < D + 40; day++) for (let k = 0; k < 4; k++) { const r = feedDish(p, sp, 'roast_rinn', low, day); if (r.ok) { p = r.pot; n++ } }
ok(n > 0 && mealsEatenOf(p) === n, `lifetime count = every dish she took (${mealsEatenOf(p)} of ${n})`)
// past 99 (the feat's number) it keeps going: snacks across many days
let q: Pot = { ...full, mealsEaten: 98 }
for (let day = D; day < D + 3; day++) { const r = feedDish(q, sp, 'roast_rinn', low, day); if (r.ok) q = r.pot }
ok(mealsEatenOf(q) >= 100, 'it passes 99 (no cap)')

// her other fields are kept (the count rides on the same pot)
const kept = feedDish({ ...base, moves: ['a'], lessons: ['b'], mealsEaten: 2 }, sp, 'water_meal', low, D)
ok(kept.ok && kept.pot.moves?.[0] === 'a' && kept.pot.lessons?.[0] === 'b' && mealsEatenOf(kept.pot) === 3, 'moves + lessons kept')

// hidden: no UI reads it yet (a future awakening feat's condition)
const talk = readFileSync(new URL('./spirit-talk.tsx', import.meta.url), 'utf8')
ok(!/mealsEaten/.test(talk), 'her panel does not show it (hidden condition)')

if (fails.length) { console.log(`FAIL ${fails.length}:`); for (const f of fails) console.log('  ' + f); process.exit(1) }
console.log(`spirit-meals-eaten.test ${pass} ok`)
