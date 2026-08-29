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
import { pieceDef, cellsOf, type Placement, type Rotation } from './pieces'

/** One block of a blueprint, in blueprint-local coordinates. */
export interface BlueprintCell { x: number; y: number; z: number; m: number }

/**
 * One PIECE of a blueprint — a door, a window, a roof slope — in blueprint-local coordinates.
 *
 * ★★ SAME SHAPE AS THE WORLD'S `Placement`, DELIBERATELY, AND NOT A SECOND TYPE FOR THE SAME THING.
 * The only difference is the coordinate space, so `stampPieces` is a translation and nothing else —
 * no field mapping, no defaults invented at the boundary. A blueprint piece that needed a different
 * shape from a placed piece would mean one of the two was wrong about what a placed piece IS.
 */
export type BlueprintPiece = Placement

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
  /** Derived bounds, in blocks — over the blocks AND every piece's footprint. Checked, not trusted. */
  w: number; h: number; d: number
  cells: number[]
  /**
   * Placed pieces — doorway, window, door, shutter, arch, gate, roof_slope, roof_cap, stair, beam,
   * fence, half_slab, bracket, hook. **The building vocabulary; blocks alone cannot make a building.**
   *
   * ⚠⚠ OPTIONAL, AND THAT IS THE SAVE-COMPAT STORY — the same reasoning `Placement.open` records.
   * Every blueprint written before pieces existed has no `pieces` key, `undefined` is falsy, and
   * `serializeBlueprint` OMITS the key when there are none. So an older file round-trips byte for
   * byte rather than being silently rewritten the first time something opens it. A required field,
   * or a default of `[]`, would change the meaning of stored data on read.
   */
  pieces?: BlueprintPiece[]
}

/** Characters allowed in an id — it becomes a filename, so this is a path guard as much as a style. */
export const SAFE_BLUEPRINT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/

/** The largest structure that may be saved, per axis. A cottage is ~12; this is a sanity ceiling. */
export const BLUEPRINT_MAX_SPAN = 128

/**
 * Every cell a placed piece occupies, asked of `pieces.ts` rather than re-derived here.
 *
 * ★★ `cellsOf` ALREADY KNOWS THE ROTATION MATHS AND THE PASSABLE CELLS. A second footprint
 * derivation in this file would be a hand-kept mirror of a rule that lives one module over — it
 * would agree right up until a piece's footprint changed, and then disagree silently about where a
 * building's bounds are. Returns [] for an unknown id; callers must have validated first.
 *
 * ⚠ EVERY cell, solid or not. A doorway's passable cells are still part of the building's FOOTPRINT
 * — the bounds have to cover the hole you walk through, or a blueprint reports a size that does not
 * contain the door in it.
 */
export function pieceFootprint(p: BlueprintPiece): { x: number; y: number; z: number }[] {
  const def = pieceDef(p.pieceId)
  return def ? cellsOf(p, def).map(c => ({ x: c.x, y: c.y, z: c.z })) : []
}

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
  return normalize(cells, []).cells
}

/**
 * Move a loose pile of blocks AND pieces into blueprint-local space together.
 *
 * ⚠⚠ THE MIN CORNER IS TAKEN OVER BOTH, AND NORMALIZING THEM SEPARATELY IS THE BUG THIS SHAPE
 * PREVENTS. Re-basing blocks on their own minimum and pieces on theirs slides the two apart by the
 * difference — a door that was in a wall ends up beside it, and nothing reports anything, because
 * each collection is internally perfect. They are one building; they get one origin.
 *
 * ★ AND A PIECE'S WHOLE FOOTPRINT COUNTS, not its origin cell. A roof slope whose origin sits inside
 * the blocks but which overhangs below them would otherwise be re-based to a negative y.
 */
export function normalize(cells: BlueprintCell[], pieces: BlueprintPiece[]):
  { cells: BlueprintCell[]; pieces: BlueprintPiece[] } {
  const solid = cells.filter(c => c.m !== MAT.AIR)
  const pts = [...solid, ...pieces.flatMap(pieceFootprint)]
  if (!pts.length) return { cells: [], pieces: [] }
  const minX = Math.min(...pts.map(c => c.x))
  const minY = Math.min(...pts.map(c => c.y))
  const minZ = Math.min(...pts.map(c => c.z))
  // Last write wins, which is what an editor session means by placing twice on one cell.
  const at = new Map<string, BlueprintCell>()
  for (const c of solid) {
    const k = `${c.x - minX},${c.y - minY},${c.z - minZ}`
    at.set(k, { x: c.x - minX, y: c.y - minY, z: c.z - minZ, m: c.m })
  }
  return {
    cells: [...at.values()].sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x),
    pieces: pieces
      .map(p => ({ ...p, x: p.x - minX, y: p.y - minY, z: p.z - minZ }))
      .sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x || a.pieceId.localeCompare(b.pieceId)),
  }
}

/** Bounds of a normalized cell list, derived. Never read off a file. */
export function boundsOf(cells: BlueprintCell[], pieces: BlueprintPiece[] = []): { w: number; h: number; d: number } {
  // ⚠ A PIECE'S FOOTPRINT IS PART OF THE BUILDING'S SIZE. Bounds taken over blocks alone report a
  // cottage that does not contain its own doorway, and the number is used to place the thing.
  const pts = [...cells, ...pieces.flatMap(pieceFootprint)]
  if (!pts.length) return { w: 0, h: 0, d: 0 }
  return {
    w: Math.max(...pts.map(c => c.x)) + 1,
    h: Math.max(...pts.map(c => c.y)) + 1,
    d: Math.max(...pts.map(c => c.z)) + 1,
  }
}

/** Build a `BlueprintDef` from loose cells. The bounds come out of the cells, so they cannot lie. */
export function makeBlueprint(
  id: string, name: string, cells: BlueprintCell[], pieces: BlueprintPiece[] = [],
): BlueprintDef {
  const n = normalize(cells, pieces)
  const b = boundsOf(n.cells, n.pieces)
  const out: BlueprintDef = { id, name, w: b.w, h: b.h, d: b.d, cells: packCells(n.cells) }
  // ⚠ THE KEY IS OMITTED WHEN EMPTY, not written as []. See `BlueprintDef.pieces`: a blueprint saved
  // before pieces existed must round-trip byte for byte, and `{...s, pieces: []}` is a different file.
  if (n.pieces.length) out.pieces = n.pieces
  return out
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
  // ⚠ THE EMPTY RULE SPANS BOTH NOW. A fence line or a lone arch is a legitimate blueprint with no
  // blocks at all, and the old wording would have refused it — a rule that was right when blocks
  // were the only content and became wrong the moment pieces arrived.
  if (d.cells.length === 0 && !(d.pieces ?? []).length) {
    p.push('a blueprint with no blocks and no pieces is not a blueprint')
  }
  if (d.cells.length % 4 !== 0) p.push(`cells must be a flat quad array, length ${d.cells.length} is not a multiple of 4`)
  if (d.cells.some(n => !Number.isInteger(n))) p.push('every packed value must be an integer')
  if (p.length) return p

  const cells = blueprintCells(d as BlueprintDef)
  if (cells.some(c => c.x < 0 || c.y < 0 || c.z < 0)) p.push('cells must be normalized to a non-negative origin')

  // ★ THE MIRROR CHECK. Stored bounds vs bounds derived from the blocks themselves — see the header.
  // ★ Blocks-only bounds are checked ONLY on a piece-less blueprint; with pieces the authoritative
  // check is the one below, over both. Running this one regardless would refuse every valid
  // blueprint whose size comes partly from a roof cap.
  const b = boundsOf(cells)
  if (!(d.pieces ?? []).length && (d.w !== b.w || d.h !== b.h || d.d !== b.d)) {
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

  // ── pieces ──────────────────────────────────────────────────────────────────────────────────
  if (d.pieces !== undefined && !Array.isArray(d.pieces)) return [...p, 'pieces is not an array']
  const pieces = d.pieces ?? []
  for (const q of pieces) {
    if (!q || typeof q !== 'object') { p.push('a piece entry is not an object'); continue }
    // ⚠ THE ID IS RESOLVED AGAINST THE REGISTRY, NOT PATTERN-MATCHED. An unknown piece id stamps
    // NOTHING — a doorway that silently does not exist leaves a wall with no way in, and the file
    // still looks like a house. Same failure the unknown-material check exists for, one type over.
    if (!pieceDef(q.pieceId)) { p.push(`unknown piece id: ${JSON.stringify(q.pieceId)}`); continue }
    if (![0, 1, 2, 3].includes(q.rot as number)) p.push(`piece '${q.pieceId}' has rotation ${q.rot}, not 0-3`)
    if (![q.x, q.y, q.z].every(Number.isInteger)) p.push(`piece '${q.pieceId}' has a non-integer position`)
  }
  if (p.length) return p

  const footprints = pieces.map(q => ({ q, cells: pieceFootprint(q) }))
  if (footprints.some(fp => fp.cells.some(c => c.x < 0 || c.y < 0 || c.z < 0))) {
    p.push('a piece reaches outside the blueprint origin — pieces normalize with the blocks, not separately')
  }
  // ★ THE BOUNDS CHECK ABOVE COUNTED BLOCKS ONLY; re-check it with the pieces included, because a
  // piece can legitimately be the thing that makes a building tall (a roof cap) or wide (an arch).
  const withPieces = boundsOf(cells, pieces)
  if (d.w !== withPieces.w || d.h !== withPieces.h || d.d !== withPieces.d) {
    p.push(`stored bounds ${d.w}x${d.h}x${d.d} disagree with blocks AND pieces, which span ${withPieces.w}x${withPieces.h}x${withPieces.d}`)
  }
  // ⚠ SOLID-vs-SOLID ONLY. Two pieces may legitimately share a PASSABLE cell (an arch over a
  // doorway), and a piece may sit where a block is — that is the world's `canPlace` question at
  // stamp time, not a claim about whether the file is well formed. Two SOLID piece cells in one
  // place is a file no editor can produce and only a hand edit can write.
  const solidAt = new Map<string, string>()
  for (const q of pieces) {
    const def = pieceDef(q.pieceId)!
    for (const c of cellsOf(q, def)) {
      if (!c.solid) continue
      const k = `${c.x},${c.y},${c.z}`
      const prev = solidAt.get(k)
      if (prev) { p.push(`pieces '${prev}' and '${q.pieceId}' both fill the cell ${k}`); break }
      solidAt.set(k, q.pieceId)
    }
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

/**
 * Place a blueprint's PIECES into the world — local placements, offset to a world origin.
 *
 * ★ A TRANSLATION AND NOTHING ELSE. `BlueprintPiece` IS `Placement`, so there is no field mapping
 * here and no default invented at the boundary — the two types agreeing is what makes that true.
 * ⚠ It does NOT ask `canPlace`. Whether a piece may legally stand in a given world cell is the
 * world's question at stamp time and depends on what is already there; this only says where.
 */
export function stampPieces(s: BlueprintDef, at: { x: number; y: number; z: number }): Placement[] {
  return (s.pieces ?? []).map(p => ({ ...p, x: p.x + at.x, y: p.y + at.y, z: p.z + at.z }))
}

/** Place a blueprint into the world: its local cells, offset to a world origin. */
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
  // ⚠ THE `pieces` KEY IS OMITTED ENTIRELY WHEN EMPTY. A blueprint written before pieces existed
  // must come back byte for byte; emitting `"pieces": []` rewrites every one of them on first read.
  const pieces = (s.pieces ?? []).length
    ? `,\n  "pieces": [\n${(s.pieces ?? []).map(p => `    ${JSON.stringify(p)}`).join(',\n')}\n  ]`
    : ''
  return `{\n  "id": ${JSON.stringify(s.id)},\n  "name": ${JSON.stringify(s.name)},\n` +
    `  "w": ${s.w}, "h": ${s.h}, "d": ${s.d},\n  "cells": [${s.cells.join(',')}]${pieces}\n}\n`
}
