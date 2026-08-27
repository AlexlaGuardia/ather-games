// The jigsaw assembler — how a structure grows from a pool of shapes.
//
// ★ PURE CORE. No react/three/DOM, and it imports nothing from outside this folder. It knows about
// boxes, sockets and seeds; it does not know what a ruin is, what a burrow is, or what a block is.
//
// ── ★ EXTRACTED FROM `ruins.ts` 2026-08-27, DELIBERATELY WITHOUT CHANGING ANYTHING ────────────
// The machinery Minecraft's villages and bastions are built on — a start piece, connectors that
// name a pool, breadth-first expansion, AABB-reject, a terminator pool at max depth — was already
// here, written, tuned by sweep and asserted over a 681-ruin oracle. It was simply typed to
// `RuinPieceDef` with `RUIN_PIECES` reached for from inside the function, so it could assemble
// exactly one kind of building.
//
// Alex, 2026-08-27, on wanting settlements and burrows: *"how to best slap together the puzzle
// pieces."* This IS that, and it existed. The pool becomes a parameter, and holds, hamlets and
// burrow warrens can each bring their own.
//
// ⚠⚠ THIS IS AN EXTRACTION AND NOT A REWRITE, WHICH IS A CONSTRAINT ON ITS CORRECTNESS, NOT A
// DESCRIPTION OF ITS SIZE. Ruins are TUNED — `sizeBias` came off `scripts/ruin-sweep.mts`, the
// door list was fixed after 10 bricked-up doorways in a 681-ruin sweep, the start piece is rolled
// because a fixed one made every one-piece ruin identical. Every hash salt below is the one that
// was there. A "tidier" salt, a reordered draw or a changed loop bound silently regenerates every
// ruin in the world, and nothing downstream would report it. Equivalence was proven by hashing
// `ruinPlan` over 641 sites before and after: `dc703495d76c5250eaf1`, unchanged.
//
// ⚠ SEED DISCIPLINE, INHERITED AND STILL LOAD-BEARING. Every roll is keyed on `(the structure's
// own seed, the socket's WORLD coordinates, the attempt number)` — never a counter, never arrival
// order — which is what lets any column re-derive the same assembly without talking to any other
// column. Introducing a counter here would break generation across chunk borders in a way that
// only shows at seams.

import { hash2 } from './noise'

/** Which way a socket faces. 0 = +x, 1 = -x, 2 = +z, 3 = -z. Same order as holds.ts's gates. */
export type Dir = 0 | 1 | 2 | 3

export interface JigsawPiece {
  id: string
  /** Extents in blocks. BOTH ODD — a piece has to have a centre column for its sockets to sit on. */
  w: number
  d: number
  /** Roll weight within its pool. */
  weight: number
  /** Terminator pool member: only ever placed to close a branch, never to extend one. */
  terminal?: boolean
}

export interface JigsawConfig {
  /** ★ A CORRECTNESS BOUND, NOT A TASTE KNOB — no cell may sit further than this from the origin.
   *  Callers scan a bounded ring of cells; this is what keeps a structure inside its own. */
  envelope: number
  /** Hard cap on pieces. Bounds size AND the per-column cost of re-deriving the assembly. */
  maxPieces: number
  /** Sockets this many links from the start draw from the TERMINATOR pool instead. */
  maxDepth: number
  /** Rolls per socket before it gives up and tries to terminate. */
  tries: number
  /** The chance a socket expands at all. Without it every assembly runs to `maxPieces`. */
  sprawl: number
  /** `r ** sizeBias` biases the per-structure budget toward small. Tune by sweep, never by eye. */
  sizeBias: number
}

export interface Box { x0: number; x1: number; z0: number; z1: number }

export interface JigsawPart<P extends JigsawPiece> extends Box {
  def: P
  /** This part's own floor, as answered by the caller's ground rule. */
  floor: number
  /** Doorway cells punched through this part's wall, world coords. */
  doors: { x: number; z: number }[]
}

/**
 * The caller's terrain rule: may a piece of these extents stand on this box, and if so, at what
 * floor? `null` rejects.
 *
 * ★ THIS IS THE SEAM THAT MAKES THE ASSEMBLER REUSABLE. A ruin dies where the country stops being
 * flat; a burrow wants the opposite (it needs a BANK to dig into); a hamlet wants to follow a road.
 * All three are the same breadth-first assembly disagreeing about one predicate.
 */
export type GroundRule<P extends JigsawPiece> = (box: Box, def: P) => number | null

/** Weighted pick from a pool by a roll in [0,1). */
export function pick<P extends JigsawPiece>(pool: P[], r: number): P {
  let total = 0
  for (const p of pool) total += p.weight
  let t = r * total
  for (const p of pool) { t -= p.weight; if (t < 0) return p }
  return pool[pool.length - 1]
}

/** Interiors, not boxes — two rooms SHARING a wall are legal, two rooms overlapping are not. */
export function interiorsOverlap(a: Box, b: Box): boolean {
  return a.x0 + 1 <= b.x1 - 1 && b.x0 + 1 <= a.x1 - 1 && a.z0 + 1 <= b.z1 - 1 && b.z0 + 1 <= a.z1 - 1
}

interface Socket { x: number; z: number; dir: Dir; depth: number }

/** The four edge-midpoint sockets of a placed part, minus the one it was entered through. */
function socketsOf(p: Box, entry: Dir | -1, depth: number): Socket[] {
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
function boxAt(s: Socket, def: JigsawPiece): Box {
  if (s.dir === 0) { const z0 = s.z - (def.d >> 1); return { x0: s.x, x1: s.x + def.w - 1, z0, z1: z0 + def.d - 1 } }
  if (s.dir === 1) { const z0 = s.z - (def.d >> 1); return { x0: s.x - def.w + 1, x1: s.x, z0, z1: z0 + def.d - 1 } }
  if (s.dir === 2) { const x0 = s.x - (def.w >> 1); return { x0, x1: x0 + def.w - 1, z0: s.z, z1: s.z + def.d - 1 } }
  const x0 = s.x - (def.w >> 1); return { x0, x1: x0 + def.w - 1, z0: s.z - def.d + 1, z1: s.z }
}

/**
 * ── ★ THE ASSEMBLY ───────────────────────────────────────────────────────────────────────────
 * Breadth-first from a start piece at the origin.
 *
 * A socket that finds nothing tries the terminator pool, and a socket that finds nothing THERE is
 * simply left closed: no door is punched until a piece is actually placed, so a dead socket leaves
 * a plain wall rather than an opening onto nothing.
 *
 * ★★ A DOORWAY IS A PROPERTY OF THE CELL, NOT OF THE PAIR THAT MADE IT. Kept as one list and
 * handed to every piece that covers it at the end — because a piece placed LATER can share the
 * wall an older door sits in without being its parent, and a piece that does not know about a door
 * draws its wall straight back over the opening. Punching it into the two pieces present at the
 * time left **10 doorways bricked up** across a 681-ruin sweep, and every one looked like a wall.
 *
 * @param sprouts Does a placed piece open further sockets? Ruins say no to a rubble heap — it has
 *   no walls to hang a door on. Defaults to yes.
 */
export function assemble<P extends JigsawPiece>(
  origin: { x: number; z: number; seed: number; floor: number },
  pool: P[],
  cfg: JigsawConfig,
  ground: GroundRule<P>,
  sprouts: (def: P) => boolean = () => true,
): JigsawPart<P>[] {
  const ext = pool.filter(p => !p.terminal)
  const term = pool.filter(p => p.terminal)

  // ★ THE START PIECE IS ROLLED, NOT FIXED, and the oracle is why. With a hardcoded start every
  // one-piece structure was identical — and one-piece is a THIRD of all of them, so the exact bug
  // this machinery exists to kill survived inside its most common case.
  const start = pick(ext, hash2(origin.z, origin.x, origin.seed ^ 0x57a7))
  const parts: JigsawPart<P>[] = [{
    def: start,
    x0: origin.x - (start.w >> 1), x1: origin.x + (start.w >> 1),
    z0: origin.z - (start.d >> 1), z1: origin.z + (start.d >> 1),
    floor: origin.floor,
    doors: [],
  }]

  // This structure's own size, rolled once. Biased small — see `sizeBias`.
  const budget = 1 + Math.floor(hash2(origin.x, origin.z, origin.seed ^ 0x51e5) ** cfg.sizeBias * cfg.maxPieces)

  const doors: { x: number; z: number }[] = []
  const queue: Socket[] = socketsOf(parts[0], -1, 1)

  while (queue.length && parts.length < budget) {
    const s = queue.shift()!
    // Does this way even continue? Rolled before anything is spent, and keyed on the socket's own
    // world position so it answers the same from every column.
    if (hash2(s.x + 7, s.z + 13, origin.seed ^ 0x5f1a) >= cfg.sprawl) continue
    const usePool = s.depth >= cfg.maxDepth ? term : ext
    let placed: JigsawPart<P> | null = null

    for (let a = 0; a < cfg.tries && !placed; a++) {
      // Two independent draws: WHICH piece, and (at the last attempt) whether to give up and cap.
      const r = hash2(s.x * 3 + a, s.z * 5 + s.dir, origin.seed ^ 0x2c0de)
      const def = pick(a === cfg.tries - 1 && usePool !== term ? term : usePool, r)
      const box = boxAt(s, def)

      // 1. the envelope — a correctness bound, checked before anything expensive
      if (box.x0 < origin.x - cfg.envelope || box.x1 > origin.x + cfg.envelope) continue
      if (box.z0 < origin.z - cfg.envelope || box.z1 > origin.z + cfg.envelope) continue
      // 2. AABB-reject, on interiors so a shared wall stays legal
      if (parts.some(p => interiorsOverlap(p, box))) continue
      // 3. the caller's terrain rule has the last word.
      const floor = ground(box, def)
      if (floor === null) continue

      placed = { def, ...box, floor, doors: [] }
    }

    if (!placed) continue
    doors.push({ x: s.x, z: s.z })
    parts.push(placed)
    if (sprouts(placed.def)) for (const ns of socketsOf(placed, s.dir, s.depth + 1)) queue.push(ns)
  }
  for (const p of parts) p.doors = doors.filter(d => p.x0 <= d.x && d.x <= p.x1 && p.z0 <= d.z && d.z <= p.z1)
  return parts
}
