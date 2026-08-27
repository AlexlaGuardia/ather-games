// Ruins — the JIGSAW ASSEMBLER. What actually stands on a site, as pure math over (site.seed).
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★ THE GAP THIS CLOSES ────────────────────────────────────────────────────────────────────
// `sites.ts` shipped Minecraft's PLACEMENT layer — cells, one jittered candidate, a failed
// candidate kills the cell — and it is tuned and correct. What it emitted was one 11×11 rectangle,
// varied only by a crumble hash. So every ruin in the world was the same building. Placement was
// solved; the BUILDING was not.
//
// ── ★ THE STEAL, NAMED (WORLDGEN-RESEARCH › structure placement; dug 2026-08-24) ─────────────
// Minecraft's villages and bastions are not authored buildings, they are ASSEMBLED ones: a start
// piece, connectors that name a pool, breadth-first expansion, and two rules that keep it sane —
//   • **AABB-reject.** A candidate whose box overlaps an already-placed piece is thrown away and
//     another is rolled. This is what stops a generator from growing a building through itself.
//   • **A terminator pool.** At max depth a connector draws from a pool of dead-ends instead, so
//     no branch is left hanging open. Without it the last ring of rooms all have doors to nowhere.
// Also taken: breadth-first (not depth-first) expansion, so the ruin grows in rings and its shape
// is decided near the centre rather than by one lucky corridor sprinting for the envelope.
//
// ── ★★ THE INVARIANT EVERYTHING HERE BENDS AROUND: THE ASSEMBLY IS PURE ──────────────────────
// `sites.ts` calls chunk-local purity *"the property that keeps trees safe"*, and it is the reason
// a ruin can cross a chunk seam at all: every column that a ruin touches re-derives the WHOLE ruin
// from `(site.seed)` alone and writes only its own slice. So `ruinPlan` may never depend on which
// column is asking — no accumulation, no global pass, no "place as you stream". It is a plan
// computed identically 9 times over, and that redundancy is the price of never having a seam.
// ⚠ THIS IS THE ONE THING NOT TO OPTIMISE BY MAKING IT STATEFUL. A cache keyed on the site is
// fine (same input, same output); anything that makes the answer depend on ARRIVAL ORDER puts a
// half-ruin on one side of a boundary and a different half on the other, and both sides look
// internally consistent — the failure mode this whole file is shaped to make impossible.
//
// ⚠ STILL A BLOCKOUT, STILL CLAIMING NOTHING. `sites.ts`'s header stands: WHAT stands in drained
// garden-country is a canon question filed in CANON_GAPS, so this assembles neutral broken stone
// and rubble — both already mineable, already textured, no new material and no new name. The
// assembler is the plumbing; the dressing swaps when Magii rules, and the plumbing does not change.

import { hash2 } from './noise'
import { assemble, type JigsawPiece, type Dir } from './jigsaw'
import { columnHeight, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { MAT } from './depth'
import { Section } from './section'
// ⚠ TYPE-ONLY, and it has to stay that way: `sites.ts` imports `buildRuin` from here at RUNTIME,
// so a value import in this direction would close a module cycle. `import type` is erased.
import type { Site } from './sites'

// ── ★★ TWO SEEDS, AND CONFLATING THEM IS THE BUG THIS FILE ALREADY MADE ONCE ─────────────────
// `site.seed` is a per-site stream (mixSeed of the cell roll) and decides WHICH pieces assemble.
// `worldSeed` is the world's own seed and is the only thing `columnHeight` will answer honestly
// to. The first draft passed `site.seed` to both, so every piece seated at a height taken from a
// world that does not exist: **1647 of 4840 wall cells floated**, and it looked like architecture
// from every angle except the one the oracle takes. Nothing else in the pipeline would have said a
// word. `worldSeed` is a required argument here for exactly that reason — a default would let a
// caller re-make the mistake silently, and the whole point of a required parameter is that the
// compiler asks the question at every call site.

// ⚠ RE-EXPORTED, NOT REDECLARED. `Dir` moved to `jigsaw.ts` with the assembler; consumers that
// imported it from here keep working, and there is exactly one definition of it.
export type { Dir }

export interface RuinPieceDef extends JigsawPiece {
  id: string
  /** Extents in blocks. BOTH ODD — a piece has to have a centre column for its sockets to sit on. */
  w: number
  d: number
  /** Wall height above the piece's own floor. 0 = no walls at all, just a rubble bed. */
  h: number
  /** Roll weight within its pool. */
  weight: number
  /** Terminator pool member: only ever placed to close a branch, never to extend one. */
  terminal?: boolean
}

/**
 * The pool. Small on purpose — six shapes assemble into far more than six buildings, and a bigger
 * catalogue is worth nothing until Alex has walked a few and said what a ruin should FEEL like.
 *
 * ⚠ Every extent is ODD. A socket sits at the midpoint of an edge, and an even edge has no
 * midpoint — it would round, and the round would break the "a doorway is on a shared wall" assert
 * in ways that only show up on one of the four sides.
 */
export const RUIN_PIECES: RuinPieceDef[] = [
  { id: 'hall',     w: 9, d: 7, h: 3, weight: 3 },
  { id: 'cell',     w: 5, d: 5, h: 2, weight: 4 },
  { id: 'court',    w: 7, d: 7, h: 1, weight: 2 },   // a knee-high wall: a yard, not a room
  { id: 'corridor', w: 3, d: 5, h: 2, weight: 3 },
  // ── terminators ──
  { id: 'cap',      w: 3, d: 3, h: 2, weight: 1, terminal: true },
  { id: 'heap',     w: 3, d: 3, h: 0, weight: 2, terminal: true },   // collapsed: rubble, no wall
]

export interface RuinConfig {
  /**
   * ★★ THE ENVELOPE, AND IT IS A CORRECTNESS BOUND, NOT A TASTE KNOB. No cell of any piece may sit
   * more than this many blocks from the site centre. `sites.ts` scans exactly ONE ring of cells
   * (`siteScanCells === 1`) and that is only sound while a structure cannot leave its own cell —
   * the jitter keeps a candidate `separation` columns (48 blocks at default) off its cell edge, so
   * the inequality is `separation * 16 > envelope + 1`. At 22 vs 48 there is room to grow the pool
   * without re-deriving the scan; past ~46 the scan radius must go up first or ruins lose slices
   * at cell seams, silently, on one side only. `ruins.test.ts` asserts the inequality.
   */
  envelope: number
  /** Hard cap on pieces. Bounds both the ruin's size and the per-column cost of re-deriving it. */
  maxPieces: number
  /** Sockets this many links from the start draw from the TERMINATOR pool instead. */
  maxDepth: number
  /** Rolls per socket before it gives up and tries to terminate. */
  tries: number
  /** A piece refuses ground whose span across its own footprint exceeds this. */
  pieceSpan: number
  /**
   * ★ THE CHANCE A SOCKET EXPANDS AT ALL — and it is what makes a ruin a RUIN rather than a
   * complex. Without it every assembly runs to `maxPieces` and stops there: the first honest run
   * of the oracle reported *678 distinct shapes, and every single one nine pieces*. High variety,
   * one size, which reads on the ground as "every ruin is a big ruin". A closed socket leaves a
   * plain wall (no door is punched until a piece is actually placed), so the cheap collapse to
   * one lonely room is a legal building and not a bug.
   */
  sprawl: number
  /**
   * ★ EACH SITE ROLLS ITS OWN PIECE BUDGET, and this is the knob that decides what a ruin IS.
   * `sprawl` alone could not do it: breadth-first expansion opens three sockets per piece, so the
   * queue outruns any per-socket coin and the assembly saturates at `maxPieces` — measured, at
   * sprawl 0.4 through 0.75, **37% → 98% of ruins hit the cap**. A budget rolled per SITE moves
   * the whole distribution instead of thinning its edges. `r ** sizeBias` biases the roll toward
   * small: at 2.2 most ruins are one to three rooms and a big complex is a thing you FIND.
   * ⚠ Tuned by sweep (`scripts/ruin-sweep.mts`), not by eye — same discipline as the
   * density sweep in sites.ts, and re-sweep it if the pool's piece sizes change.
   */
  sizeBias: number
}

export const DEFAULT_RUINS: RuinConfig = {
  envelope: 22,
  maxPieces: 9,
  maxDepth: 3,
  tries: 6,
  pieceSpan: 2,
  sprawl: 0.8,
  sizeBias: 2.2,
}

/** The furthest any ruin cell can be from its site centre. `sites.ts` clips columns against this. */
export const RUIN_REACH = DEFAULT_RUINS.envelope

export interface RuinPart {
  def: RuinPieceDef
  /** Inclusive block bounds, world coords. */
  x0: number; x1: number; z0: number; z1: number
  /** This piece's own floor: the LOWEST surface under its footprint, so it can never float. */
  floor: number
  /** Doorway cells punched through this piece's wall, world coords. */
  doors: { x: number; z: number }[]
}

interface Socket { x: number; z: number; dir: Dir; depth: number }

/** The lowest and highest generated surface under a footprint. The pad test, per piece. */
function groundSpan(
  x0: number, x1: number, z0: number, z1: number, seed: number, hcfg: HeightConfig,
): { mn: number; mx: number } {
  let mn = Infinity, mx = -Infinity
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const h = columnHeight(x, z, seed, hcfg)
      if (h < mn) mn = h
      if (h > mx) mx = h
    }
  }
  return { mn, mx }
}

/**
 * ── ★ THE ASSEMBLY ───────────────────────────────────────────────────────────────────────────
 * Breadth-first from a start piece at the site centre. Every roll is keyed on `(site.seed, the
 * socket's own coordinates, the attempt number)` — never on a counter, never on arrival order —
 * which is what makes this reproducible from any column that asks.
 *
 * A socket that finds nothing tries the terminator pool, and a socket that finds nothing THERE is
 * simply left closed: no door is punched until a piece is actually placed, so a dead socket leaves
 * a plain wall rather than an opening onto nothing.
 */
export function ruinPlan(
  site: Site, worldSeed: number, cfg: RuinConfig = DEFAULT_RUINS, hcfg: HeightConfig = DEFAULT_HEIGHT,
): RuinPart[] {
  // ★ THE GROUND HAS THE LAST WORD, and for a ruin that word is "flat enough". A branch DIES where
  // the country stops being buildable, which reads as a ruin that grew along the flat and crumbled
  // at the slope. This predicate is the only ruin-specific thing left in the assembly.
  return assemble<RuinPieceDef>(
    { x: site.x, z: site.z, seed: site.seed, floor: site.floor },
    RUIN_PIECES, cfg,
    (box) => {
      const g = groundSpan(box.x0, box.x1, box.z0, box.z1, worldSeed, hcfg)
      return g.mx - g.mn > cfg.pieceSpan ? null : g.mn
    },
    // A rubble heap has no walls, so nothing can hang a door on it.
    def => def.h > 0,
  )
}

/** The wall height this cell wants, 0 = crumbled through. Keyed on WORLD position, so a shared
 *  wall crumbles the same from either room. */
function wallHeightAt(x: number, z: number, rseed: number, max: number): number {
  const g = hash2(x + 64, z + 64, rseed ^ 0x8a11)
  if (g < 0.30) return 0
  const c = hash2(z + 128, x + 128, rseed ^ 0x77a1)
  return 1 + Math.floor(c * max)
}

/**
 * Write every block of `site`'s ruin that lands inside this column. Same contract as growTree:
 * bounded writes, clipped to the column, any column touching the ruin reproduces its own slice.
 */
export function buildRuin(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, site: Site,
  worldSeed: number, cfg: RuinConfig = DEFAULT_RUINS, hcfg: HeightConfig = DEFAULT_HEIGHT,
): void {
  const yTop = oy0 + sections.length * size
  const put = (wx: number, wy: number, wz: number, mat: number) => {
    if (wx < ox || wx >= ox + size || wz < oz || wz >= oz + size) return
    if (wy < oy0 || wy >= yTop) return
    const si = ((wy - oy0) / size) | 0
    const sec = sections[si]
    if (!sec) return
    sec.set(wx - ox, wy - oy0 - si * size, wz - oz, mat)
  }

  for (const p of ruinPlan(site, worldSeed, cfg, hcfg)) {
    const isDoor = (x: number, z: number) => p.doors.some(d => d.x === x && d.z === z)
    for (let z = p.z0; z <= p.z1; z++) {
      for (let x = p.x0; x <= p.x1; x++) {
        const onWall = x === p.x0 || x === p.x1 || z === p.z0 || z === p.z1
        if (onWall && p.def.h > 0) {
          if (isDoor(x, z)) continue                       // an opening is the whole cell, floor to top
          const h = wallHeightAt(x, z, site.seed, p.def.h)
          if (h === 0) {
            // Crumbled through — half the time the stone is still lying where it fell.
            if (hash2(x + 9, z + 9, site.seed ^ 0x5ee) < 0.5) put(x, p.floor, z, MAT.RUBBLE)
            continue
          }
          // Base AT the piece's own lowest surface: on the low side the wall replaces the surface
          // block, on the high side its first course sits buried. Never floating, by construction.
          for (let y = p.floor; y <= p.floor + h; y++) put(x, y, z, MAT.STONE)
        } else if (!onWall || p.def.h === 0) {
          // Interior (and the whole footprint of a collapsed piece): a scatter of fallen stone.
          if (hash2(x + 31, z + 17, site.seed ^ 0xd1e) < 0.08) put(x, p.floor, z, MAT.RUBBLE)
        }
      }
    }
  }
}
