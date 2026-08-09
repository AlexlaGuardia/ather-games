// MIST PATCHES — where the garden's mana pools thick enough for a spirit to manifest and spar.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder (purity.test.ts enforces).
//
// ★ THE DESIGN, IN ONE LINE: a mist patch is the exact OPPOSITE of a Hollow, and every filter here
// is that sentence as code. A Hollow is drain wearing a shape — it comes for you, at night, on
// ground that was already drained, and the verb is DISPERSE. A mist patch is the garden at its most
// alive — you step in on purpose, at any hour, on ground that is tended, and the verb is SPAR.
// Canon carries this for free: mist is mana made visible, and Shimmer IS the Alkin's practice game,
// so a manifestation-to-spar claims no new world-truth. That is also why the combat frames differ
// and neither is a compromise: a spar has RULES (turn-taking, a formal exchange), a fight does not.
//
// ★ THEY CANNOT COEXIST WITH HOLLOWS, BY FIELD RATHER THAN BY SPECIAL CASE. `greyMax` refuses a
// patch on drained ground; `hollowEligible` refuses a Hollow on anything else (greyness ≥ 0.5).
// The two populations are disjoint because the fields make them disjoint — no "is a mist patch
// nearby?" check anywhere in the spawn path, nothing to keep in sync, and the same field keeps
// ruins (greyMin 0.6) out too. When a rule can be spent once in a field instead of forever in
// checks, spend it in the field.
//
// ★ PLACEMENT IS THE `sites.ts` MACHINE, verbatim (Minecraft's own): the world tiles into cells of
// `spacing` columns, each cell rolls ONE jittered candidate seeded by (world seed, cell, salt), and
// a candidate that fails its checks KILLS the cell rather than retrying. Any column answers "am I
// in mist?" from pure math with no cross-chunk state.
//
// ★ ONE CELL, NOT A RING — and that is an inequality, not a hope. `separation` holds every
// candidate ≥ (separation+1)·16 blocks off its cell edge, and a patch reaches `radius` + the edge
// warp. While separation-reach > 0 a patch CANNOT cross a cell boundary, so the hot path scans its
// own cell only. mist.test.ts asserts the inequality, so a retune that breaks it fails loudly
// instead of quietly slicing patches in half at cell seams (the failure would look like terrain).
//
// ⚠ WHAT MANIFESTS HERE IS NOT SETTLED. Which species spar in which garden region is [OPEN] in
// CANON_GAPS (2026-08-07) — a species-truth question, Magii's. Nothing in this file names, implies
// or rosters a species; it answers only WHERE the mist lies. The renderer's resident is a neutral
// luminous form for the same reason the ruin is a neutral blockout: a guess that ships becomes
// accidental canon. Placement and look do not change when the ruling lands.

import { value2, hash2, mixSeed } from './noise'
import { columnHeight, poolDepthAt, type HeightConfig, DEFAULT_HEIGHT } from './height'
import { greyness, type BiomeConfig, DEFAULT_BIOME } from './biome'
import { DEFAULT_DEPTH, type DepthConfig } from './depth'
import { zoneAt } from './zones'

export interface MistConfig {
  /** Cell size in COLUMNS (16-block units). One candidate per cell. */
  spacing: number
  /** Jitter keeps a candidate at least this many columns off the cell edge, bounding reach. */
  separation: number
  /** Distinguishes this feature's placement stream from sites' and everything else's. */
  salt: number
  /** How far the mist field reaches from the heart, in blocks. */
  radius: number
  /** The level middle a spar needs — the pad test runs over this, not the whole patch. */
  floorRadius: number
  /** Max height span across the floor. A spar wants ground, not a staircase. */
  padSpan: number
  /** How far below the surrounding ring the heart must sit. Mist POOLS: it wants a dell. */
  dellDrop: number
  /** Ring sampled for the dell test, as a multiple of `radius`. */
  ringK: number
  /** Minimum zone membership. Patches belong to the zone's interior, not its warped fringe. */
  zoneMin: number
  /** Mist is dense MANA — it cannot gather in country the greying has drained. */
  greyMax: number
}

export const DEFAULT_MIST: MistConfig = {
  // ⚠ TUNED BY SWEEP, NOT BY EYE (scripts/mist-sweep.mts) — the target is 2-3 patches per ruled
  // region: walking one should turn up a couple, never a trail of them. Spacing sets the CANDIDATE
  // POOL only; `ZoneAnchor.mist` sets the count. The grid is deliberately fine (288 blocks) because
  // a grid coarse enough to keep the Thicket honest starved the small zones of candidates
  // entirely — home had none, which is the wrong end of the map to make rare.
  spacing: 18,
  separation: 4,
  salt: 0x4d157,
  radius: 26,
  floorRadius: 9,
  padSpan: 3,
  dellDrop: 1.2,
  ringK: 1.7,
  zoneMin: 0.5,
  greyMax: 0.3,
}

export interface MistPatch {
  /** Heart of the patch, world blocks. */
  x: number
  z: number
  /** Ground level at the heart — where the resident stands and the mist lies. */
  floor: number
  /** Zone mist character × membership: how thick this one gets. Look only, never placement. */
  weight: number
  seed: number
}

/**
 * Edge softness, as a fraction of radius. ⚠ THIS IS A GRADIENT BUDGET, NOT A TASTE DIAL, and the
 * oracle enforces it: the field drives fog density and light colour, so a steep edge is a visible
 * SNAP as you walk in. `sm`'s slope peaks at 1.5, so the worst per-block step is about
 * 1.5 / (EDGE_BAND · radius) — at 0.42/26 that is 0.14 per block, which reads as a wall of fog
 * switching on. 0.55 lands it under 0.10 and gives the mist a 14-block margin to gather in.
 */
const EDGE_BAND = 0.55
/** Border wander in normalised-radius units — a mist edge is a coastline, not a compass circle. */
const EDGE_WARP = 0.20
/** Warp wavelength in blocks: long enough that the wander does not add gradient of its own. */
const WARP_SCALE = 48

const sm = (t: number): number => { const c = t < 0 ? 0 : t > 1 ? 1 : t; return c * c * (3 - 2 * c) }

/**
 * ── The cell memo ──────────────────────────────────────────────────────────────────────────────
 * `mistAt` is called PER COLUMN by the flora field, and validating a candidate costs ~40
 * `columnHeight` reads (the pad scan plus the dell ring) — the most expensive function in the
 * generator. Unmemoised, every column inside a patch would re-derive the same answer and the
 * flora pass would collapse.
 *
 * A cell is 416 blocks and a chunk is 16, so consecutive columns almost always share one cell: a
 * tiny ring of recent answers hits ~100% during chunk generation and needs no key allocation, no
 * eviction policy and no growth bound. Memoising a PURE function cannot change a result — this is
 * speed only, and `mistPatchAt` stays independently callable and independently testable.
 */
const MEMO = 4
const memoCx = new Int32Array(MEMO).fill(0x7fffffff)
const memoCz = new Int32Array(MEMO).fill(0x7fffffff)
const memoSeed = new Int32Array(MEMO)
const memoVal: (MistPatch | null)[] = new Array(MEMO).fill(null)
const memoHit = new Uint8Array(MEMO)
let memoNext = 0

/** Drop every memoised cell. For tests and tools that sweep several seeds or configs. */
export function clearMistMemo(): void {
  memoCx.fill(0x7fffffff)
  memoHit.fill(0)
  memoNext = 0
}

/**
 * The one candidate cell (cellX, cellZ) rolls, or null if the cell is dead. Pure and deterministic.
 * Checks are ordered by how much of the world they kill per unit of work: the zone gate is two
 * field reads and rejects the overwhelming majority of cells (most of the world is wild country)
 * before anything touches terrain.
 */
export function mistPatchAt(
  seed: number, cellX: number, cellZ: number,
  cfg: MistConfig = DEFAULT_MIST,
  hcfg: HeightConfig = DEFAULT_HEIGHT,
  dcfg: DepthConfig = DEFAULT_DEPTH,
  bcfg: BiomeConfig = DEFAULT_BIOME,
): MistPatch | null {
  const s = mixSeed((hash2(cellX, cellZ, seed ^ cfg.salt) * 4294967296) | 0, cfg.salt)
  const span = cfg.spacing - cfg.separation * 2
  const jx = cfg.separation + Math.floor(hash2(cellX, cellZ, s ^ 0xc0ffee) * span)
  const jz = cfg.separation + Math.floor(hash2(cellZ, cellX, s ^ 0x5eed) * span)
  const x = (cellX * cfg.spacing + jx) * 16 + 8
  const z = (cellZ * cfg.spacing + jz) * 16 + 8

  // 1. A zone that grows mist, and the interior of it. Cheapest gate, kills the most.
  const zn = zoneAt(x, z, seed)
  const mistK = zn.zone ? zn.zone.mist : 0
  if (mistK <= 0 || zn.t < cfg.zoneMin) return null

  // 2. The zone's rarity roll, BEFORE any terrain read — the ordering is the whole reason the grid
  //    can be this fine. Spacing alone cannot set the count, because the pad and dell filters
  //    survive at wildly different rates per terrain character (see ZoneAnchor.mist): a grid coarse
  //    enough to keep the Thicket honest gave the small zones zero candidate cells at all. So the
  //    grid is fine enough that every zone gets a real pool, and this roll does the thinning.
  if (hash2(cellX + 0x1d, cellZ - 0x2f, s ^ 0x7a11) > mistK) return null

  // 3. Tended ground. The greying and the gathering are opposites — see the header.
  if (greyness(x, z, seed, bcfg) > cfg.greyMax) return null

  // 4. Never in a hot-spring pool: the Springs' own water already owns those hollows, and a spar
  //    ring standing in one would read as a mistake rather than a place.
  if (poolDepthAt(x, z, seed, hcfg) > 0) return null

  // 5. A floor to spar on. Span across the middle only — the patch's outskirts may climb.
  const fr = cfg.floorRadius
  let mn = Infinity, mx = -Infinity
  for (let dz = -fr; dz <= fr; dz++) {
    for (let dx = -fr; dx <= fr; dx++) {
      if (dx * dx + dz * dz > fr * fr) continue          // a round floor, not a square one
      const h = columnHeight(x + dx, z + dz, seed, hcfg)
      if (h < mn) mn = h
      if (h > mx) mx = h
      if (mx - mn > cfg.padSpan) return null             // not level — the cell dies, no retry
    }
  }
  if (mn <= dcfg.seaLevel + dcfg.beachHeight) return null

  // 6. ★ THE DELL. Mist lies in low ground — that is the whole reason it reads as weather rather
  //    than as an effect bolted onto a clearing, and it is the one filter that is not borrowed from
  //    sites.ts (ruins stand on pads ANYWHERE flat; mist gathers in the hollows of a zone). Eight
  //    points on a ring: the heart must sit below their average.
  let ring = 0
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    ring += columnHeight(
      Math.round(x + Math.cos(a) * cfg.radius * cfg.ringK),
      Math.round(z + Math.sin(a) * cfg.radius * cfg.ringK),
      seed, hcfg,
    )
  }
  if (mn > ring / 8 - cfg.dellDrop) return null

  // ⚠ `weight` is LOOK ONLY and deliberately does NOT read `mist`. That field is a terrain
  // correction (see ZoneAnchor.mist) — folding it in here would render the Thicket's patches at a
  // fifth thickness for a reason that has nothing to do with how they should look. A patch that
  // exists is a patch; membership just lets a fringe one sit a little thinner than a heart one.
  return { x, z, floor: mn, weight: 0.75 + 0.25 * zn.t, seed: s }
}

/** Memoised `mistPatchAt` — same answer, ~zero cost on the repeat calls the hot path makes. */
function cellPatch(seed: number, cx: number, cz: number, cfg: MistConfig): MistPatch | null {
  for (let i = 0; i < MEMO; i++) {
    if (memoHit[i] && memoCx[i] === cx && memoCz[i] === cz && memoSeed[i] === (seed | 0)) return memoVal[i]
  }
  const v = mistPatchAt(seed, cx, cz, cfg)
  const i = memoNext
  memoNext = (memoNext + 1) % MEMO
  memoCx[i] = cx; memoCz[i] = cz; memoSeed[i] = seed | 0; memoVal[i] = v; memoHit[i] = 1
  return v
}

/** The cell a world position falls in. */
export const mistCellOf = (v: number, cfg: MistConfig = DEFAULT_MIST): number =>
  Math.floor(Math.floor(v / 16) / cfg.spacing)

/**
 * How thick the mist is at (x, z): 1 at a patch's heart, easing to 0 through a warped edge, 0
 * everywhere else. THE one field — the particle pass, the fog/light pull, the flora bloom and the
 * encounter trigger all read this same number, so they can never disagree about where a patch is
 * (the sibling law; the Springs' steam earns the same property by asking `springsPoolAt`).
 *
 * Own cell only — see the inequality in the header. One hash pair for the overwhelming majority of
 * columns, which is what makes it safe to call from the flora field.
 */
export function mistAt(x: number, z: number, seed: number, cfg: MistConfig = DEFAULT_MIST): number {
  const p = cellPatch(seed, mistCellOf(x, cfg), mistCellOf(z, cfg), cfg)
  if (!p) return 0
  const d = Math.hypot(x - p.x, z - p.z) / cfg.radius
  if (d > 1 + EDGE_WARP) return 0                        // out before the warp sample is worth it
  const wob = (value2(x / WARP_SCALE, z / WARP_SCALE, seed ^ 0x9e17) - 0.5) * 2 * EDGE_WARP
  return sm((1 - (d + wob)) / EDGE_BAND) * p.weight
}

/**
 * Every patch whose heart lies within `reach` blocks — for the renderer, which must know about a
 * patch it is WALKING TOWARD, not only the one it stands in (the resident is meant to be read as a
 * silhouette from outside; that is the entire consent design). Scans the cell ring, so it costs
 * more than `mistAt` — call it at a low cadence, never per column.
 */
export function mistPatchesNear(
  x: number, z: number, seed: number, reach: number, cfg: MistConfig = DEFAULT_MIST,
): MistPatch[] {
  const c0x = mistCellOf(x, cfg), c0z = mistCellOf(z, cfg)
  const rad = Math.max(1, Math.ceil(reach / (cfg.spacing * 16)))
  const out: MistPatch[] = []
  for (let cz = c0z - rad; cz <= c0z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c0x + rad; cx++) {
      const p = mistPatchAt(seed, cx, cz, cfg)
      if (p && Math.hypot(p.x - x, p.z - z) <= reach) out.push(p)
    }
  }
  return out
}

/** Blocks a patch can reach from its heart — the quantity the cell-seam inequality is about. */
export const mistReach = (cfg: MistConfig = DEFAULT_MIST): number => cfg.radius * (1 + EDGE_WARP)

/** Blocks the jitter guarantees between a candidate and its cell edge. Must exceed `mistReach`. */
export const mistEdgeMargin = (cfg: MistConfig = DEFAULT_MIST): number => (cfg.separation + 1) * 16 - 8
