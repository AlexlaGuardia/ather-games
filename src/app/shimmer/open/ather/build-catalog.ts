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
/** the boxes a building piece is drawn with (null = not a box-built building piece: the game draws it its own way) */
export function buildBoxes(f: PieceDef): PieceBox[] | null {
  const c = WOOD_COLOR[f.wood]
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
