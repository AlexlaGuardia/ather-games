// M58 (2) ROAD RIBBONS (2026-11-21, play / Jin play b7763e94). Alex 11-21: roads are "built from loose primitive shapes with
// gaps and overlaps at joins". This is the one way a road, lane or path is drawn as a continuous ribbon from its centre line.
// Pure: xz triangles in, no three.js, so the join maths is testable (road-ribbon.test.ts).
//
// ★ HOW A RIBBON STAYS GAP-FREE
//  · along the line: a gentle turn (≤ MITRE_MAX_TURN) is an exact MITRE: both quads share the mitre edge, nothing missing,
//    nothing folded. A sharp turn breaks the strip: each quad ends square and a DISC at the vertex fills the outside wedge.
//  · the ends: a disc (a round cap). At a junction every arm runs to the shared node, so the end discs fill the corners
//    between arms: a T and a + come out filled without anyone computing the intersection polygon.
//  · a disc is a polygon CIRCUMSCRIBED on the circle (radius hw / cos(π/n)), so it contains the true round join: its flat
//    edges never leave a sliver uncovered.
// ★ HOW A JUNCTION GETS ITS KERBS RIGHT WITHOUT CLIPPING: draw each road three times, widest first, each on a higher ground
//   layer (ground-layers.ts): sidewalk (verge) → edge/kerb strip (edge) → surface (lane / road). At a T the side road's
//   SURFACE paints over the main road's kerb across its mouth, and the main road's surface paints over the side road's end.
//   Overlaps inside one pass are one colour on a layer that does not write depth, so they cannot show (or flicker).
//
// ⚖ OPT-IN until Alex looks (BETA M58: "default unchanged until Alex looks"): `?roads=ribbon`. It forces the layer table ON
//   for the ribbon meshes (the kerb trick needs the fixed draw order), whatever ?ground says.

export type P2 = readonly [number, number, ...number[]]   // extra coordinates (a lane's height) are ignored
/** Turns up to this (radians) are mitred; sharper ones break the strip and get a disc. */
export const MITRE_MAX_TURN = Math.PI / 6
/** Disc polygon sides. */
export const DISC_SEG = 12

const DEFAULT_ON = false
export function ribbonsOn(search = typeof location === 'undefined' ? '' : location.search): boolean {
  const q = new URLSearchParams(search).get('roads')
  return q === 'ribbon' ? true : q === 'legacy' ? false : DEFAULT_ON
}

/** Drop repeated points (a zero-length segment has no direction). */
function clean(pts: readonly P2[]): P2[] {
  const out: P2[] = []
  for (const p of pts) if (Number.isFinite(p[0]) && Number.isFinite(p[1]) && (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > 1e-4)) out.push(p)
  return out
}

/** A disc at (x, z): DISC_SEG triangles, circumscribed so it contains the true circle of radius r. */
export function discXZ(x: number, z: number, r: number, out: number[] = []): number[] {
  const R = r / Math.cos(Math.PI / DISC_SEG)
  for (let i = 0; i < DISC_SEG; i++) {
    const a0 = (2 * Math.PI * i) / DISC_SEG, a1 = (2 * Math.PI * (i + 1)) / DISC_SEG
    out.push(x, z, x + Math.cos(a1) * R, z + Math.sin(a1) * R, x + Math.cos(a0) * R, z + Math.sin(a0) * R)
  }
  return out
}

/** The ribbon of half-width `hw` along `pts` as flat xz triangles: [x0,z0, x1,z1, x2,z2, ...]. `caps` = round ends. */
export function ribbonXZ(input: readonly P2[], hw: number, caps = true): number[] {
  const pts = clean(input), out: number[] = []
  if (!pts.length || hw <= 0) return out
  if (pts.length === 1) return caps ? discXZ(pts[0][0], pts[0][1], hw, out) : out
  const n = pts.length
  const dir = (i: number) => { const dx = pts[i + 1][0] - pts[i][0], dz = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dz); return [dx / L, dz / L] as const }
  // per vertex: the left/right points the quad BEFORE it ends on, and the ones the quad AFTER it starts on (same at a mitre)
  const endL: P2[] = [], endR: P2[] = [], startL: P2[] = [], startR: P2[] = []
  for (let k = 0; k < n; k++) {
    const [x, z] = pts[k]
    const d0 = k > 0 ? dir(k - 1) : null, d1 = k < n - 1 ? dir(k) : null
    const perp = (d: readonly [number, number]) => [-d[1], d[0]] as const   // left of travel
    if (d0 && d1) {
      const turn = Math.acos(Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1])))
      if (turn <= MITRE_MAX_TURN) {
        const mx = -(d0[1] + d1[1]), mz = d0[0] + d1[0], ml = Math.hypot(mx, mz)
        const nx = mx / ml, nz = mz / ml, len = hw / Math.max(1e-6, nx * perp(d1)[0] + nz * perp(d1)[1])
        const L: P2 = [x + nx * len, z + nz * len], R: P2 = [x - nx * len, z - nz * len]
        endL.push(L); endR.push(R); startL.push(L); startR.push(R)
        continue
      }
      const p0 = perp(d0), p1 = perp(d1)
      endL.push([x + p0[0] * hw, z + p0[1] * hw]); endR.push([x - p0[0] * hw, z - p0[1] * hw])
      startL.push([x + p1[0] * hw, z + p1[1] * hw]); startR.push([x - p1[0] * hw, z - p1[1] * hw])
      discXZ(x, z, hw, out)   // the sharp join's round fill
      continue
    }
    const p = perp((d0 ?? d1)!)
    const L: P2 = [x + p[0] * hw, z + p[1] * hw], R: P2 = [x - p[0] * hw, z - p[1] * hw]
    endL.push(L); endR.push(R); startL.push(L); startR.push(R)
    if (caps) discXZ(x, z, hw, out)
  }
  for (let k = 0; k < n - 1; k++) {
    const aL = startL[k], aR = startR[k], bL = endL[k + 1], bR = endR[k + 1]
    // counter-clockwise seen from above (+y): R(k) → L(k) → L(k+1), R(k) → L(k+1) → R(k+1)
    out.push(aR[0], aR[1], bL[0], bL[1], aL[0], aL[1], aR[0], aR[1], bR[0], bR[1], bL[0], bL[1])
  }
  return out
}

/** Lift flat xz triangles onto a surface: xyz positions. A triangle with any vertex off the ground (y not finite) is dropped
 *  whole, so an edge-of-region point can never put NaN in a mesh's bounds. */
export function drape(xz: readonly number[], y: (x: number, z: number) => number, out: number[] = []): number[] {
  for (let i = 0; i < xz.length; i += 6) {
    const y0 = y(xz[i], xz[i + 1]), y1 = y(xz[i + 2], xz[i + 3]), y2 = y(xz[i + 4], xz[i + 5])
    if (!Number.isFinite(y0) || !Number.isFinite(y1) || !Number.isFinite(y2)) continue
    out.push(xz[i], y0, xz[i + 1], xz[i + 2], y1, xz[i + 3], xz[i + 4], y2, xz[i + 5])
  }
  return out
}

// ── test helpers (pure) ──────────────────────────────────────────────────────────────────────────────────────────────
const inTri = (px: number, pz: number, t: readonly number[], i: number) => {
  const [ax, az, bx, bz, cx, cz] = [t[i], t[i + 1], t[i + 2], t[i + 3], t[i + 4], t[i + 5]]
  const d1 = (px - bx) * (az - bz) - (ax - bx) * (pz - bz), d2 = (px - cx) * (bz - cz) - (bx - cx) * (pz - cz), d3 = (px - ax) * (cz - az) - (cx - ax) * (pz - az)
  return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9))
}
/** Is (x, z) under any triangle? */
export const coveredBy = (tris: readonly number[], x: number, z: number) => { for (let i = 0; i < tris.length; i += 6) if (inTri(x, z, tris, i)) return true; return false }
/** Signed area of triangle i/6 (positive = counter-clockwise from above). */
export const triArea = (t: readonly number[], i: number) => ((t[i + 2] - t[i]) * (t[i + 5] - t[i + 1]) - (t[i + 4] - t[i]) * (t[i + 3] - t[i + 1])) / 2
