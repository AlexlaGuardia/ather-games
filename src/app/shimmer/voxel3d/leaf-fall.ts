// Falling leaves — an orphaned leaf comes DOWN instead of blinking out.
//
// ★ PURE. No three, no DOM. `leaf-fall-mesh.ts` draws what this holds; VoxelWorld feeds it from
// the decay tick and asks it each frame what landed.
//
// Alex, 2026-09-17: *"the leaves arent coming down with the tree.. they still float there and
// slowly break down."* `voxel/decay.ts` already decides WHEN a leaf is no longer held up and the
// host removes the block — but removal is the whole effect, so a felled tree's crown hangs, then
// disappears a leaf at a time. Nothing moves. This is the motion: the moment a leaf's block goes
// AIR, a leaf of the same species starts falling from where it stood, tumbling, drifting a little,
// and when it meets ground it bursts into the leaf chips a broken leaf already throws. Leaves drop
// no item (registry), so nothing is left lying — the fall is a picture of the canopy coming down,
// not a loot path.
//
// ★ IT FALLS LIKE A LEAF, NOT A STONE. Low terminal speed, a sway, a tumble — the same block
// dropping at 20 blocks/s would read as a crate. `LEAF_FALL` holds the feel numbers; they are a
// look call and Alex's.

export interface FallingLeaf {
  /** Position of the leaf's centre, world units. Starts at the block's centre. */
  x: number; y: number; z: number
  vy: number
  /** Species — the material the block was, so the renderer can pick the tint and tile. */
  material: number
  /** Tumble phase, radians; advances at `spin` per second. */
  phase: number
  spin: number
  /** Sway phase offset so a shower does not swing as one. */
  sway: number
  /** Seconds alive; a leaf older than `LEAF_FALL.maxLife` lands wherever it is. */
  age: number
}

export interface LeafFallTuning {
  gravity: number
  /** Blocks per second a leaf cannot fall faster than. */
  terminal: number
  /** Horizontal sway amplitude, blocks per second at the peak. */
  swayAmp: number
  swayHz: number
  spinMin: number; spinMax: number
  /** Seconds after which a leaf lands regardless — a leaf falling into unloaded space, or a hole. */
  maxLife: number
  /** How many may be in the air; the decay tick drops one per frame so this is a generous cap. */
  cap: number
}

export const LEAF_FALL: LeafFallTuning = {
  gravity: 9,
  terminal: 3.2,
  swayAmp: 0.55,
  swayHz: 1.1,
  spinMin: 1.2, spinMax: 3.4,
  maxLife: 8,
  cap: 256,
}

export interface LeafFallState { leaves: FallingLeaf[] }

export const createLeafFall = (): LeafFallState => ({ leaves: [] })

/** Start a leaf falling from block (x, y, z). Past the cap the oldest lands early. */
export function dropLeaf(st: LeafFallState, x: number, y: number, z: number, material: number, rnd: () => number, t: LeafFallTuning = LEAF_FALL): FallingLeaf {
  const leaf: FallingLeaf = {
    x: x + 0.5, y: y + 0.5, z: z + 0.5, vy: 0, material,
    phase: rnd() * Math.PI * 2,
    spin: (t.spinMin + rnd() * (t.spinMax - t.spinMin)) * (rnd() < 0.5 ? -1 : 1),
    sway: rnd() * Math.PI * 2,
    age: 0,
  }
  if (st.leaves.length >= t.cap) st.leaves.shift()
  st.leaves.push(leaf)
  return leaf
}

/**
 * Advance every leaf by `dt` seconds. Returns the leaves that LANDED this step (removed from the
 * state): the cell under the leaf's centre is solid, the leaf has left the world's floor, or it is
 * past `maxLife`. `solidAt` reads the world; unloaded space should answer false so a leaf keeps
 * falling until maxLife rather than landing on nothing.
 */
export function stepLeafFall(st: LeafFallState, dt: number, solidAt: (x: number, y: number, z: number) => boolean, t: LeafFallTuning = LEAF_FALL): FallingLeaf[] {
  const landed: FallingLeaf[] = []
  const keep: FallingLeaf[] = []
  for (const l of st.leaves) {
    l.age += dt
    l.vy = Math.max(-t.terminal, l.vy - t.gravity * dt)
    const ny = l.y + l.vy * dt
    // Sway: a sideways drift that reverses, per leaf, so a shower scatters as it comes down.
    const s = Math.sin(l.age * t.swayHz * Math.PI * 2 + l.sway) * t.swayAmp * dt
    const c = Math.cos(l.age * t.swayHz * Math.PI * 2 * 0.7 + l.sway) * t.swayAmp * 0.6 * dt
    l.x += s; l.z += c
    l.phase += l.spin * dt
    // Landing: the cell the leaf's centre would enter is solid → stop on top of it.
    const cy = Math.floor(ny - 0.35)
    if (l.age > t.maxLife || ny < 0 || solidAt(Math.floor(l.x), cy, Math.floor(l.z))) {
      l.y = Math.max(ny, cy + 1 + 0.35)
      landed.push(l)
      continue
    }
    l.y = ny
    keep.push(l)
  }
  st.leaves = keep
  return landed
}
