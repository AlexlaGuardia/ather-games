// On foot on the continent, by numbers. Run: npx tsx src/app/shimmer/open/on-foot.test.ts   (REGION=corridor too)

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, TUNNEL_H, TUNNEL_WALK, type RegionMeta } from './region'
import { footWorld, tickFoot, exitSpot, canEnter, stepOut, ENTER_REACH } from './on-foot'
import type { LocoState } from '../voxel3d/locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const NAME = process.env.REGION ?? 'continent'
const meta = JSON.parse(readFileSync(`public/open/${NAME}.json`, 'utf8')) as RegionMeta
const raw = meta.binGz ? gunzipSync(readFileSync(`public/open/${NAME}.bin.gz`)) : readFileSync(`public/open/${NAME}.bin`)
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const fw = footWorld(R)
const net = meta.network!

const walk = (s: LocoState, yaw: number, secs: number, f = 1, r = 0, onTick?: (s: LocoState) => void) => {
  const fwx = -Math.sin(yaw), fwz = -Math.cos(yaw), rtx = Math.cos(yaw), rtz = -Math.sin(yaw)
  for (let t = 0; t < secs; t += 1 / 60) {
    let mx = fwx * f + rtx * r, mz = fwz * f + rtz * r
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l }
    tickFoot(fw, R, s, { mvX: mx, mvZ: mz, fwdX: fwx, fwdZ: fwz, rightX: rtx, rightZ: rtz, jumpKey: false, crouchKey: false, dt: 1 / 60 })
    onTick?.(s)
  }
}
const yawAlong = (a: number[], b: number[]) => Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]))

// ★ step out on an ordinary road: beside the car, on the ground, a body that fits; and back in from there
{
  const e = net.edges.find(q => q.kind === 'road' && q.pts.length > 12 && !(net.tunnels ?? []).some(t => t.edge === q.id))!
  const k = Math.floor(e.pts.length / 2), [x, z] = e.pts[k], yaw = yawAlong(e.pts[k], e.pts[k + 1])
  const car = { x, z, y: R.groundAt(x, z), yaw, vx: 0, vz: 0 }
  const sp = exitSpot(fw, R, car)
  ok(!!sp, `road ${e.id}: nowhere to step out`)
  if (sp) {
    const d = Math.hypot(sp.x - x, sp.z - z)
    ok(d > 1.2 && d < 3.6, `road ${e.id}: stepped out ${d.toFixed(1)} m from the car`)
    ok(Math.abs(sp.y - R.groundAt(sp.x, sp.z)) < 0.2, `road ${e.id}: the spot is not on the ground`)
    const s = stepOut(sp, car)
    ok(canEnter(s, car), `road ${e.id}: can't get back in from where you got out`)
    // walk down the road for 4 s: the walker stays on the land and actually moves
    let worst = 0
    walk(s, yaw, 4, 1, 0, q => { if (!q.airborne) worst = Math.max(worst, Math.abs(q.py - R.groundAt(q.px, q.pz, q.py + 0.6))) })
    const moved = Math.hypot(s.px - sp.x, s.pz - sp.z)
    ok(moved > 12, `road ${e.id}: walked only ${moved.toFixed(1)} m in 4 s`)
    ok(worst < 0.6, `road ${e.id}: walker ${worst.toFixed(2)} m off the ground while grounded`)
    ok(!canEnter(s, car) && Math.hypot(s.px - car.x, s.pz - car.z) > ENTER_REACH, `road ${e.id}: can still get in from ${moved.toFixed(0)} m away`)
  }
}

// ★★ IN THE PASSAGE: step out under the mountain onto the floor (not the summit), walk into the wall and be held,
// walk the bore and stay on its floor
for (const t of net.tunnels ?? []) {
  const k = Math.floor(t.pts.length / 2), [x, z, y] = t.pts[k], yaw = yawAlong(t.pts[k], t.pts[k + 1])
  const car = { x, z, y, yaw, vx: 0, vz: 0 }
  const sp = exitSpot(fw, R, car)
  ok(!!sp && Math.abs(sp.y - y) < 0.3, `tunnel ${t.id}: stepped out at ${sp?.y.toFixed(1)} (floor ${y.toFixed(1)}, hill ${R.heightAt(x, z).toFixed(0)})`)
  if (!sp) continue
  const s = stepOut(sp, car)
  // straight at the driver's-side wall for 3 s
  const wall = t.width / 2 + TUNNEL_WALK - 0.9
  let worstOff = 0, worstY = 0
  walk(s, yaw + Math.PI / 2, 3, 1, 0, () => {
    const h = R.tunnelAt(s.px, s.pz)
    if (h) { worstOff = Math.max(worstOff, Math.abs(h.off)); worstY = Math.max(worstY, Math.abs(s.py - h.y)) }
  })
  ok(worstOff <= wall + 0.15, `tunnel ${t.id}: walked ${worstOff.toFixed(2)} m off centre (wall at ${wall.toFixed(2)})`)
  ok(worstY < 0.3, `tunnel ${t.id}: walker ${worstY.toFixed(2)} m off the floor at the wall`)
  // and down the bore for 5 s
  const s2 = stepOut(sp, car)
  let high = 0
  walk(s2, yaw, 5, 1, 0, q => { const h = R.tunnelAt(q.px, q.pz); if (h && h.cover > TUNNEL_H && q.py > h.y + 1) high++ })
  ok(high === 0 && Math.hypot(s2.px - sp.x, s2.pz - sp.z) > 15, `tunnel ${t.id}: ${high} ticks up in the mountain walking the bore`)
}

// ★ ON A BRIDGE: step out onto the deck, not into the river under it
{
  const b = (net.bridges ?? []).find(q => q.pts.length > 10)
  if (b) {
    const k = Math.floor(b.pts.length / 2), [x, z, y] = b.pts[k], yaw = yawAlong(b.pts[k], b.pts[k + 1])
    const sp = exitSpot(fw, R, { x, z, y, yaw })
    ok(!!sp && Math.abs(sp.y - y) < 0.6, `bridge ${b.id}: stepped out at ${sp?.y.toFixed(1)} (deck ${y.toFixed(1)})`)
  }
}

console.log(`on-foot[${NAME}]: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
