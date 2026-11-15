// Town plans on the real continent: nothing on a road, in water or through a neighbour; plinths reach the ground;
// the core is denser than the edge; the towns are towns (counts pinned as literals, so tuning one constant cannot
// quietly pass a test that reads it). npx tsx src/app/shimmer/open/towns/plan.test.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { makeRegion, nearestRoad, nearPad, type RegionMeta } from '../region'
import { planTowns, townDiscs, type Building } from './plan'
import { inStation, stationToWorld } from './rune-hold-core'

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
    // an authored (core) building's floor is its FRONT's ground and a higher back is buried in the hill: only its
    // lowest corner must be covered by the plinth
    if (y < b.y0 - 0.01 || (!b.core && y > b.y1 + 0.01)) floating++
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
// ── Rune Hold's core is Alex's play3d layout: all 9 houses of the grid + the Station, every storefront present
const rh = byId.get('rune-hold')!
const fronts = new Set(rh.buildings.map(b => b.front).filter(Boolean))
for (const f of ['kindled-mug', 'forgelight-inn', 'bookstore', 'smithy', 'spirit-corner', 'station']) ok(fronts.has(f), `Rune Hold's core has ${f}`)
ok(rh.buildings.filter(b => b.core).length === 10, `Rune Hold's core places all 10 grid buildings: ${rh.buildings.filter(b => b.core).length}`)
ok((rh.paving?.pts.length ?? 0) > 900, `Rune Hold's grid paving is laid: ${rh.paving?.pts.length ?? 0} cells`)
// no generated building stands on the core's paving
let onPaving = 0
for (const b of rh.buildings) if (!b.core || (b as { moved?: boolean }).moved) for (const [x, z] of corners(b)) if (rh.paving!.pts.some(([px, pz]) => Math.abs(px - x) < 0.8 && Math.abs(pz - z) < 0.8)) onPaving++
ok(onPaving === 0, `generated (or moved) buildings on Rune Hold's paving: ${onPaving}`)
// ── the Travelers Station's field: placed, on clear dry ground, nothing generated inside it, reachable from the town
const site = rh.station
ok(!!site, "Rune Hold's Station field is placed")
if (site) {
  let wetOrRoad = 0
  for (let gz = 0; gz <= 50; gz += 5) for (let gx = 0; gx <= 80; gx += 5) {
    const [x, z] = stationToWorld(site, gx, gz), nr = nearestRoad(R, x, z)
    if (R.heightAt(x, z) < 1.5 || (nr.road && nr.d < nr.road.width / 2) || nearPad(R, x, z, 0)) wetOrRoad++
  }
  ok(wetOrRoad === 0, `Station field over water or a road: ${wetOrRoad} samples`)
  ok(site.level - site.base < 25, `Station terrace is ${(site.level - site.base).toFixed(1)} m (want < 25)`)
  let inside = 0
  for (const pl of plans) for (const b of pl.buildings) if (!b.core && corners(b).some(([x, z]) => inStation(site, x, z, 0))) inside++
  ok(inside === 0, `buildings inside the Station field: ${inside}`)
  ok((rh.walks?.[0]?.pts.length ?? 0) > 2, 'a paved walk runs from the Station building to the terminal')
}
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

// ── names (Magii + Alex 11-15, world/locations.md): the 1672 villages carry their names, and every named town a road
// enters has a name board, at the roadside (off the carriageway, on land)
const nameOf = (id: string) => meta.places.find(q => q.id === id)?.name
ok(nameOf('unnamed-village-17') === 'Copperlee' && nameOf('unnamed-village-0') === 'Kettlemoor' && nameOf('unnamed-school-30') === 'Redstair', 'the 1672 names are in the map data')
let boards = 0, badBoard = 0
for (const pl of plans) for (const b of pl.boards ?? []) {
  boards++
  const nr = nearestRoad(R, b.x, b.z)
  if (b.y < 1.5 || (nr.road && nr.d < nr.road.width / 2 + 0.5)) badBoard++
}
ok(boards >= 30, `name boards on the roads into town: ${boards} (want >= 30)`)
ok(badBoard === 0, `name boards on the road or in water: ${badBoard}`)

// ── Citadel (geography.md › THE TOWNS IN 1672): the Grand Exchange stands on the square, the heritage wall rings the
// old city, and no building stands in the wall's band (streets pass through its gaps; buildings never straddle it)
const cit = byId.get('citadel')!
const exch = cit.buildings.find(b => b.front === 'grand-exchange')
const csq = meta.network!.junctions.find(j => j.kind === 'square' && j.place === 'citadel')!
ok(!!exch && Math.hypot(exch.x - csq.x, exch.z - csq.z) < csq.r + 30, 'the Grand Exchange stands on the Citadel square')
ok(!!cit.wall && cit.wall.r > 100, `Citadel's heritage wall rings the old city (r ${cit.wall?.r})`)
let straddle = 0
if (cit.wall) for (const b of cit.buildings) for (const [x, z] of corners(b)) if (Math.abs(Math.hypot(x - cit.wall.x, z - cit.wall.z) - cit.wall.r) < 3) straddle++
ok(straddle === 0, `buildings in the heritage wall's band: ${straddle}`)
ok(cit.buildings.some(b => cit.wall && Math.hypot(b.x - cit.wall.x, b.z - cit.wall.z) > cit.wall.r + 10), 'the city has grown past its wall')

// ── Gale Haven (geography.md › THE TOWNS IN 1672): the Low Docks run out into the water, the Sky Port is a forest of
// mooring towers on the high ground, and no house stands on the port's ground
const gh = byId.get('gale-haven')!, port = gh.port
ok(!!port && port.piers.length >= 3, `Gale Haven has piers: ${port?.piers.length}`)
ok(!!port && port.piers.every(pr => R.heightAt(pr.x + Math.cos(pr.yaw) * pr.len, pr.z + Math.sin(pr.yaw) * pr.len) < 1.5), 'every pier ends in the water')
ok(!!port && port.towers.length >= 8, `the Sky Port's mooring-tower forest: ${port?.towers.length} towers`)
const ghY = (q: { y: number }) => q.y
const houseMid = gh.buildings.map(b => b.y1).sort((a, b) => a - b)[Math.floor(gh.buildings.length / 2)]
ok(!!port && port.towers.every(t => ghY(t) > houseMid), 'the towers stand above the town (the highest tier)')
let inPortGround = 0
if (port) for (const b of gh.buildings) for (const [x, z] of corners(b)) if (port.keepOut.some(k => Math.hypot(k.x - x, k.z - z) < k.r - 0.5)) inPortGround++
ok(inPortGround === 0, `houses on the port's ground: ${inPortGround}`)

// ── deterministic: the same map plans the same towns
const again = planTowns(R)
ok(JSON.stringify(again.map(p => p.buildings.length)) === JSON.stringify(plans.map(p => p.buildings.length)), 'planning is deterministic')

console.log(`towns: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
process.exit(fails.length ? 1 : 0)
