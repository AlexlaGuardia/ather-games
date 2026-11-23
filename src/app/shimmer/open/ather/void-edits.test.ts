// Run: npx tsx src/app/shimmer/open/ather/void-edits.test.ts
// BETA M104: the void brush layer (void-edits.ts) applied over the generated voids (makeVoids), the builder layer carrying it, and
// the publish guard (world/void-guard.ts): on the REAL tile index + season-1 network.
import { readFileSync } from 'node:fs'
import { makeVoids, FALL_W, VOID_HALF, SQ, type IndexLike } from './wilds-voids'
import { cleanVoids, paintVoids, voidOverrides, sealedMessage, VCELL, type VoidEdits } from './void-edits'
import { withGlade, type Network } from './network'
import { voidGuard } from '../../world/void-guard'
import { cleanLayer, sameLayer, layerSize } from '../../world/builder'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const index = JSON.parse(readFileSync('public/open/wilds/tiles.json', 'utf8')) as IndexLike
const net = withGlade(JSON.parse(readFileSync('public/open/wilds/network-s1.json', 'utf8')) as Network)
const V0 = makeVoids(index, net)

// 1. the layer's cleaner + the brush's cells
{
  const c = cleanVoids({ voids: { '1_2': 1, '-3_4': -1, 'x_1': 1, '5_6': 2, '7_8': '1', '9_-10': -1 } })
  ok(JSON.stringify(c) === JSON.stringify({ '1_2': 1, '-3_4': -1, '9_-10': -1 }), `cleanVoids drops junk (${JSON.stringify(c)})`)
  ok(Object.keys(cleanVoids(null)).length === 0 && Object.keys(cleanVoids({ voids: [1] })).length === 0, 'cleanVoids: null / array = empty')
  const d = paintVoids(undefined, 100, 100, 20, -1), ks = Object.keys(d)
  ok(ks.length > 10 && ks.every(k => d[k] === -1), `paintVoids erase sets ${ks.length} cells to -1`)
  ok(ks.every(k => { const [i, j] = k.split('_').map(Number); return Math.hypot((i + 0.5) * VCELL - 100, (j + 0.5) * VCELL - 100) <= 20 }), 'every cell centre within the radius')
  ok(Object.keys(paintVoids(d, 100, 100, 20, -1)).length === 0, 'repainting the same mode changes nothing (no-op stroke)')
  ok(Object.keys(paintVoids(d, 100, 100, 20, 1)).length === ks.length, 'paint over erase flips every cell')
  ok(voidOverrides({}) === null && voidOverrides(null) === null, 'no cells = no overrides')
}

// 2. no edits = the generated field exactly; an empty map too
{
  const Ve = makeVoids(index, net, [], {})
  let diff = 0
  for (let z = -3000; z <= 3000; z += 37) for (let x = -3000; x <= 3000; x += 41) if (Ve.weight(x, z) !== V0.weight(x, z)) diff++
  ok(diff === 0, `empty void layer = generated field (${diff} differ)`)
  ok(Ve.crossings.length === V0.crossings.length, 'same crossings')
}

// find a generated void point: weight 1, far from any crossing and from protected ground
let P: { x: number; z: number } | null = null
for (let z = -3000; z <= 3000 && !P; z += 10) for (let x = -3000; x <= 3000 && !P; x += 10) {
  if (V0.weight(x, z) >= 1 && !V0.crossingNear(x, z, 120) && V0.weight(x + 60, z) >= 0 && V0.weight(x, z + 60) >= 0) P = { x, z }
}
ok(!!P, 'found a generated void point')

// 3. ERASE: the crust holds there (weight 0, not void), the edge rolls back, far ground is unchanged; it never seals
if (P) {
  const ov = paintVoids(undefined, P.x, P.z, 32, -1), V = makeVoids(index, net, [], ov)
  ok(V.weight(P.x, P.z) === 0 && !V.isVoid(P.x, P.z), `erased: weight ${V.weight(P.x, P.z)} at the void point`)
  let walk = true
  for (let d = -VOID_HALF - 4; d <= VOID_HALF + 4; d += 2) { if (V.weight(P.x + d, P.z) >= 0.12 || V.weight(P.x, P.z + d) >= 0.12) walk = false }
  ok(walk, 'erased: a line straight across the strip never reaches the lip (FALL_LIP)')
  let far = 0
  for (let a = 0; a < 360; a += 15) { const x = P.x + Math.cos(a) * 400, z = P.z + Math.sin(a) * 400; if (V.weight(x, z) !== V0.weight(x, z)) far++ }
  ok(far === 0, `erase changes nothing 400 m away (${far} differ)`)
  ok(voidGuard(index, net, ov) === '', 'guard: an erase never seals')
  // the builder layer carries it
  const L = cleanLayer({ v: 1, tiles: {}, water: {}, falls: {}, voids: ov })
  ok(L.voids !== undefined && Object.keys(L.voids).length === Object.keys(ov).length, 'cleanLayer keeps voids')
  ok(!('voids' in cleanLayer({ v: 1, tiles: {}, water: {}, falls: {} })) && !('voids' in cleanLayer({ voids: {} })), 'no void cells = no voids key (pre-M104 files unchanged)')
  ok(!sameLayer(L, cleanLayer({})) && sameLayer(L, cleanLayer(JSON.parse(JSON.stringify(L)))), 'sameLayer sees void edits')
  ok(layerSize(L).voids === Object.keys(ov).length && layerSize(cleanLayer({})).voids === undefined, 'layerSize counts void cells')
}

// 4. PAINT: void on free ground; never on protected ground (a settlement's disc, a path's corridor)
{
  let Q: { x: number; z: number } | null = null
  for (let z = -2000; z <= 2000 && !Q; z += 20) for (let x = -2000; x <= 2000 && !Q; x += 20) if (V0.weight(x, z) === 0 && !V0.protectedAt(x, z) && V0.regionAt(x, z) >= 0) Q = { x, z }
  ok(!!Q, 'found free ground')
  if (Q) {
    const V = makeVoids(index, net, [], paintVoids(undefined, Q.x, Q.z, 20, 1))
    ok(V.isVoid(Q.x, Q.z) && V.weight(Q.x, Q.z) === 1, `painted: void at free ground (weight ${V.weight(Q.x, Q.z)})`)
    ok(V.weight(Q.x + 200, Q.z + 200) === V0.weight(Q.x + 200, Q.z + 200), 'paint is local')
  }
  const s = net.settlements[0], Vs = makeVoids(index, net, [], paintVoids(undefined, s.x, s.z, 24, 1))
  ok(Vs.weight(s.x, s.z) === 0, `paint on a settlement does nothing (weight ${Vs.weight(s.x, s.z)})`)
  const p = net.paths[0].pts[Math.floor(net.paths[0].pts.length / 2)], Vp = makeVoids(index, net, [], paintVoids(undefined, p[0], p[1], 24, 1))
  ok(Vp.weight(p[0], p[1]) === 0, 'paint on a path does nothing (a path is never cut)')
}

// 5. painting over a neck: it is no crossing any more (never a respawn point inside a void), and if it was the only way into a
//    region, the guard refuses and names the zone
{
  const necks = V0.crossings.filter(c => c.kind === 'neck')
  const ways = new Map<number, number>(); for (const c of V0.crossings) for (const r of [c.a, c.b]) ways.set(r, (ways.get(r) ?? 0) + 1)
  const cand = necks.filter(c => ways.get(c.a) === 1 || ways.get(c.b) === 1).slice(0, 12)
  let refused = '', zone = '', tried = 0
  for (const c of cand) {
    tried++
    const ov = paintVoids(undefined, c.x, c.z, 28, 1), V = makeVoids(index, net, [], ov)
    if (tried === 1) {
      ok(V.isVoid(c.x, c.z), 'painted neck is void')
      ok(!V.crossings.includes(c) && V.crossings.length === V0.crossings.length - 1, 'a painted-over neck leaves the crossing list')
      ok(V.crossingNear(c.x, c.z, 7) === null, 'crossingNear skips it')
    }
    const why = voidGuard(index, net, ov)
    if (why) { refused = why; zone = V0.regions[ways.get(c.a) === 1 ? c.a : c.b].zone; break }
  }
  ok(!!refused, `guard refuses a paint that seals a region (${tried} tried)`)
  ok(refused.startsWith('Publish refused') && refused.includes(zone), `the refusal names the zone (${zone}): ${refused}`)
  console.log(refused)
}
ok(sealedMessage([]) === '' && sealedMessage([{ zone: 'fen', squares: 2 }, { zone: 'fen', squares: 1 }]).includes('fen (3 squares)'), 'sealedMessage folds a zone')
ok(SQ === 200, 'grid square')

console.log(`${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('FAIL', f); process.exit(1) }
