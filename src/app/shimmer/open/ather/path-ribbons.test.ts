// path-ribbons.ts (BETA M58 (2), Ather side). Run: npx tsx src/app/shimmer/open/ather/path-ribbons.test.ts
import { tilePathLines, pathRibbonsXZ, split4, tilePathRibbons, PATH_RIM, PATH_STEP, PATH_LIFT } from './path-ribbons'
import { pathsIn, PATH_HALF, type Network } from './network'
import { coveredBy, triArea, ribbonXZ } from '../shared/road-ribbon'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// A small network, two tiles side by side (seam at x = 0, each 100 m square):
//  A runs east-west across the seam, its samples landing 0.7 m short of the seam and 1.3 m past it (the old gap);
//  B crosses A at x = -40; C ends ON A at x = 30 (a T: a side path into a through path); D turns 90° at (-60, 30).
const A: [number, number][] = [[-100.7, 0], [99.3, 0]]
const B: [number, number][] = [[-40, -40], [-40, 40]]
const C: [number, number][] = [[30, 45], [30, 0]]
const D: [number, number][] = [[-90, 30], [-60, 30], [-60, 45]]
const net = { paths: [A, B, C, D].map(pts => ({ pts })), settlements: [] } as unknown as Network
const HX = 50, HZ = 50, LEFT = { x: -50, z: 0 }, RIGHT = { x: 50, z: 0 }
const surfOf = (off: { x: number; z: number }) => pathRibbonsXZ(tilePathLines(net, off.x, off.z, HX, HZ)).surf   // world coords
const SL = surfOf(LEFT), SR = surfOf(RIGHT)
const both = (x: number, z: number) => coveredBy(SL, x, z) || coveredBy(SR, x, z)
const SW = PATH_HALF - PATH_RIM - 0.02   // inside the surface, off its exact boundary

/** The first point within SW of the centre line along [a, b] that no surface covers. */
function gap(a: [number, number], b: [number, number], cover: (x: number, z: number) => boolean, step = 0.1): string | null {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / L, tz = (b[1] - a[1]) / L
  for (let s = 0; s <= L + 1e-9; s += step) for (let w = -SW; w <= SW + 1e-9; w += SW / 4) {
    const x = a[0] + tx * s - tz * w, z = a[1] + tz * s + tx * w
    if (!cover(x, z)) return `(${x.toFixed(2)}, ${z.toFixed(2)})`
  }
  return null
}

// 1. THE SEAM: path A is unbroken across x = 0, every point of its surface drawn by one tile or the other
ok(gap([-4, 0], [4, 0], both) === null, `seam: A has a gap at ${gap([-4, 0], [4, 0], both)}`)
// ...and the defect was real: clipped at the tile square itself (the old TilePaths), nothing covers x in (-0.7, 1.3)
{
  const old = (off: { x: number; z: number }) => pathsIn(net, off.x - HX, off.z - HZ, off.x + HX, off.z + HZ, PATH_STEP).flatMap(L => ribbonXZ(L, PATH_HALF - PATH_RIM, false))   // the old strip: no caps
  const OL = old(LEFT), OR = old(RIGHT)
  ok(!coveredBy(OL, 0.3, 0) && !coveredBy(OR, 0.3, 0), 'seam: the old clipping really left a gap at x = 0.3 (else this test proves nothing)')
}
// each tile reaches at most a step and a bit past its own square (overlap, not a second copy of the world)
ok(tilePathLines(net, LEFT.x, LEFT.z, HX, HZ).every(L => L.every(([x]) => x <= PATH_STEP + 0.02)), 'seam: the left tile reaches at most one step past the seam')

// 2. THE CROSSING (A x B at x = -40): the whole crossing square is surface, so neither path's rim shows across the other
ok(gap([-40, -6], [-40, 6], both) === null && gap([-46, 0], [-34, 0], both) === null, 'cross: surface unbroken through the crossing')
{ // every point of the crossing within the surface width of EITHER centre line is surface
  let bad: string | null = null
  for (let x = -40 - SW; x <= -40 + SW && !bad; x += 0.1) for (let z = -SW; z <= SW && !bad; z += 0.1) if (!both(x, z)) bad = `(${x.toFixed(2)}, ${z.toFixed(2)})`
  ok(bad === null, `cross: rim shows inside the crossing at ${bad}`)
}

// 3. THE T (C ends on A at x = 30): C's surface reaches A's centre line and paints over A's rim across the mouth
ok(gap([30, 8], [30, 0], both) === null, 'T: the side path runs unbroken into the through path')
ok(both(30, PATH_HALF - 0.05) && both(30 - SW, PATH_HALF - 0.1) && both(30 + SW, PATH_HALF - 0.1), "T: A's rim is covered across C's mouth")

// 4. THE SHARP TURN (D, 90° at (-60, 30)): no pinch, no notch, the inside and the outside of the corner both covered
ok(gap([-70, 30], [-60, 30], both) === null && gap([-60, 30], [-60, 40], both) === null, 'turn: legs unbroken')
{
  let bad: string | null = null
  for (let a = 0; a < 2 * Math.PI && !bad; a += Math.PI / 24) for (const f of [0.3, 0.7, 0.98]) { const x = -60 + Math.cos(a) * SW * f, z = 30 + Math.sin(a) * SW * f; if (!both(x, z)) { bad = `a=${a.toFixed(2)} f=${f}`; break } }
  ok(bad === null, `turn: the corner has a notch at ${bad}`)
}

// 5. THE RIM: the edge pass covers every surface point (so the rim is only ever OUTSIDE the surface, never a stripe inside)
{
  const { edge, surf } = pathRibbonsXZ(tilePathLines(net, LEFT.x, LEFT.z, HX, HZ))
  let bad = 0
  for (let i = 0; i < surf.length; i += 2) if (!coveredBy(edge, surf[i] + Math.sign(-40 - surf[i]) * 1e-3, surf[i + 1] + Math.sign(-surf[i + 1]) * 1e-3)) bad++
  ok(bad === 0, `rim: ${bad} surface vertices outside the edge pass`)
  ok(edge.length > surf.length * 0.99 && edge.length < surf.length * 1.01, 'rim: one edge ribbon per surface ribbon')
  ok(!coveredBy(edge, -20, PATH_HALF + 0.05) && coveredBy(edge, -20, PATH_HALF - 0.05) && !coveredBy(surf, -20, PATH_HALF - 0.05), 'rim: the rim is the outer PATH_RIM of the sculpted width')
}

// 6. SPLIT + DRAPE: split4 keeps area and orientation, multiplies by 4; the draped mesh rides the ground at PATH_LIFT
{
  const t = SL.slice(0, 600), s = split4(t)
  let a0 = 0, a1 = 0, neg = 0
  for (let i = 0; i < t.length; i += 6) a0 += triArea(t, i)
  for (let i = 0; i < s.length; i += 6) { const a = triArea(s, i); a1 += a; if (a < -1e-9 && triArea(t, Math.floor(i / 24) * 6) > 0) neg++ }
  ok(s.length === t.length * 4 && Math.abs(a0 - a1) < 1e-6 && neg === 0, `split4: x4 tris, same area (${a0.toFixed(3)} vs ${a1.toFixed(3)}), no flips (${neg})`)
  const hill = (x: number, z: number) => Math.sin(x * 0.3) * 2 + z * 0.05
  const r = tilePathRibbons(net, LEFT, HX, HZ, hill)!
  let off = 0
  for (const arr of [r.edge, r.surf]) for (let i = 0; i < arr.length; i += 3) if (Math.abs(arr[i + 1] - hill(arr[i], arr[i + 2]) - PATH_LIFT) > 1e-6 || !Number.isFinite(arr[i + 1])) off++
  ok(r.surf.length === SL.length / 2 * 3 * 4 && off === 0, `drape: every vertex on the ground + lift (${off} off), tile-local`)
  ok(tilePathRibbons(net, { x: 500, z: 500 }, HX, HZ, hill) === null, 'drape: a tile with no path builds nothing')
}

console.log(`path-ribbons: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
