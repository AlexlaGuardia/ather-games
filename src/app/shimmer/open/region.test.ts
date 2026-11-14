// The exported corridor, driven by numbers before anyone looks at it. Run: npx tsx src/app/shimmer/open/region.test.ts

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { bridgeRail, drivable, ferryLanding, guardrails, makeRegion, onFerryWater, roadRail, nearestRoad, roadside, routeBetween, type RegionMeta } from './region'
import { createCourser, tickCourser, bodySpeeds } from './courser'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// REGION=continent npx tsx … runs the same law against the full map
const NAME = process.env.REGION ?? 'corridor'
const meta = JSON.parse(readFileSync(`public/open/${NAME}.json`, 'utf8')) as RegionMeta
const raw = meta.binGz ? gunzipSync(readFileSync(`public/open/${NAME}.bin.gz`)) : readFileSync(`public/open/${NAME}.bin`)
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
  const rails = guardrails(R).flatMap(g => g.pts)
  for (const r of drivable(R)) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
      const L = Math.hypot(bx - ax, bz - az); if (L < 1) continue
      const nxp = -(bz - az) / L, nzp = (bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2
      if (R.deckAt(mx, mz)) continue                               // on a bridge: the parapets are the bank
      const y0 = R.heightAt(mx, mz); if (y0 < 1) continue        // a ford over water: no bank to recover onto
      for (const side of [-1, 1]) {
        const rx = mx + nxp * side * (r.width / 2 + 0.7), rz = mz + nzp * side * (r.width / 2 + 0.7)
        if (rails.some(q => Math.hypot(q[0] - rx, q[1] - rz) < 4)) { n++; continue }   // a guardrail holds this side
        let prev = R.heightAt(mx + nxp * side * r.width / 2, mz + nzp * side * r.width / 2), bad = false
        for (let o = r.width / 2 + 2.5; o <= r.width / 2 + 30; o += 2.5) {
          const x = mx + nxp * side * o, z = mz + nzp * side * o
          const u = nearestRoad(R, x, z)
          if (u.d < 6 || u.junction) break                          // ran onto another road or a junction
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
  for (const r of drivable(R)) {
    for (let k = 0; k < r.pts.length - 1; k++) {
      const [ax, az] = r.pts[k], [bx, bz] = r.pts[k + 1]
      const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / 2))
      for (let s = 0; s < n; s++) {
        const x0 = ax + (bx - ax) * s / n, z0 = az + (bz - az) * s / n, x1 = ax + (bx - ax) * (s + 1) / n, z1 = az + (bz - az) * (s + 1) / n
        if ((R.heightAt(x0, z0) < 0.5 && !R.deckAt(x0, z0)) || (R.heightAt(x1, z1) < 0.5 && !R.deckAt(x1, z1))) continue   // a ferry's water (wet = < 0.5, as the export decides)
        if (onFerryWater(R, x0, z0) || onFerryWater(R, x1, z1)) continue      // between two ferry landings
        if (ferryLanding(R, x0, z0, 9) || ferryLanding(R, x1, z1, 9)) continue  // the quay: a stop-and-board pad at the water's edge, not a road grade
        const inIsland = (x: number, z: number) => (meta.network?.junctions ?? []).some(j => j.island && Math.hypot(x - j.x, z - j.z) < j.island + 1)
        if (inIsland(x0, z0) || inIsland(x1, z1)) continue                    // an edge runs to a roundabout's centre; nobody drives the island
        const g = Math.abs(R.groundAt(x1, z1) - R.groundAt(x0, z0)) / Math.hypot(x1 - x0, z1 - z0)
        if (g > worst) { worst = g; where = r.id }
      }
    }
  }
  ok(worst < 0.2, `steepest road grade ${(worst * 100).toFixed(0)}% on ${where} (cap 12%, sampling slack to 20%)`)
}

// ★ the road index answers exactly what a scan of every segment answers (out to its ~400 m reach)
{
  let bad = 0
  for (let k = 0; k < 600; k++) {
    const x = ((k * 7919) % 1000 / 1000 - 0.5) * sizeX, z = ((k * 104729) % 1000 / 1000 - 0.5) * sizeZ
    let brute = Infinity
    for (const r of drivable(R)) for (let i = 0; i < r.pts.length - 1; i++) {
      const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], abx = bx - ax, abz = bz - az, L = abx * abx + abz * abz || 1
      const t = Math.max(0, Math.min(1, ((x - ax) * abx + (z - az) * abz) / L))
      brute = Math.min(brute, Math.hypot(ax + abx * t - x, az + abz * t - z))
    }
    const u = nearestRoad(R, x, z)
    if (u.junction) continue
    if (brute < 380 ? Math.abs(u.d - brute) > 1e-6 : u.d < brute - 1e-6) bad++
  }
  ok(bad === 0, `road index disagrees with a full scan at ${bad}/600 points`)
}

// ★ THE NETWORK (road_network.py): one graph, junctions classified by what meets, every town a square
const net = meta.network
ok(!!net, 'export has no road network')
if (net) {
  for (const id of ['ashfeld', 'millbrook', 'rune-hold']) ok(net.junctions.some(j => j.kind === 'square' && j.place === id), `${id} has no town square`)
  ok(net.junctions.some(j => j.kind === 'roundabout' && (j.island ?? 0) > 0), 'no roundabout in the corridor (junctions.json pins one north of Rune Hold)')
  const ids = new Set(net.junctions.map(j => j.id))
  ok(net.edges.every(e => ids.has(e.a) && ids.has(e.b)), 'an edge names a junction that does not exist')
  // a pad is somewhere you stop, turn and pull away: near flat across its whole disc
  let worstPad = 0, wp = ''
  for (const j of net.junctions) {
    if (j.r <= 0) continue
    let lo = Infinity, hi = -Infinity
    for (let a = 0; a < 24; a++) for (const f of [0.3, 0.6, 0.95]) {
      const rr = j.r * f; if (j.island && rr < j.island + 0.5) continue
      const y = R.heightAt(j.x + Math.cos(a / 24 * 2 * Math.PI) * rr, j.z + Math.sin(a / 24 * 2 * Math.PI) * rr)
      if (Number.isFinite(y)) { lo = Math.min(lo, y); hi = Math.max(hi, y) }
    }
    const slope = (hi - lo) / (2 * j.r)
    if (slope > worstPad) { worstPad = slope; wp = `${j.id} ${j.kind}` }
  }
  ok(worstPad < 0.06, `junction pad ${wp} tilts ${(worstPad * 100).toFixed(1)}% across (pads hold 3%)`)
}

// ★ BRIDGES: decks over water where a paved road or a road crosses it. No step at either abutment, a gentle deck,
// clearance over the river, and the river still a river under it (no causeway).
{
  const bridges = meta.network?.bridges ?? []
  ok(bridges.length >= 2, `${bridges.length} bridges in the corridor (expected the paved one and the Rune Hold one)`)
  for (const b of bridges) {
    const p = b.pts, a = p[0], z = p[p.length - 1]
    const step = Math.max(Math.abs(a[2] - R.heightAt(a[0], a[1])), Math.abs(z[2] - R.heightAt(z[0], z[1])))
    ok(step < 0.35, `bridge ${b.id}: ${step.toFixed(2)} m step at an abutment`)
    let g = 0, clear = 0, wet = 0
    for (let k = 1; k < p.length; k++) g = Math.max(g, Math.abs(p[k][2] - p[k - 1][2]) / Math.max(0.1, Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1])))
    for (const q of p) { const under = R.heightAt(q[0], q[1]); if (under < 0.3) { wet++; clear = Math.max(clear, q[2] - Math.max(under, 0)) } }
    // ramps hold 6% over the water; at an abutment the deck may follow a bank that rises faster (it is on land there)
    ok(g < 0.09, `bridge ${b.id}: deck grade ${(g * 100).toFixed(1)}% (ramps hold 6%, abutments follow the bank)`)
    ok(wet >= 3, `bridge ${b.id}: only ${wet} deck points over water: the river was filled in under it`)
    ok(clear >= 3, `bridge ${b.id}: ${clear.toFixed(1)} m over the water (wants ≥ 3)`)
    // groundAt: the car on the deck reads the deck; a probe from under it reads the river
    const mid = p[Math.floor(p.length / 2)]
    ok(Math.abs(R.groundAt(mid[0], mid[1], mid[2]) - mid[2]) < 0.05, `bridge ${b.id}: groundAt on the deck misses it`)
    ok(R.groundAt(mid[0], mid[1], -0.5) < mid[2] - 2, `bridge ${b.id}: a boat under the deck would be lifted onto it`)
  }
}

// ★ ROADSIDE (canon 11-14): a fingerpost at every junction, each arm naming a real town down that road at a sane
// road distance; a waystone carved per km. Distances are by road: an arm's km can never beat the straight line.
{
  const { waystones, fingerposts } = roadside(R)
  const junc = (meta.network?.junctions ?? []).filter(j => ['tee', 'merge', 'cross', 'stop4', 'roundabout'].includes(j.kind))
  ok(fingerposts.length === junc.length, `${fingerposts.length} fingerposts for ${junc.length} junctions`)
  let bad = 0
  for (const f of fingerposts) for (const a of f.arms) {
    const p = meta.network?.junctions.find(q => q.place === a.town) ?? meta.places.find(q => q.id === a.town)
    if (!p || !(a.km > 0) || a.km * 1000 < Math.hypot(p.x - f.x, p.z - f.z) - 60) bad++
  }
  ok(bad === 0, `${bad} fingerpost arms name a town nearer than the road could take you, or none`)
  ok(waystones.length >= 1 && waystones.every(w => w.faces.length > 0 && w.y > 0.6), 'waystones missing, faceless, or in the water')
}

// ★★ EVERY LANE CROSSES EVERY BRIDGE CLEAN (Alex 11-14: "a missing chunk that makes the car bug out"). Five lane
// offsets, both directions, at speed: no tick airborne on or near the deck, no fall into the river. The chunk was
// four things at once: a wedge at each curved joint no segment covered, a capsule poking 2 m past an end, deck ends
// eased toward a falling riverbank, and a 2 cm seam read as a one-tick launch.
for (const b of meta.network?.bridges ?? []) for (const dir of [1, -1]) for (const off of [-5, -3, 0, 3, 5]) {
  const p = dir > 0 ? b.pts : [...b.pts].reverse()
  const [ax, az] = p[0], [bx, bz] = p[1], L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L
  const c = createCourser(ax - ux * 25 - uz * off, az - uz * 25 + ux * off, Math.atan2(-ux, -uz), R.groundAt)
  let air = 0, swam = false
  for (let t = 0; t < 9; t += 1 / 120) {
    let bk = 0, bd = Infinity
    for (let k = 0; k < p.length; k++) { const d = Math.hypot(p[k][0] - c.x, p[k][1] - c.z); if (d < bd) { bd = d; bk = k } }
    if (bk === p.length - 1 && bd > 20) break
    const q0 = p[Math.min(p.length - 2, bk + 3)], q = p[Math.min(p.length - 1, bk + 4)], qL = Math.hypot(q[0] - q0[0], q[1] - q0[1]) || 1
    const tx = q[0] - (q[1] - q0[1]) / qL * off, tz = q[1] + (q[0] - q0[0]) / qL * off
    let err = Math.atan2(-(tx - c.x), -(tz - c.z)) - c.yaw; while (err > Math.PI) err -= 2 * Math.PI; while (err < -Math.PI) err += 2 * Math.PI
    tickCourser(c, { throttle: bodySpeeds(c).fwd < 22 ? 1 : 0, steer: Math.max(-1, Math.min(1, -err * 2.5)), handbrake: false, dt: 1 / 120 }, R.groundAt)
    bridgeRail(R, c) || roadRail(R, c)
    if (c.airborne && (R.deckAt(c.x, c.z) || bd < 15)) air += 1 / 120
    if (R.heightAt(c.x, c.z) < 0.3 && c.y < 0.5) swam = true
  }
  ok(air < 0.05 && !swam, `bridge ${b.id} dir ${dir} lane ${off}: ${air.toFixed(2)} s airborne${swam ? ', IN THE RIVER' : ''}`)
}

// ★ FERRIES: every ferry has two landings on dry land, each ON its road, and a landing finds its far side
{
  for (const f of meta.network?.ferries ?? []) {
    ok(f.a[2] >= 0.5 && f.b[2] >= 0.5, `ferry ${f.id}: a landing is in the water`)
    const la = ferryLanding(R, f.a[0], f.a[1]), lb = ferryLanding(R, f.b[0], f.b[1])
    ok(la?.ferry.id === f.id && lb?.ferry.id === f.id && la.to === f.b && lb.to === f.a, `ferry ${f.id}: a landing does not lead across`)
    ok(nearestRoad(R, f.a[0], f.a[1]).d < 3 && nearestRoad(R, f.b[0], f.b[1]).d < 3, `ferry ${f.id}: a landing is off its road`)
  }
}

// ★★ THE AUTOPILOT: a pure-pursuit driver follows a ROUTE THROUGH THE NETWORK (routeBetween, around roundabouts).
// If the road is drivable the Darter gets there on it. If it stalls on a grade, flies off a lip, leaves the road or
// climbs a roundabout's island, this fails.
function drive(from: string, to: string) {
  const route = routeBetween(R, from, to)
  ok(!!route, `no network route ${from} → ${to}`)
  if (!route) return
  const pts = route.pts
  const [sx, sz] = pts[1], [tx, tz] = pts[3]
  const c = createCourser(sx, sz, Math.atan2(-(tx - sx), -(tz - sz)), R.groundAt)
  const end = pts[pts.length - 1]
  let k = 1, offRoad = 0, t = 0, maxOff = 0, airT = 0, island = 0, swam = 0, decked = false
  const DT = 1 / 120
  while (t < 300) {
    // aim at the first centre-line point 12 m ahead
    while (k < pts.length - 1 && Math.hypot(pts[k][0] - c.x, pts[k][1] - c.z) < 12) k++
    const [ax, az] = pts[k]
    const want = Math.atan2(-(ax - c.x), -(az - c.z))
    let err = want - c.yaw
    while (err > Math.PI) err -= 2 * Math.PI
    while (err < -Math.PI) err += 2 * Math.PI
    const v = bodySpeeds(c).fwd
    const steer = Math.max(-1, Math.min(1, -err * 2.5))
    // a careful driver: slow for the bend ahead (how far the road turns over the next ~40 m), brake when over
    const k2 = Math.min(pts.length - 1, k + 8)
    let turn = Math.abs(Math.atan2(pts[k2][0] - ax, pts[k2][1] - az) - Math.atan2(ax - c.x, az - c.z))
    if (turn > Math.PI) turn = 2 * Math.PI - turn
    const target = Math.max(8, 24 - turn * 18)
    const throttle = v < target - 1 ? 1 : v > target + 1 ? -0.6 : 0
    tickCourser(c, { throttle, steer, handbrake: false, dt: DT }, R.groundAt)
    bridgeRail(R, c) || roadRail(R, c)
    if (R.heightAt(c.x, c.z) < 0.3 && c.y < 0.5) swam += DT
    if (R.deckAt(c.x, c.z) && R.heightAt(c.x, c.z) < 0.3) decked = true
    t += DT
    if (c.airborne) airT += DT
    const u = nearestRoad(R, c.x, c.z)
    if (u.junction?.island && Math.hypot(c.x - u.junction.x, c.z - u.junction.z) < u.junction.island) island += DT
    const off = u.junction ? 0 : u.d
    maxOff = Math.max(maxOff, off)
    if (off > (u.road?.width ?? 12) / 2 + 2) offRoad += DT
    if (Math.hypot(end[0] - c.x, end[1] - c.z) < 15) break
  }
  const left = Math.hypot(end[0] - c.x, end[1] - c.z)
  ok(left < 15, `autopilot ${from} → ${to} never arrived (stopped ${left.toFixed(0)} m short after ${t.toFixed(0)} s)`)
  ok(offRoad < 3, `autopilot ${from} → ${to} spent ${offRoad.toFixed(1)} s off the road (max ${maxOff.toFixed(1)} m out)`)
  ok(airT < 1.5, `${from} → ${to}: the road threw the car into the air for ${airT.toFixed(2)} s in total`)
  ok(island === 0, `${from} → ${to}: drove over a roundabout island for ${island.toFixed(1)} s`)
  ok(swam === 0, `${from} → ${to}: in the river for ${swam.toFixed(1)} s (a deck let the car through?)`)
  console.log(`  autopilot: ${from} → ${to} (${(route.length / 1000).toFixed(2)} km by road) in ${t.toFixed(1)} s, max ${maxOff.toFixed(1)} m off, ${airT.toFixed(2)} s airborne`)
  return { decked }
}
drive('ashfeld', 'millbrook')
const mr = drive('millbrook', 'rune-hold')     // through the roundabout and over the bridge into Rune Hold
ok(!!mr?.decked, 'millbrook → rune-hold never crossed a bridge deck over water')
drive('rune-hold', 'ashfeld')

console.log(`region[${NAME}]: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗', f)
process.exit(fails.length ? 1 : 0)
