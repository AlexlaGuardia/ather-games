// The chunk layer — assembling generation into columns, and meshing them without seams.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// A COLUMN is a 16x16 footprint at full world height: 16 sections of 16³ stacked. It is the unit
// everything below already wanted — `carveStack` and `placeOre` both take a section stack, and the
// mesher's unit is the section. Named `Column`, not `Chunk`, deliberately: the tile world already
// has `CHUNK = 64` for streaming, and reusing the word would quietly conflate a 64-tile streaming
// cell with a 16-tile generation unit. Mapping one streaming chunk onto its 4x4 columns is the
// streaming layer's job, not this file's.
//
// ── ★ WE PULL, MOJANG PUSHES — AND THAT DISSOLVES THE NEIGHBOUR-MARGIN RULE ──────────────────
// WORLDGEN-RESEARCH steal #2 prescribes a per-chunk status enum PLUS a rule that a stage may only
// run once its declared neighbour ring reached the prior stage. That rule exists because Mojang's
// features WRITE into neighbouring chunks (the 3x3 bound) — a push model, which needs the neighbour
// to exist and be at the right stage first, and whose failure mode is the pre-1.13 cascade.
//
// Ours never writes outside itself. `carveStack` and `placeOre` SCAN nearby chunks' pure start
// functions and apply the overlap to their OWN sections. Nothing is pushed, so nothing has to wait:
// a column can generate in complete isolation, in any order, on any thread, and be correct.
//
// The cost of pulling is recomputation — each column re-walks the tunnels near it — and that is
// measured and paid: 16ms per 64-wide chunk column of carving. The benefit is that the hardest
// property in the whole pipeline (order independence) becomes structural instead of scheduled.
// **The status enum below therefore tracks progress for streaming and resumption. It is NOT a
// dependency gate, and it must not become one.**

import { Section, AIR } from './section'
import { columnHeight, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { materialAt, MAT, type DepthConfig, DEFAULT_DEPTH } from './depth'
import { plantWaystones } from './story-path'
import { carveStack, type CarveConfig, DEFAULT_CARVE } from './carve'
import { placeOre, type OreBatch, ORE_BATCHES } from './ore'
import { plantTrees, type TreeConfig, DEFAULT_TREES } from './trees'
import { placeSites } from './sites'
import { slumpMask } from './slump'
import { greedyMesh, createMeshScratch, type MeshScratch, type MeshResult } from './greedy'

export const SECTION = 16

/**
 * Generation progress. Ordered, monotonic, and used for streaming and RESUMPTION — a column may be
 * abandoned mid-pipeline when an idle slice expires and resumed at its last completed stage.
 * ⚠ Without a persisted stage, "resume" and "run again" are indistinguishable and you get ore
 * placed twice. That is the whole reason this exists; it is not a dependency gate (see header).
 */
export enum Stage {
  Empty = 0,
  Terrain = 1,   // height spline + depth rule: solid host rock
  PreOre = 2,    // tier-4 pockets, before anything cuts through them
  Carved = 3,    // tunnels and caverns
  PostOre = 4,   // tiers 1-3, so they land in cave walls
  Vegetation = 5, // trees — last, because they stand on finished ground
  Ready = 6,
}

export interface ColumnConfig {
  worldHeight: number
  /** The streaming chunk size the generators key their placement grids to. */
  chunk: number
  height: HeightConfig
  depth: DepthConfig
  carve: CarveConfig
  ore: OreBatch[]
  trees: TreeConfig
}

export const DEFAULT_COLUMN: ColumnConfig = {
  worldHeight: 256,
  chunk: 64,
  height: DEFAULT_HEIGHT,
  depth: DEFAULT_DEPTH,
  carve: DEFAULT_CARVE,
  ore: ORE_BATCHES,
  trees: DEFAULT_TREES,
}

export class Column {
  readonly wx: number
  readonly wz: number
  readonly sections: Section[]
  stage: Stage = Stage.Empty
  /** Per-section single value, or -1 when mixed. Recomputed at the end of generation. */
  readonly uniform: Int32Array
  /** Surface altitude per (x,z), cached — the depth rule wants it once per column, not per voxel. */
  readonly surface: Int32Array
  /** 1 where this column's surface voxel is a slumping lip (slump.ts). Derived from the height
   *  field alone, so it is NOT part of the save: a player edit changes the cell, never the mask,
   *  and `isHalfCell` reads both before it calls anything half. */
  readonly slump: Uint8Array

  constructor(wx: number, wz: number, cfg: ColumnConfig = DEFAULT_COLUMN) {
    this.wx = wx
    this.wz = wz
    const n = cfg.worldHeight / SECTION
    this.sections = Array.from({ length: n }, () => new Section(SECTION))
    this.uniform = new Int32Array(n).fill(-1)
    this.surface = new Int32Array(SECTION * SECTION)
    this.slump = new Uint8Array(SECTION * SECTION)
  }

  get(x: number, y: number, z: number): number {
    const s = (y / SECTION) | 0
    return this.sections[s].get(x, y - s * SECTION, z)
  }

  /** Surface altitude for a local (x, z). */
  heightAt(x: number, z: number): number { return this.surface[z * SECTION + x] }
}

/**
 * ── ★ THE ONE DEFINITION OF "THIS CELL IS HALF HEIGHT" (2026-08-11) ──────────────────────────────
 * Read by the mesher (what to draw) and by the walker (what to stand on). It has to be ONE
 * function: a cell drawn at 0.5 that collides at 1.0 is an invisible lip you trip on, and the
 * reverse is a floor you sink through. Both bugs are silent, and the frame-map lesson from the
 * sprite pipeline is the same shape — three copies of a truth is three chances to disagree.
 *
 * Three conditions, and each is load-bearing:
 *  1. the column slumps here (slump.ts's lip rule + tendedness);
 *  2. this is the GENERATED surface voxel — a floor the player dug at some lower altitude is not a
 *     terrace lip, and half-height dug floors would make placing blocks unreadable;
 *  3. the cell is solid and open to the AIR above it. This is what makes the whole feature
 *     self-healing: a trunk, a ruin wall, a waystone or a block the player just set down all land
 *     ON this cell and it goes back to full height, so nothing ever floats half a block above the
 *     ground it stands on. AIR specifically, not "non-solid" — a submerged bed under water has no
 *     business being a step.
 */
export function isHalfCell(col: Column, lx: number, y: number, lz: number): boolean {
  const i = lz * SECTION + lx
  if (!col.slump[i]) return false
  if (y !== col.surface[i]) return false
  const s = (y / SECTION) | 0
  if (s < 0 || s >= col.sections.length) return false
  if (col.sections[s].get(lx, y - s * SECTION, lz) === AIR) return false
  const up = ((y + 1) / SECTION) | 0
  if (up >= col.sections.length) return true
  return col.sections[up].get(lx, y + 1 - up * SECTION, lz) === AIR
}

/** Recompute the per-section uniform table. Cheap, and it is what makes tall worlds affordable. */
export function refreshUniform(col: Column): void {
  for (let i = 0; i < col.sections.length; i++) col.uniform[i] = col.sections[i].uniformValue() ?? -1
}

/**
 * Generate a column through to `upTo`. Resumable: pass a partially generated column and it picks up
 * at its recorded stage, running each remaining step exactly once.
 */
export function generateColumn(
  col: Column, seed: number, cfg: ColumnConfig = DEFAULT_COLUMN, upTo: Stage = Stage.Ready,
): Column {
  const { wx, wz } = col
  const surfaceAt = (x: number, z: number) => columnHeight(x, z, seed, cfg.height)

  if (col.stage < Stage.Terrain && upTo >= Stage.Terrain) {
    // The slump mask needs a one-column ring of heights, and hands back the interior it sampled —
    // so the surface altitudes below are READ, not resampled (see slumpMask's own note).
    const { mask, surface } = slumpMask(wx, wz, SECTION, seed, surfaceAt)
    col.slump.set(mask)
    col.surface.set(surface)
    for (let z = 0; z < SECTION; z++) {
      for (let x = 0; x < SECTION; x++) {
        // Surface altitude once per (x,z), not once per voxel — 256 redundant noise evaluations per
        // column is the difference between a fast generator and a slow one.
        const h = col.surface[z * SECTION + x]
        for (let y = 0; y < cfg.worldHeight; y++) {
          const s = (y / SECTION) | 0
          col.sections[s].set(x, y - s * SECTION, z, materialAt(wx + x, y, wz + z, seed, h, cfg.depth, cfg.height))
        }
      }
    }
    col.stage = Stage.Terrain
  }

  if (col.stage < Stage.PreOre && upTo >= Stage.PreOre) {
    placeOre(col.sections, wx, 0, wz, cfg.chunk, seed, 'pre', cfg.ore)
    col.stage = Stage.PreOre
  }

  if (col.stage < Stage.Carved && upTo >= Stage.Carved) {
    carveStack(col.sections, wx, 0, wz, cfg.chunk, seed, cfg.carve, surfaceAt, cfg.depth.seaLevel)
    col.stage = Stage.Carved
  }

  if (col.stage < Stage.PostOre && upTo >= Stage.PostOre) {
    placeOre(col.sections, wx, 0, wz, cfg.chunk, seed, 'post', cfg.ore)
    col.stage = Stage.PostOre
  }

  if (col.stage < Stage.Vegetation && upTo >= Stage.Vegetation) {
    // Trees stand on FINISHED ground: after carvers stopped moving the surface and after ore, so a
    // trunk is never planted on a block that later becomes a cave mouth.
    plantTrees(col.sections, wx, 0, wz, SECTION, seed, surfaceAt,
      (x, z, h) => materialAt(x, h, z, seed, h, cfg.depth, cfg.height), cfg.trees)
    // Sites go LAST: a ruin wall punches through whatever the fringe planted, never the reverse.
    placeSites(col.sections, wx, 0, wz, SECTION, seed)
    // …except the waystones, which go after even the sites: the story road's lit posts are the
    // one generated thing nothing may bury (they hold the spawn gate's light veto over the road).
    plantWaystones(col.sections, wx, wz, SECTION, surfaceAt, cfg.depth.seaLevel, MAT.STONE, MAT.MANA_LANTERN)
    col.stage = Stage.Vegetation
  }

  if (col.stage < Stage.Ready && upTo >= Stage.Ready) {
    refreshUniform(col)
    col.stage = Stage.Ready
  }
  return col
}

/** Convenience: a fresh, fully generated column. */
export const makeColumn = (wx: number, wz: number, seed: number, cfg: ColumnConfig = DEFAULT_COLUMN): Column =>
  generateColumn(new Column(wx, wz, cfg), seed, cfg)

/** The four horizontal neighbours a column needs to mesh without drawing walls at its edges. */
export interface Neighbours {
  negX?: Column | null
  posX?: Column | null
  negZ?: Column | null
  posZ?: Column | null
}

export interface SectionMesh {
  index: number
  /** World-space min corner of this section. */
  wx: number; wy: number; wz: number
  mesh: MeshResult
}

/**
 * Mesh every section of a column that can produce geometry.
 *
 * ★ TWO THINGS HERE ARE LOAD-BEARING AND BOTH ARE INVISIBLE WHEN WRONG.
 *
 * 1. **Vertical neighbours must be sampled.** Section i and section i+1 are adjacent voxels. Mesh
 *    them independently against "outside is air" and you get a floor and a ceiling between EVERY
 *    pair of sections — sixteen glass panes through every column. The mesher's own oracle already
 *    warns about this shape ("a solid section inside solid neighbours emits nothing"); this is where
 *    that promise gets kept.
 * 2. **★ AN ABSENT NEIGHBOUR MEANS "DRAW NO FACE", NOT "DRAW A WALL".** This originally treated a
 *    missing neighbour as AIR, on the reasoning that it is the honest render for the edge of the
 *    loaded world. In play it is catastrophic: a column meshed before its neighbour arrives draws
 *    its entire side — 16 wide by ~185 tall, bedrock to surface — and a few of those read as sheer
 *    grey cliffs with a chasm between them. Alex hit exactly that and reported terrain holes; the
 *    height field there was gentle (steepest adjacent step: 3 voxels). It was the frontier, drawn.
 *
 *    Absent is now OPAQUE, so the frontier simply draws nothing and fades into fog. The trade is
 *    transient UNDER-draw instead of transient OVER-draw, and under-draw at the fog line is
 *    invisible while over-draw is a wall across the sky. Faces appear correctly the moment the
 *    neighbour loads and both columns re-mesh.
 *
 *    ⚠ This is why the function takes columns rather than generating them — generating a missing
 *    neighbour here would be the synchronous-neighbour dependency the whole pipeline refuses.
 *
 * ⚠ THE UNIFORM SKIP CURRENTLY BUYS ABOUT NOTHING, AND THAT IS WORTH RECORDING RATHER THAN
 * REDISCOVERING. The theory: a section whose value matches every neighbour it touches cannot produce
 * a quad, so skip it. Measured on the REAL generated world it saves ~0% — because ore spans y16..156
 * at 26 attempts per chunk and carvers cut through, so only 14% of sections are uniformly solid, and
 * those still need all six neighbours to agree. **The ore density that makes the game good is what
 * kills this optimisation.** It stays because it is correct, free, and asserted output-identical —
 * it would pay in a sparser world — but do not budget for it. The mesher's OWN uniform fast path
 * (6 boundary planes instead of 51, in `greedy.ts`) is the one that genuinely pays, because 45% of
 * sections are uniform even if their neighbours are not.
 */
export function meshColumn(
  col: Column, neigh: Neighbours = {}, scratch?: MeshScratch, out: SectionMesh[] = [],
): SectionMesh[] {
  out.length = 0
  const sc = scratch ?? createMeshScratch(SECTION)
  const n = col.sections.length

  for (let i = 0; i < n; i++) {
    const sec = col.sections[i]
    const u = col.uniform[i]

    // ── the skip: uniform AND every touching neighbour agrees ────────────────────────────────
    if (u !== -1) {
      const below = i > 0 ? col.uniform[i - 1] : (u === AIR ? AIR : -1)
      const above = i < n - 1 ? col.uniform[i + 1] : AIR
      const sides = [neigh.negX, neigh.posX, neigh.negZ, neigh.posZ]
      let allAgree = below === u && above === u
      if (allAgree) {
        for (const s of sides) {
          // An ABSENT neighbour is opaque (see above), so a uniform section beside one has no face
          // to draw there and stays skippable. Treating absent as air here is what produced
          // full-height frontier walls.
          if (!s) continue
          if (s.uniform[i] !== u) { allAgree = false; break }
        }
      }
      if (allAgree) continue
      if (u === AIR && above === AIR && below === AIR) continue   // sky above the world: never geometry
    }

    const oy = i * SECTION
    const sample = (x: number, y: number, z: number): number => {
      // Vertical: walk into the section above or below within this column.
      if (y < 0) return i > 0 ? col.sections[i - 1].get(x, SECTION - 1, z) : AIR
      if (y >= SECTION) return i < n - 1 ? col.sections[i + 1].get(x, 0, z) : AIR
      // Horizontal: walk into the neighbouring column. ABSENT = OPAQUE, so no face is drawn at the
      // frontier — `sec.get(...)` mirrors our own voxel, which can never differ from itself and so
      // can never produce a face. Returning AIR here is what drew full-height walls at the edge of
      // the loaded world and read as terrain holes.
      if (x < 0) return neigh.negX ? neigh.negX.sections[i].get(SECTION - 1, y, z) : sec.get(0, y, z)
      if (x >= SECTION) return neigh.posX ? neigh.posX.sections[i].get(0, y, z) : sec.get(SECTION - 1, y, z)
      if (z < 0) return neigh.negZ ? neigh.negZ.sections[i].get(x, y, SECTION - 1) : sec.get(x, y, 0)
      if (z >= SECTION) return neigh.posZ ? neigh.posZ.sections[i].get(x, y, 0) : sec.get(x, y, SECTION - 1)
      return sec.get(x, y, z)
    }

    // Slump, in section-local coordinates. Mirrors `sample`'s frontier rule: an ABSENT neighbour
    // column is opaque, and opaque ground is never a lip — so the frontier draws no half faces
    // either, and they arrive with the column when it does.
    const halfAt = (x: number, y: number, z: number): boolean => {
      const wy = oy + y
      if (x < 0) return neigh.negX ? isHalfCell(neigh.negX, SECTION - 1, wy, z) : false
      if (x >= SECTION) return neigh.posX ? isHalfCell(neigh.posX, 0, wy, z) : false
      if (z < 0) return neigh.negZ ? isHalfCell(neigh.negZ, x, wy, SECTION - 1) : false
      if (z >= SECTION) return neigh.posZ ? isHalfCell(neigh.posZ, x, wy, 0) : false
      if (wy < 0 || wy >= n * SECTION) return false
      return isHalfCell(col, x, wy, z)
    }
    const mesh = greedyMesh(sec, sample, sc, halfAt)
    if (mesh.quads === 0) continue
    // ⚠ The scratch is reused, so these arrays are views that the NEXT section will overwrite.
    // Copy them here: the caller receives a list, and a list of aliased views is a trap.
    out.push({
      index: i, wx: col.wx, wy: oy, wz: col.wz,
      mesh: {
        positions: mesh.positions.slice(),
        normals: mesh.normals.slice(),
        materials: mesh.materials.slice(),
        indices: mesh.indices.slice(),
        quads: mesh.quads,
        faces: mesh.faces,
      },
    })
  }
  return out
}
