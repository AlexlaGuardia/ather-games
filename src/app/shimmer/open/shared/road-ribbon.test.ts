// road-ribbon.ts. Run: npx tsx src/app/shimmer/open/shared/road-ribbon.test.ts
import { ribbonXZ, discXZ, drape, coveredBy, triArea, ribbonsOn, atherRibbonsOn, MITRE_MAX_TURN, DISC_SEG, type P2 } from './road-ribbon'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** Every point within (hw - eps) of the polyline is covered: sample across the width at fine steps along it AND around
 *  every vertex (where joins live). eps keeps us off the exact boundary. */
function gapAt(tris: number[], pts: P2[], hw: number, ends = true): string | null {
  const eps = 0.02, r = hw - eps
  for (let k = 0; k < pts.length - 1; k++) {
    const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L
    for (let s = 0; s <= L; s += 0.1) for (let w = -r; w <= r + 1e-9; w += r / 6) {
      const x = ax + tx * s - tz * w, z = az + tz * s + tx * w
      if (!coveredBy(tris, x, z)) return `seg ${k} s=${s.toFixed(2)} w=${w.toFixed(2)}`
    }
  }
  for (const [vx, vz] of ends ? pts : pts.slice(1, -1)) for (let a = 0; a < 2 * Math.PI; a += Math.PI / 36) for (const f of [0.3, 0.7, 0.98]) {
    const x = vx + Math.cos(a) * r * f, z = vz + Math.sin(a) * r * f
    if (!coveredBy(tris, x, z)) return `vertex (${vx},${vz}) a=${a.toFixed(2)} f=${f}`
  }
  return null
}

// 1. a straight road: two triangles a segment plus two cap discs; covered edge to edge, nothing past it
{
  const pts: P2[] = [[0, 0], [10, 0]], t = ribbonXZ(pts, 2)
  ok(t.length / 6 === 2 + 2 * DISC_SEG, `straight: 2 quad tris + 2 caps (${t.length / 6})`)
  ok(gapAt(t, pts, 2) === null, 'straight: no gap')
  ok(!coveredBy(t, 5, 2.3) && !coveredBy(t, 5, -2.3), 'straight: nothing drawn past the edge')
  ok(ribbonXZ(pts, 2, false).length / 6 === 2, 'no caps: just the strip')
}
// 2. a gentle curve (every turn ≤ MITRE_MAX_TURN, segments longer than the width): mitred, no gaps, no folds
{
  const curve: P2[] = Array.from({ length: 14 }, (_, k) => [k * 3, Math.sin(k * 0.35) * 2.5] as P2)
  const t = ribbonXZ(curve, 1.5, false)
  ok(gapAt(t, curve, 1.5, false) === null, `gentle curve: no gap along any segment or at any interior join (${gapAt(t, curve, 1.5, false)})`)
  // folds: every strip triangle keeps the same winding (a fold flips one)
  const signs = new Set<number>(); for (let i = 0; i < t.length; i += 6) signs.add(Math.sign(triArea(t, i)))
  ok(signs.size === 1, `gentle curve: no folded quad (${[...signs]})`)
  ok(t.length / 6 === 2 * (curve.length - 1), 'gentle curve: all mitres, no join discs')
  ok(gapAt(ribbonXZ(curve, 1.5, true), curve, 1.5) === null, 'gentle curve with caps: no gap anywhere, joins included')
}
// 3. sharp turns: an L (90°) and a hairpin (~170°): the join disc fills the outside wedge
for (const [name, pts] of [['L', [[0, 0], [10, 0], [10, 10]]], ['hairpin', [[0, 0], [10, 0], [0, 1.5]]]] as [string, P2[]][]) {
  const t = ribbonXZ(pts, 2)
  ok(gapAt(t, pts, 2) === null, `${name}: no gap at the sharp join (${gapAt(t, pts, 2)})`)
}
// 4. JUNCTIONS: arms run to the shared node, so the end caps fill the corners between them
{
  const T: P2[][] = [[[-12, 0], [12, 0]], [[0, 0], [0, 12]]]
  const tris = T.flatMap(a => ribbonXZ(a, 2.5))
  ok(T.every(a => gapAt(tris, a, 2.5) === null), 'T junction: every arm covered')
  // the corners where the side road meets the main one (just inside both edges) are filled
  ok([[2.4, 2.4], [-2.4, 2.4], [2.2, 2.6], [-2.6, 2.2]].every(([x, z]) => coveredBy(tris, x, z)), 'T junction: both inside corners filled')
  const plus: P2[][] = [[[-12, 0], [12, 0]], [[0, -12], [0, 12]]]
  const pt = plus.flatMap(a => ribbonXZ(a, 2.5))
  ok([[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]].every(([x, z]) => coveredBy(pt, x, z)), '+ junction: all four corners filled')
  // a Y: three arms at odd angles meeting at a node
  const Y: P2[][] = [[[0, 0], [10, 0]], [[0, 0], [-6, 8]], [[0, 0], [-6, -8]]]
  const yt = Y.flatMap(a => ribbonXZ(a, 2))
  ok(Y.every(a => gapAt(yt, a, 2) === null), 'Y junction: every arm covered to the node')
}
// 5. MUTATION: the instrument can fail. Without the join disc an L has a hole on the outside of the corner.
{
  const pts: P2[] = [[0, 0], [10, 0], [10, 10]], t = ribbonXZ(pts, 2, false)
  const noDisc = t.slice(DISC_SEG * 6)   // the join disc is emitted first, before the strip
  ok(gapAt(noDisc, pts, 2) !== null, 'mutation: dropping the sharp-join disc opens a gap the test sees')
  const inscribed: number[] = []
  for (let i = 0; i < DISC_SEG; i++) { const a0 = 2 * Math.PI * i / DISC_SEG, a1 = 2 * Math.PI * (i + 1) / DISC_SEG; inscribed.push(0, 0, Math.cos(a1) * 2, Math.sin(a1) * 2, Math.cos(a0) * 2, Math.sin(a0) * 2) }
  const half = (Math.PI / DISC_SEG), x = Math.cos(half) * 1.985, z = Math.sin(half) * 1.985
  ok(coveredBy(discXZ(0, 0, 2), x, z) && !coveredBy(inscribed, x, z), 'mutation: an inscribed disc misses the rim sliver; the circumscribed one covers it')
}
// 6. drape: heights on, and a vertex off the ground drops its whole triangle
{
  const t = ribbonXZ([[0, 0], [10, 0]], 1, false)
  const flat = drape(t, () => 5)
  ok(flat.length === t.length / 2 * 3 && flat.filter((_, i) => i % 3 === 1).every(y => y === 5), 'drape: every vertex lifted')
  ok(drape(t, (x) => (x > 9 ? -Infinity : 0)).length < flat.length, 'drape: a triangle touching -∞ is dropped')
}
ok(ribbonXZ([], 2).length === 0 && ribbonXZ([[1, 1]], 2).length / 6 === DISC_SEG && ribbonXZ([[0, 0], [0, 0], [4, 0]], 1, false).length / 6 === 2, 'degenerate input: empty, a dot, a repeated point')
ok(ribbonsOn('?roads=ribbon') && !ribbonsOn('?roads=legacy') && !ribbonsOn(''), 'Nyx opt-in: ?roads=ribbon, none = legacy')
ok(atherRibbonsOn('') && atherRibbonsOn('?hour=13&waymark=greg') && atherRibbonsOn('?roads=ribbon') && !atherRibbonsOn('?roads=legacy'), 'Ather default (M58, Alex 11-23): no flag = ribbons, ?roads=legacy = the old strips')

console.log(`road-ribbon: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
