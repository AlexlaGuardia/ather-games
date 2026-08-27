// The Moglin holds — the three story-node HOLDS, blocked out in stone.
//
// ⚠ NOT "strongholds", AND THE WORD IS LOCKED RATHER THAN PREFERRED. `game/shimmer-storyline.md:23`
// (ruled 2026-06-03): *"the v1 main-map three are **holds / camps**; the word **stronghold** is
// reserved for the Wilds."* Thistle, Vetch and Brack are garden-plot-scale land grabs — canon's
// *"the gardens were practice"* — and the Wilds' eight are the *"strongholds are real"* half. This
// header said the reserved word for eighteen days. ⚠ `npm run canon` CANNOT CATCH THIS: the drift
// gate judges names and rosters, and reports vocabulary only for nouns canon has listed as fully
// retired. "Stronghold" is not retired, it is RESERVED TO ANOTHER SCALE, which no gate here reads.
//
// ★ PURE CORE, GEOMETRY ONLY. Imports story-path (the node positions) and nothing else — heights
// are resolved by the CALLERS (height.ts owns the pad level, depth.ts asks with it in hand), so
// no height↔holds import cycle can exist.
//
// ── BLOCKOUT, deliberately (2026-08-08, Alex: "lets do the hold blockouts") ──────────────────
// Massing first: a flattened pad, a stone curtain wall the ROAD pierces through real gatehouse
// gaps, corner posts, an offset keep with a doorway, lanterns over the gates (lit gates hold the
// grey out of the threshold — same spawn-gate veto the waystones use). Piece dressing (roofs,
// stairs, beams — the build-mode vocabulary) comes with the tombstone save layer, next pass.
// WHO lives here and what the fight is = canon (Thistle/Vetch/Brack are the ruled names; the
// beat sheet reconcile is already in CANON_GAPS). The shapes are Jin's.

import { STORY_NODES } from './story-path'

export interface HoldGate {
  /** Which wall: 0 = +x ('e'), 1 = -x ('w'), 2 = +z ('s'), 3 = -z ('n'). */
  wall: number
  /** Offset along that wall where the ROAD actually crosses it — the gap sits on the road. */
  at: number
}

export interface HoldSpec {
  id: string
  x: number
  z: number
  /** Half-extent of the curtain wall square. Escalates down the chain — Brack looms. */
  half: number
  /** Keep half-extent; the keep sits offset PERPENDICULAR to the road axis, out of the roadway. */
  keepHalf: number
  keepOx: number
  keepOz: number
  gates: HoldGate[]
}

const WALL_H = 4       // curtain wall height above the pad
const KEEP_H = 7       // keep height above the pad
const GATE_HALF = 1    // gate gap half-width (3 wide)
const GATE_H = 3       // gate gap height
export const PAD_BLEND = 18   // blocks past the wall over which the pad melts into the country

/** Where the segment from (px,pz) toward (qx,qz) crosses a wall `half` out on the dominant axis. */
function gateFor(px: number, pz: number, qx: number, qz: number, half: number): HoldGate {
  const dx = qx - px, dz = qz - pz
  if (Math.abs(dx) >= Math.abs(dz)) {
    const wall = dx > 0 ? 0 : 1
    const at = Math.round((dz / Math.abs(dx)) * half)
    return { wall, at: Math.max(-half + 2, Math.min(half - 2, at)) }
  }
  const wall = dz > 0 ? 2 : 3
  const at = Math.round((dx / Math.abs(dz)) * half)
  return { wall, at: Math.max(-half + 2, Math.min(half - 2, at)) }
}

/** The three holds, derived from the spine at module load — no seed, pure map data. */
export const HOLDS: HoldSpec[] = [2, 3, 4].map((n, i) => {
  const node = STORY_NODES[n], prev = STORY_NODES[n - 1], next = STORY_NODES[n + 1]
  const half = [10, 12, 14][i]
  const gates = [gateFor(node.x, node.z, prev.x, prev.z, half), gateFor(node.x, node.z, next.x, next.z, half)]
  // Keep goes perpendicular to the road's dominant axis so the road never dead-ends into it.
  const roadIsX = gates[0].wall <= 1 || gates[1].wall <= 1
  const off = Math.floor(half / 2)
  return {
    id: node.id, x: node.x, z: node.z, half,
    keepHalf: Math.max(3, Math.floor(half / 3)),
    keepOx: roadIsX ? 0 : off, keepOz: roadIsX ? off : 0,
    gates,
  }
})

// ── ★ GENERATED PIECE DRESSING (2026-08-08, the pieces pass) ─────────────────────────────────
// The holds dress themselves in the PLAYER'S building vocabulary: fence pieces as parapets along
// the wall tops, roof slopes and caps over the keep. One vocabulary everywhere — a hold reads as
// something a builder could have made, because it literally is made of the same catalogue.
// These are recomputed from the map on every load (never saved); what persists is their ABSENCE
// (the host's tombstone list, ColumnSave.genRemoved). Ids are deterministic for exactly that.

export interface GenPiece {
  /** Deterministic identity — the tombstone key. */
  gen: string
  pieceId: string
  x: number; y: number; z: number
  rot: 0 | 1 | 2 | 3
}

const WALL_TOP = WALL_H       // parapet feet sit ON the wall (y = pad + WALL_H + 1)

/** Every dressing piece of one hold, given its pad level. Deterministic, whole-hold. */
export function holdGenPieces(i: number, pad: number): GenPiece[] {
  const s = HOLDS[i]
  const out: GenPiece[] = []
  const gateSpan = (wall: number, along: number): boolean =>
    s.gates.some(g => g.wall === wall && Math.abs(along - g.at) <= GATE_HALF + 1)

  // Parapet: alternating fence posts along the wall top, skipping corners (stone posts rise
  // there) and gate spans (the lantern hangs there).
  for (let t = -s.half + 1; t <= s.half - 1; t++) {
    if ((t & 1) !== 0) continue
    const spots: [number, number, number][] = [
      [s.x + s.half, s.z + t, 0], [s.x - s.half, s.z + t, 1],
      [s.x + t, s.z + s.half, 2], [s.x + t, s.z - s.half, 3],
    ]
    for (const [wx, wz, wall] of spots) {
      if (gateSpan(wall, t)) continue
      out.push({ gen: `${s.id}:p:${wx},${wz}`, pieceId: 'fence', x: wx, y: pad + WALL_TOP + 1, z: wz,
                 rot: wall <= 1 ? 1 : 0 })   // rails run ALONG the wall, not across it
    }
  }

  // Keep roof: slopes on the perimeter facing outward, caps inside; the four corners stay clear
  // (the blockout's voxel lanterns stand there — the dressing defers to the light).
  const ky = pad + KEEP_H + 1
  for (let kz = -s.keepHalf; kz <= s.keepHalf; kz++) {
    for (let kx = -s.keepHalf; kx <= s.keepHalf; kx++) {
      if (Math.abs(kx) === s.keepHalf && Math.abs(kz) === s.keepHalf) continue
      const wx = s.x + s.keepOx + kx, wz = s.z + s.keepOz + kz
      const edge = Math.abs(kx) === s.keepHalf || Math.abs(kz) === s.keepHalf
      const rot: 0 | 1 | 2 | 3 = !edge ? 0
        : Math.abs(kx) === s.keepHalf ? (kx > 0 ? 3 : 1)
        : (kz > 0 ? 0 : 2)
      out.push({ gen: `${s.id}:r:${wx},${wz}`, pieceId: edge ? 'roof_slope' : 'roof_cap', x: wx, y: ky, z: wz, rot })
    }
  }
  return out
}

/**
 * The dressing pieces whose ORIGIN column is (cx, cz) — what the host applies when that column
 * is adopted. `padOf` is injected (height.ts owns pad levels; this file stays height-free).
 */
export function holdGenPiecesForCol(
  cx: number, cz: number, size: number, padOf: (i: number) => number,
): GenPiece[] {
  const x0 = cx * size, z0 = cz * size
  const out: GenPiece[] = []
  for (let i = 0; i < HOLDS.length; i++) {
    const s = HOLDS[i]
    if (x0 + size <= s.x - s.half - 1 || x0 > s.x + s.half + 1 ||
        z0 + size <= s.z - s.half - 1 || z0 > s.z + s.half + 1) continue
    for (const g of holdGenPieces(i, padOf(i)))
      if (g.x >= x0 && g.x < x0 + size && g.z >= z0 && g.z < z0 + size) out.push(g)
  }
  return out
}

/** Which hold's build zone contains this column — -1 if none. Cheap bbox, callers gate on it. */
export function holdIndexAt(x: number, z: number): number {
  for (let i = 0; i < HOLDS.length; i++) {
    const s = HOLDS[i]
    if (Math.abs(x - s.x) <= s.half + PAD_BLEND && Math.abs(z - s.z) <= s.half + PAD_BLEND) return i
  }
  return -1
}

/** Pad membership: 1 inside the walls, melting to 0 across PAD_BLEND past them. */
export function padBlendAt(x: number, z: number): { i: number; t: number } | null {
  const i = holdIndexAt(x, z)
  if (i < 0) return null
  const s = HOLDS[i]
  const d = Math.max(Math.abs(x - s.x), Math.abs(z - s.z))     // square footprint, square blend
  if (d <= s.half) return { i, t: 1 }
  const t = 1 - (d - s.half) / PAD_BLEND
  return { i, t: t * t * (3 - 2 * t) }
}

/** Is this column inside the courtyard (walls included)? Surface turns to worn path there. */
export function holdCourtyardAt(x: number, z: number): boolean {
  const i = holdIndexAt(x, z)
  if (i < 0) return false
  const s = HOLDS[i]
  return Math.abs(x - s.x) <= s.half && Math.abs(z - s.z) <= s.half
}

/**
 * The structure voxel at (x, y, z) given the hold's pad surface level — 0 for "nothing here".
 * Callers pass materials in (stone, lantern) so this file imports no material table.
 */
export function holdVoxelAt(
  x: number, y: number, z: number, i: number, pad: number,
  stone: number, lantern: number,
): number {
  const s = HOLDS[i]
  const lx = x - s.x, lz = z - s.z
  const alx = Math.abs(lx), alz = Math.abs(lz)
  if (alx > s.half || alz > s.half || y <= pad) return 0
  const dy = y - pad                                    // 1.. above the pad

  // ── the keep — a solid mass with a doorway facing the courtyard centre ──
  const kx = lx - s.keepOx, kz = lz - s.keepOz
  if (Math.abs(kx) <= s.keepHalf && Math.abs(kz) <= s.keepHalf) {
    if (dy <= KEEP_H) {
      // Doorway: 2 tall, 2 wide, punched through the wall nearest the courtyard centre.
      const doorWallZ = s.keepOz !== 0 ? -Math.sign(s.keepOz) * s.keepHalf : null
      const doorWallX = s.keepOx !== 0 ? -Math.sign(s.keepOx) * s.keepHalf : null
      const inDoor = dy <= 2 && (
        (doorWallZ !== null && kz === doorWallZ && Math.abs(kx) <= 1) ||
        (doorWallX !== null && kx === doorWallX && Math.abs(kz) <= 1))
      return inDoor ? 0 : stone
    }
    // Lanterns on the keep's roof corners — the courtyard is TENDED ground.
    if (dy === KEEP_H + 1 && Math.abs(kx) === s.keepHalf && Math.abs(kz) === s.keepHalf) return lantern
    return 0
  }

  // ── the curtain wall ──
  const onWall = (alx === s.half && alz <= s.half) || (alz === s.half && alx <= s.half)
  if (!onWall) return 0
  // Gate gaps: the road walks through; a lantern hangs over each gap's centre.
  for (const g of s.gates) {
    const along = g.wall <= 1 ? lz : lx
    const isThisWall =
      (g.wall === 0 && lx === s.half) || (g.wall === 1 && lx === -s.half) ||
      (g.wall === 2 && lz === s.half) || (g.wall === 3 && lz === -s.half)
    if (!isThisWall) continue
    if (Math.abs(along - g.at) <= GATE_HALF && dy <= GATE_H) return 0          // the gap
    if (along === g.at && dy === WALL_H + 1) return lantern                    // the gate light
  }
  if (dy <= WALL_H) return stone
  // Corner posts rise two blocks above the wall line.
  if (alx === s.half && alz === s.half && dy <= WALL_H + 2) return stone
  return 0
}
