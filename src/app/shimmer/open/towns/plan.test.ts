// Town plans on the real continent: nothing on a road, in water or through a neighbour; plinths reach the ground;
// the core is denser than the edge; the towns are towns (counts pinned as literals, so tuning one constant cannot
// quietly pass a test that reads it). npx tsx src/app/shimmer/open/towns/plan.test.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, nearestRoad, nearPad, type RegionMeta } from '../region'
import { planTowns, townDiscs, type Building } from './plan'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const meta = JSON.parse(readFileSync('public/open/continent.json', 'utf8')) as RegionMeta
const raw = gunzipSync(readFileSync('public/open/continent.bin.gz'))
const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
const plans = planTowns(R)
const byId = new Map(plans.map(p => [p.place, p]))

import { footprint, quadsOverlap } from './plan'
const corners = (b: Building) => footprint(b)
// ── every building: on land, off the roads and pads, its plinth spanning the ground under it
let onRoad = 0, wet = 0, floating = 0, total = 0
for (const pl of plans) for (const b of pl.buildings) {
  total++
  for (const [x, z] of corners(b)) {
    const y = R.heightAt(x, z), nr = nearestRoad(R, x, z)
    if (y < 1.5) wet++
    if ((nr.road && nr.d < nr.road.width / 2) || nearPad(R, x, z, 0)) onRoad++
    if (y < b.y0 - 0.01 || y > b.y1 + 0.01) floating++
  }
}
ok(onRoad === 0, `building corners on a road or pad: ${onRoad}`)
ok(wet === 0, `building corners in water: ${wet}`)
ok(floating === 0, `corners outside their plinth span (float or sink): ${floating}`)
ok(total > 900, `towns hold ${total} buildings (want > 900)`)

// ── no two buildings of a town overlap (separating-axis on the footprints)
const overlap = (a: Building, b: Building) => quadsOverlap(footprint(a), footprint(b))
let clash = 0
for (const pl of plans) { const bs = pl.buildings; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (Math.hypot(bs[i].x - bs[j].x, bs[i].z - bs[j].z) < 30 && overlap(bs[i], bs[j])) clash++ }
ok(clash === 0, `overlapping buildings: ${clash}`)

// ── the towns are towns
const n = (id: string) => byId.get(id)?.buildings.length ?? 0
ok(n('citadel') >= 180, `Citadel has ${n('citadel')} buildings (want >= 180)`)
ok(n('gale-haven') >= 180, `Gale Haven has ${n('gale-haven')} (want >= 180)`)
ok(n('ashfeld') >= 50, `Ashfeld has ${n('ashfeld')} (want >= 50)`)
ok(n('rune-hold') >= 35, `Rune Hold has ${n('rune-hold')} (want >= 35)`)
ok(n('millbrook') >= 15, `Millbrook has ${n('millbrook')} (want >= 15)`)
ok(n('passage') === 0, `the Passage (underground) has no town on top: ${n('passage')}`)
ok((byId.get('citadel')?.lanes.length ?? 0) >= 30, `Citadel has lanes`)

// ── denser at the core: buildings per m² inside half the reach beat the outer ring, and the core stands taller
for (const id of ['citadel', 'gale-haven', 'ashfeld']) {
  const pl = byId.get(id)!, inner = pl.buildings.filter(b => b.rim < 0.45), outer = pl.buildings.filter(b => b.rim >= 0.45)
  const fl = (bs: Building[]) => bs.reduce((s, b) => s + b.floors, 0) / Math.max(1, bs.length)
  ok(fl(inner) > fl(outer), `${id}: core floors ${fl(inner).toFixed(2)} > edge ${fl(outer).toFixed(2)}`)
  const area = (bs: Building[]) => bs.reduce((s, b) => s + b.w * b.d, 0)
  // built-up density: cities only. A settlement's high street can pass outside its core (Ashfeld's road skirts the
  // square), and lining it is right, so there the outer ring may legitimately be the busier one.
  if (id !== 'ashfeld') ok(area(inner) / (0.45 * 0.45) > area(outer) / (1 - 0.45 * 0.45), `${id}: core built-up denser than the edge`)
}

// ── lanes: on land, inside their town, off the roads
let badLane = 0
const discs = new Map(townDiscs(R).map(d => [d.id, d]))
for (const pl of plans) for (const l of pl.lanes) for (const [i, [x, z]] of l.pts.entries()) {
  // a lane's first point sits ON the kerb or the square's rim by design: that is where it joins
  if (i === 0) continue
  const d = discs.get(pl.place)!, nr = nearestRoad(R, x, z)
  if (R.heightAt(x, z) < 1.5 || Math.hypot(x - d.x, z - d.z) > pl.r || (nr.road && nr.d < nr.road.width / 2)) badLane++
}
ok(badLane === 0, `lane points in water, off-town or on a road: ${badLane}`)

const segDist = (pts: [number, number, number][], x: number, z: number) => {
  let best = Infinity
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz || 1
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L))
    best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z))
  }
  return best
}
// ── every lane is joined: its first point is on a road kerb / the square, or it crosses another lane that is
let loose = 0
for (const pl of plans) {
  const seen = new Set<number>()
  const onNet = (x: number, z: number) => { const nr = nearestRoad(R, x, z); return (nr.road && nr.d < nr.road.width / 2 + 1.5) || nearPad(R, x, z, 1.5) }
  pl.lanes.forEach((l, i) => { if (onNet(l.pts[0][0], l.pts[0][1])) seen.add(i) })
  for (let grew = true; grew;) {
    grew = false
    pl.lanes.forEach((l, i) => {
      if (seen.has(i)) return
      if ([...seen].some(j => l.pts.some(([x, z]) => segDist(pl.lanes[j].pts, x, z) < 5))) { seen.add(i); grew = true }
    })
  }
  loose += pl.lanes.length - seen.size
}
ok(loose === 0, `lanes not joined to the high street: ${loose}`)

// ── deterministic: the same map plans the same towns
const again = planTowns(R)
ok(JSON.stringify(again.map(p => p.buildings.length)) === JSON.stringify(plans.map(p => p.buildings.length)), 'planning is deterministic')

console.log(`towns: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
