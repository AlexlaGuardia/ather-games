// combat.fire's `ads` (Alex 11-18, aim down the sights in the Wilds): through the sights the cone is the gun's adsSpread, so rounds land
// tighter than from the hip, for every gun on the racks; the default (no ads) is the hip cone the Wilds always had.
//   npx tsx src/app/shimmer/open/ather/combat-ads.test.ts
import { newCombat, fire } from './combat'
import { RANGE_GUNS } from '../shared/gunplay'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  ✗', m) } }
const eye = { x: 0, y: 1.6, z: 0 }, fwd = { x: 0, y: 0, z: -1 }
/** mean angle (degrees) off the aim over n single rounds, the keeper steady (no bloom), from one seed */
function meanOff(gunId: string, ads: boolean | undefined, n = 400): number {
  const c = newCombat(7)
  c.gun = RANGE_GUNS.find(g => g.id === gunId)!   // a drawn gun's stats replace the last one's, as combat-layer does on a swap
  let sum = 0, count = 0
  for (let i = 0; i < n; i++) {
    c.keeper.ammo = 99; c.keeper.sinceShot = 99; c.keeper.reloading = 0; c.keeper.bloom = 0; c.rounds.length = 0
    const fired = ads === undefined ? fire(c, eye, fwd) : fire(c, eye, fwd, ads)
    for (const r of c.rounds) { const l = Math.hypot(r.vx, r.vy, r.vz); sum += (Math.acos(Math.max(-1, Math.min(1, -r.vz / l))) * 180) / Math.PI; count++ }
    if (!fired) break
  }
  return count ? sum / count : NaN
}
for (const g of RANGE_GUNS) {
  if (g.adsSpread >= g.hipSpread) continue   // a gun whose sights do not tighten has nothing to show here
  const hip = meanOff(g.id, false), ads = meanOff(g.id, true)
  ok(Number.isFinite(hip) && Number.isFinite(ads), `${g.id}: rounds left both ways`)
  ok(ads < hip * 0.8, `${g.id}: through the sights the rounds land tighter (${ads.toFixed(2)}° vs ${hip.toFixed(2)}° from the hip)`)
}
ok(RANGE_GUNS.some(g => g.adsSpread < g.hipSpread), 'at least one gun tightens in the sights (else this file proves nothing)')
// the default is the hip: callers that never pass ads (every one before 11-18) keep the cone they had
ok(Math.abs(meanOff('backbone', undefined) - meanOff('backbone', false)) < 1e-9, 'no ads argument = the hip cone, exactly')
console.log(`combat-ads: ${pass}/${fail}`); process.exit(fail ? 1 : 0)
