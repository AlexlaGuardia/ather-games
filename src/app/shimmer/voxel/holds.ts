// The Moglin holds — the three story-node HOLDS. **Taken ground, not architecture.**
//
// ── ★★★ CORRECTED 2026-08-29 TO A CANON RULING, AND WHAT CAME OUT WAS A CASTLE ────────────────
// This file blocked the three out as *a flattened pad, a stone curtain wall pierced by gatehouse
// gaps, corner posts, and an offset keep with a doorway*. `design-briefs/moglin-holds.md` (RULED
// 2026-08-29, /magii + Alex, from a gap this build raised) says that is wrong at every level:
//
//   **"A hold is neither built nor dug. It is folded, pinned and stacked — and at plot scale it is
//   simply ground somebody else folded, taken."**
//
// ⛔ **No masonry anywhere.** No curtain wall, gatehouse, keep, tower, corner post or cut stone. The
// Ather has no ore and no quarry-craft, and Bonn #1 ch4 negates it BY NAME at exactly this location:
// a garden plot's walls are *"not of stone, not of wood. Walls of cloud… piled high like heaped
// wool."* A Thornlord's hold IS one of those plots — Gregory on Bramble, *"his plot is the last
// door"* — so the three weeds raised nothing. They squat Gregory's ground inside Gregory's cloud.
//
// ★★ AND THE REASON IS SHARPER THAN INACCURACY. Masonry would hand the collar-culture **craft,
// ambition and dignity** — it would say *these people make things*. They do not. *"A collarer is not
// a builder; he is a squatter with a good grip."* The creature card solved this at body scale (soft
// body, the collar carries the menace); this is the same solution at environment scale.
//
// ★ WHAT REMAINS IS THE COLLAR'S KIT, AND CANON SAYS IT IS THE WHOLE BUILT VOCABULARY: cages,
// tethers, stakes, lead-lines, cage-hooks, a lantern hung to watch something. *"Metal on a structure
// means a hold"* — everything a keeper owns is grown, pegged and lashed, so a hold's irons are the
// single place the eye finds forged metal and it learns the moral map in one screen with no
// tutorial. **A curtain wall dilutes the strongest signal the build owns.**
//
// ⚠⚠ TWO THINGS THE RULING ASKS FOR THAT ARE NOT HERE YET, NAMED SO NOBODY READS THIS AS FINISHED:
//   · **Cages and tethers do not exist as pieces.** `pieces.ts` has 14 and none of them is a cage,
//     a tether, a stake-and-line or a lead. That is new art, and the hold is under-dressed until it
//     lands — a lantern on a post is the tell, not the scene.
//   · **The flattened pad is still here, and canon bans it** (⛔ *"a flattened construction pad"*).
//     It cannot simply be deleted: `height.ts` IMPORTS this file, so this file cannot ask for a
//     column's height, and the single pad level is what breaks that cycle — dressing needs SOME
//     ground to stand on. Removing it means handing `holdGenPieces` a ground-lookup the way
//     `jigsaw` takes a `GroundRule`, which is a terrain refactor with six suites downstream and
//     wants its own pass. **Filed, not forgotten.**
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
// ⚠ HISTORY, KEPT FOR THE LESSON: this once read *"Massing first: a flattened pad, a stone curtain
// wall the ROAD pierces through real gatehouse gaps, corner posts, an offset keep with a doorway."*
// It shipped 2026-08-08 as a deliberate massing blockout with piece dressing deferred — so it never
// claimed to be canon, and it was still the only picture of a Moglin hold that existed for three
// weeks. **A blockout is a claim about shape, and shape is exactly what the ruling overturned.**
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

/** A watch-stake stands this many blocks, with the lantern on top. Canon's only made thing here. */
const STAKE_H = 2
/**
 * How far along the edge the stake stands FROM the road's crossing.
 *
 * ⚠⚠ IT IS NOT ZERO, AND THE FIRST CUT MADE IT ZERO. Standing the stake exactly on the gate line
 * put it IN THE ROADWAY — where the old code punched a hole for the road to walk through — so all
 * three holds sealed their own road. `holds.test.ts` caught it on every hold. Canon is explicit that
 * a collarer *"takes and pressures; he does not injure"*, and a hold that closes the quest spine is
 * a hold that seals. **The light watches the road; it does not stand in it.**
 *
 * ★ EXPORTED so the oracle can ASK where the stake is rather than restating the offset — a second
 * copy would agree until somebody moved it, which is this codebase's most-repeated failure.
 */
export const STAKE_OFFSET = 2
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
  /**
   * Generated OPEN, for a piece that opens. Absent = closed, same as `Placement.open`.
   *
   * ⚠⚠ THE HOLD GATES MUST BE BORN OPEN AND THIS IS A TRAVERSAL FACT, NOT A GARNISH. The gate gap
   * is where the STORY ROAD crosses the curtain wall — the quest spine physically runs through it.
   * A gate generated closed puts a shut door across the main path of the game, on three holds, for
   * every keeper, before anyone has been given a reason to open one. `cellsOf` writes no solid
   * cells for an open piece, so an open gate occupies nothing and the road is exactly as passable
   * as it was before this existed.
   */
  open?: boolean
}

/** Every dressing piece of one hold, given its pad level. Deterministic, whole-hold. */
export function holdGenPieces(i: number, pad: number): GenPiece[] {
  const s = HOLDS[i]
  const out: GenPiece[] = []

  // ── ★★★ THE COLLAR'S KIT, WHICH CANON SAYS IS THE WHOLE BUILT VOCABULARY ────────────────────
  // What stood here was a stone parapet along a curtain wall and a gate in each gap. Both are gone
  // with the wall. Canon's list is exhaustive: *"cages, tethers, stakes, lead-lines, cage-hooks, a
  // lantern hung to watch something"* — imported metal, and nothing architectural.
  //
  // ⚠⚠ ONLY PART OF THAT LIST EXISTS AS PIECES, AND THE GAP IS NAMED RATHER THAN PAPERED OVER.
  // `pieces.ts` has 14 shapes and none of them is a cage, a tether or a lead-line. What it does have
  // is `hook` — canon's own *cage-hook* — and `fence`, which reads as a stake-and-line where a
  // tether would be strung. So a hold is under-dressed until the cage lands, and this file says so
  // rather than substituting something architectural to fill the space. **An under-dressed hold is
  // honest; a hold with a wall is a lie about who these people are.**
  //
  // ★ THE `gen` KEYS ARE POSITION-BASED AND UNCHANGED IN SHAPE. `gen` is the TOMBSTONE key — what
  // persists is a piece's ABSENCE — so keying on position rather than on the piece id means a
  // keeper who tore a hook down last week keeps it down, across this very correction.
  const rim = s.half - 1
  // ⚠ THE CORNERS ARE SHARED BY TWO RUNS AND WERE EMITTED TWICE. The four edges are walked with one
  // parameter, so at |t| == rim the x-run and the z-run name the same cell — two pieces, one
  // position, and because `gen` keys on POSITION (the tombstone rule) that is two pieces with ONE
  // id. The uniqueness assert caught it; without dedup, tearing one down would tear down a piece
  // that is still standing, or leave a ghost that cannot be removed.
  const seen = new Set<string>()

  // Lead-lines: stakes strung at intervals around the taken ground's edge, skipping the road.
  for (let t = -rim; t <= rim; t += 3) {
    const spots: [number, number][] = [
      [s.x + rim, s.z + t], [s.x - rim, s.z + t], [s.x + t, s.z + rim], [s.x + t, s.z - rim],
    ]
    for (const [wx, wz] of spots) {
      // Leave the road's crossing clear — a lead-line across the quest spine reads as a barrier,
      // and canon is explicit that a hold takes and pressures rather than seals.
      if (s.gates.some(g => Math.abs((g.wall <= 1 ? wz - s.z : wx - s.x) - g.at) <= 2)) continue
      const key = `${wx},${wz}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ gen: `${s.id}:t:${key}`, pieceId: 'fence', x: wx, y: pad + 1, z: wz, rot: 0 })
    }
  }

  // Cage-hooks, clustered where stock is kept: a short row inside the ground, off the road.
  for (let k = -1; k <= 1; k++) {
    const hx = s.x + s.keepOx + k * 2, hz = s.z + s.keepOz
    out.push({ gen: `${s.id}:h:${hx},${hz}`, pieceId: 'hook', x: hx, y: pad + 2, z: hz, rot: 0 })
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
/**
 * ── ★ THE WALL IS MIXED, NOT ONE STONE (2026-08-27) ──────────────────────────────────────────
 * Texture-mixing inside one hue is the most consistently cited fix for a wall that reads flat, and
 * a hold was the worst case in the build: one material, every cell, at the largest scale anything
 * is built at here. `worn` and `cracked` are mixed in at roughly a fifth of cells each.
 *
 * ★ KEYED ON WORLD POSITION, never on a counter or on draw order, for the same reason every other
 * roll in the generator is: a hold spans many columns and each one re-derives its own slice with no
 * knowledge of the others. A counter would make the mix disagree across a chunk seam — visible as a
 * seam in the masonry, on one side only.
 *
 * ⚠ AND THE MATERIALS ARE STILL INJECTED. This file has never imported MAT and must not start: the
 * geometry is Jin's and what a stone IS belongs to the registry. Two more parameters is the whole
 * cost of keeping that true.
 */
function mixed(x: number, y: number, z: number, stone: number, worn: number, cracked: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  const r = ((h ^ (h >>> 16)) >>> 0) / 4294967296
  return r < 0.20 ? worn : r < 0.36 ? cracked : stone
}

export function holdVoxelAt(
  x: number, y: number, z: number, i: number, pad: number,
  stake: number, lantern: number,
): number {
  const s = HOLDS[i]
  const lx = x - s.x, lz = z - s.z
  if (Math.abs(lx) > s.half || Math.abs(lz) > s.half || y <= pad) return 0
  const dy = y - pad                                    // 1.. above the ground

  // ── ★★★ THE WATCH-STAKES, AND THEY ARE ALL THAT IS LEFT ─────────────────────────────────────
  // Canon's made-things list for a hold is exhaustive and short: *"cages, tethers, stakes,
  // lead-lines, cage-hooks, **a lantern hung to watch something**"* — and *"metal on a structure
  // means a hold"*, which is why the lantern is the tell rather than the decoration. So a hold's
  // whole built vocabulary at the road is a stake with a light on it, standing where the road comes
  // in. Nothing else about the ground is made by anybody.
  //
  // ⚠ THE GATE POSITIONS ARE KEPT, THE GATE IS NOT. `s.gates` still names where the story road
  // crosses the hold's edge, and that is exactly where a collarer would stand a light to watch who
  // arrives. What is gone is the wall it used to hang on.
  for (const g of s.gates) {
    const along = g.wall <= 1 ? lz : lx
    const onEdge =
      (g.wall === 0 && lx === s.half) || (g.wall === 1 && lx === -s.half) ||
      (g.wall === 2 && lz === s.half) || (g.wall === 3 && lz === -s.half)
    if (!onEdge || along !== g.at + STAKE_OFFSET) continue
    if (dy <= STAKE_H) return stake
    if (dy === STAKE_H + 1) return lantern
  }
  return 0
}
