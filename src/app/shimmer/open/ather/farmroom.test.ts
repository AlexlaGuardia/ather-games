// farmroom.ts: the Farm room's moves over the pure model. Run: npx tsx src/app/shimmer/open/ather/farmroom.test.ts
import { plantAt, harvestAt, feedAt, grantStarter, seedsReach, adoptFarm, freshFarmSave, STARTER, BEDS, dosesOf, msLeft } from './farmroom'
import { CROPS, seedId, cropId, CHARGE_CAP, DOSE_COST, isArmed, type CropId } from './farming'
import { existsSync } from 'node:fs'
import { freshWorks, ROOM_STORE_SLOTS, type Works } from './rooms'
import { newInv, give, countOf, itemDef, ITEM_GROUP } from '../shared/inventory'
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗', m) } }
const T0 = 1_000_000
const room = { id: 'farm-1', kind: 'farm' as const, x: 0, z: 0, q: 0, placedAt: 0, doneAt: 1 }
const W = (store?: { id: string; n: number }[]): Works => ({ ...freshWorks(), rooms: [{ ...room, store }] })
const stackOf = (w: Works, id: string) => (w.rooms[0].store ?? []).reduce((a, s) => a + (s.id === id ? s.n : 0), 0)

// items: graded ids are real rows
ok(itemDef(seedId('starbloom')).name === 'Starbloom seed · D' && itemDef(cropId('starbloom', 'C')).name === 'Starbloom · C', 'graded ids name themselves')
ok(itemDef(seedId('goldleaf')).icon === '/open/icons/seed-goldleaf.svg' && itemDef(cropId('ather_wheat')).icon === '/open/icons/crop-ather-wheat.svg' && itemDef(cropId('goldleaf')).stack === 99, 'icons + stack (per crop, tools/art/crop_icons.py)')
// every crop's two icons are on disk (a missing file is a blank cell in the bag)
for (const c of Object.keys(CROPS) as CropId[]) for (const id of [seedId(c), cropId(c)]) ok(existsSync(`public${itemDef(id).icon}`), `icon file missing: ${itemDef(id).icon}`)
ok(ITEM_GROUP[seedId('ather_lily', 'S')] === 'farming' && ITEM_GROUP[cropId('goldleaf')] === 'farming', 'farming group')

// starter: once
const st = grantStarter(freshFarmSave(), W(), room.id)
ok(st.given && stackOf(st.works, seedId('goldleaf')) === 3 && stackOf(st.works, seedId('dewdrop_vine')) === 2 && STARTER.every(s => CROPS[s.id.split(':')[1] as keyof typeof CROPS].tier === 1), 'starter: tier-1 D seeds in the store')
ok(!grantStarter(st.sv, st.works, room.id).given, 'starter: only once per garden')

// plant: store first, then bag; a taken bed refuses
let inv = give(newInv(0), seedId('goldleaf'), 1).inv
let p = plantAt(st.sv, st.works, inv, room.id, 0, seedId('goldleaf'), T0)
ok(p.ok && stackOf(p.works, seedId('goldleaf')) === 2 && countOf(p.inv, seedId('goldleaf')) === 1, 'plant draws from the store first')
if (p.ok) {
  ok(!plantAt(p.sv, p.works, p.inv, room.id, 0, seedId('goldleaf'), T0).ok, 'a taken bed refuses')
  ok(!plantAt(p.sv, p.works, p.inv, room.id, 1, 'goldwood_log', T0).ok, 'only seeds plant')
  ok(seedsReach(p.works, room.id, p.inv).find(s => s.id === seedId('goldleaf'))?.n === 3, 'seedsReach counts store + bag')
  // not ready, then ready (5 min goldleaf)
  ok(!harvestAt(p.sv, p.works, room.id, 0, T0 + 60_000, Math.random).ok, 'not ready refuses')
  const h = harvestAt(p.sv, p.works, room.id, 0, T0 + 5 * 60_000, Math.random)
  ok(h.ok && stackOf(h.works, cropId('goldleaf')) === 1 && stackOf(h.works, seedId('goldleaf')) === 4 && h.sv.farm.beds[0] === null, 'harvest: crop + 2 seeds into the store, bed empty')
  // overflow: a full store sends the harvest to the composter
  const full = Array.from({ length: ROOM_STORE_SLOTS }, (_, i) => ({ id: `seed:${Object.keys(CROPS)[i % 10]}:${'DCBAS'[Math.floor(i / 10)]}`, n: 99 }))
  const hf = harvestAt(p.sv, W(full), room.id, 0, T0 + 5 * 60_000, Math.random)
  ok(hf.ok && hf.sv.farm.charge === 3 && hf.works.rooms[0].store!.length === ROOM_STORE_SLOTS, 'overflow: 1 crop + 2 seeds into the composter (+3 charge)')
  // a full composter is armed, so its harvest spends a dose first and makes room: nothing is ever dropped
  const fullC = { ...p.sv, farm: { ...p.sv.farm, charge: CHARGE_CAP } }
  const hc = harvestAt(fullC, W(full), room.id, 0, T0 + 5 * 60_000, () => 0)
  ok(hc.ok && hc.sv.farm.charge === CHARGE_CAP - DOSE_COST + 4, 'full store + full composter: the dose spent makes room, nothing dropped')
}

// feed: any item, capped; the rest stays in the bag
let bag = give(newInv(0), 'goldwood_log', 12).inv
const at = bag.slots.findIndex(s => s?.id === 'goldwood_log')
const f1 = feedAt(freshFarmSave(), bag, at, 12)
ok(f1.fed === 12 && f1.sv.farm.charge === 12 && countOf(f1.inv, 'goldwood_log') === 0 && dosesOf(f1.sv.farm) === 1 && isArmed(f1.sv.farm), 'feed: 12 logs, one dose, armed')
const f2 = feedAt({ ...freshFarmSave(), farm: { ...freshFarmSave().farm, charge: CHARGE_CAP - 5 } }, bag, at, 12)
ok(f2.fed === 5 && countOf(f2.inv, 'goldwood_log') === 7, 'feed: capped, the rest stays in the bag')
ok(feedAt(freshFarmSave(), bag, 20, 3).fed === 0, 'feed: empty slot')

// armed harvest: seeds come back upgraded
const armed = { ...f1.sv, farm: { ...f1.sv.farm, beds: f1.sv.farm.beds.map((b, i) => (i === 0 ? { crop: 'goldleaf' as const, grade: 'D' as const, plantedAt: T0, watered: false } : b)) } }
const ha = harvestAt(armed, W(), room.id, 0, T0 + 5 * 60_000, () => 0)
ok(ha.ok && stackOf(ha.works, seedId('goldleaf', 'C')) === 2 && stackOf(ha.works, cropId('goldleaf')) === 2 && ha.sv.farm.charge === 2, 'armed: 2 crops, both seeds one grade up, a dose spent')
ok(msLeft({ crop: 'goldleaf', grade: 'D', plantedAt: T0, watered: false }, freshFarmSave().farm, T0) === 5 * 60_000, 'msLeft: base time')

// save adoption
ok(adoptFarm(null).farm.beds.length === BEDS && adoptFarm({ v: 1, farm: { beds: [{ crop: 'nope', grade: 'D', plantedAt: 1 }], charge: 9999 }, starter: true }).farm.charge === CHARGE_CAP, 'adopt: bad bed dropped, charge capped')
console.log(`farmroom: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
