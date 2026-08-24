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

/** Which way a socket faces. 0 = +x, 1 = -x, 2 = +z, 3 = -z. Same order as holds.ts's gates. */
export type Dir = 0 | 1 | 2 | 3

export interface RuinPieceDef {
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

/** Weighted pick from a pool by a roll in [0,1). */
function pick(pool: RuinPieceDef[], r: number): RuinPieceDef {
  let total = 0
  for (const p of pool) total += p.weight
  let t = r * total
  for (const p of pool) { t -= p.weight; if (t < 0) return p }
  return pool[pool.length - 1]
}

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

/** Interiors, not boxes — two rooms SHARING a wall are legal, two rooms overlapping are not. */
function interiorsOverlap(a: RuinPart, b: { x0: number; x1: number; z0: number; z1: number }): boolean {
  return a.x0 + 1 <= b.x1 - 1 && b.x0 + 1 <= a.x1 - 1 && a.z0 + 1 <= b.z1 - 1 && b.z0 + 1 <= a.z1 - 1
}

/** The four edge-midpoint sockets of a placed part, minus the one it was entered through. */
function socketsOf(p: RuinPart, entry: Dir | -1, depth: number): Socket[] {
  const cx = (p.x0 + p.x1) >> 1, cz = (p.z0 + p.z1) >> 1
  const all: Socket[] = [
    { x: p.x1, z: cz, dir: 0, depth },
    { x: p.x0, z: cz, dir: 1, depth },
    { x: cx, z: p.z1, dir: 2, depth },
    { x: cx, z: p.z0, dir: 3, depth },
  ]
  // The entry side faces back at the parent; re-opening it would roll a piece straight into it.
  const back: Record<number, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 }
  return entry === -1 ? all : all.filter(s => s.dir !== back[entry])
}

/** Where a piece of these extents lands if it hangs off `s`, SHARING the wall it connects through. */
function boxAt(s: Socket, def: RuinPieceDef) {
  if (s.dir === 0) { const z0 = s.z - (def.d >> 1); return { x0: s.x, x1: s.x + def.w - 1, z0, z1: z0 + def.d - 1 } }
  if (s.dir === 1) { const z0 = s.z - (def.d >> 1); return { x0: s.x - def.w + 1, x1: s.x, z0, z1: z0 + def.d - 1 } }
  if (s.dir === 2) { const x0 = s.x - (def.w >> 1); return { x0, x1: x0 + def.w - 1, z0: s.z, z1: s.z + def.d - 1 } }
  const x0 = s.x - (def.w >> 1); return { x0, x1: x0 + def.w - 1, z0: s.z - def.d + 1, z1: s.z }
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
  const ext = RUIN_PIECES.filter(p => !p.terminal)
  const term = RUIN_PIECES.filter(p => p.terminal)

  // ★ THE START PIECE IS ROLLED, NOT FIXED, and the oracle is why. With a hardcoded start every
  // one-piece ruin was the identical 9×7 hall — and after the size budget landed, one-piece ruins
  // are a THIRD of all of them. So the exact bug this file was written to kill (every ruin is the
  // same ruin) had quietly survived inside the most common case, in a build whose variety assert
  // otherwise read 45%. A pool the assembler already has is the whole fix.
  const start = pick(ext, hash2(site.z, site.x, site.seed ^ 0x57a7))
  const parts: RuinPart[] = [{
    def: start,
    x0: site.x - (start.w >> 1), x1: site.x + (start.w >> 1),
    z0: site.z - (start.d >> 1), z1: site.z + (start.d >> 1),
    floor: site.floor,
    doors: [],
  }]

  // This ruin's own size, rolled once. Biased small — see `sizeBias`.
  const budget = 1 + Math.floor(hash2(site.x, site.z, site.seed ^ 0x51e5) ** cfg.sizeBias * cfg.maxPieces)

  // ★★ A DOORWAY IS A PROPERTY OF THE CELL, NOT OF THE PAIR THAT MADE IT. Kept as one list and
  // handed to every piece that covers it at the end — because a piece placed LATER can share the
  // wall an older door sits in without being its parent, and a piece that does not know about a
  // door draws its wall straight back over the opening. Punching it into the two pieces present
  // at the time left **10 doorways bricked up** across a 681-ruin sweep, and every one of them
  // looked like an ordinary wall.
  const doors: { x: number; z: number }[] = []

  const queue: Socket[] = socketsOf(parts[0], -1, 1)
  while (queue.length && parts.length < budget) {
    const s = queue.shift()!
    // Does this way even continue? Rolled before anything is spent, and keyed on the socket's own
    // world position so it answers the same from every column.
    if (hash2(s.x + 7, s.z + 13, site.seed ^ 0x5f1a) >= cfg.sprawl) continue
    const pool = s.depth >= cfg.maxDepth ? term : ext
    let placed: RuinPart | null = null

    for (let a = 0; a < cfg.tries && !placed; a++) {
      // Two independent draws: WHICH piece, and (at the last attempt) whether to give up and cap.
      const r = hash2(s.x * 3 + a, s.z * 5 + s.dir, site.seed ^ 0x2c0de)
      const def = pick(a === cfg.tries - 1 && pool !== term ? term : pool, r)
      const box = boxAt(s, def)

      // 1. the envelope — a correctness bound, checked before anything expensive
      if (box.x0 < site.x - cfg.envelope || box.x1 > site.x + cfg.envelope) continue
      if (box.z0 < site.z - cfg.envelope || box.z1 > site.z + cfg.envelope) continue
      // 2. AABB-reject, on interiors so a shared wall stays legal
      if (parts.some(p => interiorsOverlap(p, box))) continue
      // 3. the ground has the last word. A branch DIES where the country stops being buildable,
      //    which reads as a ruin that grew along the flat and crumbled at the slope.
      const g = groundSpan(box.x0, box.x1, box.z0, box.z1, worldSeed, hcfg)
      if (g.mx - g.mn > cfg.pieceSpan) continue

      placed = { def, ...box, floor: g.mn, doors: [] }
    }

    if (!placed) continue
    doors.push({ x: s.x, z: s.z })
    parts.push(placed)
    if (placed.def.h > 0) for (const ns of socketsOf(placed, s.dir, s.depth + 1)) queue.push(ns)
  }
  for (const p of parts) p.doors = doors.filter(d => p.x0 <= d.x && d.x <= p.x1 && p.z0 <= d.z && d.z <= p.z1)
  return parts
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
