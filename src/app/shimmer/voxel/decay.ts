// Leaf decay — a canopy that has lost its tree comes down.
//
// ★ PURE CORE. No react/three/DOM. The host owns the clock and the world writes; this file only
// answers "which leaves are no longer held up, and when should each one fall".
//
// Alex, 2026-08-13: *"once the trunk is mined the leaves should come down over time."* Chopping
// already persists (`Column.overrides`), so before this the reward for felling a tree was a canopy
// hanging in the air forever — the one edit in the world that visibly refuses to finish.
//
// ── ★ WHY SUPPORT IS RECOMPUTED, NOT STORED ────────────────────────────────────────────────────
// Minecraft keeps a distance-to-log number in every leaf's block state and decays at >4. We cannot:
// a voxel here is ONE material id in a flat array, which is what makes sections, saves, the mesher
// and the worker boundary as cheap as they are. Adding a per-cell counter would change the world's
// storage format for a feature that fires a few times a minute.
//
// So support is a QUESTION ASKED AT CHOP TIME instead of a fact carried by every leaf: a multi
// source BFS out of the surviving logs, through leaves only. It costs one small box scan per log
// removed — player-paced, not per-frame — and it stays correct without anything to keep in sync.
//
// ── ★ AND IT IS DELIBERATELY THE SAME RULE MINECRAFT USES, for a reason that is ours ───────────
// Chopping the base of a trunk leaves the rest standing, so the crown is still held and nothing
// falls. The canopy only comes down when the last log near it is gone — which is what makes felling
// a tree read as an act with an ending, rather than every mis-click raining leaves.

/** Reads a world material at absolute coordinates. Ungenerated space should read as AIR. */
export type MaterialAt = (x: number, y: number, z: number) => number

export interface DecayCell { x: number; y: number; z: number; /** seconds from now */ delay: number }

export interface DecayConfig {
  /**
   * How many leaf-steps a leaf may sit from a log and still be held up.
   *
   * ⚠ THIS IS A CANOPY MEASUREMENT, NOT A TASTE KNOB. The widest species (starwillow, radius 5)
   * hangs strands a further 1-3 below its rim, so a leaf can legitimately sit ~7 steps from the
   * trunk. Set it lower and felling one tree eats the healthy edge of the tree beside it; set it
   * much higher and two neighbouring canopies hold each other up after both trunks are gone.
   */
  maxDist: number
  /** Half-extent of the box searched around the removed log. Must exceed maxDist or the walk is
   *  clipped before it can find a log that really is holding the leaf. */
  span: number
  /** Seconds before the first leaf goes. */
  delayBase: number
  /** Extra seconds per step of distance from the felled trunk — this is what makes it come DOWN
   *  rather than blink out: the canopy unravels outward from where the tree stood. */
  delayPerStep: number
  /** Random spread added per leaf, so a tier does not vanish as one flat disc. */
  delayJitter: number
}

export const DEFAULT_DECAY: DecayConfig = {
  maxDist: 7,
  span: 10,
  delayBase: 0.6,
  delayPerStep: 0.35,
  delayJitter: 0.7,
}

/**
 * Which leaves around (ox,oy,oz) have just lost their support, and how long each should wait.
 *
 * Call AFTER the log has been removed from the world — `at` must already report the new state, or
 * the log being felled counts as its own support and nothing ever decays.
 *
 * `rand` is injected so the oracle can pin the ordering; the host passes Math.random.
 */
export function orphanedLeaves(
  at: MaterialAt,
  isLeaf: (m: number) => boolean,
  isLog: (m: number) => boolean,
  ox: number, oy: number, oz: number,
  rand: () => number,
  cfg: DecayConfig = DEFAULT_DECAY,
): DecayCell[] {
  const { maxDist, span } = cfg
  const S = span * 2 + 1
  const idx = (x: number, y: number, z: number) => ((y + span) * S + (z + span)) * S + (x + span)
  const inBox = (x: number, y: number, z: number) =>
    x >= -span && x <= span && y >= -span && y <= span && z >= -span && z <= span

  // 255 = unreached. Distances stay well under that, so the array doubles as the visited set.
  const dist = new Uint8Array(S * S * S).fill(255)

  // ── seed the walk from every surviving log in the box ──
  // ⚠ Logs are collected across the WHOLE box, not just near the removal, because the leaf that
  // matters is the one at the boundary between two trees whose crowns touch.
  const queue: number[] = []
  for (let dy = -span; dy <= span; dy++) {
    for (let dz = -span; dz <= span; dz++) {
      for (let dx = -span; dx <= span; dx++) {
        if (!isLog(at(ox + dx, oy + dy, oz + dz))) continue
        dist[idx(dx, dy, dz)] = 0
        queue.push(dx, dy, dz)
      }
    }
  }

  // ── BFS through LEAVES only ──
  // Through leaves and not through air, or support would leak across a gap and a severed crown
  // would be held up by the tree on the other side of the clearing.
  for (let head = 0; head < queue.length; head += 3) {
    const x = queue[head], y = queue[head + 1], z = queue[head + 2]
    const d = dist[idx(x, y, z)]
    if (d >= maxDist) continue
    for (let n = 0; n < 6; n++) {
      const nx = x + (n === 0 ? 1 : n === 1 ? -1 : 0)
      const ny = y + (n === 2 ? 1 : n === 3 ? -1 : 0)
      const nz = z + (n === 4 ? 1 : n === 5 ? -1 : 0)
      if (!inBox(nx, ny, nz)) continue
      const i = idx(nx, ny, nz)
      if (dist[i] !== 255) continue
      if (!isLeaf(at(ox + nx, oy + ny, oz + nz))) continue
      dist[i] = d + 1
      queue.push(nx, ny, nz)
    }
  }

  // ── everything still unreached is orphaned ──
  // ⚠ Reported only within `maxDist` of the removal, NOT the whole span: a leaf out at the box edge
  // may well be held by a log one step further out than we looked, and decaying it would eat holes
  // in an untouched tree every time you fell its neighbour. The box is deliberately larger than the
  // answer it is allowed to give.
  const out: DecayCell[] = []
  const reach = maxDist
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dz = -reach; dz <= reach; dz++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (dist[idx(dx, dy, dz)] !== 255) continue
        if (!isLeaf(at(ox + dx, oy + dy, oz + dz))) continue
        // Chebyshev, not Euclidean: the canopy is a blob around the trunk and this reads as one
        // front moving outward through it rather than a circle expanding through a cube.
        const steps = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))
        out.push({
          x: ox + dx, y: oy + dy, z: oz + dz,
          delay: cfg.delayBase + steps * cfg.delayPerStep + rand() * cfg.delayJitter,
        })
      }
    }
  }
  return out
}

// ── the pending queue ────────────────────────────────────────────────────────────────────────────

/** A leaf waiting to fall. `at` is an absolute timestamp in seconds, so it survives a reload. */
export interface PendingLeaf { x: number; y: number; z: number; at: number }

/**
 * Which pending leaves are due, given the clock.
 *
 * ★ ABSOLUTE TIMES, NOT COUNTDOWNS, and that is the whole persistence story. The queue is written
 * to storage as-is; come back an hour later and every entry is already due, so the canopy you felled
 * is simply gone — which is what "it came down while you were away" has to mean. A countdown would
 * pause whenever the game was not running and the tree would still be standing.
 *
 * The caller applies these through its normal world write, so decay persists exactly the way any
 * other edit does and needs no record of its own.
 */
export function dueLeaves(pending: PendingLeaf[], now: number): PendingLeaf[] {
  return pending.filter(p => p.at <= now)
}

/** The queue with the given cells removed. Kept beside `dueLeaves` so the two can never disagree
 *  about which entries were consumed. */
export function withoutLeaves(pending: PendingLeaf[], done: PendingLeaf[]): PendingLeaf[] {
  if (!done.length) return pending
  const gone = new Set(done.map(p => `${p.x},${p.y},${p.z}`))
  return pending.filter(p => !gone.has(`${p.x},${p.y},${p.z}`))
}

/**
 * Merge newly orphaned cells into the queue.
 *
 * ⚠ AN ALREADY-QUEUED CELL KEEPS ITS EARLIER TIME. Felling a trunk log by log re-runs the scan on
 * every swing and re-orphans the same leaves; taking the newest time each pass would push the
 * canopy's fall further away with every chop, so a fast chopper would never see a leaf drop.
 */
export function enqueueLeaves(pending: PendingLeaf[], cells: DecayCell[], now: number): PendingLeaf[] {
  if (!cells.length) return pending
  const seen = new Map(pending.map(p => [`${p.x},${p.y},${p.z}`, p]))
  for (const c of cells) {
    const k = `${c.x},${c.y},${c.z}`
    const at = now + c.delay
    const prev = seen.get(k)
    if (!prev) seen.set(k, { x: c.x, y: c.y, z: c.z, at })
    else if (at < prev.at) prev.at = at
  }
  return [...seen.values()]
}
