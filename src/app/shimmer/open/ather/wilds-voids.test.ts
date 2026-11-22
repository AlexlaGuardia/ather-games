// Run: npx tsx src/app/shimmer/open/ather/wilds-voids.test.ts
// M41 s1+2: the cloud voids between the Wilds' zones. On the REAL tile index + season-1 network: every region is reachable from
// Moonwell ON FOOT (a raster walk where a void cell is a wall), only through crossings; nothing the relief protects is touched;
// the same answer twice.
import { readFileSync } from 'node:fs'
import { makeVoids, VOID_HALF, FALL_W, SQ, type IndexLike } from './wilds-voids'
import { withGlade, SETTLEMENT_CLEAR, PATH_HALF, type Network } from './network'
import { GLADE, WILDS_FRONT_SHIFT, wildsFrontDist } from './relief'
import { GREG_WAYMARK } from './waymarks'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const V = makeVoids(index, net), V2 = makeVoids(index, net)

// 1. there are regions and voids, one neck per touching pair, and every crossing sits on a border
ok(V.regions.length > 6, `regions ${V.regions.length}`)
const necks = V.crossings.filter(c => c.kind === 'neck'), paths = V.crossings.filter(c => c.kind === 'path')
ok(necks.length >= V.regions.length - 1, `a neck per touching pair (${necks.length} necks for ${V.regions.length} regions)`)
const pairs = new Set(necks.map(c => `${c.a}-${c.b}`)); ok(pairs.size === necks.length, 'one neck per region pair')

let graphSeen = new Set<number>()
// 2. the graph over the region adjacency: reachable from Moonwell's region through crossings only
{
  const start = V.regionAt(GLADE.gx, GLADE.gz); ok(start >= 0, 'Moonwell is on the grid')
  const adj = new Map<number, Set<number>>(); for (const r of V.regions) adj.set(r.id, new Set())
  for (const c of V.crossings) { adj.get(c.a)!.add(c.b); adj.get(c.b)!.add(c.a) }
  // a corner touch with sea on both other sides has no border, so no void and no crossing: it joins the graph as it joins the land
  const has = new Set<string>(); for (const t of index.tiles) for (const nd of t.nodes) has.add(`${t.tx * 5 + nd.i - 2},${t.ty * 5 + nd.j - 2}`)
  for (const k of has) { const [X, Z] = k.split(',').map(Number)
    for (const dz of [-1, 1]) if (has.has(`${X + 1},${Z + dz}`) && !has.has(`${X + 1},${Z}`) && !has.has(`${X},${Z + dz}`)) {
      const a = V.regionAt(X * SQ, Z * SQ), b = V.regionAt((X + 1) * SQ, (Z + dz) * SQ); if (a !== b) { adj.get(a)!.add(b); adj.get(b)!.add(a) } } }
  const seen = new Set([start]), q = [start]
  while (q.length) for (const n of adj.get(q.pop()!)!) if (!seen.has(n)) { seen.add(n); q.push(n) }
  graphSeen = seen
}

// 3. ON FOOT: a raster walk over the whole grid, void cells are walls; every region must be reached
{
  const step = 8, ox = -5200, oz = -5200, n = Math.ceil(10400 / step)
  const si = Math.round((GLADE.gx - ox) / step), sj = Math.round((GLADE.gz - oz) / step)
  // the baseline: the same walk with NO voids. Some regions are sea-bound islands today (a lone square, a corner touch):
  // the voids must seal nothing the keeper could reach before
  const walk = (wallFn: (x: number, z: number) => boolean) => {
    const seen = new Uint8Array(n * n), st = [si + sj * n], R = new Set<number>(); seen[st[0]] = 1
    while (st.length) {
      const k = st.pop()!, i = k % n, j = (k - i) / n; R.add(V.regionAt(ox + i * step, oz + j * step))
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n || seen[a + b * n]) continue
        const x = ox + a * step, z = oz + b * step; if (V.regionAt(x, z) < 0 || wallFn(x, z)) continue
        seen[a + b * n] = 1; st.push(a + b * n)
      }
    }
    return R
  }
  const base = walk(() => false), withV = walk((x, z) => V.weight(x, z) >= FALL_W)
  const sealed = [...base].filter(r => !withV.has(r))
  ok(base.size > 50, `baseline walk reaches ${base.size} regions with no voids`)
  ok([...base].every(r => graphSeen.has(r)), `graph over the zone grid: every region the keeper can reach today is reachable through crossings (graph ${graphSeen.size} of ${V.regions.length}; the rest are sea-bound islands)`)
  ok(sealed.length === 0, `on foot: the voids seal nothing (base ${base.size}, with voids ${withV.size}, sealed ${sealed.map(r => V.regions[r].zone + '#' + r).join(' ')})`)

  // ...and ONLY through crossings: wall off every crossing's neck AND every protected patch (a settlement or path straddling a
  // border is a way across too, and is listed as the ground it is): the walk then never leaves Moonwell's own region
  const wall = (x: number, z: number) => V.weight(x, z) >= FALL_W || V.crossings.some(c => Math.hypot(c.x - x, c.z - z) < 24) || (V.weight(x, z) < FALL_W && V.protectedAt(x, z))
  const w2 = walk(wall)
  ok(w2.size === 1, `with every crossing + protected patch walled off the walk stays in its own region (reached ${w2.size}: ${[...w2].map(r => V.regions[r].zone + '#' + r).join(' ')})`)
}

// 4. nothing relief protects is void: the Glade, settlement discs + the fair, Greg's waymark, a corridor round every path
{
  let bad = 0
  // M67 s1b-2: the Glade left the Wilds; its OLD footprint there (wildsFrontDist) stays void-free, so no void moved
  const ox = GLADE.gx - WILDS_FRONT_SHIFT.x, oz = GLADE.gz - WILDS_FRONT_SHIFT.z
  for (let z = oz - 80; z <= oz + 80; z += 2) for (let x = ox - 80; x <= ox + 80; x += 2) if (wildsFrontDist(x, z) <= 8 && V.weight(x, z) > 0) bad++
  ok(bad === 0, `no void weight over the Glade's old Wilds footprint (${bad} bad)`)
  bad = 0
  for (const s of net.settlements) for (let a = 0; a < 360; a += 10) for (let r = 0; r <= SETTLEMENT_CLEAR; r += 4) if (V.weight(s.x + Math.cos(a * Math.PI / 180) * r, s.z + Math.sin(a * Math.PI / 180) * r) > 0) bad++
  ok(bad === 0, `no void weight on a settlement's disc (${bad} bad)`)
  bad = 0
  for (const [x, z] of [[GREG_WAYMARK.x, GREG_WAYMARK.z]]) for (let a = 0; a < 360; a += 10) for (let r = 0; r <= 14; r += 2) if (V.weight(x + Math.cos(a * Math.PI / 180) * r, z + Math.sin(a * Math.PI / 180) * r) > 0) bad++
  ok(bad === 0, `no void weight on Greg's waymark (${bad} bad)`)
  if (net.fair) { bad = 0; for (let a = 0; a < 360; a += 10) for (let r = 0; r <= 34; r += 4) if (V.weight(net.fair.x + Math.cos(a * Math.PI / 180) * r, net.fair.z + Math.sin(a * Math.PI / 180) * r) > 0) bad++; ok(bad === 0, `no void weight at the fair (${bad})`) }
  bad = 0; let samples = 0
  for (const p of net.paths) for (let k = 1; k < p.pts.length; k++) {
    const [ax, az] = p.pts[k - 1], [bx, bz] = p.pts[k], m = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4))
    for (let s = 0; s <= m; s++) { const x = ax + ((bx - ax) * s) / m, z = az + ((bz - az) * s) / m; samples++
      const nx = -(bz - az), nz = bx - ax, L = Math.hypot(nx, nz) || 1
      for (const o of [-PATH_HALF - 1, 0, PATH_HALF + 1]) if (V.weight(x + (nx / L) * o, z + (nz / L) * o) > 0) bad++ }
  }
  ok(bad === 0, `no void weight on any path's corridor (${bad} bad of ${samples * 3} samples)`)
}

// 5. voids exist and are really void: border midpoints away from a crossing are standing-impossible, and a crossing's own is not
{
  let void_ = 0, tot = 0
  const neckAt = (x: number, z: number) => V.crossings.some(c => Math.hypot(c.x - x, c.z - z) < 40)
  for (let z = -5200; z < 5200; z += SQ / 2) for (let x = -5200; x < 5200; x += SQ) {
    // a vertical-border midpoint: x on a wall line, z mid-square
    const wx = Math.round(x / SQ - 0.5) * SQ + SQ / 2, wz = Math.round(z / SQ) * SQ
    const a = V.regionAt(wx - 20, wz), b = V.regionAt(wx + 20, wz)
    if (a < 0 || b < 0 || a === b || neckAt(wx, wz)) continue
    if (V.protectedAt(wx, wz)) continue   // protected ground (a path, a settlement): a listed gap, not a void
    tot++; if (V.isVoid(wx, wz)) void_++
  }
  ok(tot > 50 && void_ === tot, `every unprotected border midpoint is void (${void_}/${tot})`)
  for (const c of V.crossings.filter(c => c.kind === 'neck')) ok(!V.isVoid(c.x, c.z), `neck ${c.a}-${c.b} is standable`)
  ok(VOID_HALF > 0, 'void width is positive')
}

// 6. determinism: a second build answers the same everywhere
{
  let same = true
  for (let k = 0; k < 4000 && same; k++) { const x = ((k * 7919) % 9000) - 4500, z = ((k * 104729) % 9000) - 4500; if (V.weight(x, z) !== V2.weight(x, z)) same = false }
  ok(same && V.crossings.length === V2.crossings.length && V.crossings.every((c, i) => c.x === V2.crossings[i].x && c.z === V2.crossings[i].z), 'deterministic')
  console.log(`regions ${V.regions.length} · necks ${necks.length} · path crossings ${paths.length}`)
}

console.log(`${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
