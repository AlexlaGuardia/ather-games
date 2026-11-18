// ather/folk-spots.ts (BETA M19): every Moglin a spot on the green, the same on every device, apart, inside the flat disc
import { folkSpots, nearestSpot, MIN_GAP } from './folk-spots'
import { SETTLEMENT_R } from './network'
let n = 0, fails = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { fails++; console.log('  FAIL', m) } }
const S = [{ id: 'st-a', name: 'A', x: 100, z: -40 }, { id: 'st-b', name: 'B', x: -900, z: 2200 }, { id: 'st-c', name: 'C', x: 0, z: 0 }]
for (const s of S) {
  const ids = ['m1', 'm2', 'm3', 'm4', 'm5'].map(i => `${s.id}:${i}`)
  const a = folkSpots(s, ids), b = folkSpots(s, ids)
  ok(a.length === 5 && JSON.stringify(a) === JSON.stringify(b), `${s.id}: one spot each, the same every time`)
  ok(a.every(p => Math.hypot(p.x - s.x, p.z - s.z) < SETTLEMENT_R * 0.4), `${s.id}: all well inside the flat disc`)
  ok(a.every((p, i) => a.every((q, j) => i === j || Math.hypot(p.x - q.x, p.z - q.z) >= MIN_GAP * 0.99)), `${s.id}: none closer than ${MIN_GAP} m`)
  ok(a.every(p => Number.isFinite(p.yaw)), `${s.id}: each faces somewhere`)
  const near = nearestSpot(a, a[2].x + 0.3, a[2].z), far = nearestSpot(a.slice(0, 2), a[2].x, a[2].z)
  ok(near?.id === a[2].id && far?.id !== a[2].id, `${s.id}: the nearest one is picked, among those still home`)
}
ok(nearestSpot([], 0, 0) === null, 'no Moglins home: nobody')
console.log(`folk-spots: ${n - fails} ok, ${fails} fail`); process.exit(fails ? 1 : 0)
