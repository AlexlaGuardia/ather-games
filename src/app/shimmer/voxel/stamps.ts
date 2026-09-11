// A STAMP — a saved blueprint standing at a fixed place in the world.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. It knows cells, bounds,
// rotations and a height field; it does not know what a worktable is or where a file lives.
//
// ── ★★★ WHY THIS EXISTS (2026-09-11, Alex: "how our buildings get built") ─────────────────────
// `STRUCTURE-LAYER.md § 6` promised that anything built by hand becomes something the world can
// place. Half of that shipped 08-29: the worktable (`dev/worktable`) saves a `BlueprintDef` to
// `data/blueprints/`. The other half never did — `grep` for a consumer of `stampCells` found only
// the module that defines it. Every building standing in the world today is code-generated (the
// jigsaw ruins and warrens, the bridges, the gate station), and the one saved blueprint sat on disk
// for thirteen days with nothing reading it. This is the missing half: a blueprint, a place, a
// rotation, and the world column writes it the same way it writes a ruin.
//
// ── THE MODEL ─────────────────────────────────────────────────────────────────────────────────
// · A `Stamp` is (blueprint, x, z, rot, sink). `x`/`z` are the world column of the ROTATED box's
//   min corner, so the box a stamp covers is exactly `[x, x+w') × [z, z+d')` with w'/d' swapped for
//   odd rotations. Nothing about a stamp is hashed from the seed — placement is an authored fact,
//   which is what makes "Alex places the building" true (map placement is his call, not mine).
// · THE FLOOR IS READ OFF THE GROUND, NOT STORED. Blueprint y=0 lands at (HIGHEST surface over
//   the footprint) + 1 − sink, so nothing is ever buried: on a stepped pad the building stands
//   proud of the low side and the plinth fills under it. A blueprint knows nothing about altitude and must not: the same cottage
//   stands on the glade at 128 and on a Wilds bench at 140. `sink` is the per-placement knob for a
//   blueprint whose bottom layer IS the floor (the sparring ring's path tiles are meant at grade,
//   not one step up like a stage): sink 1 puts that layer in the surface block.
// · THE BOX IS AUTHORITATIVE ABOVE GROUND. Inside the rotated box, every cell above the local
//   surface that the blueprint does not name becomes AIR. A blueprint stores solids only, so its
//   interior air is implied — and a trunk the vegetation stage planted where the kitchen goes has
//   to leave. Below the local surface nothing is cleared: a sunk layer's gaps must not become
//   holes in the ground.
// · A PLINTH, FROM THE BLUEPRINT'S OWN MATERIAL. Under every solid cell of the bottom layer, the
//   column is filled from the cell down to the surface with that cell's material. The floor is read
//   at the HIGHEST point of the pad, so on a pad with one step in it the high side sits flush and
//   the low side gets a course of its own floor beneath it — Minecraft's village floor projection, and
//   the thing that makes "no terrain flattening" survive contact with a real pad. It is not a
//   substitute for placing on a pad; `placed.test.ts` refuses a placement whose pad spans more than
//   `STAMP_PAD_SPAN`.
// · PIECES RIDE ALONG AS `GenPiece`s, the proven worldgen-piece path (`holds.ts`, `bridges.ts`):
//   the host's `applyGenPieces` writes their occupancy and syncs the renderer. Their rotation
//   composes with the stamp's (`rotatePiece`), and `stamps.test.ts` proves the composed placement
//   covers exactly the cells the unrotated piece covered, rotated — for every piece, every rotation.
//   ⚠ A piece's occupancy is written by the column its ORIGIN cell is in, and clipped there
//   (`applyGenPieces`), so a multi-cell piece straddling a column seam loses the far cells. Every
//   piece in the catalogue is 1×h×1 today, so nothing straddles; the day one is wider this is the
//   line to read.
//
// ── ★ WHO IS ALLOWED TO CALL THIS ─────────────────────────────────────────────────────────────
// `generateColumn` (the Vegetation stage, LAST, so a building punches through what the fringe
// planted) via `cfg.stamps`. `DEFAULT_COLUMN.stamps` is EMPTY on purpose: the table of what stands
// where lives with the blueprints (`data/blueprints/placed.ts`), outside the core, and the worker
// hands it in. A pure oracle calling `generateColumn` with the default sees no stamps — that is a
// property of the default, and `placed.test.ts` reads the worker source to prove the world does.

import type { BlueprintDef, BlueprintCell } from './blueprints'
import { blueprintCells } from './blueprints'
import { pieceDef, cellsOf, rotateCell, type Placement, type Rotation, type PieceDef } from './pieces'
import type { GenPiece } from './holds'
import { AIR, type Section } from './section'

export interface Stamp {
  /** Unique across the table — the gen-key prefix for its pieces. */
  id: string
  bp: BlueprintDef
  /** World column of the ROTATED box's min corner. */
  x: number
  z: number
  rot: Rotation
  /** How many bottom layers sit IN the ground. 0 (default) = the blueprint stands on the surface. */
  sink?: number
}

/** A placement's pad may step at most this much across the footprint. Beyond it, the plinth is doing the terrain's job. */
export const STAMP_PAD_SPAN = 1

/** Rotated footprint of a blueprint: w/d swap for odd rotations, h is untouched. */
export function stampBox(s: Stamp): { w: number; h: number; d: number } {
  const odd = (s.rot & 1) === 1
  return { w: odd ? s.bp.d : s.bp.w, h: s.bp.h, d: odd ? s.bp.w : s.bp.d }
}

/** One blueprint-local cell, rotated about the blueprint's own box. Same rule as `rotateCell`. */
export function rotateLocal(x: number, z: number, bp: { w: number; d: number }, rot: Rotation): { x: number; z: number } {
  return rotateCell(x, z, { w: bp.w, d: bp.d } as PieceDef, rot)
}

/**
 * The world y that blueprint y=0 lands on. Read at the HIGHEST point of the pad, so the plinth
 * (below) is the only thing that ever meets uneven ground — a building is never buried.
 */
export function stampFloor(s: Stamp, surfaceAt: (x: number, z: number) => number): number {
  const box = stampBox(s)
  let mx = -Infinity
  for (let dz = 0; dz < box.d; dz++) {
    for (let dx = 0; dx < box.w; dx++) {
      const h = surfaceAt(s.x + dx, s.z + dz)
      if (h > mx) mx = h
    }
  }
  return (mx === -Infinity ? 0 : mx) + 1 - (s.sink ?? 0)
}

/** Highest minus lowest surface across the footprint — the number `STAMP_PAD_SPAN` bounds. */
export function stampPadSpan(s: Stamp, surfaceAt: (x: number, z: number) => number): number {
  const box = stampBox(s)
  let mn = Infinity, mx = -Infinity
  for (let dz = 0; dz < box.d; dz++) {
    for (let dx = 0; dx < box.w; dx++) {
      const h = surfaceAt(s.x + dx, s.z + dz)
      if (h < mn) mn = h
      if (h > mx) mx = h
    }
  }
  return mx === -Infinity ? 0 : mx - mn
}

/** Does the stamp's box touch this column? Cheap bbox, callers gate on it. */
export function stampTouches(s: Stamp, ox: number, oz: number, size: number): boolean {
  const box = stampBox(s)
  return !(s.x + box.w <= ox || s.x >= ox + size || s.z + box.d <= oz || s.z >= oz + size)
}

/** Every solid cell of the stamp in WORLD coordinates (rotated, translated, floored). */
export function stampWorldCells(s: Stamp, floor: number): BlueprintCell[] {
  return blueprintCells(s.bp).map(c => {
    const r = rotateLocal(c.x, c.z, s.bp, s.rot)
    return { x: s.x + r.x, y: floor + c.y, z: s.z + r.z, m: c.m }
  })
}

/**
 * A blueprint piece, rotated with the blueprint and translated into the world.
 *
 * ★ THE ORIGIN IS THE MIN CORNER OF THE ROTATED FOOTPRINT, NOT THE ROTATED ORIGIN. `cellsOf` lays a
 * piece out from its origin toward +x/+z at every rotation, so rotating the origin cell alone would
 * put a wide piece one cell off. Rotating every footprint cell and taking the corner is right by
 * construction; the guard proves the composed placement covers exactly the rotated cells.
 */
export function rotatePiece(p: Placement, bp: { w: number; d: number }, rot: Rotation): Placement {
  const def = pieceDef(p.pieceId)
  if (!def) return { ...p }
  let mx = Infinity, mz = Infinity
  for (const c of cellsOf(p, def)) {
    const r = rotateLocal(c.x, c.z, bp, rot)
    if (r.x < mx) mx = r.x
    if (r.z < mz) mz = r.z
  }
  return { ...p, x: mx, z: mz, rot: ((p.rot + rot) & 3) as Rotation }
}

/** The stamp's pieces as worldgen pieces, keyed `stamp:<id>:<index>`. */
export function stampGenPieces(s: Stamp, floor: number): GenPiece[] {
  return (s.bp.pieces ?? []).map((p, i) => {
    const r = rotatePiece(p, s.bp, s.rot)
    const g: GenPiece = { gen: `stamp:${s.id}:${i}`, pieceId: r.pieceId, x: s.x + r.x, y: floor + r.y, z: s.z + r.z, rot: r.rot }
    if (r.open) g.open = true
    return g
  })
}

/**
 * The pieces whose ORIGIN falls in this column. Mirrors `holdGenPiecesForCol` — the host concatenates
 * this ABOVE `applyGenPieces`'s early-out (`gen-pieces.test.ts` reads the call site).
 */
export function stampGenPiecesForCol(
  stamps: readonly Stamp[], cx: number, cz: number, size: number,
  surfaceAt: (x: number, z: number) => number,
): GenPiece[] {
  const x0 = cx * size, z0 = cz * size
  const out: GenPiece[] = []
  for (const s of stamps) {
    if (!stampTouches(s, x0, z0, size)) continue
    const floor = stampFloor(s, surfaceAt)
    for (const g of stampGenPieces(s, floor))
      if (g.x >= x0 && g.x < x0 + size && g.z >= z0 && g.z < z0 + size) out.push(g)
  }
  return out
}

/**
 * Write every stamp that touches this column into its sections. Same shape as `buildRuin`: a `put`
 * clipped to the column, so a building spanning four columns is written by four calls that agree,
 * because everything they read (the blueprint, the floor, the surface) is a pure function.
 *
 * Order within the box: clear above ground → blocks → plinth. Returns how many stamps touched.
 */
export function placeStamps(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number,
  stamps: readonly Stamp[], surfaceAt: (x: number, z: number) => number,
): number {
  const yTop = oy0 + sections.length * size
  const put = (wx: number, wy: number, wz: number, mat: number) => {
    if (wx < ox || wx >= ox + size || wz < oz || wz >= oz + size) return
    if (wy < oy0 || wy >= yTop) return
    const si = ((wy - oy0) / size) | 0
    const sec = sections[si]
    if (!sec) return
    sec.set(wx - ox, wy - oy0 - si * size, wz - oz, mat)
  }
  let touched = 0
  for (const s of stamps) {
    if (!stampTouches(s, ox, oz, size)) continue
    touched++
    const box = stampBox(s)
    const floor = stampFloor(s, surfaceAt)
    // The box, clipped to this column — the only cells this call may write.
    const x0 = Math.max(s.x, ox), x1 = Math.min(s.x + box.w, ox + size)
    const z0 = Math.max(s.z, oz), z1 = Math.min(s.z + box.d, oz + size)
    for (let z = z0; z < z1; z++) {
      for (let x = x0; x < x1; x++) {
        const surf = surfaceAt(x, z)
        for (let y = Math.max(floor, surf + 1); y < floor + box.h; y++) put(x, y, z, AIR)
      }
    }
    for (const c of stampWorldCells(s, floor)) {
      if (c.x < x0 || c.x >= x1 || c.z < z0 || c.z >= z1) continue
      put(c.x, c.y, c.z, c.m)
      if (c.y !== floor) continue
      const surf = surfaceAt(c.x, c.z)
      for (let y = floor - 1; y > surf; y--) put(c.x, y, c.z, c.m)
    }
  }
  return touched
}
