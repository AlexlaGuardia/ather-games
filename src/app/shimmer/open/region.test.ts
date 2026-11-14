// The exported corridor, driven by numbers before anyone looks at it. Run: npx tsx src/app/shimmer/open/region.test.ts

import { readFileSync } from 'node:fs'
import { makeRegion, nearestRoad, type RegionMeta } from './region'
import { createCourser, tickCourser, bodySpeeds } from './courser'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const meta = JSON.parse(readFileSync('public/open/corridor.json', 'utf8')) as RegionMeta
const raw = readFileSync('public/open/corridor.bin')
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const { cell, nx, nz, sizeX, sizeZ } = meta

// ★ what you see is what you drive on: heightAt at every vertex IS the vertex, and a mid-face sample lies on the plane
{
  let worst = 0
  for (let k = 0; k < 4000; k++) {
    const i = (k * 37) % (nx - 1), j = (k * 91) % (nz - 1)
    worst = Math.max(worst, Math.abs(R.heightAt(i * cell - sizeX / 2, j * cell - sizeZ / 2) - R.vertex(i, j)))
  }
  ok(worst < 1e-4, `heightAt differs from the mesh vertex by ${worst}`)
  ok(R.heightAt(sizeX, 0) === -Infinity, 'off the region should be no ground')
}

// the places the corridor promises are in it
const place = (id: string) => meta.places.find(p => p.id === id)
for (const id of ['ashfeld', 'millbrook', 'rune-hold']) ok(!!place(id), `place ${id} missing from the export`)

// ★ a missed turn is recoverable (Alex 11-14: roads sat high on dykes; one slip fell into a valley too steep to climb
// back out of). Step off every road, both sides, 30 m out: the bank must stay under the courser's climb limit (0.6)
// and the ground must not fall away below the road.
{
  let steep = 0, drops = 0, n = 0, worstDrop = 0
  for (const r of meta.roads) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
      const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue
      const nxp = -(bz - az) / L, nzp = (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2
      const y0 = R.heightAt(mx, mz); if (y0 < 1) continue        // causeway over water: no bank to recover onto yet
      for (const side of [-1, 1]) {
        let prev = R.heightAt(mx + nxp * side * r.width / 2, mz + nzp * side * r.width / 2), bad = false
        for (let o = r.width / 2 + 2.5; o <= r.width / 2 + 30; o += 2.5) {
          const x = mx + nxp * side * o, z = mz + nzp * side * o
          if (nearestRoad(R, x, z).d < 6) break                     // ran onto another road
          const y = R.heightAt(x, z); if (!Number.isFinite(y)) break
          if (Math.abs(y - prev) / 2.5 > 0.6) bad = true
          prev = y
        }
        const yOut = R.heightAt(mx + nxp * side * (r.width / 2 + 30), mz + nzp * side * (r.width / 2 + 30))
        if (Number.isFinite(yOut)) { const drop = y0 - yOut; worstDrop = Math.max(worstDrop, drop); if (drop > 6) drops++ }
        if (bad) steep++
        n++
      }
    }
  }
  ok(steep / n < 0.03, `${(100 * steep / n).toFixed(1)}% of road banks are steeper than the climb limit within 30 m`)
  ok(drops / n < 0.03, `${(100 * drops / n).toFixed(1)}% of road edges fall >6 m within 30 m (worst ${worstDrop.toFixed(1)} m): the road is a dyke`)
  console.log(`  banks: ${n} probes, ${(100 * steep / n).toFixed(1)}% steep, ${(100 * drops / n).toFixed(1)}% fall >6 m (worst ${worstDrop.toFixed(1)} m)`)
}

// ★ roads are drivable: along every road's centre line the grade stays near the 12% cap
{
  let worst = 0, where = ''
  for (const r of meta.roads) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2))
      for (let s = 0; s < n; s++) {
        const x0 = ax + (bx - ax) * s / n, z0 = az + (bz - az) * s / n, x1 = ax + (bx - ax) * (s + 1) / n, z1 = az + (bz - az) * (s + 1) / n
        const g = Math.abs(R.heightAt(x1, z1) - R.heightAt(x0, z0)) / Math.hypot(x1 - x0, z1 - z0)
        if (g > worst) { worst = g; where = r.id }
      }
    }
  }
  ok(worst < 0.2, `steepest road grade ${(worst * 100).toFixed(0)}% on ${where} (cap 12%, sampling slack to 20%)`)
}

// ★★ THE AUTOPILOT: a pure-pursuit driver follows the Ashfeld → Millbrook road. If the road is drivable, the Darter
// gets there on it. If it stalls on a grade, flies off a lip, or the road leaves the ground, this fails.
{
  const road = meta.roads.find(r => r.from === 'ashfeld' && r.to === 'millbrook') ?? meta.roads.find(r => r.id.startsWith('ashfeld--millbrook'))
  ok(!!road, 'no Ashfeld–Millbrook road in the export')
  if (road) {
    const pts = road.pts
    const [sx, sz] = pts[1], [tx, tz] = pts[3]
    const c = createCourser(sx, sz, Math.atan2(-(tx - sx), -(tz - sz)), R.heightAt)
    const end = pts[pts.length - 1]
    let k = 1, offRoad = 0, t = 0, maxOff = 0, airT = 0
    const DT = 1 / 120
    while (t < 240) {
      // aim at the first centre-line point 14 m ahead
      while (k < pts.length - 1 && Math.hypot(pts[k][0] - c.x, pts[k][1] - c.z) < 14) k++
      const [ax, az] = pts[k]
      const want = Math.atan2(-(ax - c.x), -(az - c.z))
      let err = want - c.yaw
      while (err > Math.PI) err -= 2 * Math.PI
      while (err < -Math.PI) err += 2 * Math.PI
      const v = bodySpeeds(c).fwd
      const steer = Math.max(-1, Math.min(1, -err * 2.5))
      // a careful driver: slow for the bend ahead (how far the road turns over the next ~40 m), brake when over
      const k2 = Math.min(pts.length - 1, k + 4)
      const turn = Math.abs(Math.atan2(pts[k2][0] - ax, pts[k2][1] - az) - Math.atan2(ax - c.x, az - c.z))
      const target = Math.max(9, 24 - Math.min(Math.PI, turn) * 18)
      const throttle = v < target - 1 ? 1 : v > target + 1 ? -0.6 : 0
      tickCourser(c, { throttle, steer, handbrake: false, dt: DT }, R.heightAt)
      t += DT
      if (c.airborne) airT += DT
      const off = nearestRoad(R, c.x, c.z).d
      maxOff = Math.max(maxOff, off)
      if (off > road.width) offRoad += DT
      if (Math.hypot(end[0] - c.x, end[1] - c.z) < 15) break
    }
    const arrived = Math.hypot(end[0] - c.x, end[1] - c.z) < 15
    ok(arrived, `autopilot never reached Millbrook (stopped ${Math.hypot(end[0] - c.x, end[1] - c.z).toFixed(0)} m short after ${t.toFixed(0)} s)`)
    ok(offRoad < 3, `autopilot spent ${offRoad.toFixed(1)} s off the road (max ${maxOff.toFixed(1)} m out)`)
    ok(airT < 1.5, `the road threw the car into the air for ${airT.toFixed(2)} s in total`)
    console.log(`  autopilot: Ashfeld → Millbrook in ${t.toFixed(1)} s, max ${maxOff.toFixed(1)} m off the centre line, ${airT.toFixed(2)} s airborne`)
  }
}

console.log(`region: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
