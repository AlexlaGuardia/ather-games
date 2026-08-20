// Boulders — the shed stone that is big enough to be a PLACE.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ── ★★ A BOULDER IS A LANDFORM, NOT GROUND COVER, AND THAT IS WHY IT IS NOT IN scatter.ts ───────
// Slice ③ put rocks, deadfall and mushrooms in the h+1 resolver, which is correct for anything
// whose real grain is one cell: a stone lying on the ground IS one block, so a per-cell roll places
// it truthfully. A boulder is the opposite kind of object. It has mass, it occupies a volume, you
// walk AROUND it rather than over it, and — the part that decides the architecture — it spans
// several columns, so no per-column function can place one. A "boulder" that fits in the h+1 slot
// is a rock with a bigger name.
//
// So this goes through the door the tree planter already opened: per-chunk STARTS plus a scan
// radius, so a boulder rooted in the next chunk still assembles into this one. Same shape as
// `treeStartsAt` / `treeScanRadius`, deliberately, because the problem is identical.
//
// ── ★★ THE WARP HASHES ON THE OFFSET FROM THE BOULDER'S OWN CENTRE, NEVER WORLD POSITION ───────
// Taken directly from `trees.ts`'s lobe warp, and it is the one rule here that is not a preference.
// A column is generated with its neighbours scanned in, so the SAME voxel is computed by more than
// one column's assembly. If the lumpiness were hashed on world (x,y,z) that would still agree — but
// hashing on the offset is what also makes a boulder look like itself wherever it sits, and it is
// what `column.test.ts`'s seam assert is actually protecting. Both alignments must compute an
// identical warp for an identical voxel or the boulder grows a crack down the chunk boundary.
//
// ── ★ IT IS `MAT.STONE`. NO NEW MATERIAL, NO NEW BLOCK ROW, AND THAT IS THE POINT ──────────────
// Stone already carries `ground: true`, `minTier: 1`, and drops rubble. So a boulder is a
// prospecting node standing in open country — it feeds the stone economy that exists instead of
// opening a second one, which is the same call the two quarried-stone rows in registry.ts make and
// state their reasons for. It also means the "set `ground` on every new surface-reaching material"
// trap has nothing to catch here: the material reaching the surface is one the registry has known
// since the beginning.
//
// ⚠ AND A BOULDER IS DELIBERATELY NOT DISTINGUISHABLE FROM A CLIFF OUTCROP. `depth.ts` already
// answers STONE on a steep face; a boulder is the same rock, detached. Giving it a private material
// would claim a difference the world does not have.

import { Section } from './section'
import { MAT } from './depth'
import { hash2, mixSeed } from './noise'
import { isLogMat, isLeafMat } from './trees'
import { isOre } from './ore'
import { scatterCharacterAt, MAX_BOULDER_K } from './scatter'

export interface BoulderConfig {
  /** Expected boulders per chunk column at `boulderK` 1. Scaled by the land, then Bernoulli'd. */
  perColumn: number
  minRadius: number
  maxRadius: number
  /** Vertical squash range — 1 is a sphere, lower is a dome. Nothing here is ever taller than wide. */
  minSquash: number
  maxSquash: number
  /**
   * Fraction of the boulder's vertical extent that sits BELOW the surface. See `boulderCells`.
   *
   * ★ 0.42 → 0.28, AND IT WAS MEASURED RATHER THAN ARGUED. At 0.42 a typical boulder (r 3.3,
   * squash 0.7) stood **2 rows proud of 5, with 55% of its mass underground** — which reads as a
   * bump in the turf, not as a thing you walk around. At 0.28 it is 3 rows and ~62% visible. It
   * must not go to 0: a boulder resting exactly ON the surface reads as dropped from the sky, and
   * on any slope it hovers on the downhill side.
   */
  sink: number
  /** Radius warp amplitude, as a fraction of r. 0 is a perfect ellipsoid, which reads as a golf ball. */
  warp: number
  material: number
  /** Above this altitude nothing is placed — matches the treeline's reason: the shell is up there. */
  maxAltitude: number
}

export const DEFAULT_BOULDERS: BoulderConfig = {
  // 0.11 per chunk at k=1 → crag (k 3.0) carries ~1 per 3 chunks, a field you walk through; meadow
  // (k 0.15) ~1 per 60 chunks, the lone erratic that makes a meadow feel old. Tuned by looking.
  perColumn: 0.11,
  // ★★ THE SIZE BAND WAS RAISED BECAUSE THE SMALL END WAS NOT A BOULDER (measured, 2026-08-19).
  // At r 1.6 / squash 0.55 the whole object is ~2 blocks tall, so after sinking it stood ONE row
  // proud — indistinguishable from the loose rock that `scatter.ts` already places, which is the
  // real argument: the two features must not converge, or the big one stops meaning anything. The
  // oracle now sweeps the whole band and demands 3 rows proud at every size, so this cannot drift
  // back by someone lowering `minRadius` for variety.
  minRadius: 3.0,
  maxRadius: 4.4,
  minSquash: 0.70,
  maxSquash: 0.90,
  sink: 0.25,
  warp: 0.30,
  material: MAT.STONE,
  maxAltitude: 200,
}

export interface BoulderStart {
  x: number
  z: number
  /** Horizontal radius in blocks. Vertical extent is `r * squash`. */
  r: number
  squash: number
  seed: number
}

/** How many chunk columns out to scan for boulders that reach into this one. */
export const boulderScanRadius = (size: number, cfg: BoulderConfig = DEFAULT_BOULDERS): number =>
  Math.ceil(cfg.maxRadius / size) + 1

const unit = (x: number, z: number, seed: number): number => hash2(x, z, seed)

/**
 * The boulders rooted in chunk (cx, cz).
 *
 * ★ THE LAND SCALES AN EXPECTED COUNT, IT DOES NOT VETO. Same construction as `treeStartsAt`: a
 * fractional expectation with a Bernoulli tail, so a land's boulder count eases across a border
 * instead of switching on at a contour — the continuous half of the sibling law, again. A veto
 * would put a visible line exactly where the blend exists to remove one.
 */
export function boulderStartsAt(
  seed: number, cx: number, cz: number, size: number, cfg: BoulderConfig = DEFAULT_BOULDERS,
): BoulderStart[] {
  const base = (hash2(cx, cz, seed ^ 0xb0c1de) * 4294967296) | 0
  const k = scatterCharacterAt(cx * size + size / 2, cz * size + size / 2, seed).boulderK
  const expected = cfg.perColumn * k
  const whole = Math.floor(expected)
  const n = whole + (unit(cx, cz, seed ^ 0x51a1) < expected - whole ? 1 : 0)
  const out: BoulderStart[] = []
  for (let i = 0; i < n; i++) {
    const s = mixSeed(base, i)
    out.push({
      x: cx * size + Math.floor(unit(s, 1, seed ^ 0x11) * size),
      z: cz * size + Math.floor(unit(s, 2, seed ^ 0x22) * size),
      r: cfg.minRadius + unit(s, 3, seed ^ 0x33) * (cfg.maxRadius - cfg.minRadius),
      squash: cfg.minSquash + unit(s, 4, seed ^ 0x44) * (cfg.maxSquash - cfg.minSquash),
      seed: s,
    })
  }
  return out
}

/**
 * Low-frequency radius warp — the lump that stops a boulder reading as a dome.
 *
 * ⚠ HASHED ON (dx, dy, dz) RELATIVE TO THE BOULDER, never on world position. See the header: this
 * is what makes two column alignments agree on the same voxel, and it is what the seam assert is
 * protecting. Changing it to a world-space hash would still be deterministic and would still look
 * fine in a single column — and would crack every boulder that straddles a chunk boundary.
 *
 * ── ★★ AND HERE IS WHEN THIS WARNING APPLIES, BECAUSE IT HAS ALREADY BEEN COPIED WHERE IT DOES NOT
 * The dens pass took this paragraph verbatim onto its own warp, and a mutation to world-space came
 * back GREEN — correctly, because a den's cells are derived entirely from a PLAN whose inputs are
 * alignment-independent, so both columns build the identical plan and therefore identical cells.
 * The geometry was safe by construction, not by how the hash was salted, and the imported warning
 * was pure decoration guarding nothing.
 *
 * ★ THE TEST, for whoever copies this next: does the feature's shape depend on anything a
 * NEIGHBOURING COLUMN cannot see? Here it does — `boulderCells` walks offsets from a centre and
 * asks this function per voxel, so the salt IS the agreement. Where a feature computes a whole
 * plan from shared fields first and only then emits cells, the salt is free and this paragraph is
 * a lie. **A warning travels by copy-paste; the reason it was true does not.** State the reason
 * next to the rule or the next file inherits a guard around nothing — and worse, a green mutation
 * that reads as coverage.
 */
export function boulderWarp(dx: number, dy: number, dz: number, s: number, amp: number): number {
  // Two octaves at different salts — one broad lobe, one smaller bite out of the rim.
  const a = hash2(Math.round(dx * 1.7), Math.round(dz * 1.7) + Math.round(dy * 3.1), s ^ 0x9e37)
  const b = hash2(Math.round(dx * 3.9) + Math.round(dy * 2.3), Math.round(dz * 3.9), s ^ 0x2c1b)
  return 1 + amp * ((a - 0.5) + 0.5 * (b - 0.5))
}

/**
 * The cells a boulder occupies, as offsets from its centre. Exported for the oracle — the planter
 * writes through `Section`s, which a test cannot easily read shape out of.
 *
 * `groundY` is the surface height at the boulder's root. The centre is sunk by `sink` of the
 * vertical extent so the thing is BEDDED IN the ground rather than balanced on it: a boulder
 * resting exactly on the surface reads as dropped from the sky, and on any slope it hovers on the
 * downhill side. Sinking it also means a slope cuts the silhouette, which is most of what makes one
 * look like it has been there a long time.
 */
export function boulderCells(
  st: BoulderStart, groundY: number, cfg: BoulderConfig = DEFAULT_BOULDERS,
): { x: number; y: number; z: number }[] {
  const out: { x: number; y: number; z: number }[] = []
  const ry = st.r * st.squash
  // ⚠ `cy` IS A FLOAT AND MUST STAY ONE UNTIL THE VERY LAST STEP. The first cut rounded the centre
  // and then walked integer offsets from it — which quantised the sink away completely: a small
  // boulder's 0.16·ry offset rounded to 0, the cell band came out symmetric about the surface, and
  // the thing sat balanced on the ground with exactly as much below as above. The oracle caught it
  // at 17 vs 17 on two of three squash values. Rounding a centre rounds away every sub-block
  // property derived from it.
  const cy = groundY + ry - 2 * ry * cfg.sink
  const rad = Math.ceil(st.r * (1 + cfg.warp))
  const radY = Math.ceil(ry * (1 + cfg.warp))
  const y0 = Math.floor(cy - radY), y1 = Math.ceil(cy + radY)
  for (let y = y0; y <= y1; y++) {
    // Float offset for the SHAPE, rounded offset for the WARP. Both are derived from the boulder's
    // own centre, so both are identical under either column's alignment — the seam rule holds.
    const fy = y - cy
    const wy = Math.round(fy)
    for (let dz = -rad; dz <= rad; dz++) {
      for (let dx = -rad; dx <= rad; dx++) {
        const w = boulderWarp(dx, wy, dz, st.seed, cfg.warp)
        const nx = dx / (st.r * w), ny = fy / (ry * w), nz = dz / (st.r * w)
        if (nx * nx + ny * ny + nz * nz > 1) continue
        out.push({ x: st.x + dx, y, z: st.z + dz })
      }
    }
  }
  return out
}

interface Ctx {
  sections: (Section | null)[]
  ox: number; oy0: number; oz: number
  size: number; yTop: number
}

/**
 * ⚠ REFUSES ANY CELL HOLDING A LOG, A LEAF **OR ORE**, and that refusal is the whole reason boulders
 * are placed AFTER the trees rather than before.
 *
 * Before-trees would let a trunk grow straight out of solid rock, because `plantTrees` asks the
 * GENERATED surface material, not what has been written into the column — so it would never know
 * the boulder was there. After-trees without this guard is worse than ugly: eating a trunk's base
 * breaks chopping and fires leaf decay on a canopy whose support silently vanished, which is a
 * gameplay bug with no error and no wrong pixel. Preserving the tree is the safe direction, and the
 * cost is a rare boulder with a bite out of it — visible, harmless, and honest.
 *
 * Overlap is rare by construction anyway: `boulderK` runs roughly inverse to `treeK` (crag 3.0
 * against treeK 0, highland 2.2 against 0.5, versus meadow 0.15).
 *
 * ── ★★ AND ORE IS THE ONE THAT WOULD NEVER HAVE BEEN NOTICED ───────────────────────────────────
 * The stage order that protects boulders FROM ore is exactly what exposes ore TO boulders. The
 * pipeline is `depth → pre-carve ore → carvers → post-carve ore → VEGETATION`, so ore cannot land
 * inside a boulder (those cells do not exist yet) — but a boulder writing STONE in the vegetation
 * stage lands on top of whatever is already there. Several batches ship `discardOnAirExposure: 0`,
 * and tier-4 `ather_crystal` is pre-carve with 0 *deliberately* so carvers slice it open, which
 * means ore is allowed to reach exposed positions where a boulder can find it.
 *
 * A boulder dropped on an outcrop silently converts a tier-2 ELEMENT CRYSTAL into plain stone that
 * drops rubble. That is the herb-ordering problem one layer out: element crystals catalyse all four
 * infusions and each element gates ten canon second forms, so a worldgen ORDERING decision would
 * move the rarity of a third of the evolution grid — no error, no wrong pixel, just slightly fewer
 * crystals forever. Invisible in a playtest; found in six months by someone counting.
 *
 * `boulders.test.ts` pins the ore-cell count unchanged with boulders on and off, because a rarity
 * bug is exactly the kind that cannot be eyeballed. (Found by the hub window, not by me.)
 */
function put(c: Ctx, wx: number, wy: number, wz: number, mat: number): void {
  if (wx < c.ox || wx >= c.ox + c.size || wz < c.oz || wz >= c.oz + c.size) return
  if (wy < c.oy0 || wy >= c.yTop) return
  const si = ((wy - c.oy0) / c.size) | 0
  const sec = c.sections[si]
  if (!sec) return
  const li = sec.idx(wx - c.ox, wy - c.oy0 - si * c.size, wz - c.oz)
  const cur = sec.data[li]
  if (isLogMat(cur) || isLeafMat(cur) || isOre(cur)) return
  sec.data[li] = mat
}

/**
 * Place every boulder that reaches into this column. Returns how many were rooted here.
 *
 * ⚠ NOTHING IS PLACED BELOW THE WATERLINE. A boulder in a lake bed is invisible mass that a swimmer
 * bumps into, and on a shore it would sit half-drowned with no way to read why. `dry` is the same
 * test the plant branch in column.ts uses, for the same reason.
 */
export function plantBoulders(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, size: number, seed: number,
  surfaceAt: (x: number, z: number) => number,
  seaLevel: number,
  cfg: BoulderConfig = DEFAULT_BOULDERS,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const c: Ctx = { sections, ox, oy0, oz, size, yTop: oy0 + sections.length * size }
  const rad = boulderScanRadius(size, cfg)
  const c0x = Math.floor(ox / size), c0z = Math.floor(oz / size)
  let placed = 0

  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      for (const st of boulderStartsAt(seed, cx, cz, size, cfg)) {
        const h = surfaceAt(st.x, st.z)
        if (h < seaLevel) continue                 // no drowned mass — see above
        if (h >= cfg.maxAltitude) continue
        for (const cell of boulderCells(st, h, cfg)) put(c, cell.x, cell.y, cell.z, cfg.material)
        placed++
      }
    }
  }
  return placed
}

/** Loosest expected boulders per chunk anywhere in the world — the oracle's upper bound. */
export const maxExpectedPerChunk = (cfg: BoulderConfig = DEFAULT_BOULDERS): number =>
  cfg.perColumn * MAX_BOULDER_K
