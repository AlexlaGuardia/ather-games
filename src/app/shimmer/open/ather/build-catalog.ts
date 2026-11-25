// ── BETA M169 s1: THE BUILDING CATALOG (pure: no three, no react; build-catalog.test.ts) ──
// ONE catalog, read by both places that build: the garden's planning mode (workshop.tsx Catalog) and Creative's Place palette
// (scenery.ts group 'Build', place-mode.tsx). Its only source is the `build` field on a furniture piece (furniture.ts FURNITURE):
// set it on a new piece and that piece is planned on a plot AND placed in Creative, under its sub-category, with its icon.
// The icon is drawn from the piece itself: the same boxes the game draws it with (workshop.tsx PieceBody reads buildBoxes),
// seen from above at an angle, as flat shaded faces (an SVG path per face, no picture files, no extra WebGL).
import { BUILD_SUBS, FURNITURE, FURNITURE_ORDER, WOOD_COLOR, type BuildSub, type PieceDef } from './furniture'

/** the catalog: each sub-category that holds a piece, its pieces in FURNITURE order (an empty one is left out) */
export function buildCatalog(defs: Readonly<Record<string, PieceDef>> = FURNITURE, order: readonly string[] = FURNITURE_ORDER): { sub: BuildSub; ids: string[] }[] {
  return BUILD_SUBS.map(sub => ({ sub, ids: order.filter(id => defs[id]?.build === sub) })).filter(g => g.ids.length > 0)
}
export const BUILD_PIECES: readonly string[] = buildCatalog().flatMap(g => g.ids)

/** a box of a piece: p = its middle (m, local, y up from the ground), s = its size, c = its colour */
export interface PieceBox { p: readonly [number, number, number]; s: readonly [number, number, number]; c: string }
const DARK = '#6b4a2a'
/** M169 s2: the crystal pane's colour and a door / shutter leaf's (a shade under the goldwood round it, so a shut leaf reads) */
export const PANE = '#bfe6f2', LEAF = '#b98a44'
/** M169 s2: the cut pieces' sizes (athernyx concept-1672 building + textures NOTES, Magii 246c2cc / 9c9e688; the build's plot-walls.ts) */
export const CUT = { doorH: 2.2, leafW: 0.94, leafH: 2.14, leafT: 0.06, frame: 0.06, sill: 1.0, winTop: 2.2, round: 0.45, roundY: 1.6, shutW: 0.5, shutH: 1.2, shutT: 0.05 } as const
/** M169 s2: where nothing answers E (Creative's Place pieces, a zone's parts) a door's leaves and a window's shutters stand OPEN: a
 *  shut door there would be a wall nobody could open */
export const CREATIVE_OPEN = true as const
/** a piece that opens and shuts on E (a door's leaves, a window's shutters) */
export const opens = (f: PieceDef | undefined) => f?.shape === 'door' || f?.shape === 'shutters' || f?.shape === 'gate'
/** M169 s3: the stair (12 steps of RISE x TREAD climbing to the 4.8 m wall top, under the walker's 0.5 m step), the ramp (strips of
 *  RAMP_RISE), and the ONE rail style the stair's sides, the railing, the fence and the gate share (post, handrail, height) */
export const STAIR = { steps: 12, rise: 0.4, tread: 0.5 } as const
export const RAMP = { strips: 12, rise: 0.1 } as const
export const RAIL = { h: 1.0, post: 0.1, hand: 0.1, handT: 0.06, bal: 0.04, low: 0.15, lowT: 0.05, mid: 0.55 } as const
/** a stair step's local box: n = 1..steps from the bottom (+z end), climbing toward -z */
export const stepZ = (f: Pick<PieceDef, 'd'>, n: number, tread: number) => f.d / 2 - (n - 0.5) * tread
/** the x of a stair's railing on side k (-1 left, +1 right, seen climbing toward -z: left = -x) */
const railX = (f: Pick<PieceDef, 'w'>, k: number) => k * (f.w / 2 - RAIL.post / 2)
const railSides = (f: PieceDef): number[] => f.rails === 'lr' ? [-1, 1] : f.rails === 'l' ? [-1] : f.rails === 'r' ? [1] : []
const bx = (x: number, y: number, z: number, w: number, h: number, d: number, c: string): PieceBox => ({ p: [x, y, z], s: [w, h, d], c })
/** the round pane's band as strips: each strip's middle height and the pane's half width there (wall fills the rest) */
const ROUND_STRIPS = 5
function roundBand(r: number, y0: number, n = ROUND_STRIPS) { const hgt = 2 * r / n
  return Array.from({ length: n }, (_, k) => { const y = y0 - r + hgt * (k + 0.5); return { y, h: hgt, hw: Math.sqrt(Math.max(0, r * r - (y - y0) ** 2)) } }) }
/** M169 s2: a cut piece's boxes (local; x along the wall, +z = its outer face; `open` = leaves / shutters open) */
function cutBoxes(f: PieceDef, open: boolean): PieceBox[] {
  const c = f.tint ?? WOOD_COLOR[f.wood], tr = f.tint ? '#7a3f2e' : DARK, { w, d, h } = f, out: PieceBox[] = []
  const foot = () => out.push(bx(0, 0.09, 0, w + 0.02, 0.18, d + 0.04, tr)), cap = () => out.push(bx(0, h - 0.05, 0, w + 0.02, 0.1, d + 0.04, tr))
  const lintel = (y0: number) => out.push(bx(0, (y0 + h) / 2, 0, w, h - y0, d, c))
  const jambs = (y1: number) => [-1, 1].forEach(k => out.push(bx(k * (w / 2 - CUT.frame / 2), y1 / 2, 0, CUT.frame, y1, d, tr)))
  const pane = (hw: number) => { lintel(CUT.winTop); out.push(bx(0, CUT.sill / 2, 0, w, CUT.sill, d, c)); foot(); cap()
    const ph = CUT.winTop - CUT.sill, py = (CUT.sill + CUT.winTop) / 2
    out.push(bx(0, py, 0, hw * 2, ph, 0.04, PANE), bx(0, py, 0, 0.04, ph, 0.06, tr))
    ;[-1, 1].forEach(k => out.push(bx(k * (w / 2 - (w / 2 - hw) / 2), py, 0, w / 2 - hw, ph, d, tr)))
    out.push(bx(0, CUT.sill - 0.03, 0.04, w, 0.06, d + 0.08, tr)) }
  switch (f.shape) {
    case 'door': case 'doorway': {
      lintel(CUT.doorH); cap(); jambs(CUT.doorH); out.push(bx(0, 0.01, 0, w, 0.02, d, tr))
      if (f.shape === 'door') for (const k of [-1, 1]) {   // two leaves; open = a quarter turn outward on the hinge at the jamb
        const hx = k * (w / 2 - CUT.frame), y = 0.02 + CUT.leafH / 2
        if (!open) out.push(bx(hx - k * CUT.leafW / 2, y, 0, CUT.leafW, CUT.leafH, CUT.leafT, LEAF), bx(hx - k * CUT.leafW / 2, y, CUT.leafT / 2 + 0.01, CUT.leafW - 0.14, 0.08, 0.02, tr))
        else out.push(bx(hx - k * CUT.leafT / 2, y, d / 2 + CUT.leafW / 2, CUT.leafT, CUT.leafH, CUT.leafW, LEAF), bx(hx + k * 0.01, y, d / 2 + CUT.leafW / 2, 0.02, 0.08, CUT.leafW - 0.14, tr))
      }
      return out }
    case 'window': pane(w / 2 - 0.08); return out
    case 'shutters': {
      pane(w / 2 - 0.08)
      for (const k of [-1, 1]) {   // a pair on the outer face; open = folded back flat on the wall beside it (each covers 0.5 m of the next piece)
        const x = open ? k * (w / 2 + CUT.shutW / 2) : k * CUT.shutW / 2, z = d / 2 + 0.03 + CUT.shutT / 2, y = (CUT.sill + CUT.winTop) / 2
        out.push(bx(x, y, z, CUT.shutW - 0.01, CUT.shutH, CUT.shutT, LEAF), bx(x, y, z + CUT.shutT / 2 + 0.01, CUT.shutW - 0.1, 0.06, 0.02, tr))
      }
      return out }
    case 'round': {
      const r = CUT.round, y0 = CUT.roundY
      out.push(bx(0, (y0 - r) / 2, 0, w, y0 - r, d, c)); lintel(y0 + r); foot(); cap()
      for (const s of roundBand(r, y0)) { out.push(bx(0, s.y, 0, s.hw * 2, s.h, 0.04, PANE)); [-1, 1].forEach(k => out.push(bx(k * (w / 2 - (w / 2 - s.hw) / 2), s.y, 0, w / 2 - s.hw, s.h, d, c))) }
      out.push(bx(0, y0, 0, 0.04, 2 * r, 0.06, tr), bx(0, y0, 0, 2 * r, 0.04, 0.06, tr))
      return out }
    case 'arch': {
      const r = w / 2 - CUT.frame, y0 = CUT.doorH
      jambs(y0); lintel(y0 + r); cap()
      for (const s of roundBand(r, y0, 10).slice(5)) [-1, 1].forEach(k => out.push(bx(k * (w / 2 - (w / 2 - s.hw) / 2), s.y, 0, w / 2 - s.hw, s.h, d, c)))
      return out }
    case 'half': out.push(bx(0, h / 2, 0, w, h, d, c), bx(0, 0.09, 0, w + 0.02, 0.18, d + 0.04, tr), bx(0, h - 0.03, 0, w + 0.02, 0.06, d + 0.04, tr)); return out
    case 'end': out.push(bx(0, h / 2, 0, w, h, d, c), bx(0, 0.09, 0, w + 0.04, 0.18, d + 0.04, tr), bx(0, h - 0.04, 0, w + 0.06, 0.08, d + 0.06, tr)); return out
    case 'stair': {   // M169 s3: solid steps from the floor, a darker nosing on each; a railing side = a post every other step, a baluster
      // between, a handrail stepping up with the treads
      const { steps, rise, tread } = STAIR
      for (let n = 1; n <= steps; n++) { const z = stepZ(f, n, tread), top = n * rise
        out.push(bx(0, top / 2, z, w, top, tread, c), bx(0, top - 0.02, z + tread / 2 - 0.03, w, 0.04, 0.06, tr))
        for (const k of railSides(f)) { const x = railX(f, k), p = n % 2 ? RAIL.post : RAIL.bal
          out.push(bx(x, top + RAIL.h / 2, z, p, RAIL.h, p, c), bx(x, top + RAIL.h - RAIL.handT / 2, z, RAIL.hand, RAIL.handT, tread + 0.01, tr)) } }
      return out }
    case 'railing': case 'fence': {   // posts every metre; a railing: handrail, low rail, balusters; a fence: handrail, mid + low rails
      const n = Math.max(1, Math.round(w))
      for (let k = 0; k <= n; k++) { const x = -w / 2 + RAIL.post / 2 + k * (w - RAIL.post) / n; out.push(bx(x, RAIL.h / 2, 0, RAIL.post, RAIL.h, RAIL.post, c), bx(x, RAIL.h + 0.02, 0, RAIL.post + 0.02, 0.04, RAIL.post + 0.02, tr)) }
      out.push(bx(0, RAIL.h - RAIL.handT / 2, 0, w, RAIL.handT, RAIL.hand, tr), bx(0, RAIL.low, 0, w - 0.02, RAIL.lowT, RAIL.lowT, c))
      if (f.shape === 'fence') out.push(bx(0, RAIL.mid, 0, w - 0.02, RAIL.lowT, RAIL.lowT, c))
      else for (let b = 0; b < n * 4; b++) { if (b % 4 === 0) continue; const x = -w / 2 + RAIL.post / 2 + b * (w - RAIL.post) / (n * 4); out.push(bx(x, (RAIL.low + RAIL.h) / 2, 0, RAIL.bal, RAIL.h - RAIL.low, RAIL.bal, c)) }
      return out }
    case 'gate': {   // two posts; the leaf between (a frame, two pickets) swings a quarter turn outward on the left post when open
      ;[-1, 1].forEach(k => out.push(bx(k * (w / 2 - RAIL.post / 2), RAIL.h / 2, 0, RAIL.post, RAIL.h, RAIL.post, c), bx(k * (w / 2 - RAIL.post / 2), RAIL.h + 0.02, 0, RAIL.post + 0.02, 0.04, RAIL.post + 0.02, tr)))
      const L = w - 2 * RAIL.post - 0.02, hx = -w / 2 + RAIL.post + 0.01, lh = RAIL.h - 0.1 - RAIL.low / 2, ly = RAIL.low / 2 + lh / 2
      const leaf: [number, number, number, number][] = [[L / 2, RAIL.h - 0.1, L, 0.06], [L / 2, RAIL.low, L, 0.06], [0.03, ly, 0.06, lh], [L - 0.03, ly, 0.06, lh], [L / 3, ly, 0.05, lh], [2 * L / 3, ly, 0.05, lh]]
      for (const [a, y, len, ht] of leaf) out.push(open ? bx(hx, y, d / 2 + a, 0.05, ht, len, LEAF) : bx(hx + a, y, 0, len, ht, 0.05, LEAF))
      return out }
    case 'ramp': {   // strips of RAMP.rise climbing toward -z, a darker edge strip down each side
      const { strips, rise } = RAMP, run = d / strips
      for (let n = 1; n <= strips; n++) { const z = stepZ(f, n, run), top = n * rise; out.push(bx(0, top / 2, z, w - 0.12, top, run, c)); [-1, 1].forEach(k => out.push(bx(k * (w / 2 - 0.03), top / 2 + 0.02, z, 0.06, top + 0.04, run, tr))) }
      return out }
    case 'corner': {   // an L in a 1 x 1 m square: one arm along its back (local -z), one down its left (local -x), meeting in the corner
      const t = 0.3, H = h
      for (const [x, z, aw, ad] of [[0, -w / 2 + t / 2, w, t], [-w / 2 + t / 2, t / 2, t, d - t]] as const)
        out.push(bx(x, H / 2, z, aw, H, ad, c), bx(x, 0.09, z, aw + 0.02, 0.18, ad + 0.04, tr), bx(x, H - 0.05, z, aw + 0.02, 0.1, ad + 0.04, tr))
      return out }
  }
  return out
}
/** a part of a piece that BLOCKS the walker: local middle (x, z), size w x d, h tall from the floor */
export interface SolidPart { x: number; z: number; w: number; d: number; h: number }
/** M169 s2: what of a cut piece blocks (null = not a cut piece: its whole footprint, the old rule). A shut door's leaves block the
 *  whole doorway; an open door, a doorway or an arch blocks nothing (the lintel is over a keeper's head). A window is a wall. */
export function buildSolids(f: PieceDef, open = false): SolidPart[] | null {
  if (!f.shape) return null
  switch (f.shape) {
    case 'door': return open ? [] : [{ x: 0, z: 0, w: f.w, d: f.d, h: f.h }]
    case 'doorway': case 'arch': return []
    case 'stair': { const out: SolidPart[] = []   // M169 s3: each step a column from the floor; a railing side a thin wall 1 m over each tread
      for (let n = 1; n <= STAIR.steps; n++) { const z = stepZ(f, n, STAIR.tread), top = n * STAIR.rise
        out.push({ x: 0, z, w: f.w, d: STAIR.tread, h: top }); for (const k of railSides(f)) out.push({ x: railX(f, k), z, w: RAIL.post, d: STAIR.tread, h: top + RAIL.h }) }
      return out }
    case 'ramp': return Array.from({ length: RAMP.strips }, (_, i) => ({ x: 0, z: stepZ(f, i + 1, f.d / RAMP.strips), w: f.w, d: f.d / RAMP.strips, h: (i + 1) * RAMP.rise }))
    case 'gate': return open ? [-1, 1].map(k => ({ x: k * (f.w / 2 - RAIL.post / 2), z: 0, w: RAIL.post, d: f.d, h: f.h })) : [{ x: 0, z: 0, w: f.w, d: f.d, h: f.h }]
    case 'corner': return [{ x: 0, z: -f.w / 2 + 0.15, w: f.w, d: 0.3, h: f.h }, { x: -f.w / 2 + 0.15, z: 0.15, w: 0.3, d: f.d - 0.3, h: f.h }]
    default: return [{ x: 0, z: 0, w: f.w, d: f.d, h: f.h }]
  }
}
/** the boxes a building piece is drawn with (null = not a box-built building piece: the game draws it its own way). `open` = a
 *  door's leaves / a window's shutters stand open (M169 s2). */
export function buildBoxes(f: PieceDef, open = false): PieceBox[] | null {
  const c = WOOD_COLOR[f.wood]
  if (f.shape) return cutBoxes(f, open)
  // M98b b2 wall panels: the wall itself in its material, a darker sill and a cap (three meshes: a run of panels stays cheap)
  if (f.panel) { const pc = f.tint ?? c, tr = f.tint ? '#7a3f2e' : DARK
    return [{ p: [0, f.h / 2, 0], s: [f.w, f.h, f.d], c: pc }, { p: [0, 0.09, 0], s: [f.w + 0.02, 0.18, f.d + 0.04], c: tr }, { p: [0, f.h - 0.05, 0], s: [f.w + 0.02, 0.1, f.d + 0.04], c: tr }] }
  // M98b floor slabs: a slab with a seam every metre (wood: planks run along w; stone: a flag grid)
  if (f.slab) { const stone = f.wood === 'stone', seam = stone ? '#8a8274' : DARK, n = Math.round(f.w * (stone ? 1 : 3)), out: PieceBox[] = [{ p: [0, f.h / 2, 0], s: [f.w, f.h, f.d], c }]
    for (let k = 0; k < n - 1; k++) out.push({ p: [-f.w / 2 + (k + 1) * f.w / n, f.h + 0.003, 0], s: [0.025, 0.006, f.d - 0.02], c: seam })
    if (stone) for (let k = 0; k < Math.round(f.d) - 1; k++) out.push({ p: [0, f.h + 0.003, -f.d / 2 + (k + 1)], s: [f.w - 0.02, 0.006, 0.025], c: seam })
    return out }
  return null
}

/** one shaded face of the icon: an SVG path in a 0..ICON viewBox, and its fill */
export interface IconFace { d: string; fill: string }
export const ICON = 40
const COS = Math.cos(Math.PI / 6), SIN = Math.sin(Math.PI / 6)
const shade = (hex: string, k: number) => { const n = parseInt(hex.slice(1), 16), ch = (v: number) => Math.round(Math.min(255, v * k)).toString(16).padStart(2, '0')
  return `#${ch(n >> 16 & 255)}${ch(n >> 8 & 255)}${ch(n & 255)}` }
/** the icon of a building piece: its boxes from the front-right, above, as their top, front and right faces, far ones first */
export function pieceIcon(id: string): IconFace[] {
  const f = FURNITURE[id], boxes = f ? buildBoxes(f) : null
  if (!boxes) return []
  const pr = (x: number, y: number, z: number) => [(x - z) * COS, -y + (x + z) * SIN] as const
  const faces: { pts: (readonly [number, number])[]; fill: string; depth: number }[] = []
  for (const b of boxes) {
    const [cx, cy, cz] = b.p, [w, h, d] = b.s, x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2
    const depth = cy * 10 + cx + cz
    faces.push({ pts: [pr(x0, y1, z0), pr(x1, y1, z0), pr(x1, y1, z1), pr(x0, y1, z1)], fill: shade(b.c, 1), depth: depth + 0.002 })
    faces.push({ pts: [pr(x0, y0, z1), pr(x1, y0, z1), pr(x1, y1, z1), pr(x0, y1, z1)], fill: shade(b.c, 0.8), depth })
    faces.push({ pts: [pr(x1, y0, z0), pr(x1, y0, z1), pr(x1, y1, z1), pr(x1, y1, z0)], fill: shade(b.c, 0.64), depth: depth + 0.001 })
  }
  const all = faces.flatMap(f => f.pts), minX = Math.min(...all.map(p => p[0])), maxX = Math.max(...all.map(p => p[0])), minY = Math.min(...all.map(p => p[1])), maxY = Math.max(...all.map(p => p[1]))
  const pad = 3, k = (ICON - pad * 2) / Math.max(maxX - minX, maxY - minY), ox = (ICON - (maxX - minX) * k) / 2, oy = (ICON - (maxY - minY) * k) / 2
  const at = (p: readonly [number, number]) => `${((p[0] - minX) * k + ox).toFixed(2)} ${((p[1] - minY) * k + oy).toFixed(2)}`
  return faces.sort((a, b) => a.depth - b.depth).map(f => ({ d: `M${f.pts.map(at).join('L')}Z`, fill: f.fill }))
}
