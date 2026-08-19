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
import { materialAt, MAT, isPlant, isHalfMat, HALF_BIT, type DepthConfig, DEFAULT_DEPTH } from './depth'
import {
  bubbleMaterialAt, distFromAxis, DEFAULT_BUBBLE, maxShellRadius, maxShellReach, shellCapTop, type BubbleConfig,
} from './bubble'
import { ZONE_ANCHORS } from './zones'
import { plantWaystones } from './story-path'
import { carveStack, type CarveConfig, DEFAULT_CARVE } from './carve'
import { placeOre, type OreBatch, ORE_BATCHES } from './ore'
import { plantTrees, type TreeConfig, DEFAULT_TREES } from './trees'
import { plantBoulders, type BoulderConfig, DEFAULT_BOULDERS } from './boulders'
import { placeSites } from './sites'
import { slumpMask } from './slump'
import { plantMaterialAt } from './flora'
import { biomeAt, DEFAULT_BIOME } from './biome'
import { greedyMesh, createMeshScratch, halfKey, type MeshScratch, type MeshResult, type HalfCells } from './greedy'

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
  boulders: BoulderConfig
}

export const DEFAULT_COLUMN: ColumnConfig = {
  worldHeight: 256,
  chunk: 64,
  height: DEFAULT_HEIGHT,
  depth: DEFAULT_DEPTH,
  carve: DEFAULT_CARVE,
  ore: ORE_BATCHES,
  trees: DEFAULT_TREES,
  boulders: DEFAULT_BOULDERS,
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
  /**
   * ── ★ WHAT THE STAGES AFTER THE DEPTH RULE PUT HERE (2026-08-11) ──────────────────────────────
   * Packed local index → material, for every cell where the finished column differs from the bare
   * terrain fill: carved tunnels, ore, trunks, leaves, ruin walls, waystones. It exists because
   * the save is a DIFF — `recordEdit` stores an edit only when the new material differs from the
   * generated one — and `materialAt` cannot see any of those stages. Measured before this existed:
   * 99.9% of tree and leaf voxels in the Thicket compared against AIR, so chopping a tree recorded
   * NOTHING and the tree was whole again on reload.
   *
   * Sparse on purpose. A full pristine copy is 131KB per column, and the load ring reaches 625
   * columns at max view radius — 82MB in a tab that already has an OOM history. The stages touch a
   * few hundred cells per column, so this is a few KB and is thrown away with the column.
   */
  overrides: Map<number, number> | null = null

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
 * ── ★ WHAT THE GENERATOR WOULD HAVE PUT AT THIS CELL — including ground cover (2026-08-11) ──────
 * `materialAt` plus the one plant voxel that sits above the surface. This exists as ONE function
 * because `recordEdit` stores an edit only when the new material DIFFERS from the generated one:
 * if the diff asked `materialAt` (which knows nothing about plants) then picking a flower would
 * compare AIR against AIR, store nothing, and the flower would be back on reload. Anything that
 * asks "was this cell touched by the player" must ask HERE, never `materialAt` directly.
 *
 * ⚠ Trees, sites and waystones still write over this afterwards and are NOT reflected — they run
 * as later stages and re-run identically on regeneration, so a cell they own compares against the
 * plant (or air) underneath them. That is the pre-existing contract, not something plants changed.
 */
/**
 * ── ★ THE KEEPER'S FOLD, STANDING IN THE WILDS (2026-08-15, the wiring) ─────────────────────────
 * The one live bubble. `bubble.ts` ships a DEFAULT whose materials are placeholders and whose door
 * faces nowhere in particular, on purpose — it is pure geometry and takes both as parameters (the
 * `plantWaystones` precedent). This is the wiring site, so this is where they get answered.
 *
 * ★★ THE DOOR IS AIMED AT THE PLAYER, AND THAT IS NOT A TWEAK — IT IS THE FEATURE. `bubble.ts`'s
 * own header says it: *"A single opening in a 6.3km circumference is undiscoverable by exploration,
 * so the build must put the player's arrival AT it rather than hoping they find it. Nothing here
 * picks that spot."* Nothing did, and the default bearing of 0 put the fold's only entrance on the
 * FAR side of the shell from every place a player has ever stood — about 1000 blocks of featureless
 * wall away from spawn. The bubble was unreachable in the most literal sense.
 *
 * So the bearing is DERIVED from the glade rather than typed: the passage sits on the line from the
 * bubble's centre to where the keeper wakes up, which puts it ~157 blocks off the glade's doorstep —
 * inside the view slider, on the skyline from where Gregory is standing when he tells them about it.
 * Derived, so it follows the glade if the glade ever moves; a typed bearing would silently rot.
 */
const GLADE = ZONE_ANCHORS.find(z => z.id === 'moonwell-glade')!

export const WILDS_BUBBLE: BubbleConfig = {
  ...DEFAULT_BUBBLE,
  passageBearing: Math.atan2(GLADE.z - DEFAULT_BUBBLE.cz, GLADE.x - DEFAULT_BUBBLE.cx),
  materials: { wall: MAT.CLOUD_WALL },
}

/**
 * ── ★ IS THIS WILDS COORDINATE SOMEWHERE A KEEPER CAN STAND? (2026-08-19) ──────────────────────
 * Inside the shell there is no ground at any altitude — the interior is unreachable by construction
 * (see bubble.ts on why only the skin is real), so a Wilds coordinate within the shell is not a
 * place, it is the outside of the fold seen from the wrong side.
 *
 * ★ EXPORTED BECAUSE TWO TOOLS NEEDED IT AND ONE OF THEM LEARNED THE HARD WAY. `findLands` had no
 * such filter, so `/land` and the contact sheet both proposed sites within a few hundred blocks of
 * spawn — every one of them inside the bubble. The teleports silently failed and **eight of nine
 * tiles in the first sheet were the same picture of the spawn view**, which reads as "the biome
 * layer does nothing" rather than as "the tour is broken". Third instance of the same family:
 * `/goto garden` teleported into the void, the slump oracle sampled plot geometry, and now this.
 *
 * ⚠ `maxShellRadius`, NOT `.radius` — the same reasoning `bubbleSwallows` states one block down:
 * the bulge is ±15 and a guard asked about the mean of a shape it exists to check the extremes of
 * is no guard at all.
 *
 * ★ `margin` IS FOR SEARCHES, and it is the second half of the same lesson. With margin 0 the
 * predicate answers the strict question ("could a keeper stand here"), and a NEAREST-site search
 * against it piles every answer up against the shell — the second contact sheet had four tiles
 * that were mostly cloud wall, technically standable and useless as pictures of a biome. A search
 * wants "somewhere with country around it", which is this question plus room. Same predicate, so
 * the two cannot drift; the margin says which question is being asked.
 */
export const wildsSwallows = (x: number, z: number, margin = 0): boolean =>
  Math.hypot(x - WILDS_BUBBLE.cx, z - WILDS_BUBBLE.cz) <= maxShellRadius(WILDS_BUBBLE) + margin

/**
 * ── ★★ THE ONE ANCHOR THIS BUBBLE IS ALLOWED TO SWALLOW, AND WHY (declared 2026-08-16) ──────────
 * `garden` sits at (0,0) — the exact centre of `WILDS_BUBBLE` — and that is CORRECT: this bubble IS
 * the garden's outside, and the zone entry named here shapes the terrain around the fold rather than
 * describing ground inside it. There is no conflict to fix.
 *
 * ⚠ IT IS WRITTEN DOWN BECAUSE "INTENDED" AND "FORGOTTEN" LOOK IDENTICAL FROM THE OUTSIDE. The
 * collision went unnoticed for a day precisely because the only list it was ever checked against
 * quietly did not contain it, and the cost was `/goto garden` teleporting keepers into a void with
 * no ground at any altitude. An exemption that is stated can be argued with; an omission cannot.
 *
 * ⚠ NOTHING ELSE GOES IN HERE WITHOUT A MEASUREMENT. Adding an id to silence a red guard is how the
 * glade gets buried — that is the exact failure `bubbleSwallows` was written to prevent.
 */
export const WILDS_SWALLOW_EXEMPT = ['garden'] as const

/**
 * Could this column hold any part of the bubble? A cheap rejection so the ~every column in the
 * world that has nothing to do with it pays one hypot and leaves.
 *
 * ⚠ CONSERVATIVE ON PURPOSE — it answers "possibly" wherever the wobble could reach, because a
 * false NO leaves a hole in the shell and a false YES costs one wasted pass.
 */
function columnTouchesBubble(wx: number, wz: number, span: number, cfg: BubbleConfig): boolean {
  // Nearest point of the column's footprint to the axis; if even that is beyond the shell's
  // outermost possible face, nothing in this column is the bubble's.
  const nx = Math.max(cfg.cx - (wx + span), Math.min(0, cfg.cx - wx))
  const nz = Math.max(cfg.cz - (wz + span), Math.min(0, cfg.cz - wz))
  const near = Math.hypot(nx, nz)
  // ⚠ `maxShellReach`, NOT A SECOND HAND-WRITTEN COPY OF THE SAME ARITHMETIC. This line and
  // `bubbleMaterialAt`'s cheap reject were the same expression typed twice in two files; the shape
  // changed on 2026-08-16 and only one of them would have been found by grepping for `wobble`.
  return near <= maxShellReach(cfg) + 1
}

export function generatedAt(
  x: number, y: number, z: number, seed: number, h: number,
  depthCfg: DepthConfig = DEFAULT_DEPTH, heightCfg: HeightConfig = DEFAULT_HEIGHT,
  bubbleCfg: BubbleConfig = WILDS_BUBBLE,
): number {
  // ★ THE BUBBLE ANSWERS FIRST, AND BEING HERE IS WHAT KEEPS THE SAVE HONEST. This function is the
  // ONE definition of "what the generator would have put here" — the terrain stage writes it and
  // `recordEdit` diffs against it. Wire the shell into the terrain stage alone and every wall voxel
  // becomes a phantom edit the moment anything near it is touched: exactly the trap the plot lane
  // caught at 79.3% of a column, one space over. `null` means "not mine" and costs one distance
  // test almost everywhere.
  const b = bubbleMaterialAt(x, y, z, seed, h, bubbleCfg)
  if (b !== null) return b
  // ⚠ NOTHING GROWS UNDER WATER, AND THIS GATE WAS MISSING ENTIRELY (found 2026-08-18 by walking to
  // a herb patch and arriving neck-deep in a lake). The plant branch below OVERWRITES whatever
  // `materialAt` would have put at h+1 — including WATER — so every submerged column in the world
  // has been quietly growing tufts and flowers on its bed. They rendered as nothing (the renderer's
  // probe demands topsoil with air above) which is exactly why nobody saw it: invisible voxels, real
  // in the save, breakable by a swimmer.
  //
  // ★ IT BECAME LOAD-BEARING WITH THE HERBS. Canon puts Violetbloom on the BASIN, and this build's
  // `basin` is `h <= seaLevel` — 82% of it is lake bed. Without this line the flagship Mana herb
  // grows underwater, which contradicts the ruling's own reason for putting it there (*"low,
  // sheltered, **the air standing**"*). With it, a basin's Violetbloom grows on the dry rim at the
  // waterline: the sheltered margin of a pool, which is the sentence canon actually wrote.
  const dry = h >= depthCfg.seaLevel
  if (y === h + 1 && dry) {
    // ★ THE GROUND IS RESOLVED HERE BECAUSE THIS IS WHERE `h` LIVES (2026-08-18, the herbs).
    // `biomeAt` needs the column's height and the sea level, and `flora.ts` has neither — it is a
    // pure selection field over (x, z). So the generator, which holds both, answers "what ground is
    // this" once per COLUMN (this branch runs on exactly one voxel of the 65,536 in a column) and
    // hands it down. ⚠ That per-column-ness is load-bearing: `biomeAt` reads rivers, zones, grey and
    // continentalness, and calling it per voxel would put five noise fields on the world's hot path
    // — the same shape as the shell-radius bug that made a slow generator look like a broken game.
    const p = plantMaterialAt(x, z, seed, biomeAt(x, z, seed, h, depthCfg.seaLevel, DEFAULT_BIOME, heightCfg))
    if (p !== AIR) return p
  }
  return materialAt(x, y, z, seed, h, depthCfg, heightCfg)
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
  // ★ THE MATERIAL DECIDES NOW (2026-08-11, Alex: "the fix is to make half blocks an actual item").
  // Kept as a helper because the renderer and the flora probe still ask the question, but it is a
  // one-bit read of world state — not a rule about the column. Everything that used to make this
  // fragile (a per-column mask consulted at render time, edits that had to suppress it) is gone:
  // mine the slab and the cell is AIR, place stone and the cell holds stone.
  return isHalfMat(col.get(lx, y, lz))
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
          let m = generatedAt(wx + x, y, wz + z, seed, h, cfg.depth, cfg.height)
          // A slumping lip is written as a SLAB, not as a full block a mask will later draw short.
          if (y === h && m !== AIR && col.slump[z * SECTION + x]) m |= HALF_BIT
          col.sections[s].set(x, y - s * SECTION, z, m)
        }
      }
    }
    col.stage = Stage.Terrain
  }

  // Snapshot the bare terrain the moment it exists — this is exactly what `generatedAt` returns,
  // so diffing the finished column against it yields the stage writes and nothing else. A plain
  // typed-array compare: no noise is re-evaluated, which is what makes this affordable at all.
  const bare = (col.stage === Stage.Terrain && upTo >= Stage.Ready && !col.overrides)
    ? col.sections.map(sec => Uint16Array.from(sec.data)) : null

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
    // ── ★★ BOULDERS GO AFTER THE TREES, AND THE ORDER IS LOAD-BEARING IN BOTH DIRECTIONS ──────
    // AFTER, because before-trees would let a trunk grow straight out of solid rock: `plantTrees`
    // asks the GENERATED surface material, never what has been written into the column, so it can
    // never see a boulder that is already there.
    //
    // ★ AND THIS ORDER IS ALSO WHAT PROTECTS BOULDERS FROM ORE — for free. The pipeline is
    // `depth → pre-carve ore → carvers → post-carve ore → vegetation`, so ore cannot land INSIDE a
    // boulder: those cells do not exist when either ore phase runs, and `placeOre` discards mass
    // above the surface anyway.
    //
    // ⚠ THE REVERSE IS NOT FREE, AND `plantBoulders` OWNS IT. Landing last means a boulder writes
    // on top of whatever is already there, and several ore batches ship `discardOnAirExposure: 0`
    // (tier-4 `ather_crystal` deliberately, so carvers slice it open) — so ore DOES reach exposed
    // positions a boulder can find. Its `put` refuses logs, leaves and ore for that reason. Without
    // it, a boulder on an outcrop silently turns an element crystal into stone that drops rubble,
    // moving the rarity of a third of the evolution grid with nothing looking wrong.
    plantBoulders(col.sections, wx, 0, wz, SECTION, seed, surfaceAt, cfg.depth.seaLevel, cfg.boulders)
    // Sites go LAST: a ruin wall punches through whatever the fringe planted, never the reverse.
    placeSites(col.sections, wx, 0, wz, SECTION, seed)
    // …except the waystones, which go after even the sites: the story road's lit posts are the
    // one generated thing nothing may bury (they hold the spawn gate's light veto over the road).
    plantWaystones(col.sections, wx, wz, SECTION, surfaceAt, cfg.depth.seaLevel, MAT.STONE, MAT.MANA_LANTERN)
    // ★ NOTHING STANDS ON A SLAB. Trunks, ruin walls and waystones are placed after the terrain, so
    // a lip can end up carrying one — and a trunk on a half block floats half a voxel. Water is
    // excluded for the same reason the old rule demanded AIR: a submerged bed is not a step.
    // Runs after the bare-terrain snapshot, so the diff records it as a stage write and
    // `generatedVoxel` agrees with the world (that disagreement is what regrew chopped trees).
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      const h = col.surface[z * SECTION + x]
      const s0 = (h / SECTION) | 0
      const m = col.sections[s0].get(x, h - s0 * SECTION, z)
      if (!isHalfMat(m)) continue
      const s1 = ((h + 1) / SECTION) | 0
      if (s1 >= col.sections.length) continue
      const up = col.sections[s1].get(x, h + 1 - s1 * SECTION, z)
      if (up === AIR || isPlant(up)) continue
      col.sections[s0].set(x, h - s0 * SECTION, z, m & 0xFF)
    }
    col.stage = Stage.Vegetation
  }

  // ── ★★ THE FOLD IS RE-ASSERTED AFTER EVERY STAGE, AND IT COSTS THE SAVE NOTHING ───────────────
  // The terrain stage already wrote the shell (`generatedAt` answers it first), but five stages run
  // afterwards and none of them has ever heard of a bubble: `carveStack` would drive a cave clean
  // through the cloud-wall, `plantTrees` would stand a trunk in the fold's empty interior, ore and
  // ruins would speckle both.
  //
  // ★ THE CAVE IS THE ONE THAT MATTERS. A carver breaching the shell is a HOLE, and a hole is the
  // exact silhouette canon names as the misreading — *"no gates, no locks"* — leading into 500
  // blocks of ungenerated nothing. `bubble.test.ts` floods 8-connected to prove the wall has no gap;
  // that proof is about the geometry, and it says nothing about a carver that arrives later. This is
  // what makes the shipped world match the tested shape.
  //
  // ★ AND IT IS FREE IN THE SAVE, WHICH IS WHY IT IS SAFE TO DO BLUNTLY. `bare` is the post-terrain
  // snapshot, which already holds the bubble. Re-asserting restores those cells to exactly what
  // `bare` has, so `diffOverrides` sees no difference and records no override — the world is fixed
  // and the diff stays empty. Writing the same truth twice is the cheap half of a bargain whose
  // expensive half would be teaching five stages about a shell.
  if (col.stage >= Stage.Vegetation && upTo >= Stage.Ready
      && columnTouchesBubble(wx, wz, SECTION, WILDS_BUBBLE)) {
    // ⚠ THE BUBBLE IS ASKED ONCE PER (x,z), NOT ONCE PER VOXEL. Its answer varies with `y` only at
    // the shell's top and bottom caps, and `shellRadiusAt` — the expensive half — does not depend on
    // `y` at all. Asking per cell meant 65,536 fbm evaluations per column and was slow enough to
    // stall the stream (see `bubbleMaterialAt`'s own header for what that looked like).
    for (let z = 0; z < SECTION; z++) {
      for (let x = 0; x < SECTION; x++) {
        const h = col.surface[z * SECTION + x]
        // One probe decides this whole vertical: mid-shell, where the caps cannot confuse the
        // answer. `null` here means the bubble has no opinion about this column at all.
        const probeY = Math.floor((WILDS_BUBBLE.bottomY + WILDS_BUBBLE.topY) / 2)
        const mine = bubbleMaterialAt(wx + x, probeY, wz + z, seed, h, WILDS_BUBBLE)
        if (mine === null) continue
        // AIR is the fold's interior and spans the FULL height (there is no ground in there at all).
        // The wall stands only between its caps, so it still has to respect them.
        // ⚠ `shellCapTop`, NOT `WILDS_BUBBLE.topY` — since 2026-08-16 `topY` is the MEAN of the cap
        // and each column crowns to its own height. Filling to the mean would build the wall and
        // shave every crown flat in the same pass, putting back the dead-level 3km skyline the
        // crowns exist to break, and it would look like nothing at all from the ground.
        const y0 = mine === AIR ? 0 : WILDS_BUBBLE.bottomY
        const top = shellCapTop(wx + x, wz + z, seed, WILDS_BUBBLE)
        const y1 = mine === AIR ? cfg.worldHeight - 1 : Math.min(top, cfg.worldHeight - 1)
        for (let y = y0; y <= y1; y++) {
          const s = (y / SECTION) | 0
          if (col.sections[s].get(x, y - s * SECTION, z) !== mine) col.sections[s].set(x, y - s * SECTION, z, mine)
        }
      }
    }
  }

  if (col.stage < Stage.Ready && upTo >= Stage.Ready) {
    if (bare) col.overrides = diffOverrides(col, bare)
    refreshUniform(col)
    col.stage = Stage.Ready
  }
  return col
}

/**
 * Column-local packed index. ⚠ MUST match `edits.editIndex` — deliberately duplicated rather than
 * imported, because `edits.ts` already imports this file and the reverse edge would make the cycle
 * bidirectional. `plants.test.ts` asserts the two agree, so the duplication cannot drift silently.
 */
const packIndex = (x: number, y: number, z: number): number => (y * SECTION + z) * SECTION + x

/** Cells where the finished column differs from its bare terrain fill. See `Column.overrides`. */
function diffOverrides(col: Column, bare: Uint16Array[]): Map<number, number> {
  const out = new Map<number, number>()
  for (let i = 0; i < col.sections.length; i++) {
    const now = col.sections[i].data, was = bare[i]
    for (let j = 0; j < now.length; j++) {
      if (now[j] === was[j]) continue
      // Section-local j is (y*S + z)*S + x; editIndex wants the column-local y.
      const y = ((j / (SECTION * SECTION)) | 0) + i * SECTION
      const rest = j % (SECTION * SECTION)
      out.set(packIndex(rest % SECTION, y, (rest / SECTION) | 0), now[j])
    }
  }
  return out
}

/**
 * ★ THE VALUE `recordEdit` MUST DIFF AGAINST — ask this, never `generatedAt` directly.
 * Falls back to the depth rule wherever no stage wrote, which is almost everywhere.
 */
export function generatedVoxel(
  col: Column, lx: number, y: number, lz: number, seed: number,
  depthCfg: DepthConfig = DEFAULT_DEPTH, heightCfg: HeightConfig = DEFAULT_HEIGHT,
): number {
  const o = col.overrides?.get(packIndex(lx, y, lz))
  if (o !== undefined) return o
  const h = col.heightAt(lx, lz)
  const m = generatedAt(col.wx + lx, y, col.wz + lz, seed, h, depthCfg, heightCfg)
  // Same slab rule the terrain stage applies — one place, so the save's diff cannot disagree with
  // what was generated (that disagreement is what made chopped trees regrow).
  return (y === h && m !== AIR && col.slump[lz * SECTION + lx]) ? m | HALF_BIT : m
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
 *    its entire side — 16 wide by ~185 tall, floor to surface — and a few of those read as sheer
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
  // One reusable scratch section for the lip-stripped copy (see the strip block below). Allocated
  // per column mesh, not per section, and never touched unless a section actually holds a lip.
  const strip = new Section(SECTION)

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
    const raw = (x: number, y: number, z: number): number => {
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

    // ── slump, and the cost of asking about it ───────────────────────────────────────────────
    // ── slabs in this section, and in the one-cell ring around it ────────────────────────────
    // ★ SCANNED FROM THE MATERIAL, never from the terrain's lip mask. The mask only knows where the
    // GENERATOR put a slab; a player can place one anywhere, and gating on it drew those as full
    // cubes. The scan is ~4k reads of a typed array per meshed section — a bit test, not the
    // per-cell CALL that cost 3ms/column (see the HalfCells contract in greedy.ts).
    //
    // The lips still leave the sweep through a stripped COPY, for that same reason: the mesher's
    // inner loop must never learn that half blocks exist.
    let half: HalfCells | null = null
    let meshSec = sec
    const data = sec.data
    for (let j = 0; j < data.length; j++) {
      if (!isHalfMat(data[j])) continue
      const ly = (j / (SECTION * SECTION)) | 0, rest = j % (SECTION * SECTION)
      const lx = rest % SECTION, lz = (rest / SECTION) | 0
      if (!half) half = new Map()
      half.set(halfKey(lx, ly, lz, SECTION), data[j])
      if (meshSec === sec) { strip.data.set(sec.data); meshSec = strip }
      meshSec.set(lx, ly, lz, AIR)
    }
    // The ring is CONTEXT, never drawn: a slab needs to know whether the cell beside it — possibly
    // in the next column, or the section above/below — covers its side. ⚠ The Y ring counts too: a
    // slab at the top of section i-1 is meshed against section i's bottom plane, and without it the
    // sweep caps that slab at full height. Mirrors `raw`: an absent neighbour is opaque.
    const ringAt = (rx: number, ry: number, rz: number, src: Column | null | undefined,
                    sx: number, wy: number, sz: number) => {
      if (!src || wy < 0 || wy >= n * SECTION) return
      const m = src.get(sx, wy, sz)
      if (!isHalfMat(m)) return
      if (!half) half = new Map()
      half.set(halfKey(rx, ry, rz, SECTION), m)
    }
    for (let a = 0; a < SECTION; a++) for (let b = 0; b < SECTION; b++) {
      ringAt(-1, b, a, neigh.negX, SECTION - 1, oy + b, a)
      ringAt(SECTION, b, a, neigh.posX, 0, oy + b, a)
      ringAt(a, b, -1, neigh.negZ, a, oy + b, SECTION - 1)
      ringAt(a, b, SECTION, neigh.posZ, a, oy + b, 0)
    }
    for (let z = 0; z < SECTION; z++) for (let x = 0; x < SECTION; x++) {
      ringAt(x, -1, z, col, x, oy - 1, z)
      ringAt(x, SECTION, z, col, x, oy + SECTION, z)
    }
    // ⚠ THE VERTICAL NEIGHBOUR NEEDS STRIPPING TOO, and only the RARE path pays for it. A lip at
    // the top of section i-1 is read by section i's bottom plane through this closure, not through
    // the stripped copy — leave it solid there and the sweep caps the lip at full height. Called
    // only for out-of-section coordinates, so this lookup never touches the hot loop.
    const neighbourFn = half === null ? raw
      : (x: number, y: number, z: number) => half!.has(halfKey(x, y, z, SECTION)) ? AIR : raw(x, y, z)
    // The world corner, for the leaf pass's per-cell hash — see `greedyMesh`. Everything else in
    // the mesher is section-local on purpose and stays that way.
    const mesh = greedyMesh(meshSec, neighbourFn, sc, half, [col.wx, oy, col.wz])
    if (mesh.quads === 0) continue
    // ⚠ The scratch is reused, so these arrays are views that the NEXT section will overwrite.
    // Copy them here: the caller receives a list, and a list of aliased views is a trap.
    out.push({
      index: i, wx: col.wx, wy: oy, wz: col.wz,
      mesh: {
        positions: mesh.positions.slice(),
        normals: mesh.normals.slice(),
        materials: mesh.materials.slice(),
        ao: mesh.ao.slice(),
        indices: mesh.indices.slice(),
        quads: mesh.quads,
        faces: mesh.faces,
      },
    })
  }
  return out
}
