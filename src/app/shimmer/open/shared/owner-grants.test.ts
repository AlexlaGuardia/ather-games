// Run: npx tsx src/app/shimmer/open/shared/owner-grants.test.ts
import { oneOfEachSeed, lendAllGuns, takeBackGuns } from './owner-grants'
import { RANGE_GUNS } from './gunplay'
import { claimKaelsArms, equip, newLoadout, type Loadout } from './loadout'
import { SEED_IDS } from '../ather/seed-items'
import { countOf, give, type Inv } from './inventory'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const empty = (): Inv => ({ v: 1, slots: Array(32).fill(null) })
const a = oneOfEachSeed(empty())
ok(a.added === SEED_IDS.length && a.missed === 0, `adds all ${SEED_IDS.length}`)
ok(SEED_IDS.every(id => countOf(a.inv, id) === 1), 'exactly one of each')
const b = oneOfEachSeed(a.inv)
ok(b.added === 0 && SEED_IDS.every(id => countOf(b.inv, id) === 1), 'second press adds none')
const c = oneOfEachSeed(give(empty(), SEED_IDS[0], 3).inv)
ok(c.added === SEED_IDS.length - 1 && countOf(c.inv, SEED_IDS[0]) === 3, 'a held seed is not topped up')
const full: Inv = { v: 1, slots: Array(32).fill(null).map(() => ({ id: 'bait1', n: 1 })) }
const d = oneOfEachSeed(full)
ok(d.added === 0 && d.missed === SEED_IDS.length, 'full bag: nothing added, all missed')
// M140: all guns, and back
{
  const ALL = RANGE_GUNS.map(g => g.id), L0: Loadout = { ...equip({ ...newLoadout(), guns: ['backbone', 'repeater'], kael: true }, 'primary', 'backbone'), fit: { backbone: { sight: 'lens', owned: ['lens'], sigil: ['star'] } } }, j0 = JSON.stringify(L0)
  const r = lendAllGuns(L0)
  ok(r.added === ALL.length - 2 && ALL.every(g => r.loadout.guns.includes(g)) && new Set(r.loadout.guns).size === ALL.length, 'all 6 guns owned, once each')
  ok(r.loadout.primary === 'backbone' && r.loadout.secondary === 'repeater' && JSON.stringify([r.loadout.fit, r.loadout.vessels, r.loadout.tactical, r.loadout.signature, r.loadout.kael]) === JSON.stringify([L0.fit, L0.vessels, L0.tactical, L0.signature, L0.kael]), 'nothing worn or fitted changes')
  ok(JSON.stringify(L0) === j0, 'pure')
  ok(lendAllGuns(r.loadout).added === 0 && lendAllGuns(r.loadout).loadout === r.loadout, 'a second press adds none and forgets none')
  ok(JSON.stringify(takeBackGuns(r.loadout).loadout) === j0, 'taken back = exactly the old set')
  const worn = equip(equip(r.loadout, 'primary', 'lance'), 'secondary', 'spitter'), t = takeBackGuns(worn)
  ok(t.taken === ALL.length - 2 && t.loadout.guns.join() === 'backbone,repeater' && t.loadout.primary === null && t.loadout.secondary === 'repeater' && !t.loadout.lent, 'a worn lent gun leaves the slot, a real one stays worn')
  ok(takeBackGuns(L0).taken === 0 && takeBackGuns(L0).loadout === L0, 'nothing lent: nothing taken')
  const k = claimKaelsArms({ ...lendAllGuns({ ...newLoadout() }).loadout })   // the Charred Rifle lent, then really won from Kael's chest
  ok(k.ok && takeBackGuns(k.loadout).loadout.guns.slice().sort().join() === 'charred-rifle,repeater', "a lent gun won for real (Kael's chest) stays")
}
console.log(`owner-grants: ${pass} pass, ${fail} fail`); if (fail) process.exit(1)
