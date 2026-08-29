// A BLUEPRINT — a bounded lump of authored voxels, saved by hand and stamped by the world.
//
// ⚠⚠⚠ IT IS CALLED A BLUEPRINT BECAUSE "STRUCTURE" WAS ALREADY TAKEN TWICE, AND FINDING THAT OUT
// COST A FILE (2026-08-29). This started as `voxel/structures.ts` with a `/shimmer/save-structure`
// route writing into `data/structures/` — and ALL THREE already existed, for a completely different
// system: `world/structures.ts` is 2D TILE GROUPS (cols/rows of tile indices, stamped onto a zone by
// `dev/editors/StructureBuilder`), with `engine/structures.ts` beside it. The route was overwritten
// before anyone looked at it; git had it, so nothing was lost.
//
// ★★ THE NEAR-MISS WAS THE SHARED DATA DIRECTORY, NOT THE FILE. Two formats writing `.json` into one
// folder, each listing that folder and parsing every file as its own type — the 2D editor would have
// shown voxel blueprints as broken tile groups and neither side would have said why. So the names are
// disjoint at every layer (`blueprints.ts`, `/shimmer/save-blueprint`, `data/blueprints/`) and
// `blueprints.test.ts` asserts the two systems share no directory and no route.
//
// ★ Alex's word for the page is still "structure worktable" — that is the UI's vocabulary, and the
// artifact it writes is a blueprint.
//
// ★ PURE CORE. No react, no three, no fs. It knows about cells, bounds and materials; it does not
// know what a house is, what a worktable is, or how anything is drawn. The editor (`dev/worktable`)
// and the save route both go through here, so there is exactly one definition of what a structure IS.
//
// ── ★★★ WHY THIS EXISTS (Alex, 2026-08-29) ────────────────────────────────────────────────────
// *"a demo space where you can view independant structures .. if we wanted to build houses here we
// can not only view but build them in an isolated enviroment that you can see and edit at .. a kind
// of structure worktable."* Every judgement on the gate station so far was made from ASCII and
// arithmetic, and `dev/court` fixed the LOOKING half for one specific code-generated building. This
// is the other half: structures a human BUILDS, saved as data, which the world can then place.
//
// ⚠ THIS IS NOT `PieceDef`, AND THEY MUST NOT BE CONFLATED. A `PieceDef` (`pieces.ts`) is a single
// craftable object in the build-mode vocabulary — a door, a beam — with a cost, a footprint and
// collision rules. A `BlueprintDef` is an ARRANGEMENT of raw blocks: a whole cottage. Pieces are the
// bricks; structures are the buildings. A structure may one day carry pieces as well as blocks, and
// when it does that is a new FIELD here, never a merge of the two types.
//
// ── ★★ THE STORED BOUNDS ARE A MIRROR, SO THEY ARE CHECKED RATHER THAN TRUSTED ────────────────
// `w/h/d` are written into the file because a listing wants them without parsing every cell. That
// makes them a hand-kept copy of something the cells already say, which is the shape this codebase
// has paid for repeatedly — a copy and its source agree right up until they do not, and agreement
// between them is not evidence about either. So `parseBlueprint` DERIVES the bounds and refuses a
// file whose stored bounds disagree. The mirror is allowed to exist; it is not allowed to be
// believed.
import { blockDef } from './registry'
import { MAT } from './depth'

/** One block of a structure, in structure-local coordinates. */
export interface BlueprintCell { x: number; y: number; z: number; m: number }

/**
 * A saved structure, as it sits on disk.
 *
 * ⚠ `cells` IS A FLAT QUAD ARRAY — `[x, y, z, m, x, y, z, m, ...]` — and the layout is written down
 * exactly once, here, with `blueprintCells` / `packCells` as the only two things that know it. Four
 * numbers per block rather than four keys makes a two-thousand-block cottage a readable file instead
 * of an eighty-kilobyte one. ★ Nothing else may index this array directly; a second reader of a
 * packed layout is a second definition of the format.
 */
export interface BlueprintDef {
  id: string
  name: string
  /** Derived bounds, in blocks. See the note above on why these are checked and not trusted. */
  w: number; h: number; d: number
  cells: number[]
}

/** Characters allowed in an id — it becomes a filename, so this is a path guard as much as a style. */
export const SAFE_BLUEPRINT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** The largest structure that may be saved, per axis. A cottage is ~12; this is a sanity ceiling. */
export const BLUEPRINT_MAX_SPAN = 128

/** Unpack the flat quad array. The ONLY reader of the layout. */
export function blueprintCells(s: BlueprintDef): BlueprintCell[] {
  const out: BlueprintCell[] = []
  for (let i = 0; i + 3 < s.cells.length; i += 4) {
    out.push({ x: s.cells[i], y: s.cells[i + 1], z: s.cells[i + 2], m: s.cells[i + 3] })
  }
  return out
}

/** Pack cells into the flat quad array. The ONLY writer of the layout. */
export function packCells(cells: BlueprintCell[]): number[] {
  const out: number[] = []
  for (const c of cells) out.push(c.x, c.y, c.z, c.m)
  return out
}

/**
 * Move a loose pile of world cells into structure-local space: min corner to the origin, AIR
 * dropped, later writes winning at a repeated coordinate, and a stable order.
 *
 * ★ ORDERED y-then-z-then-x SO A DIFF IS READABLE. These files live in git and a human reviews
 * them; an insertion-ordered cell list reshuffles every time the author works in a different sequence
 * and the diff stops carrying information. Sorting costs nothing at authoring scale.
 *
 * ⚠ AIR IS DROPPED RATHER THAN STORED. A structure is what it IS, not what it is not — storing air
 * would make a stamped structure carve holes in whatever it lands on, which is a completely
 * different feature (a "clear this volume" mask) and wants to be asked for on purpose.
 */
export function normalizeCells(cells: BlueprintCell[]): BlueprintCell[] {
  const solid = cells.filter(c => c.m !== MAT.AIR)
  if (!solid.length) return []
  const minX = Math.min(...solid.map(c => c.x))
  const minY = Math.min(...solid.map(c => c.y))
  const minZ = Math.min(...solid.map(c => c.z))
  // Last write wins, which is what an editor session means by placing twice on one cell.
  const at = new Map<string, BlueprintCell>()
  for (const c of solid) {
    const k = `${c.x - minX},${c.y - minY},${c.z - minZ}`
    at.set(k, { x: c.x - minX, y: c.y - minY, z: c.z - minZ, m: c.m })
  }
  return [...at.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
}

/** Bounds of a normalized cell list, derived. Never read off a file. */
export function boundsOf(cells: BlueprintCell[]): { w: number; h: number; d: number } {
  if (!cells.length) return { w: 0, h: 0, d: 0 }
  return {
    w: Math.max(...cells.map(c => c.x)) + 1,
    h: Math.max(...cells.map(c => c.y)) + 1,
    d: Math.max(...cells.map(c => c.z)) + 1,
  }
}

/** Build a `BlueprintDef` from loose cells. The bounds come out of the cells, so they cannot lie. */
export function makeBlueprint(id: string, name: string, cells: BlueprintCell[]): BlueprintDef {
  const norm = normalizeCells(cells)
  const b = boundsOf(norm)
  return { id, name, w: b.w, h: b.h, d: b.d, cells: packCells(norm) }
}

/**
 * Every reason a candidate is not a structure, as sentences. Empty means it is one.
 *
 * ⚠ IT RETURNS THE REASONS, NOT A BOOLEAN. A validator that answers `false` invites the caller to
 * report "invalid" and invites the author to guess; this codebase's own rule is to assert the NAME
 * of what is wrong rather than a tally. The save route hands these straight back to the editor.
 */
export function blueprintProblems(s: unknown): string[] {
  const p: string[] = []
  if (typeof s !== 'object' || s === null) return ['not an object']
  const d = s as Partial<BlueprintDef>

  if (typeof d.id !== 'string' || !SAFE_BLUEPRINT_ID.test(d.id)) {
    p.push(`id must match ${SAFE_BLUEPRINT_ID} (got ${JSON.stringify(d.id)})`)
  }
  if (typeof d.name !== 'string' || !d.name.trim()) p.push('name is empty')
  if (!Array.isArray(d.cells)) return [...p, 'cells is not an array']
  if (d.cells.length === 0) p.push('a structure with no blocks is not a structure')
  if (d.cells.length % 4 !== 0) p.push(`cells must be a flat quad array, length ${d.cells.length} is not a multiple of 4`)
  if (d.cells.some(n => !Number.isInteger(n))) p.push('every packed value must be an integer')
  if (p.length) return p

  const cells = blueprintCells(d as BlueprintDef)
  if (cells.some(c => c.x < 0 || c.y < 0 || c.z < 0)) p.push('cells must be normalized to a non-negative origin')

  // ★ THE MIRROR CHECK. Stored bounds vs bounds derived from the blocks themselves — see the header.
  const b = boundsOf(cells)
  if (d.w !== b.w || d.h !== b.h || d.d !== b.d) {
    p.push(`stored bounds ${d.w}x${d.h}x${d.d} disagree with the blocks, which span ${b.w}x${b.h}x${b.d}`)
  }
  if (b.w > BLUEPRINT_MAX_SPAN || b.h > BLUEPRINT_MAX_SPAN || b.d > BLUEPRINT_MAX_SPAN) {
    p.push(`spans ${b.w}x${b.h}x${b.d}, over the ${BLUEPRINT_MAX_SPAN} ceiling`)
  }

  // ⚠ A MATERIAL THE REGISTRY DOES NOT KNOW RENDERS AS SOMETHING, AND THAT SOMETHING IS A LIE. The
  // court preview shipped a whole tower in dirt brown from one guessed id; a saved file carrying an
  // unknown material would do it permanently and in git.
  const unknown = [...new Set(cells.map(c => c.m).filter(m => !blockDef(m)))]
  if (unknown.length) p.push(`unknown material id(s): ${unknown.join(', ')}`)
  if (cells.some(c => c.m === MAT.AIR)) p.push('air is not stored — see normalizeCells')

  const seen = new Set<string>()
  for (const c of cells) {
    const k = `${c.x},${c.y},${c.z}`
    if (seen.has(k)) { p.push(`two blocks share the cell ${k}`); break }
    seen.add(k)
  }
  return p
}

/**
 * Parse a file's contents into a structure, or throw with every reason at once.
 *
 * ★ THROWS RATHER THAN RETURNING null. A structure that silently fails to load leaves the world
 * placing nothing where a building should be, which reads as a worldgen bug somewhere else entirely.
 */
export function parseBlueprint(raw: string): BlueprintDef {
  let json: unknown
  try { json = JSON.parse(raw) } catch (e) {
    throw new Error(`structure is not JSON: ${e instanceof Error ? e.message : String(e)}`)
  }
  const problems = blueprintProblems(json)
  if (problems.length) throw new Error(`invalid structure:\n  - ${problems.join('\n  - ')}`)
  return json as BlueprintDef
}

/** Place a structure into the world: its local cells, offset to a world origin. */
export function stampCells(s: BlueprintDef, at: { x: number; y: number; z: number }): BlueprintCell[] {
  return blueprintCells(s).map(c => ({ x: c.x + at.x, y: c.y + at.y, z: c.z + at.z, m: c.m }))
}

/**
 * A structure as it is written to disk.
 *
 * ★★ IT LIVES HERE, NOT IN THE ROUTE, BECAUSE IT IS PART OF THE FORMAT. The save route used to
 * build this string by concatenation, which put a second definition of the file layout in a file
 * whose job is HTTP — and a serializer nobody can round-trip in a test is a format nobody can trust.
 * `parseBlueprint(serializeBlueprint(s))` is asserted, so the writer and the reader cannot drift.
 *
 * ⚠ CELLS ON ONE LINE, ON PURPOSE. A human reviews these diffs in git; one number per line turns a
 * cottage into a two-thousand-line file that nobody reads and every edit rewrites.
 */
export function serializeBlueprint(s: BlueprintDef): string {
  return `{\n  "id": ${JSON.stringify(s.id)},\n  "name": ${JSON.stringify(s.name)},\n` +
    `  "w": ${s.w}, "h": ${s.h}, "d": ${s.d},\n  "cells": [${s.cells.join(',')}]\n}\n`
}
