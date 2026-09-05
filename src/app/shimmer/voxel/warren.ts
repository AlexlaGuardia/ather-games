// Warrens — what is UNDER a ruin, and the way down into it.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★ WHY THIS EXISTS (Alex, 2026-09-05) ─────────────────────────────────────────────────────
// *"we will need new points of interest to generate into the game that hides them within .. maybe
// even something similar to a procedurally generated dungeon .. a maze."* The cache road is canon
// as of the same morning (`design-briefs/shimmer-casting-vessels.md` › THE THREE ROADS): a vessel
// is FOUND as *a cache in the Wilds*, anonymous, *"left, stashed, forgotten, grown over"*.
//
// ★★ THE DESCENT IS NOT A NEW STRUCTURE, IT IS A DOOR IN ONE THAT ALREADY GENERATES. Every ruin
// in the world is a candidate. That is worth more than a new surface POI: the ~1.1 sites per 1000²
// of greyfield that `sites.ts` already places stop being scenery you loot for bricks and become
// things you check. Nothing new has to be found before the feature is reachable.
//
// ── ★★★ WHY IT IS A ROLL ON THE SITE AND NOT A PIECE IN `RUIN_PIECES` ────────────────────────
// A stair piece in the ruin pool is the obvious build and it is the wrong one. `pick()` weights
// against the pool TOTAL, so appending one member re-rolls every socket in the world: every ruin
// changes shape, and `jigsaw.ts`'s header says exactly what that costs — *"a reordered draw or a
// changed loop bound silently regenerates every ruin in the world, and nothing downstream would
// report it."* The ruin pool is sweep-tuned (`scripts/ruin-sweep.mts`) and oracle-asserted over
// 681 sites; spending all of that to add a staircase is a bad trade.
//
// A roll keyed on `site.seed` costs nothing and perturbs nothing — verified, not assumed:
// `npx tsx scripts/ruin-hash.mts` reports the same digest before and after this file existed.
// ★ And it lands the shaft in the one place a ruin is guaranteed to have a room: the START piece
// sits at the site centre by construction, so the way down is through the middle of the building.
//
// ── ★ THE GROUND RULE IS THE INVERSE OF A RUIN'S, WHICH IS THE SEAM `jigsaw.ts` PROMISED ─────
// Its header: *"A ruin dies where the country stops being flat; a burrow wants the opposite (it
// needs a BANK to dig into) ... All three are the same breadth-first assembly disagreeing about
// one predicate."* A warren disagrees a third way: it does not care what the surface is doing, it
// cares that there is still ROCK OVERHEAD. `enoughCover` is that predicate and it is the only
// warren-specific thing in the assembly. A branch dies where the country gets too thin to hide a
// room, which reads as a warren that stopped digging before it broke daylight.
//
// ⚠⚠ AND THE FLOOR IS FLAT, DELIBERATELY, WHICH IS THE ONE PLACE THIS DIVERGES FROM `ruins.ts`.
// A ruin takes each piece's own lowest ground so it can never float. A warren is DUG: every room
// is at one depth because somebody cut them all from the same level, and a stepped underground
// floor would read as a bug rather than as terrain. The ground rule therefore returns a constant.
//
// ── ★★ PURITY, AND IT IS THE SAME INVARIANT `ruins.ts` BENDS AROUND ─────────────────────────
// Every column that a warren touches re-derives the WHOLE warren from `(site.seed)` alone and
// writes only its own slice. No accumulation, no arrival order, no "place as you stream". The
// cache's position is picked by a deterministic scan over the finished part list for the same
// reason: two columns that disagree about which room holds the cache would each be internally
// consistent, and the world would have two caches or none.
//
// ── ★ WHAT MAKES IT A MAZE IS THE DARK, NOT THE LAYOUT ───────────────────────────────────────
// A twisty layout loses to a spike: the player mines through the wall. So the walls here are
// ordinary salvageable brick and mining through is ALLOWED — it is just slow, and slow is the
// thing you cannot afford underground with no sky channel and the Night Tide's dark having the run
// of untended country (`shimmer-geography.md` › THE NIGHT TIDE, ruled 2026-08-06). The corridors
// are long and the pool is turn-heavy so the place reads labyrinthine; Minecraft strongholds feel
// endless at about fifteen rooms and nobody maps them, and breadth-first-with-terminators is why.
//
// ── ⚠ CANON: THIS CLAIMS NOTHING, EXACTLY AS `ruins.ts` CLAIMS NOTHING ───────────────────────
// *What* stands in drained garden-country is an OPEN gap (`CANON_GAPS.md`, filed by `sites.ts`).
// So a warren is unbranded worked stone under an unbranded ruin: no name, no builder, no story.
// It uses only materials that already ship. The day Magii rules the surface, the dressing here
// changes with it and the plumbing does not.
// ⛔ It is a CACHE and never a chest. `MAT.CHEST` is craftable player furniture in this build, and
// canon rules the collision explicitly: *"a lootable container sharing that noun would be two
// things wearing one label."* ⛔ `burrow` is likewise unavailable — `shimmer-geography.md` gives it
// to collar culture, and `dens.ts`'s header holds the line on why a generator may not scatter one.

import { hash2 } from './noise'
import { assemble, type JigsawPiece } from './jigsaw'
import { columnHeight, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { MAT } from './depth'
import { AIR, Section } from './section'
// ⚠ TYPE-ONLY, and for the same reason `ruins.ts` says so: `sites.ts` imports this module's
// builder at RUNTIME, so a value import in this direction would close a module cycle.
import type { Site } from './sites'

export interface WarrenPieceDef extends JigsawPiece {
  /** Interior height in blocks above the floor. The ceiling course sits one above this. */
  h: number
}

/**
 * The pool. Turn- and corridor-heavy where `RUIN_PIECES` is room-heavy, and that difference IS the
 * feel: a ruin is a footprint you look down at, a warren is something you are inside and cannot see
 * the end of. Six shapes for the same reason ruins have six — a bigger catalogue is worth nothing
 * until Alex has walked one and said what it should feel like.
 *
 * ⚠ Every extent is ODD, inherited from `jigsaw.ts` and non-negotiable: a socket sits at the
 * midpoint of an edge and an even edge has no midpoint.
 */
export const WARREN_PIECES: WarrenPieceDef[] = [
  { id: 'run',     w: 3, d: 9, h: 3, weight: 5 },   // the long straight — the corridor that does the work
  { id: 'bend',    w: 5, d: 5, h: 3, weight: 4 },   // a turn: what makes it read as a warren and not a hall
  { id: 'gallery', w: 7, d: 5, h: 4, weight: 2 },
  { id: 'vault',   w: 7, d: 7, h: 5, weight: 1 },   // rare, tall, and where a cache usually ends up
  // ── terminators ──
  { id: 'nook',    w: 3, d: 3, h: 3, weight: 3, terminal: true },
  { id: 'slump',   w: 3, d: 3, h: 2, weight: 2, terminal: true },   // a low collapsed dead-end
]

export interface WarrenConfig {
  /**
   * ★★ A CORRECTNESS BOUND, NOT A TASTE KNOB — the same one `ruins.ts` documents, and it is now
   * SHARED. `sites.ts` scans one ring of cells and clips columns against the larger of the two
   * reaches, so the inequality that must hold is `separation * 16 > max(reach) + 1`: at 48 vs 31
   * there is room. Past ~46 the scan radius must go up FIRST or a warren loses slices at cell
   * seams, silently, on one side only. `warren.test.ts` asserts the inequality.
   */
  envelope: number
  /** Hard cap on pieces. Bounds size AND the per-column cost of re-deriving the assembly. */
  maxPieces: number
  /** Sockets this many links from the shaft draw from the TERMINATOR pool instead. */
  maxDepth: number
  /** Rolls per socket before it gives up and tries to terminate. */
  tries: number
  /** The chance a socket digs on at all. */
  sprawl: number
  /**
   * `r ** sizeBias` biases the per-warren budget toward small.
   * ⚠ LOWER THAN `DEFAULT_RUINS` (2.2) ON PURPOSE. A one-room ruin is a legal building and reads
   * as one. A one-room warren is a hole at the bottom of a staircase, and it makes the descent a
   * disappointment — which is the only thing this feature must not be, because the player PAID for
   * it by climbing down in the dark.
   */
  sizeBias: number
  /** How far below the ruin's own floor the warren is cut. The length of the shaft. */
  depth: number
  /** Solid cover demanded between a room's ceiling and the surface, in blocks. */
  cover: number
  /** No warren may be cut below this Y — the world floor is pressed cloud and stays that way. */
  minFloor: number
  /** Share of ruins with a way down. */
  chance: number
}

export const DEFAULT_WARREN: WarrenConfig = {
  envelope: 30,
  maxPieces: 12,
  maxDepth: 4,
  tries: 6,
  sprawl: 0.85,
  sizeBias: 1.6,
  depth: 9,
  cover: 3,
  minFloor: 8,
  // ⚠ A TUNING NUMBER AND NOTHING MORE, and it is the one to move first after a walk. Too high and
  // every ruin is a dungeon, which makes the surface ruin meaningless; too low and the feature is a
  // rumour. A third is the opening guess: enough that checking a ruin is worth the detour, rare
  // enough that finding a way down is an event. Same class of decision as `GUARD_TUNING`.
  chance: 1 / 3,
}

/** The furthest any warren cell can be from its site centre. `sites.ts` clips columns against it. */
export const WARREN_REACH = DEFAULT_WARREN.envelope

/**
 * Does this ruin have a way down? Pure, O(1), and keyed on `site.seed` alone.
 *
 * ★ ITS OWN SALT, which is the whole reason this is safe to add. The roll consumes nothing from
 * the ruin's stream — `ruinPlan` draws on `0x57a7`, `0x51e5`, `0x5f1a` and `0x2c0de`, and touching
 * none of them is what keeps every existing ruin exactly where it was.
 */
export function hasDescent(site: Site, cfg: WarrenConfig = DEFAULT_WARREN): boolean {
  return hash2(site.x + 5, site.z + 11, site.seed ^ 0xde5ce) < cfg.chance
}

/** The floor a warren under this site is cut at, or null if the ground is too thin to hold one. */
export function warrenFloor(site: Site, cfg: WarrenConfig = DEFAULT_WARREN): number | null {
  const y = site.floor - cfg.depth
  return y < cfg.minFloor ? null : y
}

export interface WarrenPart {
  def: WarrenPieceDef
  /** Inclusive block bounds, world coords. */
  x0: number; x1: number; z0: number; z1: number
  /** Every room shares one floor — a warren is dug, not seated. */
  floor: number
  /** Doorway cells punched through this room's wall, world coords. */
  doors: { x: number; z: number }[]
}

/**
 * Is there still enough rock over this box to hide a room of height `h`?
 *
 * ★ THE ONE WARREN-SPECIFIC PREDICATE. It reads the GENERATED surface, never the column being
 * written, so it answers identically from every column — the property the whole file rests on.
 */
function enoughCover(
  x0: number, x1: number, z0: number, z1: number, floor: number, h: number,
  worldSeed: number, hcfg: HeightConfig, cover: number,
): boolean {
  const need = floor + h + 1 + cover
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      if (columnHeight(x, z, worldSeed, hcfg) < need) return false
    }
  }
  return true
}

/**
 * ── ★ THE ASSEMBLY ───────────────────────────────────────────────────────────────────────────
 * Breadth-first from the foot of the shaft, which sits under the ruin's start piece at the site
 * centre. Empty when this ruin has no descent, or when the ground is too thin.
 *
 * ⚠ TWO SEEDS, AND `ruins.ts` PAID FOR THIS LESSON ALREADY: `site.seed` decides WHICH rooms
 * assemble, `worldSeed` is the only thing `columnHeight` answers honestly to. Passing the wrong one
 * to the cover check would seat a warren against a world that does not exist — the same shape as
 * the 1647 floating wall cells, except underground, where nobody would ever see it.
 * ★ The salt differs from `ruinPlan`'s so the warren's own stream is independent of the ruin's.
 */
export function warrenPlan(
  site: Site, worldSeed: number, cfg: WarrenConfig = DEFAULT_WARREN, hcfg: HeightConfig = DEFAULT_HEIGHT,
): WarrenPart[] {
  if (!hasDescent(site, cfg)) return []
  const floor = warrenFloor(site, cfg)
  if (floor === null) return []

  return assemble<WarrenPieceDef>(
    // ⚠ The seed is MIXED, not reused. Handing `assemble` the raw `site.seed` would make the
    // warren's socket rolls correlate with the ruin's above it — same salts, same coordinates —
    // and the two layouts would visibly rhyme. They are separate buildings.
    { x: site.x, z: site.z, seed: (site.seed ^ 0x1077e5) | 0, floor },
    WARREN_PIECES, cfg,
    (box, def) => (enoughCover(box.x0, box.x1, box.z0, box.z1, floor, def.h, worldSeed, hcfg, cfg.cover) ? floor : null),
  )
}

/**
 * Which room holds the cache: the one whose centre is furthest from the shaft, ties broken by the
 * part's own index so the answer never depends on anything but the plan.
 *
 * ★ FURTHEST, NOT ROLLED, AND IT IS A DESIGN CLAIM. A rolled room puts the cache next to the
 * stairs a twelfth of the time, and the one thing a descent may not be is a room you glance into.
 * Furthest also means the vault — the rarest, tallest piece — usually wins it without being
 * special-cased, because a big room is placed late and late is far.
 */
export function cacheCell(parts: WarrenPart[], site: Site): { x: number; y: number; z: number } | null {
  if (parts.length < 2) return null          // the shaft's own landing room never holds it
  let best = -1, bestD = -1
  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]!
    const cx = (p.x0 + p.x1) >> 1, cz = (p.z0 + p.z1) >> 1
    const d = Math.abs(cx - site.x) + Math.abs(cz - site.z)
    if (d > bestD) { bestD = d; best = i }
  }
  if (best < 0) return null
  const p = parts[best]!
  return { x: (p.x0 + p.x1) >> 1, y: p.floor + 1, z: (p.z0 + p.z1) >> 1 }
}

/**
 * The 3×3 shaft's perimeter, as a CYCLE — each cell orthogonally adjacent to the next, so a step
 * per cell descends as a true spiral rather than a scatter of blocks at falling heights.
 * The centre is deliberately absent: it is the newel, and it stays solid so the well cannot be
 * fallen down. A 9-block drop onto stone is the difference between a way in and a trap.
 */
const SPIRAL: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0],
]

/**
 * Write every block of `site`'s warren that lands inside this column. Same contract as `buildRuin`:
 * bounded writes, clipped to the column, and any column touching the warren reproduces its own
 * slice from the plan alone.
 *
 * ⚠ ORDER IS LOAD-BEARING AND IT IS ONE LINE: the shaft is cut AFTER the rooms. The landing room
 * writes a ceiling across its whole footprint, and the shaft comes down through the middle of it —
 * cut first, the ceiling would seal it, and the descent would end in solid rock with the stair
 * still visible above. Rooms then shaft; never the other way round.
 */
export function buildWarren(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, site: Site,
  worldSeed: number, cfg: WarrenConfig = DEFAULT_WARREN, hcfg: HeightConfig = DEFAULT_HEIGHT,
): void {
  const parts = warrenPlan(site, worldSeed, cfg, hcfg)
  if (!parts.length) return

  const yTop = oy0 + sections.length * size
  const put = (wx: number, wy: number, wz: number, mat: number) => {
    if (wx < ox || wx >= ox + size || wz < oz || wz >= oz + size) return
    if (wy < oy0 || wy >= yTop) return
    const si = ((wy - oy0) / size) | 0
    const sec = sections[si]
    if (!sec) return
    sec.set(wx - ox, wy - oy0 - si * size, wz - oz, mat)
  }

  // ── ★★★ TWO PASSES, AND THE SECOND ONE IS NOT TIDINESS — IT IS THE FIX FOR A REAL DEFECT ─────
  // Found by this file's own oracle on the first run: a `run` room 9 long had 12 of its 21 interior
  // cells filled with brick, and the brick belonged to a VAULT next door.
  //
  // ★ `jigsaw.ts`'s AABB-reject compares INTERIORS, on purpose — *"two rooms SHARING a wall are
  // legal, two rooms overlapping are not."* But *"our interiors do not overlap"* and *"your wall
  // does not land in my interior"* are DIFFERENT CLAIMS, and the gap between them is exactly one
  // cell wide. Two rooms can sit one apart, pass the reject cleanly, and still have the second's
  // wall course written straight down the middle of the first. Measured: interiors x=[-12408] and
  // x=[-12407..-12403] are genuinely disjoint, and the vault's west wall at x=-12408 is the run's
  // only interior column.
  //
  // ⚠⚠ AND IT IS HARMLESS ABOVE GROUND, WHICH IS WHY NOTHING CAUGHT IT BEFORE. A ruin's interior is
  // a scatter of rubble, so another ruin's wall crossing it reads as architecture — you cannot tell
  // by looking. Underground it SEALS A ROOM: the room is still in the plan, still has its doorway,
  // and is solid brick. This is the same shape as every entry in PATTERNS about two consumers
  // agreeing about one property and disagreeing about another nobody was checking.
  //
  // ⛔ THE FIX MAY NOT GO IN `jigsaw.ts`. Tightening the reject there would change which pieces are
  // accepted and silently regenerate every ruin in the world — the exact cost `ruin-hash.mts`
  // exists to measure, spent to fix a bug ruins do not have. So the warren pays for it locally, in
  // the only place that cares: SHELLS first, then HOLLOW every interior. A cell that is interior to
  // any room ends as air no matter which room's wall was written over it, and the ordering is a
  // property of the whole warren rather than of the pair that collided.
  //
  // ★ WHERE TWO ROOMS REALLY DID GROW INTO EACH OTHER, THIS JOINS THEM, and that is the right
  // answer rather than a tolerated side effect: the alternative is a sealed room behind a doorway.
  // A warren whose rooms have eaten into one another is a warren.
  const shell = (p: WarrenPart) => {
    const isDoor = (x: number, z: number) => p.doors.some(d => d.x === x && d.z === z)
    const top = p.floor + p.def.h
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = p.x0; x <= p.x1; x++) {
        const onWall = x === p.x0 || x === p.x1 || z === p.z0 || z === p.z1
        // The floor course: dressed, because somebody cut these rooms and a floor is what you see.
        put(x, p.floor, z, MAT.MOSSY_CUT_STONE)
        if (onWall && !isDoor(x, z)) {
          // A course of brick, weathered per WORLD position so a shared wall reads the same from
          // either room — the same rule `ruins.ts` uses, and for the same reason.
          for (let y = p.floor + 1; y <= top; y++) {
            put(x, y, z, hash2(x + 5, z * 3 + y, site.seed ^ 0xb41c) < 0.34
              ? MAT.CRACKED_STONE_BRICK : MAT.MOSSY_STONE_BRICK)
          }
        }
        // The ceiling closes the room off from whatever rock is above it.
        put(x, top + 1, z, MAT.CRACKED_STONE_BRICK)
      }
    }
  }
  const hollow = (p: WarrenPart) => {
    const isDoor = (x: number, z: number) => p.doors.some(d => d.x === x && d.z === z)
    const top = p.floor + p.def.h
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = p.x0; x <= p.x1; x++) {
        const onWall = x === p.x0 || x === p.x1 || z === p.z0 || z === p.z1
        // Interiors and doorways both: an opening is the whole cell, floor to top.
        if (onWall && !isDoor(x, z)) continue
        for (let y = p.floor + 1; y <= top; y++) put(x, y, z, AIR)
      }
    }
  }
  for (const p of parts) shell(p)
  for (const p of parts) hollow(p)

  // ── the cache ──
  const cell = cacheCell(parts, site)
  if (cell) put(cell.x, cell.y, cell.z, MAT.CACHE)

  // ── the shaft, last ──
  const floor = parts[0]!.floor
  for (let y = floor + 1; y <= site.floor; y++) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        // ⚠ THE NEWEL STOPS ONE ABOVE THE WARREN FLOOR AND THE LAST LEVEL IS ALL AIR. Run it to the
        // bottom and the post stands in the middle of the landing room — the stairs deliver you
        // into a pillar, and `warren.test.ts` reports the landing as sealed, which is what it did.
        // There is nothing to fall down at the last step, so there is nothing for it to guard.
        const newel = dx === 0 && dz === 0 && y > floor + 1
        put(site.x + dx, y, site.z + dz, newel ? MAT.MOSSY_CUT_STONE : AIR)
      }
    }
  }
  // One tread per level, walking the perimeter cycle: a spiral you can climb back out of.
  for (let y = site.floor, k = 0; y > floor; y--, k++) {
    const [dx, dz] = SPIRAL[k % SPIRAL.length]!
    put(site.x + dx, y, site.z + dz, MAT.MOSSY_CUT_STONE)
  }
}
