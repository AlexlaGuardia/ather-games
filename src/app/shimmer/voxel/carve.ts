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

/** A voxel may be carved unless it is structural. Bedrock and the floor guard are never removed. */
function carvable(m: number): boolean {
  return m !== AIR && m !== MAT.BEDROCK && m !== MAT.WATER
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
  const g = rng(start.seed ^ 0x5f356495)
  let x = start.x, y = start.y, z = start.z
  let yaw = start.yaw, pitch = start.pitch
  let carved = 0

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

    // Cheap reject before the O(r^3) sphere fill.
    if (x + r < ox || x - r > ox + S || z + r < oz || z - r > oz + S || y + r < oy0 || y - r > yTop) continue

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
          if (surfaceAt) {
            const h = surfaceAt(wx, wz)
            // Leave the ground intact: no surface breach, and never open the floor under standing
            // water (which drains a lake through a hole nobody can see).
            if (wy > h - cfg.surfaceClearance) continue
            if (h <= seaLevel && wy > h - 3) continue
          }
          sec.data[li] = AIR
          carved++
        }
      }
    }
  }
  return carved
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
