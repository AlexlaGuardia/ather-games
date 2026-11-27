// ── A LOST ZONE IS VOID (BETA M235 s2; canon Magii 15b0e8a: the zone collapses into the cloud below) ──────────────────────────
// Wraps the Wilds' cloud-void field (wilds-voids.ts) so a lost zone's ground is carved away like a void, wall to wall: weight 0 on
// its border (the neighbour's ground never moves), rising to 1 across LOST_FADE metres inside, the pit LOST_DEPTH deep. The tile
// parse then drops its trees, crystals and nodes (they skip any weight > 0) and draws its cells as void.
// The keeper never walks in: lostEdge() > 0 is a hard edge the page holds them back from (they do not fall, they stop).
// Ownership is the fine per-tile section rule (nodes.ts ownerOf): inside a tile the border is the bisector between the owning
// section and the nearest section of a zone that is not lost; at a tile seam, the seam itself when the ground across is not lost.
// ★ PURE. Build only (Jin's look, Alex judges): no words.
import type { VoidField } from './wilds-voids'
import { FALL_W } from './wilds-voids'

export const LOST_FADE = 14
export const LOST_DEPTH = 48
const smooth = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }

export interface Section { id: string; x: number; z: number }
export interface LostGround {
  /** the sections of the tile under a point and that tile's square (world metres), or null off the map */
  tileAt(x: number, z: number): { sections: readonly Section[]; x0: number; z0: number; x1: number; z1: number } | null
  zoneOf(sectionId: string): string
  lost: ReadonlySet<string>
}
/** metres inside a lost zone's border at a point (0 = not in a lost zone) */
export function lostDepthAt(g: LostGround, x: number, z: number): number {
  if (!g.lost.size) return 0
  const t = g.tileAt(x, z); if (!t || !t.sections.length) return 0
  let a: Section | undefined, bd = Infinity
  for (const s of t.sections) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; a = s } }
  if (!a || !g.lost.has(g.zoneOf(a.id))) return 0
  let d = Infinity
  for (const b of t.sections) {
    if (b === a || g.lost.has(g.zoneOf(b.id))) continue
    const L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1e-6) continue
    d = Math.min(d, (((b.x - x) ** 2 + (b.z - z) ** 2) - bd) / (2 * L))
  }
  const E = 0.5   // a step over the seam: whose ground is across?
  const across = (px: number, pz: number) => { const u = g.tileAt(px, pz); if (!u || !u.sections.length) return false; let o: Section | undefined, od = Infinity; for (const s of u.sections) { const q = (s.x - px) ** 2 + (s.z - pz) ** 2; if (q < od) { od = q; o = s } } return !!o && !g.lost.has(g.zoneOf(o.id)) }
  if (across(t.x0 - E, z)) d = Math.min(d, x - t.x0)
  if (across(t.x1 + E, z)) d = Math.min(d, t.x1 - x)
  if (across(x, t.z0 - E)) d = Math.min(d, z - t.z0)
  if (across(x, t.z1 + E)) d = Math.min(d, t.z1 - z)
  return Math.max(0, Number.isFinite(d) ? d : 1e6)
}
export const lostWeight = (g: LostGround, x: number, z: number) => { const d = lostDepthAt(g, x, z); return d > 0 ? smooth(d / LOST_FADE) : 0 }

/** the field the tiles carve with: the cloud voids AND the lost zones (base null = no voids of its own) */
export function withLost(base: VoidField | null, g: LostGround): VoidField | null {
  if (!g.lost.size) return base
  const weight = (x: number, z: number) => Math.max(base?.weight(x, z) ?? 0, lostWeight(g, x, z))
  return {
    weight,
    protectedAt: (x, z) => base?.protectedAt(x, z) ?? false,
    isVoid: (x, z) => weight(x, z) >= FALL_W,
    crossings: base?.crossings ?? [],
    crossingNear: (x, z, r) => base?.crossingNear(x, z, r) ?? null,
    regionAt: (x, z) => base?.regionAt(x, z) ?? -1,
    regions: base?.regions ?? [],
    carve: (x, z, land, waterY) => {
      const b = base ? base.carve(x, z, land, waterY) : land, w = lostWeight(g, x, z)
      return w > 0 ? Math.min(b, land - LOST_DEPTH * w) : b
    },
  }
}
