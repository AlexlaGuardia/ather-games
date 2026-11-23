// On foot on the continent, by numbers. Run: npx tsx src/app/shimmer/open/on-foot.test.ts   (REGION=corridor too)

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, TUNNEL_H, TUNNEL_WALK, type RegionMeta } from './region'
import { footWorld, tickFoot, exitSpot, canEnter, stepOut, ENTER_REACH, WATER_Y } from './on-foot'
import type { LocoState } from './shared/locomotion'
import { cachedPlan, solidHit, bodyHits, buildingBox, stationGround } from './foot-solids'
import { createLoco } from './shared/locomotion'
import { STATION } from '../play3d/station-field'

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

// ★ SOLID TOWNS: a house stops the walker at its wall (and it slides along it), the Station's stair carries it up the
//   terrace and through the town door, the terminal's walls hold. foot-solids.ts. (The continent's towns by name.)
if (['rune-hold', 'citadel'].every(id => meta.places.some(p => p.id === id))) {
  const dirYaw = (dx: number, dz: number) => Math.atan2(-dx, -dz)
  const towns = ['rune-hold', 'citadel', 'gale-haven', ...meta.places.filter(p => p.kind === 'village').slice(0, 3).map(p => p.id)]
  let arrived = 0, slid = 0, tried = 0
  for (const id of towns) {
    const pi = meta.places.findIndex(p => p.id === id)
    if (pi < 0) continue
    const plan = cachedPlan(R, pi)
    for (const b of plan.buildings.filter((_, k) => k % Math.max(1, Math.floor(plan.buildings.length / 8)) === 0)) {
      const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), ax = -fz, az = fx, box = buildingBox(b)
      const sx = b.x + fx * (b.d / 2 + 4), sz = b.z + fz * (b.d / 2 + 4)
      fw.hint.y = b.y1 + 2
      const sy = R.groundAt(sx, sz, b.y1 + 2)
      if (!Number.isFinite(sy) || sy < WATER_Y + 0.3 || !fw.world.bodyFree(sx, sz, sy + 0.1)) continue
      tried++
      // straight at the facade
      const s = createLoco(sx, sy + 0.05, sz)
      let inside = false
      walk(s, dirYaw(-fx, -fz), 3, 1, 0, q => { if (bodyHits(box, q.px, q.pz, q.py)) inside = true })
      ok(!inside, `${id}: walked into a house at ${b.x.toFixed(0)},${b.z.toFixed(0)}`)
      const out = (s.px - b.x) * fx + (s.pz - b.z) * fz - b.d / 2
      if (out < 1.2) arrived++
      // glancing: 45° between the facade and along it; the walker keeps going along the wall
      const g = createLoco(sx, sy + 0.05, sz)
      walk(g, dirYaw(-fx + ax, -fz + az), 3, 1, 0, q => { if (bodyHits(box, q.px, q.pz, q.py)) inside = true })
      ok(!inside, `${id}: slid into a house at ${b.x.toFixed(0)},${b.z.toFixed(0)}`)
      if ((g.px - sx) * ax + (g.pz - sz) * az > 3) slid++
    }
  }
  ok(tried >= 20, `only ${tried} houses had a clear front to walk from`)
  ok(arrived >= tried * 0.6, `the walker reached only ${arrived}/${tried} facades (terrain in the way, or the test is not testing)`)
  ok(slid >= tried * 0.5, `the walker slid along only ${slid}/${tried} walls`)

  // the Station: up the stair, through the town door, onto the terrace; then the terminal's north wall
  const st = fw.solids.station
  ok(!!st, 'no Station site')
  if (st) {
    const c = Math.cos(st.yaw), sn = Math.sin(st.yaw), toW = (gx: number, gz: number) => [st.x + gx * c - gz * sn, st.z + gx * sn + gz * c]
    const toG = (x: number, z: number) => [(x - st.x) * c + (z - st.z) * sn, -(x - st.x) * sn + (z - st.z) * c]
    const h = st.level - st.base, L = h / 0.55, zc = STATION.doors.town.z + STATION.doors.town.h / 2 - 0.5
    const [fx0, fz0] = toW(-L - 3, zc)
    fw.hint.y = st.base + 40
    const s = createLoco(fx0, Math.max(R.groundAt(fx0, fz0, st.level + 2), stationGround(st, fx0, fz0)) + 0.05, fz0)
    walk(s, dirYaw(c, sn), Math.max(6, (L + 10) / 4))
    const [gx, gz] = toG(s.px, s.pz)
    ok(gx > 3 && Math.abs(s.py - st.level) < 0.3, `Station: the stair did not carry the walker in (gx ${gx.toFixed(1)}, gz ${gz.toFixed(1)}, y ${s.py.toFixed(1)} vs level ${st.level.toFixed(1)})`)
    const [ix, iz] = toW(14, 24)
    const w = createLoco(ix, st.level + 0.05, iz)
    walk(w, dirYaw(sn, -c), 4)
    ok(toG(w.px, w.pz)[1] > 13.5 + 0.25, `Station: walked through the terminal's north wall (gz ${toG(w.px, w.pz)[1].toFixed(2)})`)
    ok(toG(w.px, w.pz)[1] < 14.5, `Station: never reached the terminal's north wall (gz ${toG(w.px, w.pz)[1].toFixed(2)})`)
  }

  // a body that ends up INSIDE a house (a mantle onto the hill a house is buried in, a spawn) is put back out at once
  {
    const b = cachedPlan(R, meta.places.findIndex(p => p.id === 'citadel')).buildings[5], box = buildingBox(b)
    const fx = Math.cos(b.yaw), fz = Math.sin(b.yaw), x = b.x + fx * (b.d / 2 - 0.4), z = b.z + fz * (b.d / 2 - 0.4)
    fw.hint.y = b.y1 + 2
    const s = createLoco(x, b.y1 + 0.3, z)
    ok(bodyHits(box, s.px, s.pz, s.py), 'push-out test: the body was not inside the house to begin with')
    ok(!fw.world.bodyFree(s.px, s.pz, s.py), 'bodyFree calls a spot inside a house free (the gate on every move is off)')
    walk(s, 0, 1 / 60, 0, 0)
    ok(!bodyHits(box, s.px, s.pz, s.py), `a body inside a house stayed inside it (${s.px.toFixed(1)},${s.pz.toFixed(1)})`)
    ok(Math.hypot(s.px - x, s.pz - z) < 1.5, `push-out threw the body ${Math.hypot(s.px - x, s.pz - z).toFixed(1)} m`)
  }

  // a step out of a car on a town lane never stands the walker inside a house
  const rh = cachedPlan(R, meta.places.findIndex(p => p.id === 'rune-hold'))
  let bad = 0, spots = 0
  for (const ln of rh.lanes) for (let k = 0; k + 1 < ln.pts.length; k += 3) {
    const [x, z] = ln.pts[k], [x2, z2] = ln.pts[k + 1], y = R.heightAt(x, z)
    const sp = exitSpot(fw, R, { x, z, y, yaw: yawAlong([x, z], [x2, z2]) })
    if (!sp) continue
    spots++
    if (solidHit(R, fw.solids, sp.x, sp.z, sp.y)) bad++
  }
  ok(spots > 10 && bad === 0, `Rune Hold lanes: ${bad}/${spots} step-out spots inside a house`)

  // cost: a minute of walking through Citadel's streets
  const ci = cachedPlan(R, meta.places.findIndex(p => p.id === 'citadel')), l0 = ci.lanes[0].pts[0]
  const cy = R.heightAt(l0[0], l0[1])
  fw.hint.y = cy + 2
  const cs = createLoco(l0[0], cy + 0.05, l0[1])
  const t0 = performance.now()
  walk(cs, 0.7, 60, 1, 0.3)
  const per = (performance.now() - t0) / 3600
  ok(per < 0.25, `a walker tick in Citadel costs ${per.toFixed(3)} ms`)
  console.log(`  solid towns: ${tried} houses, ${arrived} reached, ${slid} slid; Station step-outs ${spots}; ${per.toFixed(3)} ms/tick in Citadel`)
}

// ★ M84 s3b: a published zone build's boxes stop the walker (footWorld's 3rd param = zone-parts.ts zonePartBoxes), and nothing else
{
  const e = net.edges.find(q => q.kind === 'road' && q.pts.length > 12 && !(net.tunnels ?? []).some(t => t.edge === q.id))!
  const [x, z] = e.pts[Math.floor(e.pts.length / 2)], y = R.groundAt(x, z)
  const wall = { x0: x - 3, x1: x + 3, z0: z - 0.1, z1: z + 0.1, y0: y - 0.5, y1: y + 3 }
  const withWall = footWorld(R, null, [wall])
  ok(fw.world.bodyFree(x, z, y + 0.05), `zone box: the spot is free without the box`)
  ok(!withWall.world.bodyFree(x, z, y + 0.05), `zone box: the walker cannot stand inside a published wall`)
  ok(withWall.world.bodyFree(x + 6, z + 6, R.groundAt(x + 6, z + 6) + 0.05) === fw.world.bodyFree(x + 6, z + 6, R.groundAt(x + 6, z + 6) + 0.05), 'zone box: away from it, nothing changes')
}
console.log(`on-foot[${NAME}]: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
