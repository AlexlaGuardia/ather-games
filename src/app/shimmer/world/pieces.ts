// The piece catalogue — the LOOK half of the structure layer.
//
// ★ PURE CORE. No react/three/DOM. Spec: `STRUCTURE-LAYER.md` (§ 2 the model, § 8 cost shape).
//
// ── WHY THIS FILE HOLDS GEOMETRY AS DATA AND NOT AS THREE OBJECTS ─────────────────────────────
// `STRUCTURE-LAYER.md` § 5 makes `InstancedMesh`-per-piece-type non-negotiable, and the real art is
// a GLTF job that has not happened yet (§ 10 — picaso / headless-Blender, and Meshy is the wrong
// tool for dimension-exact modular geometry). So a placeholder has to exist in the meantime, and the
// question is what shape it takes.
//
// Holding it as **plain part descriptors** rather than THREE meshes buys three things:
//   1. the whole catalogue is provable headless (`pieces.test.ts`), which is the only reason the
//      footprint/geometry invariants below can be asserted at all;
//   2. the renderer stays the single place that knows about GPU objects, so a placeholder cannot
//      quietly become the per-placement allocation that got this page blocked from WebGL on 08-06;
//   3. swapping a placeholder for its GLTF is a one-field change (`model`), not a rewrite — the
//      registry row already carries the slot.
// Same reasoning as `voxel/registry.ts`: shaped as data so it lifts into `data/` (and Rust) unchanged.
//
// ── ★ PLACEHOLDERS ON PURPOSE, AND THE SEQUENCING BEHIND IT ───────────────────────────────────
// The spec says *"do not model forty pieces against an unproven loop."* This goes one step further,
// with Alex: **do not model SIX against an unproven loop either.** Six clean dimension-exact GLTFs
// are the long pole of this whole feature and the one part that cannot be iterated cheaply, so the
// loop (place → rotate → afford → commit → occupancy → deconstruct → save template) gets proven
// against code-built boxes and wedges first — exactly the procedural-placeholder path the chest,
// bench and pot already took. Then picaso models against a proven loop and a LOCKED footprint.
//
// ── CANON ─────────────────────────────────────────────────────────────────────────────────────
// Every `itemId` below already ships in `world/resources.ts` — `goldwood_plank` and friends are
// ruled canon names. **No new material names invented here** (§ 8). Piece NAMES are deliberately
// plain ("Door", not something evocative): anything with flavour in it is canon-adjacent and belongs
// to Magii, so the flavour pass is a batch to the gap queue, not a thing this file guesses at.

/** 4-way rotation, in quarter turns clockwise looking down. Placement offers exactly these (§ 7). */
export type Quarter = 0 | 1 | 2 | 3

/**
 * Occupancy footprint in whole blocks. **This is NOT the visual bound** (§ 4) — a roof overhang has
 * to hang over someone's head without blocking the cell they stand in, so the footprint is usually
 * SMALLER than the geometry. Keeping them separate is the whole reason a door's frame can be solid
 * while its doorway is walkable.
 */
export interface Footprint { w: number; h: number; d: number }

export interface PieceSpec {
  id: string
  /** Plain by design — evocative naming is canon-adjacent and batches to Magii. */
  name: string
  footprint: Footprint
  cost: { itemId: string; count: number }[]
  /** GLTF filename once the art lands; `null` = still drawing the placeholder below. */
  model: string | null
  category: 'piece'
}

/**
 * A placeholder primitive. Positions are in BLOCK units with the origin at the footprint's
 * **min corner** (not its centre) so a piece's parts read in the same coordinates its footprint is
 * declared in — the alternative is an off-by-half that only shows up once something is placed.
 */
export interface PiecePart {
  kind: 'box' | 'wedge'
  /** Centre of the part. */
  pos: [number, number, number]
  size: [number, number, number]
  /**
   * `wedge` only: the horizontal direction the slope falls toward.
   *
   * ★ The encoding is **rotation-ordered — 0=+x, 1=+z, 2=-x, 3=-z** — and that is load-bearing, not
   * a style choice. A quarter turn clockwise takes +x to +z, so under this ordering rotating a
   * wedge is `(fall + q) % 4` and nothing else. The obvious-looking alternative (0=+x, 1=-x, 2=+z,
   * 3=-z) makes that arithmetic silently wrong: a slope would rotate to a perpendicular face
   * instead of the next one round, and a roof would look *plausible* while shedding the wrong way.
   */
  fall?: Quarter
  /** Placeholder tint. Not a look call — the real look is the GLTF, and looks are Alex's. */
  tint: string
}

// ── The six (STRUCTURE-LAYER § 9, Alex's call) ────────────────────────────────────────────────
// Enough to make a block shed read as a building, which is the only thing v1 has to prove.
// `roof_cap` earns its slot over a second trim piece because a slope with no ridge cannot CLOSE —
// two slopes meeting leave an open seam along the whole roofline, which is the one placeholder gap
// a player would read as a bug rather than as missing art.
export const PIECES: PieceSpec[] = [
  {
    id: 'door', name: 'Door',
    // 1 wide, 3 tall, 1 deep — the FRAME. The doorway itself must stay walkable, which is why the
    // occupancy hook (hub lane) marks the jambs and lintel and deliberately leaves the gap open.
    footprint: { w: 1, h: 3, d: 1 },
    cost: [{ itemId: 'goldwood_plank', count: 6 }],
    model: null, category: 'piece',
  },
  {
    id: 'window', name: 'Window',
    footprint: { w: 1, h: 2, d: 1 },
    cost: [{ itemId: 'goldwood_plank', count: 4 }],
    model: null, category: 'piece',
  },
  {
    id: 'roof_slope', name: 'Roof Slope',
    footprint: { w: 1, h: 1, d: 1 },
    cost: [{ itemId: 'goldwood_plank', count: 2 }],
    model: null, category: 'piece',
  },
  {
    id: 'roof_cap', name: 'Roof Cap',
    footprint: { w: 1, h: 1, d: 1 },
    cost: [{ itemId: 'goldwood_plank', count: 2 }],
    model: null, category: 'piece',
  },
  {
    id: 'stair', name: 'Stair',
    footprint: { w: 1, h: 1, d: 1 },
    cost: [{ itemId: 'block_stone', count: 3 }],
    model: null, category: 'piece',
  },
  {
    id: 'beam', name: 'Beam',
    footprint: { w: 1, h: 1, d: 1 },
    cost: [{ itemId: 'goldwood_plank', count: 1 }],
    model: null, category: 'piece',
  },
]

export const pieceOf = (id: string): PieceSpec => {
  const p = PIECES.find((x) => x.id === id)
  if (!p) throw new Error(`pieces: unknown piece '${id}'`)
  return p
}

// Placeholder palette. Three tints only, and they encode ROLE rather than material: frame, fill,
// and the sloped surfaces. A placeholder that tries to look like wood invites "the art is done".
const FRAME = '#8a6a43'
const FILL = '#c8b189'
const SLOPE = '#6f7d8c'

/**
 * The placeholder geometry for a piece, unrotated.
 *
 * ⚠ **Never returns an empty array** — asserted in the oracle. A piece that renders nothing is
 * indistinguishable in play from a piece that was never wired, and this repo has now paid for that
 * exact confusion twice (the const not referenced in a `_SPRITES` export; the chest that shipped
 * inert). An unbuilt piece must fail loudly at the registry, not silently at the mesh.
 */
export function placeholderParts(id: string): PiecePart[] {
  const t = 0.12   // frame thickness — thin enough to read as a frame, thick enough to see
  switch (id) {
    case 'door': {
      // two jambs + a lintel; the doorway between them stays open on purpose
      return [
        { kind: 'box', pos: [t / 2, 1.5, 0.5], size: [t, 3, 0.5], tint: FRAME },
        { kind: 'box', pos: [1 - t / 2, 1.5, 0.5], size: [t, 3, 0.5], tint: FRAME },
        { kind: 'box', pos: [0.5, 3 - t / 2, 0.5], size: [1, t, 0.5], tint: FRAME },
        // the leaf, inset so it reads as hung inside the frame rather than filling the hole
        { kind: 'box', pos: [0.5, 1.45, 0.5], size: [1 - 2 * t, 2.9, 0.16], tint: FILL },
      ]
    }
    case 'window': {
      return [
        { kind: 'box', pos: [0.5, t / 2, 0.5], size: [1, t, 0.4], tint: FRAME },        // sill
        { kind: 'box', pos: [0.5, 2 - t / 2, 0.5], size: [1, t, 0.4], tint: FRAME },    // head
        { kind: 'box', pos: [t / 2, 1, 0.5], size: [t, 2, 0.4], tint: FRAME },          // jambs
        { kind: 'box', pos: [1 - t / 2, 1, 0.5], size: [t, 2, 0.4], tint: FRAME },
        { kind: 'box', pos: [0.5, 1, 0.5], size: [t, 2, 0.1], tint: FRAME },            // mullion
      ]
    }
    case 'roof_slope':
      // A single wedge falling toward +x. Rotation is what makes the other three directions.
      return [{ kind: 'wedge', pos: [0.5, 0.5, 0.5], size: [1, 1, 1], fall: 0, tint: SLOPE }]
    case 'roof_cap':
      // Two half-wedges back to back = a ridge. Closes the seam two opposing slopes leave.
      // ⚠ 0 and 2 (+x and -x), NOT 0 and 1 — under the rotation-ordered `fall` encoding, opposing
      // faces differ by TWO. Asserted by name in the oracle, because a cap whose halves are 90°
      // apart still renders as a plausible lump and would only be caught by looking very closely.
      return [
        { kind: 'wedge', pos: [0.25, 0.5, 0.5], size: [0.5, 1, 1], fall: 2, tint: SLOPE },
        { kind: 'wedge', pos: [0.75, 0.5, 0.5], size: [0.5, 1, 1], fall: 0, tint: SLOPE },
      ]
    case 'stair':
      // Three treads rising toward +x. Reads as a stair at a glance and meets uneven ground, which
      // is the thesis of the whole layer (§ 2: pieces sit WITH terrain instead of fighting it).
      return [
        { kind: 'box', pos: [1 / 6, 1 / 6, 0.5], size: [1 / 3, 1 / 3, 1], tint: FILL },
        { kind: 'box', pos: [0.5, 1 / 3, 0.5], size: [1 / 3, 2 / 3, 1], tint: FILL },
        { kind: 'box', pos: [5 / 6, 0.5, 0.5], size: [1 / 3, 1, 1], tint: FILL },
      ]
    case 'beam':
      return [{ kind: 'box', pos: [0.5, 0.5, 0.5], size: [1, 0.2, 0.2], tint: FRAME }]
    default:
      throw new Error(`pieces: no placeholder geometry for '${id}'`)
  }
}

/**
 * Rotate a footprint by quarter turns. **w and d swap on odd turns; h never changes** — a door laid
 * on its side is not a thing this layer supports, and a rotation that silently changed height would
 * let a 3-tall piece claim one cell of headroom after a turn.
 */
export function rotateFootprint(f: Footprint, q: Quarter): Footprint {
  return q % 2 === 0 ? { ...f } : { w: f.d, h: f.h, d: f.w }
}

/**
 * Rotate placeholder parts clockwise about the footprint's vertical axis.
 *
 * ★ The rotation happens **within the footprint's own extent**, which is why `f` is a parameter and
 * not derived: rotating about the origin swings every part out of its own cell, and rotating about a
 * hardcoded centre is only correct while a piece is square in plan.
 *
 * ⚠ **Every piece in today's catalogue IS square in plan (d = 1), so that bug is currently
 * unreachable — and it stayed green through a deliberate mutation because of it.** An earlier draft
 * of this comment claimed the door and window would catch it; they would not, both are 1×n×1. The
 * transform is general, the data is not, so `pieces.test.ts` proves it against a synthetic 1×1×3
 * fixture instead. The first 2-wide double door or 2-deep roof section makes the bug live for real.
 */
export function rotateParts(parts: PiecePart[], q: Quarter, f: Footprint): PiecePart[] {
  if (q === 0) return parts.map((p) => ({ ...p }))
  return parts.map((p) => {
    let [x, y, z] = p.pos
    let [sx, sy, sz] = p.size
    let fw = f.w, fd = f.d
    for (let i = 0; i < q; i++) {
      // clockwise looking down: (x, z) -> (fd - z, x), and the extent swaps with it
      const nx = fd - z
      const nz = x
      x = nx; z = nz
      const t2 = sx; sx = sz; sz = t2
      const t3 = fw; fw = fd; fd = t3
    }
    const out: PiecePart = { ...p, pos: [x, y, z], size: [sx, sy, sz] }
    if (p.fall !== undefined) out.fall = (((p.fall + q) % 4) as Quarter)
    return out
  })
}
