// footing.ts — is there a floor to fight on here, and if not, where is the nearest one?
//
// ★ PURE. No react, no three, no grid — `voxel/` may not import three. Same seam as `collar-foes.ts`:
// the rules travel between worlds, the state does not.
//
// ── ★ WHY THIS EXISTS: TWO OF THE THREE FIGHT FLOORS WERE ALREADY LEVEL, AND THE THIRD IS THE ROAD ──
// `mist.ts` step 5 (*"A floor to spar on"*) refuses any patch whose middle is not level, and
// `holds.ts` stands each Moglin hold on a flattened pad. So a mist spar and a hold assault both
// happen on ground the generator guaranteed. **A collared patrol does not.** It comes out to meet you
// at `PATROL_MEET` blocks (`VoxelWorld.tsx`) and `roadAt()` is a boolean SURFACE swap — packed earth
// painted onto whatever the terrain does, with no bench, grade or levelling anywhere in
// `story-path.ts`. The road is the only fight floor in the game with no flatness guarantee, which is
// why a walker can end up shuffling against a two-block face while the keeper hits it from above.
//
// ── ★ NEAREST ACCEPTABLE, NOT FLATTEST — AND THAT IS THE WHOLE TUNING DECISION ─────────────────────
// Displacement is the cost, not the leftover. Canon's line for this encounter is *"a patrol comes out
// to meet you"*, and `PATROL_MEET` was measured against the real approach (22, so they arrive as a
// group on the ROAD rather than materialising on top of someone). A search that hunts the flattest
// spot in range will happily move a Moglin six blocks to save one block of span and break the very
// read the distance was tuned for. So this takes the FIRST spot that clears the bar, scanning
// outward, and stops.
//
// ── ⚠ IT FAILS OPEN, DELIBERATELY, AND THE DIRECTION IS THE POINT ─────────────────────────────────
// If nothing in range clears the bar it returns the ORIGINAL point with `ok: false`. It never refuses
// a placement. A patrol that declines to spawn because the ground is lumpy is a silently deleted
// encounter — the player walks past a hold and nothing happens, which looks exactly like a hold that
// has already been freed. A slightly sloped fight is a worse fight; no fight is a missing feature.
// Callers that want to know may read `ok`; nothing is obliged to.
//
// ── ⚠⚠ `columnHeight` IS THE WORLD AS FIRST IMAGINED, NOT THE WORLD UNDERFOOT ─────────────────────
// It is a PURE GENERATOR QUERY and knows nothing about mining, building, or anything a player has
// ever done — `VoxelWorld.tsx` says so at `groundTopNear`, which exists because the Hollows' probe
// was `columnHeight` and so **no wall had ever stopped a Hollow**, conjured or hand-built. That is
// the same trap one layer down: measured on the generator alone, a spot the keeper dug out last
// night still reads as level, and a patrol spawns standing in a hole they made.
//
// So `heightAt` is the seam, and it is deliberately the SAME shape as `collar-foes.ts`'s `blocked?`
// — *"the one thing that cannot travel between worlds"*. Omit it and this is a pure generator read,
// which is correct for a generation-time question (`sites.ts`, `mist.ts` both ask exactly that) and
// keeps this module testable with no host. Pass the host's live probe and it measures the ground
// that is actually there, which is the right question for a RUNTIME spawn. ⚠ A caller placing a
// living body should pass it; a caller deciding where the generator puts something must not.

import { columnHeight, type HeightConfig, DEFAULT_HEIGHT } from './height'

export interface FootingCfg {
  /** Radius of the ring a fight needs, in blocks. Round, not square — a spar ring is round. */
  radius: number
  /** Max height span across that ring before it stops being a floor. */
  maxSpan: number
  /** How far the point may be nudged to find one, in blocks. */
  search: number
}

/**
 * ★ TUNED AGAINST THE TWO FLOORS THAT ALREADY WORK, NOT INVENTED. `radius` 3 is a fighting ring a
 * little tighter than a mist patch's `floorRadius`; `maxSpan` 2 is the SAME bar `sites.ts` (`padSpan`)
 * and `mist.ts` hold their floors to, so "level enough to fight on" means one thing across the build.
 * `search` 3 keeps a nudged foe inside the spread `rollPatrol` already gives its slots, so a patrol
 * still reads as a group met on the road rather than as three walkers who wandered off.
 */
export const DEFAULT_FOOTING: FootingCfg = { radius: 3, maxSpan: 2, search: 3 }

/**
 * The height span across a round footprint — THE metric, exported so callers derive it rather than
 * restate it. `sites.ts` and `mist.ts` each inline their own copy of this loop against `padSpan`;
 * this is the same reading, and a caller comparing against `maxSpan` is comparing derivations.
 */
export function footingSpan(
  x: number, z: number, seed: number,
  radius: number, hcfg: HeightConfig = DEFAULT_HEIGHT,
  heightAt?: (x: number, z: number) => number,
): number {
  const r = Math.max(0, Math.floor(radius))
  let mn = Infinity, mx = -Infinity
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue        // a round floor, not a square one
      const px = Math.floor(x) + dx, pz = Math.floor(z) + dz
      const h = heightAt ? heightAt(px, pz) : columnHeight(px, pz, seed, hcfg)
      if (h < mn) mn = h
      if (h > mx) mx = h
    }
  }
  return mx - mn
}

export interface Footing {
  x: number
  z: number
  /** The span at the returned point. */
  span: number
  /** Did it clear `maxSpan`? False means this is the original point, unmoved. */
  ok: boolean
  /** Blocks moved from the requested point. 0 when the ground was already good. */
  moved: number
}

/**
 * The nearest spot to (x,z) with a floor worth fighting on.
 *
 * ★ SCANS BY RINGS SO "NEAREST" IS TRUE, NOT APPROXIMATE. A raw nested dx/dz sweep visits (-3,-3)
 * before (0,1) and would return a corner when a neighbour was fine. Candidates are gathered per
 * integer ring and the first ring with a passing member wins; within a ring the order is fixed and
 * seed-free, so the same request always returns the same point (a foe must not jitter between
 * frames, and a test must not need a seed to be repeatable).
 */
export function flatFightSpot(
  x: number, z: number, seed: number,
  cfg: FootingCfg = DEFAULT_FOOTING, hcfg: HeightConfig = DEFAULT_HEIGHT,
  heightAt?: (x: number, z: number) => number,
): Footing {
  const here = footingSpan(x, z, seed, cfg.radius, hcfg, heightAt)
  if (here <= cfg.maxSpan) return { x, z, span: here, ok: true, moved: 0 }

  const s = Math.max(0, Math.floor(cfg.search))
  for (let ring = 1; ring <= s; ring++) {
    let best: Footing | null = null
    for (let dz = -ring; dz <= ring; dz++) {
      for (let dx = -ring; dx <= ring; dx++) {
        // The ring's edge only — inner cells were covered by an earlier, nearer ring.
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue
        const cx = x + dx, cz = z + dz
        const span = footingSpan(cx, cz, seed, cfg.radius, hcfg, heightAt)
        if (span > cfg.maxSpan) continue
        const moved = Math.hypot(dx, dz)
        // Ties break on true distance, then on a fixed order, so the result is deterministic.
        if (!best || moved < best.moved || (moved === best.moved && span < best.span)) {
          best = { x: cx, z: cz, span, ok: true, moved }
        }
      }
    }
    if (best) return best
  }
  // ⚠ Fail OPEN — see the header. The caller still gets a placement.
  return { x, z, span: here, ok: false, moved: 0 }
}
