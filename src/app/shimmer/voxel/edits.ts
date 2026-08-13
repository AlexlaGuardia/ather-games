// Player edits — the only thing the world actually stores.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Where the bytes physically
// live (IndexedDB, a file, a server) is the host's problem; what an edit IS belongs here.
//
// ── ★ THE DELIBERATE DIVERGENCE FROM MOJANG ─────────────────────────────────────────────────
// Minecraft writes every generated chunk to disk in full, forever, touched or not. We do the
// opposite, and it was ruled in WORLDGEN-RESEARCH before any of this existed: **a column is stored
// only if it holds a player edit, and absence means "pure procedural, regenerate."**
//
// That is affordable for us and not for them because our generator is cheap, deterministic and
// order-independent — the same seed and coordinate always rebuild the same column, so the world
// itself needs no storage at all. Only the difference between what the generator said and what the
// player did has to survive.
//
// The practical consequence is worth stating: walking a thousand columns costs ZERO bytes. A save
// grows with what you BUILD, not with where you have been.

import { Column, SECTION } from './column'

/**
 * ★ BUMP THIS WHENEVER GENERATION CHANGES THE WORLD.
 *
 * An edit is a diff against generated terrain, so it is only meaningful against the generator that
 * produced that terrain. Retune the height spline and a saved "I removed this block" may now point
 * at a block that was never there — a hole in mid-air, or a door opening into rock.
 *
 * Storing the version does not FIX that (nothing can, in general — the research flagged it as ours
 * to solve and left it open). What it does is make the mismatch DETECTABLE instead of silent, so a
 * loader can warn, migrate, or refuse rather than quietly producing a broken world.
 */
// v2 (2026-08-07): per-item seeds now go through `mixSeed`. That fixed a real distribution bug
// (see noise.ts) but it also MOVES EVERY CARVE, ORE VEIN AND TREE — which is exactly the case this
// constant exists for. A v1 save's edits were diffed against a world that no longer exists.
// v3: valley-floor shaping + woodland mask (2026-08-07) — the surface moved, so v2 edits may sit
// above or below the ground they were made on. The warning is honest; the edits still apply.
// v4: the biome layer (2026-08-07) — grey surfaces appear and species weights shifted, so a v3
// edit's recorded "generated" baseline can disagree with what now generates there.
// v5: the plains pass (2026-08-07 eve) — a flatness field benches the base and kills ridges over
// ~a third of the country, so v4 edits can sit metres above or below the new ground.
// v6: ruin sites (2026-08-07 late) — structures generate on greyfield pads; a v5 edit could sit
// inside ground a ruin now occupies.
// v7: rivers (2026-08-07 late) — the weirdness zero-line carves a channel; v6 edits along valley
// centres can now sit in the water or above the carved bed.
// v8: open country (2026-08-07 late) — ridge wavelength 150→340, relief gathered into ranges;
// most hills moved, so v7 edits on any slope are likely mid-air or buried now.
// v9: un-slice (2026-08-07 late) — base-field warps 4/3 → 1.2; coastlines and uplands moved.
// v8 shipped and was WALKED before this landed, so it gets its own number.
// v10: the water table (2026-08-07 late) — river/pond water fills to a coarse lattice level
// instead of per-column banks−1, so water blocks moved anywhere a channel or pool exists.
// v11: the rim clamp (2026-08-07 late) — water may not stand above adjacent dry ground; the
// standing walls v10 could build are gone, and water near shorelines moved down.
// v12: land-around-water (2026-08-07 late) — inside the river band the TERRAIN anchors to the
// water table (banks/levees/gorges); every riverside surface moved.
// v13: vertical rebalance (2026-08-08) — sea 140→100, datum 160→120; the whole surface moved
// down 40 and every shoreline redrew.
// v14: the Springs mountain (2026-08-08) — mana-springs lifts a terraced massif (lift 64,
// benchK 2, reliefK 0) with hot-spring pools sunk into the flats; every column in the Springs
// ellipse moved, nothing outside it did.
// 14 → 15 (2026-08-11): terrain changed three times in one day — slumped lips, ground cover as
// voxels above the surface, and lips becoming slab MATERIALS. Old edits still apply (they are
// absolute materials at fixed indices), but a save from before today no longer describes the same
// world, and `isStale` exists precisely so the player is told rather than left to notice.
// 15 → 16 (2026-08-13): the crown became a cluster of lobes. Every blob-species canopy changed
// shape — satellites hung below the main lobe, a warped radius, ~17% more leaf voxels — so any
// edit a player made inside or against a canopy now sits against different foliage. Terrain did
// not move; only the trees did.
//
// ⚠ I SHIPPED THAT CHANGE WITHOUT BUMPING THIS, and the bump is the entire point of the constant.
// The generator moved under saved edits for most of a day and nothing told anybody. Trunk geometry
// changed too (the root flare) but that one is RENDER-ONLY and correctly needs no bump — which is
// exactly the distinction that makes this easy to forget: two tree changes in one session, one of
// them version-affecting and one not.
export const GENERATOR_VERSION = 16

/**
 * One column's edits: packed local index → material.
 *
 * A Map rather than a list, because editing the same voxel twice must collapse to one entry. A list
 * would grow forever while a player fiddles with the same doorway.
 */
export type ColumnEdits = Map<number, number>

/** Packed local index within a full-height column. Mirrors `Section.idx` extended across sections. */
export const editIndex = (x: number, y: number, z: number): number =>
  (y * SECTION + z) * SECTION + x

export const unpackIndex = (i: number): { x: number; y: number; z: number } => ({
  x: i % SECTION,
  z: Math.floor(i / SECTION) % SECTION,
  y: Math.floor(i / (SECTION * SECTION)),
})

/**
 * Record an edit, given what the GENERATOR would have put there.
 *
 * ★ AN EDIT THAT RESTORES THE ORIGINAL IS DELETED, NOT STORED. Mine a block and put it back and the
 * save returns to empty — because the diff is against generated terrain, and "same as generated" is
 * not a difference. Without this a player who tidies up leaves a file full of no-ops, and a column
 * that is byte-identical to procedural output still costs storage forever.
 */
export function recordEdit(edits: ColumnEdits, index: number, material: number, generated: number): void {
  if (material === generated) edits.delete(index)
  else edits.set(index, material)
}

/** Apply a column's edits over freshly generated terrain. Idempotent: applying twice changes nothing. */
export function applyEdits(col: Column, edits: ColumnEdits | undefined): void {
  if (!edits || edits.size === 0) return
  for (const [i, mat] of edits) {
    const { x, y, z } = unpackIndex(i)
    if (y < 0 || y >= col.sections.length * SECTION) continue   // a stale save must not throw
    const s = (y / SECTION) | 0
    col.sections[s].set(x, y - s * SECTION, z, mat)
  }
}

// ── serialisation ────────────────────────────────────────────────────────────────────────────
// Two parallel typed arrays rather than JSON: they survive structuredClone into IndexedDB with no
// parse step, and an edit is 6 bytes instead of ~20 characters.

export interface PackedEdits {
  version: number
  idx: Uint32Array
  mat: Uint16Array
}

export function packEdits(edits: ColumnEdits): PackedEdits {
  const n = edits.size
  const idx = new Uint32Array(n)
  const mat = new Uint16Array(n)
  let i = 0
  for (const [k, v] of edits) { idx[i] = k; mat[i] = v; i++ }
  return { version: GENERATOR_VERSION, idx, mat }
}

export function unpackEdits(p: PackedEdits | undefined | null): ColumnEdits {
  const out: ColumnEdits = new Map()
  if (!p || !p.idx || !p.mat) return out
  const n = Math.min(p.idx.length, p.mat.length)
  for (let i = 0; i < n; i++) out.set(p.idx[i], p.mat[i])
  return out
}

/**
 * Is this save from a different generator than the one running?
 *
 * Deliberately a QUESTION, not an action. Whether a mismatch means warn, migrate or discard is a
 * product decision, and burying it in a loader is how a player silently loses a house.
 */
export const isStale = (p: PackedEdits | undefined | null): boolean =>
  !!p && p.version !== GENERATOR_VERSION
