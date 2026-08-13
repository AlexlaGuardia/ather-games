// Smooth canopy renderer — the same crowns the voxel world grows, drawn as geometry instead of cells.
//
// ★ HOST SIDE. This file may import three; `voxel/` may not.
//
// ── ★ WHY THIS EXISTS: IT IS AN EXPERIMENT, AND IT IS SUPPOSED TO BE THROWN AWAY OR PROMOTED ────
// Alex, 2026-08-13: *"is it not possible to introduce 3dish models to our voxel world?"* The honest
// answer is yes — voxel3d is the same react-three-fiber canvas play3d is, and play3d already serves
// seven GLB props through drei's loader. But "possible" was never the interesting part. The
// interesting part is whether smooth foliage READS right standing in a blocky world, and no amount
// of arguing settles that. So: a flag, a picture, a decision.
//
// ── ★ THE ONE DESIGN RULE THAT MAKES IT A FAIR TEST ─────────────────────────────────────────────
// The smooth canopy is drawn at EXACTLY the lobes the generator wrote, out of the same `crownAt`
// the generator itself draws from. Not a similar shape, not a nicer shape — the same shape. So what
// is being judged is the MEDIUM (smooth vs blocky) and nothing else.
//
// The temptation was to reach for `public/models/flora/tree.glb`, which has been sitting in the repo
// since July. It is a two-material CONE, and our common species are broadleaf blobs — so it would
// have asked Alex to judge "cone vs blob" while believing he was judging "smooth vs blocky". A
// placeholder that changes the question is worse than no placeholder.
//
// ── ★ THE VOXELS ARE UNTOUCHED, WHICH IS THE WHOLE POINT ────────────────────────────────────────
// This is `flora-mesh.ts`'s bargain one level up: the world stays the source of truth and the
// renderer just draws it better. Every leaf is still a real voxel — choppable, decaying, saved,
// lighting the same. Turn the flag off and nothing about the world has changed. If this look wins,
// the next step is swapping this geometry for a GLB, which is one line here and nothing anywhere
// else — the same seam `piece-mesh.ts` was built with.
//
// ── ★ ONE InstancedMesh PER SPECIES, NON-NEGOTIABLE (piece-mesh's rule) ─────────────────────────
// A radius-12 view holds a few hundred trees at three or four lobes each. A mesh per lobe is the
// allocation that got this page blocked from creating a WebGL context on 2026-08-06.

import * as THREE from 'three'
import { SPECIES, treeStartsAt, treeScanRadius, crownAt, DEFAULT_TREES, type TreeSpecies } from '../voxel/trees'
import { MATERIAL_COLOR } from './attrs'

const SECTION = 16

/**
 * Instance cap per species. Goldwood is 58% of the forest and carries 3-4 lobes a tree, so it is the
 * one that decides this number; the sync stops quietly at the cap rather than growing a buffer
 * mid-frame. Sized against a radius-12 view with headroom, not against a guess.
 */
const CAP = 6000

/**
 * Is this tree still standing? The renderer must not draw a crown over a tree the player felled.
 *
 * ⚠ THIS IS A CHEAP TEST AND IT IS DELIBERATELY THE CHEAP ONE. It asks whether the crown's own
 * centre cell is still wood — one voxel read per tree, no per-lobe scan, no bookkeeping. It catches
 * the case that matters (the canopy is gone, or the top of the trunk is) and it MISSES the case
 * where somebody chops the base and leaves the crown floating. That is the correct trade for a
 * flag-gated experiment: a wrong answer costs one stale crown, and finding out whether the look is
 * worth having costs nothing.
 *
 * ★ IF THIS GETS PROMOTED, THIS FUNCTION IS THE PART THAT NEEDS THE REAL WORK — an intact bit per
 * tree, invalidated on any edit inside the crown's box, so the model drops the instant the tree
 * stops being the tree the generator described. Do not ship the cheap version as if it were done.
 */
export type WoodProbe = (x: number, y: number, z: number) => boolean

export interface CanopyRenderer {
  group: THREE.Group
  /** Rebuild instance buffers from the loaded columns. Cheap enough to run on the same beat as flora. */
  sync(cols: { key: string; x0: number; z0: number }[], seed: number,
       groundAt: (x: number, z: number) => number | null, isWood: WoodProbe): void
  dispose(): void
}

export function createCanopyRenderer(): CanopyRenderer {
  const group = new THREE.Group()
  group.name = 'smooth-canopy'

  // ⚠ DETAIL 2, NOT 1. A detail-1 icosahedron is 80 faces and reads as a faceted low-poly gem —
  // which is its own art style and not the question being asked. The question is whether SMOOTH
  // foliage sits right next to blocky ground, so the sphere has to actually look smooth.
  const geo = new THREE.IcosahedronGeometry(1, 2)

  const meshes = new Map<string, THREE.InstancedMesh>()
  for (const sp of SPECIES) {
    const mat = new THREE.MeshLambertMaterial({ color: MATERIAL_COLOR[sp.leaves] ?? 0x5aa845 })
    const im = new THREE.InstancedMesh(geo, mat, CAP)
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    im.count = 0
    im.frustumCulled = false          // instances span the whole load radius; one bounds test is wrong
    meshes.set(sp.id, im)
    group.add(im)
  }

  // Reused across syncs — allocating a Matrix4 per lobe is the same mistake as a mesh per lobe,
  // one order of magnitude down.
  const m4 = new THREE.Matrix4()
  const quat = new THREE.Quaternion()
  const euler = new THREE.Euler()
  const pos = new THREE.Vector3()
  const scale = new THREE.Vector3()

  function sync(
    cols: { key: string; x0: number; z0: number }[], seed: number,
    groundAt: (x: number, z: number) => number | null, isWood: WoodProbe,
  ): void {
    const counts = new Map<string, number>()
    for (const sp of SPECIES) counts.set(sp.id, 0)
    // Diagnostics, not decoration: when a canopy fails to appear the picture cannot tell you
    // whether the trees were never rolled, had no loaded ground, or were rejected as felled.
    // Read with `WORLD_LOG='\[canopy\]'` on scripts/world-shot.mts.
    let rolled = 0, noGround = 0, notWood = 0

    // ★ THE SAME SCAN THE PLANTER USES. A crown rooted in a neighbouring column reaches into this
    // one, so the renderer has to look as far out as the generator does or trees pop in at the load
    // edge a column late. `treeScanRadius` is the single definition of how far that is.
    const rad = treeScanRadius(SECTION, DEFAULT_TREES)
    const seen = new Set<string>()

    for (const col of cols) {
      const c0x = Math.floor(col.x0 / SECTION), c0z = Math.floor(col.z0 / SECTION)
      for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
        for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
          // Neighbouring columns overlap in their scan boxes; without this every tree near a border
          // is drawn several times, which is invisible until you notice the canopy is too dark.
          const ck = `${cx},${cz}`
          if (seen.has(ck)) continue
          seen.add(ck)

          for (const st of treeStartsAt(seed, cx, cz, SECTION, DEFAULT_TREES)) {
            rolled++
            const h = groundAt(st.x, st.z)
            if (h === null) { noGround++; continue }       // column not loaded — no ground to stand on
            const crown = crownAt(st, h)
            if (!crown) continue
            if (!isWood(crown.x, crown.y, crown.z)) { notWood++; continue }   // felled, or never planted

            const im = meshes.get(st.species.id)!
            let n = counts.get(st.species.id)!
            for (const lo of crown.lobes) {
              if (n >= CAP) break
              // ★ VOXEL CENTRES, NOT CORNERS. A voxel at cell (x,y,z) occupies the unit box whose
              // MINIMUM corner is (x,y,z), so its centre is +0.5 on every axis. Skip this and the
              // whole canopy sits half a block low and half a block north-west of its own trunk —
              // a drift small enough to look like a tuning problem rather than an off-by-a-half.
              pos.set(crown.x + lo.dx + 0.5, crown.y + lo.dy + 0.5, crown.z + lo.dz + 0.5)
              // The lobe's own ellipsoid, read straight off the generator's convention: the
              // vertical semi-axis is r / sqrt(squash). A layered tier reports a large squash and
              // comes out as the disc it is.
              scale.set(lo.r, lo.r / Math.sqrt(lo.squash), lo.r)
              // A rotation off the lobe's seed, so several hundred spheres of the same radius do
              // not all present the same silhouette to the camera. Free — it rides the matrix.
              euler.set((lo.seed & 255) / 40, ((lo.seed >> 8) & 255) / 40, ((lo.seed >> 16) & 255) / 40)
              quat.setFromEuler(euler)
              im.setMatrixAt(n, m4.compose(pos, quat, scale))
              n++
            }
            counts.set(st.species.id, n)
          }
        }
      }
    }

    let lobes = 0
    for (const sp of SPECIES) {
      const im = meshes.get(sp.id)!
      im.count = counts.get(sp.id)!
      lobes += im.count
      im.instanceMatrix.needsUpdate = true
    }
    console.log(`[canopy] cols=${cols.length} rolled=${rolled} noGround=${noGround} notWood=${notWood} lobes=${lobes}`)
  }

  function dispose(): void {
    geo.dispose()
    for (const im of meshes.values()) {
      (im.material as THREE.Material).dispose()
      im.dispose()
    }
    meshes.clear()
    group.clear()
  }

  return { group, sync, dispose }
}

/** Re-exported so the caller does not have to reach into `voxel/` for the one type it passes back. */
export type { TreeSpecies }
