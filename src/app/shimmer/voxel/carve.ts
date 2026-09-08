// Carvers — tunnels and caverns cut through solid rock.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder.
//
// ⚠ THIS STAGE ONLY EXISTS BECAUSE HEIGHT 256 GAVE US A COLUMN. WORLDGEN-RESEARCH originally
// SKIPPED carvers outright — *"they tunnel through a solid 3D volume; we have a tile grid plus a
// height tier and no z-column, so there is nothing to tunnel"* — and the voxel ruling expired that
// reason on the same day. This is Voranyx: no longer a place on the map, but generated mineshafts
// that sometimes open into large caverns.
//
// ── WHERE THIS SITS IN THE PIPELINE, AND WHY IT MATTERS ──────────────────────────────────────
//   depth rule (host rock)  →  PRE-CARVE features  →  CARVERS  →  POST-CARVE features  →  vegetation
//
// Ore lives on BOTH sides of this stage deliberately. Tiers 1–3 are placed post-carve, so they show
// in the walls of a cave you walk into. Tier 4 is placed pre-carve, so a carver slices through the
// pocket and you break into a seam. Folding ore into the depth rule would have made every ore
// pre-carve and thrown that distinction away permanently — which is why `depth.ts` has none.
//
// ── THE CROSS-CHUNK PROBLEM, SOLVED THE SAME WAY AS STRUCTURES ───────────────────────────────
// A tunnel is longer than a chunk, so it straddles borders. Research steal #1: exactly one chunk
// AUTHORS each tunnel and everyone nearby clips it. `carveStartsAt(seed, cx, cz)` is pure and O(1),
// reads no neighbour, and answers only about its own chunk. When building any chunk we scan the box
// of chunks within `maxReach` and apply whichever carves overlap. No storage, no pointers, no
// coordination — and critically, **no stage ever synchronously generates a missing neighbour**,
// which is the pre-1.13 cascading bug and, in a browser, a frame-time cliff rather than a lag spike.

import { hash2, mixSeed } from './noise'
import { MAT } from './depth'
import { Section, AIR } from './section'

export interface CarveConfig {
  /** Expected tunnel origins per chunk. Fractional — the remainder is a probability. */
  tunnelsPerChunk: number
  /** How far a tunnel may travel from its origin. Sets the scan box AND the generation margin. */
  maxReach: number
  tunnelRadiusMin: number
  tunnelRadiusMax: number
  /** Steps walked per tunnel; each step advances ~1 voxel and carves a sphere. */
  stepsMin: number
  stepsMax: number
  /** Chance per step that the tunnel swells into a cavern. */
  cavernChance: number
  cavernRadiusMin: number
  cavernRadiusMax: number
  /** Vertical band carvers operate in. Above `yMax` tunnels taper out rather than stopping dead. */
  yMin: number
  yMax: number
  /** Never carve below this — the world needs a floor you cannot fall through. */
  floorGuard: number
  /**
   * Voxels of ground left intact beneath the surface.
   *
   * ★ WITHOUT THIS, CARVERS PUNCH ONE-VOXEL PIT TRAPS. Measured over 40,960 columns: 1% had AIR at
   * the surface voxel and a handful opened shafts 40+ deep. A cave mouth is a fine thing to have,
   * but an invisible single-voxel hole you drop 40 blocks down is not a cave mouth — it is a bug
   * that reads as one. Cave entrances should be a deliberate feature (a widened, visible mouth),
   * not a side effect of a tunnel happening to graze the surface.
   */
  surfaceClearance: number
}

export const DEFAULT_CARVE: CarveConfig = {
  // ★ Tuned against a PLAYER-MEANINGFUL number, not a volume fraction. The first pass (1.6 tunnels,
  // radius 1.6-3.4) opened 0.25% of underground volume and put a cave in only 6.7% of columns —
  // you could dig for an hour and never break into one. Measured curve: 1.6→6.7% of columns,
  // 3.2→19.9%, 4.8+longer→51.0%, and these values→59.5% with 8.4 cave voxels per column. "What
  // fraction of columns hit a cave" is the number a player feels; "% of volume carved" is not.
  tunnelsPerChunk: 4.8,
  // 96 tiles = 1.5 chunks. This number is the whole cost/benefit dial: it sets a 5x5 chunk scan
  // (`2*ceil(96/64)+1`) and it is also the neighbour margin the chunk pipeline must respect.
  // Longer tunnels read better and cost quadratically more scanning.
  maxReach: 96,
  tunnelRadiusMin: 2.0,
  tunnelRadiusMax: 4.2,
  stepsMin: 60,
  stepsMax: 190,
  cavernChance: 0.03,
  cavernRadiusMin: 5,
  cavernRadiusMax: 11,
  yMin: 6,
  yMax: 150,
  floorGuard: 4,
  surfaceClearance: 3,
}

/** Deterministic per-carver stream. xorshift32 — same sequence in TS and Rust, which is the point. */
function rng(seed: number) {
  let s = seed | 0
  if (s === 0) s = 0x9e3779b9
  return () => {
    s ^= s << 13; s |= 0
    s ^= s >>> 17
    s ^= s << 5; s |= 0
    return ((s >>> 0) / 4294967296)
  }
}

export interface CarveStart {
  x: number; y: number; z: number
  yaw: number; pitch: number
  steps: number
  radius: number
  seed: number
}

/**
 * The carve origins OWNED by chunk (cx, cz). Pure, O(1), no neighbour reads — a chunk asks only
 * about itself, which is what makes the whole scheme work without coordination.
 */
export function carveStartsAt(seed: number, cx: number, cz: number, chunk: number, cfg: CarveConfig = DEFAULT_CARVE): CarveStart[] {
  const out: CarveStart[] = []
  const base = (hash2(cx, cz, seed ^ 0xca4e) * 4294967296) | 0
  const r = rng(base)
  const whole = Math.floor(cfg.tunnelsPerChunk)
  const n = whole + (r() < cfg.tunnelsPerChunk - whole ? 1 : 0)
  for (let i = 0; i < n; i++) {
    const s = mixSeed(base, i)
    const g = rng(s)
    out.push({
      x: cx * chunk + Math.floor(g() * chunk),
      z: cz * chunk + Math.floor(g() * chunk),
      y: cfg.yMin + Math.floor(g() * (cfg.yMax - cfg.yMin)),
      yaw: g() * Math.PI * 2,
      // Biased flat: a tunnel that dives steeply reads as a hole, not a passage.
      pitch: (g() - 0.5) * 0.5,
      steps: cfg.stepsMin + Math.floor(g() * (cfg.stepsMax - cfg.stepsMin)),
      radius: cfg.tunnelRadiusMin + g() * (cfg.tunnelRadiusMax - cfg.tunnelRadiusMin),
      seed: s,
    })
  }
  return out
}

/** How many chunks out we must scan for carves that could reach into this one. */
export const carveScanRadius = (chunk: number, cfg: CarveConfig = DEFAULT_CARVE): number =>
  Math.ceil(cfg.maxReach / chunk)

/** A voxel may be carved unless it is structural. The cloud floor and the guard below it are never removed. */
function carvable(m: number): boolean {
  return m !== AIR && m !== MAT.PACKED_CLOUD && m !== MAT.WATER
}

/**
 * Walk one carver and cut it into a vertical STACK of sections.
 *
 * ★ THE STACK IS THE WHOLE POINT, AND THE FIRST VERSION GOT IT WRONG. Carving one section at a time
 * re-walks every nearby tunnel for every section: a 64-wide column at height 256 is 256 sections,
 * the scan box holds ~120 tunnels, and each walks up to 190 steps — 5.8M step evaluations per
 * column, measured at 0.76ms per section = **195ms per chunk arrival**. The walk does not depend on
 * which section is being filled, so it belongs outside that loop. Walking once per column and
 * dispatching each carved voxel to the section that owns it makes the tunnel count the cost, not
 * the tunnel count TIMES the section count.
 *
 * `sections[i]` covers world y in `[oy0 + i*S, oy0 + (i+1)*S)`. Sections may be null (a stack with
 * holes is fine — those y ranges are simply not carved).
 *
 * ⚠ Carving DOWN through the surface is allowed and wanted: that is how a cave mouth happens. What
 * is refused is opening the floor under standing water, which drains a lake through a hole nobody
 * can see. The caller passes `surfaceAt` so the carver can decline.
 */
export function carveOne(
  sections: (Section | null)[], ox: number, oy0: number, oz: number,
  start: CarveStart, cfg: CarveConfig = DEFAULT_CARVE,
  surfaceAt?: (x: number, z: number) => number,
  seaLevel = -Infinity,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const S = first.size
  const yTop = oy0 + sections.length * S
  let carved = 0

  walkCarve(start, cfg, (x, y, z, r) => {
    // Cheap reject before the O(r^3) sphere fill.
    if (x + r < ox || x - r > ox + S || z + r < oz || z - r > oz + S || y + r < oy0 || y - r > yTop) return

    const r2 = r * r
    const x0 = Math.max(ox, Math.floor(x - r)), x1 = Math.min(ox + S - 1, Math.ceil(x + r))
    const y0 = Math.max(oy0, Math.floor(y - r)), y1 = Math.min(yTop - 1, Math.ceil(y + r))
    const z0 = Math.max(oz, Math.floor(z - r)), z1 = Math.min(oz + S - 1, Math.ceil(z + r))

    for (let wy = y0; wy <= y1; wy++) {
      if (wy < cfg.floorGuard) continue
      const sec = sections[(wy - oy0) / S | 0]
      if (!sec) continue
      const ly = wy - oy0 - ((wy - oy0) / S | 0) * S
      const dy = wy - y
      for (let wz = z0; wz <= z1; wz++) {
        const dz = wz - z
        for (let wx = x0; wx <= x1; wx++) {
          const dx = wx - x
          if (dx * dx + dy * dy + dz * dz > r2) continue
          const li = sec.idx(wx - ox, ly, wz - oz)
          if (!carvable(sec.data[li])) continue
          if (surfaceAt && !carveReaches(wy, surfaceAt(wx, wz), cfg, seaLevel)) continue
          sec.data[li] = AIR
          carved++
        }
      }
    }
  })
  return carved
}

/**
 * May a carver open this cell, given its column's surface? The two altitude refusals `carveOne`
 * applies, as one predicate.
 *
 * ★ IT IS A FUNCTION BECAUSE `carveTopAt` HAS TO ASK THE SAME QUESTION, and a second copy of two
 * inequalities is exactly the hand-kept mirror this tree keeps paying for: both copies would stay
 * correct until someone changed one, and a query that disagrees with the writer reports caves in
 * cells that are solid. One definition, two callers.
 */
export function carveReaches(y: number, h: number, cfg: CarveConfig, seaLevel: number): boolean {
  // Leave the ground intact: no surface breach, and never open the floor under standing water
  // (which drains a lake through a hole nobody can see).
  if (y > h - cfg.surfaceClearance) return false
  if (h <= seaLevel && y > h - 3) return false
  return true
}

/**
 * ── ★★★ THE HIGHEST CELL ANY CARVER OPENS IN COLUMN (x, z), OR -1 ──────────────────────────────
 *
 * Pure, and that is the entire reason it exists rather than a read of the written grid. The adit
 * in `dens.ts` has to know whether a tunnel runs just under the crust HERE before it will cut a
 * mouth, and a den's plan may be resolved from a neighbouring column that has not been generated —
 * that is what makes the whole no-coordination scheme work (`denAt` reads only `surfaceAt`, which
 * is pure and global). A planner that peeked at `sections` would compute one plan from its own
 * column and a different one from next door, and the seam would be half a cave mouth.
 *
 * ⚠ IT WALKS THE SAME `walkCarve` THE WRITER WALKS, AND SHARES `carveReaches` WITH IT. That is
 * deliberate and it is the difference between a derivation and a mirror: the only thing this
 * function adds is the projection of a sphere onto one vertical line. `carve.test.ts` asserts it
 * against what `carveStack` actually WROTE over a few thousand columns rather than against a second
 * reading of the same idea, because two functions that agree with each other prove nothing.
 *
 * ⚠ IT CANNOT SEE MATERIAL. `carveOne` also refuses a non-carvable cell (packed cloud, water), and
 * nothing pure knows what is at a voxel before the stage runs. So this is an UPPER BOUND: it may
 * report a cell the writer declined. The differential measures how often, and the adit treats a
 * miss as a refusal rather than as a hole, so the failure direction is a mouth that does not get
 * cut — never a mouth into solid rock.
 */
export function carveTopAt(
  seed: number, x: number, z: number, chunk: number,
  surfaceAt: (x: number, z: number) => number, seaLevel: number,
  cfg: CarveConfig = DEFAULT_CARVE,
): number {
  return carveTopAtMany(seed, [{ x, z }], chunk, surfaceAt, seaLevel, cfg)[0]
}

/**
 * ── ★★ `carveTopAt` FOR MANY COLUMNS AT ONCE, AND THE BATCHING IS NOT AN OPTIMISATION DETAIL ────
 *
 * It is the same lesson `carveOne` learned and wrote down two paragraphs up: *"the walk does not
 * depend on which section is being filled, so it belongs outside that loop."* The adit planner asks
 * this question once per attempt, every attempt in a column shares the same carvers, and answering
 * them one at a time re-walks the whole scan box each time.
 *
 * ⚠ MEASURED, BECAUSE THE FIRST VERSION SHIPPED THE SLOW SHAPE AND IT WAS NOT SUBTLE: per-attempt
 * queries took column generation from 288ms to 736ms per four columns — a 2.6x worldgen regression,
 * in a browser worker, on a box whose GPU is an Intel UHD 630. That is the kind of cost that never
 * shows up as a wrong pixel and only ever shows up as the world loading badly.
 *
 * The points are expected to sit within a column or two of each other (they are one column's adit
 * attempts), so a single bounding box around them rejects almost every sphere before any point is
 * tested. Answers are returned in the order the points were given.
 */
export function carveTopAtMany(
  seed: number, pts: ReadonlyArray<{ x: number; z: number }>, chunk: number,
  surfaceAt: (x: number, z: number) => number, seaLevel: number,
  cfg: CarveConfig = DEFAULT_CARVE,
): number[] {
  const n = pts.length
  const out = new Array<number>(n).fill(-1)
  if (n === 0) return out

  // ⚠⚠ THERE IS NO SECOND COPY OF THE ALTITUDE RULE HERE, AND THERE WAS ONE UNTIL A MUTATION
  // PROVED IT DEAD. The first version precomputed a per-point ceiling as
  // `min(h - surfaceClearance, h <= seaLevel ? h - 3 : Infinity)` — which is `carveReaches`
  // rewritten as an inequality — and then ALSO called `carveReaches` in the loop below. The two
  // agreed, so the call was unreachable: mutating it to `if (false)` changed nothing and the sweep
  // reported SURVIVED, which reads as *the differential is blind*. It was not blind; the guard was
  // simply guarding a copy of itself. Exactly the hand-kept-mirror shape, hiding inside a line
  // written to avoid one. The loop now starts at the sphere's own top and `carveReaches` is the
  // only thing that decides, so there is one definition and the mutation fires.
  const hs = new Array<number>(n)
  let px0 = Infinity, px1 = -Infinity, pz0 = Infinity, pz1 = -Infinity
  for (let i = 0; i < n; i++) {
    hs[i] = surfaceAt(pts[i].x, pts[i].z)
    if (pts[i].x < px0) px0 = pts[i].x
    if (pts[i].x > px1) px1 = pts[i].x
    if (pts[i].z < pz0) pz0 = pts[i].z
    if (pts[i].z > pz1) pz1 = pts[i].z
  }

  const rad = carveScanRadius(chunk, cfg)
  const c0x = Math.floor(px0 / chunk) - rad, c1x = Math.floor(px1 / chunk) + rad
  const c0z = Math.floor(pz0 / chunk) - rad, c1z = Math.floor(pz1 / chunk) + rad
  for (let cz = c0z; cz <= c1z; cz++) {
    for (let cx = c0x; cx <= c1x; cx++) {
      for (const st of carveStartsAt(seed, cx, cz, chunk, cfg)) {
        walkCarve(st, cfg, (sx, sy, sz, r) => {
          // One box reject for the whole point set, before any per-point work.
          if (sx + r < px0 || sx - r > px1 || sz + r < pz0 || sz - r > pz1) return
          if (sy + r < cfg.floorGuard) return
          for (let i = 0; i < n; i++) {
            if (sy + r <= out[i]) continue
            const dx = pts[i].x - sx, dz = pts[i].z - sz
            const flat = dx * dx + dz * dz
            if (flat > r * r) continue
            const yTopHere = Math.floor(sy + Math.sqrt(r * r - flat))
            for (let y = yTopHere; y > out[i] && y >= cfg.floorGuard; y--) {
              const dy = y - sy
              if (dy * dy + flat > r * r) continue
              if (!carveReaches(y, hs[i], cfg, seaLevel)) continue
              out[i] = y
              break
            }
          }
        })
      }
    }
  }
  return out
}

/**
 * One carver's walk, as a sequence of spheres. Extracted so the writer and `carveTopAt` cannot
 * drift apart — the walk IS the tunnel's definition, and two copies of it would be two tunnels.
 *
 * ⚠ THE RNG STREAM IS THE CONTRACT. Four draws per step in a fixed order (yaw, pitch, cavern,
 * radius), and both `break` conditions come BEFORE the cavern draw. A visitor cannot perturb it,
 * which is what makes it safe to hand this walk to a caller that only looks.
 */
function walkCarve(
  start: CarveStart, cfg: CarveConfig, visit: (x: number, y: number, z: number, r: number) => void,
): void {
  const g = rng(start.seed ^ 0x5f356495)
  let x = start.x, y = start.y, z = start.z
  let yaw = start.yaw, pitch = start.pitch
  for (let step = 0; step < start.steps; step++) {
    // Smooth wander: nudge the heading rather than re-rolling it, or the tunnel becomes a scribble.
    yaw += (g() - 0.5) * 0.38
    pitch = Math.max(-0.6, Math.min(0.6, pitch + (g() - 0.5) * 0.16))
    x += Math.cos(yaw) * Math.cos(pitch)
    z += Math.sin(yaw) * Math.cos(pitch)
    y += Math.sin(pitch)

    if (y < cfg.floorGuard || y > cfg.yMax + 12) break
    // Bounded reach is a hard contract: the scan box is sized from it, so a tunnel that outran it
    // would be clipped invisibly and leave a wall mid-passage.
    if (Math.abs(x - start.x) > cfg.maxReach || Math.abs(z - start.z) > cfg.maxReach) break

    const cavern = g() < cfg.cavernChance
    const r = cavern
      ? cfg.cavernRadiusMin + g() * (cfg.cavernRadiusMax - cfg.cavernRadiusMin)
      : start.radius * (0.75 + g() * 0.5)
    visit(x, y, z, r)
  }
}

/**
 * Apply every carver that can reach this stack. `ox/oy0/oz` is the stack's world-space min corner.
 *
 * This is the whole cross-chunk story in one loop: scan the owning chunks in range, ask each what it
 * owns, clip. Nothing stored, nothing coordinated — two neighbouring stacks generated on different
 * threads in different orders produce the same tunnel, because both ran this same pure scan.
 */
export function carveStack(
  sections: (Section | null)[], ox: number, oy0: number, oz: number, chunk: number, seed: number,
  cfg: CarveConfig = DEFAULT_CARVE,
  surfaceAt?: (x: number, z: number) => number,
  seaLevel = -Infinity,
): number {
  const first = sections.find(Boolean)
  if (!first) return 0
  const rad = carveScanRadius(chunk, cfg)
  const c0x = Math.floor(ox / chunk), c0z = Math.floor(oz / chunk)
  const c1x = Math.floor((ox + first.size - 1) / chunk), c1z = Math.floor((oz + first.size - 1) / chunk)
  let carved = 0
  for (let cz = c0z - rad; cz <= c1z + rad; cz++) {
    for (let cx = c0x - rad; cx <= c1x + rad; cx++) {
      for (const st of carveStartsAt(seed, cx, cz, chunk, cfg)) {
        carved += carveOne(sections, ox, oy0, oz, st, cfg, surfaceAt, seaLevel)
      }
    }
  }
  return carved
}

/** Single-section convenience — a stack of one. Prefer `carveStack` for real generation. */
export function carveSection(
  sec: Section, ox: number, oy: number, oz: number, chunk: number, seed: number,
  cfg: CarveConfig = DEFAULT_CARVE,
  surfaceAt?: (x: number, z: number) => number,
  seaLevel = -Infinity,
): number {
  return carveStack([sec], ox, oy, oz, chunk, seed, cfg, surfaceAt, seaLevel)
}
