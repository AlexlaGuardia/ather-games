// BETA M126 (play, 2026-11-24): THE GROUND A FOLLOWING SPIRIT MAY USE in the garden. Her roam (workshop.tsx planterNav) is the
// open garden at her planter's own level, which is right for roaming and was wrong for following: a raised house, its door
// steps, its stairs, and the path / valley / Green past the island were all refused, so she stopped at the door or the edge.
//   open ground = any floor of yours at HER level, clear of walls / chests / pieces by her body; and the valley, its paths and
//                 the Green (the cluster's ground) clear of its trees.
//   trail       = anywhere the keeper walked (shared/keeper-trail.ts), feet height and all: doors, steps, stairs, jumps.
// The page says what the garden is (setGardenGround). No three, no react. Tested in garden-follow.test.ts.
import { footBlocked, plotFootprints, type Foot, type PieceFoot } from './obstacles'
import { pieceFloor, type Works } from './rooms'
import { GROUND_Y, plotHeightAt, squareAt, sqId } from './plot'
import type { Frame } from './cluster'
import { clusterGround, mateAt } from './cluster'
import type { Box } from '../terrain-world'
import { keeperTrail, makeGuide, TRAIL, type Trail } from '../shared/keeper-trail'
import type { Vec } from '../shared/follow-formation'

export type GardenGround = { owned: ReadonlySet<string>; works: Works; walls: readonly Box[]; frame?: Frame }
type Ground = GardenGround & { feet: PieceFoot[]; solid: Box[] }
let cur: Ground | null = null, seen: Works | null = null
export function setGardenGround(g: GardenGround | null) {
  if (!g) { cur = null; return }
  // pieces are in the footprints (what she keeps her whole body clear of), so the solid list is walls, chests and house boxes
  const feet = plotFootprints(g.works.pieces), k = new Set(feet.map(f => `${f.rect.x0.toFixed(2)},${f.rect.z0.toFixed(2)},${f.rect.x1.toFixed(2)},${f.rect.z1.toFixed(2)}`))
  if (seen && (seen.walls !== g.works.walls || seen.rooms !== g.works.rooms)) keeperTrail.clear()   // a wall may stand across it now
  seen = g.works; cur = { ...g, feet, solid: g.walls.filter(b => !k.has(`${b.x0.toFixed(2)},${b.z0.toFixed(2)},${b.x1.toFixed(2)},${b.z1.toFixed(2)}`)) }
}
export const gardenGround = () => cur

const distTo = (b: Foot, x: number, z: number) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1))
const SAME = 0.12     // m: the same floor
const SLOPE = 0.8     // m: the valley's slope between her and the point asked for
/** the open ground's height at (x, z) for a body of radius r whose feet are at y; null = not open ground there */
export function openAt(x: number, z: number, r: number, y: number): number | null {
  const g = cur; if (!g) return null
  const s = squareAt(x, z)
  if (s) {
    if (!g.owned.has(sqId(s.i, s.j)) || Math.abs(plotHeightAt(x, z) - GROUND_Y) > 0.05) return null
    const h = pieceFloor(g.works, { item: '', x, z }); if (Math.abs(h - y) > SAME) return null
    for (const b of g.solid) if (b.y0 < h + 1 && b.y1 > h + 0.3 && distTo(b, x, z) < r) return null
    return footBlocked(g.feet, x, z, r) ? null : h
  }
  const f = g.frame; if (!f?.linked || !f.meadow || mateAt(f, x, z)) return null
  if (plotHeightAt(x, z) > -Infinity) return null   // the island's own rim: the trail's
  const h = clusterGround(f, x, z); if (!Number.isFinite(h) || Math.abs(h - y) > SLOPE) return null
  for (const t of f.meadow.trees) if (Math.hypot(t.x - x, t.z - z) < r + 0.5) return null
  return h
}

/** One following spirit's ground and way. `y` = her feet. */
export type FollowNav = {
  blocked: (x: number, z: number) => boolean
  /** the same question for her SLOT, from the keeper's floor */
  slotBlocked: (x: number, z: number) => boolean
  toward: (pos: Vec, goal: Vec, dt: number) => Vec | null
  /** she stands here now: her feet height (null = nothing known there: she keeps the last) */
  stand: (x: number, z: number) => number
  y: () => number
  /** she is on her own ground again (not following): her feet are at h */
  put: (h: number) => void
  /** the ground's height there for feet near `near` (none = the keeper's floor); null = not hers to walk */
  height: (x: number, z: number, near?: number) => number | null
  /** she could not get anywhere for TRAIL.lost s: a spot by the keeper, out of their sight and hers there too; else null */
  lost: (pos: Vec, k: Vec & { yaw: number }, slot: Vec, dt: number) => Vec | null
}
export function gardenFollow(r: number, y0: number, trail: Trail = keeperTrail): FollowNav {
  let y = y0, stuck = 0, from: Vec | null = null
  const heightAt = (x: number, z: number, near: number) => openAt(x, z, r, near) ?? trail.at(x, z, near)
  const blocked = (x: number, z: number) => heightAt(x, z, y) === null
  const guide = makeGuide(trail, blocked)
  return {
    blocked,
    slotBlocked: (x, z) => heightAt(x, z, trail.level() ?? y) === null,
    toward: guide.toward,
    stand: (x, z) => (y = heightAt(x, z, y) ?? y),
    y: () => y, put: h => { y = h }, height: (x, z, near) => heightAt(x, z, near ?? trail.level() ?? y),
    lost(pos, k, slot, dt) {
      const d = Math.hypot(pos.x - k.x, pos.z - k.z)
      if (d < TRAIL.far || !from || Math.hypot(pos.x - from.x, pos.z - from.z) > 0.6) { from = { ...pos }; stuck = 0; if (d < 40) return null }
      stuck += dt; if (stuck < TRAIL.lost && d < 40) return null
      const unseen = (p: Vec) => (p.x - k.x) * -Math.sin(k.yaw) + (p.z - k.z) * -Math.cos(k.yaw) < 0   // behind the keeper's facing
      const lv = trail.level() ?? y
      if (!(unseen(pos) || d > 40) || !unseen(slot)) return null
      const h = heightAt(slot.x, slot.z, lv); if (h === null) return null
      stuck = 0; from = null; y = h; return { x: slot.x, z: slot.z }
    },
  }
}
