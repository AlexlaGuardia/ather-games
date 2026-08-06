// Dropped items — what a broken block leaves on the ground.
//
// ★ PURE CORE. No react/three/DOM, no imports from outside this folder. Item physics is a rule, not
// a rendering concern, so it lives here and is testable headlessly.
//
// ★ WHY THIS EXISTS AT ALL: mining used to put drops straight into the inventory. That is the
// version you write when you have not played it — it works, and it feels like nothing happened.
// A block that bursts into an object on the floor tells the player the swing landed, shows them
// what it yielded before they own it, and makes a vein something you clear and then collect.

export interface Drop {
  id: number
  itemId: string
  count: number
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  /** Seconds alive — drives the bob/spin phase and eventual despawn. */
  age: number
  /**
   * Seconds before this can be picked up.
   *
   * ★ NOT COSMETIC. Without it the drop is vacuumed on the same frame it spawns and the whole
   * point — seeing the thing fall out of the block — never happens. It also stops a block you
   * PLACE and immediately re-break from feeling like it never left your hand.
   */
  pickupDelay: number
  resting: boolean
}

export interface DropConfig {
  gravity: number
  /** Speed cap, so a drop into a deep shaft does not tunnel through the floor. */
  terminal: number
  /** Horizontal drag while sliding, per second. */
  drag: number
  /** How close the player must be. Generous — chasing a shard around a cave is not fun. */
  pickupRadius: number
  /** Same-item drops closer than this fuse into one entity. */
  mergeRadius: number
  despawnSeconds: number
  maxStack: number
}

export const DEFAULT_DROPS: DropConfig = {
  gravity: 26,
  terminal: 34,
  drag: 6,
  pickupRadius: 1.6,
  mergeRadius: 0.9,
  despawnSeconds: 300,
  maxStack: 99,
}

let nextId = 1
/** Deterministic-ish id source. Ids are per-session handles, never persisted or seeded. */
export const resetDropIds = () => { nextId = 1 }

/**
 * Spawn a drop at the centre of the block that was broken, with a small outward pop.
 *
 * The pop is seeded from the block coordinate rather than random, so the same block broken twice
 * throws its drop the same way. That costs nothing and keeps the whole core deterministic — which
 * is the property that lets a TS and a Rust build be diffed.
 */
export function spawnDrop(itemId: string, count: number, bx: number, by: number, bz: number): Drop {
  let h = (bx * 374761393) ^ (by * 668265263) ^ (bz * 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  const a = ((h >>> 0) / 4294967296) * Math.PI * 2
  return {
    id: nextId++,
    itemId, count,
    x: bx + 0.5, y: by + 0.35, z: bz + 0.5,
    vx: Math.cos(a) * 1.4, vy: 3.1, vz: Math.sin(a) * 1.4,
    age: 0, pickupDelay: 0.45, resting: false,
  }
}

export interface DropTickResult {
  /** Items collected this tick, already merged by id. */
  picked: { itemId: string; count: number }[]
  /** Ids that despawned without being collected. */
  expired: number[]
}

/**
 * Advance every drop: gravity, collision, merging, pickup, despawn.
 *
 * `solidAt` answers whether a voxel blocks movement. Drops resolve against the voxel grid rather
 * than against terrain height, so a drop inside a cave rests on the cave floor, not on the surface
 * far above it — the case a heightfield check gets silently wrong.
 *
 * ⚠ MUTATES `drops` IN PLACE and returns what happened. Allocating a new array of entities every
 * frame is the shape this codebase has already paid for twice (the mesher's scratch, the carver's
 * per-section walk); an entity list is small but it ticks every frame forever.
 */
export function tickDrops(
  drops: Drop[],
  dt: number,
  px: number, py: number, pz: number,
  solidAt: (x: number, y: number, z: number) => boolean,
  cfg: DropConfig = DEFAULT_DROPS,
): DropTickResult {
  const picked: { itemId: string; count: number }[] = []
  const expired: number[] = []

  // ── merge first, so physics and pickup run on the smaller set ────────────────────────────
  for (let i = 0; i < drops.length; i++) {
    const a = drops[i]
    if (a.count <= 0) continue
    for (let j = i + 1; j < drops.length; j++) {
      const b = drops[j]
      if (b.count <= 0 || b.itemId !== a.itemId) continue
      if (a.count + b.count > cfg.maxStack) continue
      const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
      if (dx * dx + dy * dy + dz * dz > cfg.mergeRadius * cfg.mergeRadius) continue
      a.count += b.count
      // The survivor keeps the LONGER remaining delay, or a fresh drop merging into an old one
      // would become instantly collectable and skip its fall.
      a.pickupDelay = Math.max(a.pickupDelay, b.pickupDelay)
      b.count = 0
    }
  }

  for (const d of drops) {
    if (d.count <= 0) continue
    d.age += dt
    d.pickupDelay = Math.max(0, d.pickupDelay - dt)

    if (d.age > cfg.despawnSeconds) { expired.push(d.id); d.count = 0; continue }

    // ── physics ──────────────────────────────────────────────────────────────────────────
    d.vy = Math.max(-cfg.terminal, d.vy - cfg.gravity * dt)

    const ny = d.y + d.vy * dt
    if (d.vy < 0 && solidAt(Math.floor(d.x), Math.floor(ny - 0.15), Math.floor(d.z))) {
      // Land ON TOP of the block below rather than at the sample point, or a drop sinks a little
      // further into the floor on every landing until it is inside it.
      d.y = Math.floor(ny - 0.15) + 1.15
      d.vy = 0
      d.resting = true
    } else {
      d.y = ny
      d.resting = false
    }

    if (d.resting) {
      const k = Math.max(0, 1 - cfg.drag * dt)
      d.vx *= k; d.vz *= k
    }
    const nx = d.x + d.vx * dt
    if (!solidAt(Math.floor(nx), Math.floor(d.y), Math.floor(d.z))) d.x = nx; else d.vx = 0
    const nz = d.z + d.vz * dt
    if (!solidAt(Math.floor(d.x), Math.floor(d.y), Math.floor(nz))) d.z = nz; else d.vz = 0

    // ── pickup ───────────────────────────────────────────────────────────────────────────
    if (d.pickupDelay > 0) continue
    const dx = d.x - px, dy = d.y - py, dz = d.z - pz
    if (dx * dx + dy * dy + dz * dz <= cfg.pickupRadius * cfg.pickupRadius) {
      picked.push({ itemId: d.itemId, count: d.count })
      d.count = 0
    }
  }

  // Compact once, at the end — splicing mid-loop is how an entity list silently skips entries.
  let w = 0
  for (let r = 0; r < drops.length; r++) if (drops[r].count > 0) drops[w++] = drops[r]
  drops.length = w

  return { picked, expired }
}
