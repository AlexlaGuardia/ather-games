// expedition.ts — THE EXPEDITION: a generated maze floor (2026-09-29, the first slice).
//
// Alex: *"pre generated style dungeons with mazes and puzzles to figure out to find chests… the reason to do them would
// be the mob drops.. elite mobs drop the same samples needed to upgrade the tree in the breach.. the unique chest idea..
// a chance when opening one of these puzzle chests to have it in the loot.. a high chance of breaking on opening."*
//
// ── WHAT A RUN IS ─────────────────────────────────────────────────────────────────────────────────────────────
// A seeded maze of corridors and a few rooms. Elites stand in the rooms and drop WRACK (canon's word for what a fallen
// special leaves, `two-lines-two-games.md` › THE LAB, WRACK), which now BANKS between runs and is carried into the
// Breach. Caches (never "chests" for loot, the 09-05 vessel ruling) sit in dead ends; one per floor is a PUZZLE cache
// on a raised terrace. The exit is the far end of the maze.
//
// ── THE PUZZLE (v1): THE TERRACE ────────────────────────────────────────────────────────────────────────────
// The puzzle cache sits on a terrace two tiers up in a room corner: a cliff from the room (a walker steps one tier, a
// jump clears about 1.2), which Updraft, Quickform or Overcharge clear. ★ THE LONG WAY ALWAYS EXISTS: a one-tier stair
// in the NEIGHBOURING maze cell climbs onto the terrace's back through a gap in the room wall, and every maze cell is
// reachable, so a keeper whose casts cannot lift them walks round. The cast is a shortcut, never a lock.
//
// ── CANON BOUNDARY ─────────────────────────────────────────────────────────────────────────────────────────
// What these places ARE, who built them, what the elites are and what the keepsake is called are OPEN
// (`CANON_GAPS.md` › Expeditions). Nothing here names the place or describes it. Layout, drops, odds = Jin's.

export const EXP_ZONE = 'expedition'

// tile ids (Shimmer3D's constants; WALL must be 34, the one id every bot, round and orb predicate treats as solid)
export const EXP_FLOOR = 97
export const EXP_WALL = 34
export const EXP_WARP = 14

/** maze cells across/down; a cell is CELL tiles of floor plus one of wall */
export const MAZE = 9
export const CELL = 4
export const EXP_SIZE = MAZE * CELL + 1
export const TERRACE_TIERS = 2

export interface ExpCache { id: string; x: number; z: number; y: number; puzzle: boolean }
export interface ExpLayout {
  seed: number
  grid: number[][]
  heights: number[][]
  start: { x: number; z: number }
  exit: { x: number; z: number }
  elites: { x: number; z: number }[]
  caches: ExpCache[]
  /** the stair that is the long way onto the terrace (for the oracle, and a future hint) */
  stair: { x: number; z: number } | null
}

function rng(seed: number): () => number {
  let a = seed >>> 0 || 1
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

const centre = (c: number) => c * CELL + 2   // the middle tile of a cell's 3x3 floor

/**
 * Generate one floor. Pure and seeded: the same seed is the same maze (a party's leader and mates would agree).
 */
export function generateExpedition(seed: number): ExpLayout {
  const r = rng(seed)
  const N = EXP_SIZE
  const grid: number[][] = Array.from({ length: N }, () => Array(N).fill(EXP_WALL))
  const heights: number[][] = Array.from({ length: N }, () => Array(N).fill(0))
  const open = (x: number, z: number) => { grid[z][x] = EXP_FLOOR }
  // carve each cell's 3x3 floor
  for (let cz = 0; cz < MAZE; cz++) for (let cx = 0; cx < MAZE; cx++)
    for (let dz = 1; dz <= 3; dz++) for (let dx = 1; dx <= 3; dx++) open(cx * CELL + dx, cz * CELL + dz)
  // links: [cx,cz] → set of neighbour keys joined
  const joined = new Set<string>()
  const key = (a: number, b: number, c: number, d: number) => (a < c || (a === c && b < d)) ? `${a},${b}|${c},${d}` : `${c},${d}|${a},${b}`
  const join = (ax: number, az: number, bx: number, bz: number) => {
    joined.add(key(ax, az, bx, bz))
    // knock the 3-tile wall between two adjacent cells
    if (ax !== bx) { const wx = Math.max(ax, bx) * CELL; for (let d = 1; d <= 3; d++) open(wx, az * CELL + d) }
    else { const wz = Math.max(az, bz) * CELL; for (let d = 1; d <= 3; d++) open(ax * CELL + d, wz) }
  }
  // 1. a perfect maze (recursive backtracker): every cell reachable
  const seen = new Set<string>(['0,0'])
  const stack: [number, number][] = [[0, 0]]
  const DIRS: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  while (stack.length) {
    const [cx, cz] = stack[stack.length - 1]
    const next = DIRS.map(([dx, dz]) => [cx + dx, cz + dz] as [number, number])
      .filter(([x, z]) => x >= 0 && z >= 0 && x < MAZE && z < MAZE && !seen.has(`${x},${z}`))
    if (!next.length) { stack.pop(); continue }
    const [nx, nz] = next[Math.floor(r() * next.length)]
    join(cx, cz, nx, nz); seen.add(`${nx},${nz}`); stack.push([nx, nz])
  }
  // 2. a few loops, so a maze is a place to move in rather than one corridor with branches
  for (let i = 0; i < 10; i++) {
    const cx = Math.floor(r() * MAZE), cz = Math.floor(r() * MAZE), [dx, dz] = DIRS[Math.floor(r() * 4)]
    const nx = cx + dx, nz = cz + dz
    if (nx >= 0 && nz >= 0 && nx < MAZE && nz < MAZE) join(cx, cz, nx, nz)
  }
  const links = (cx: number, cz: number) => DIRS.map(([dx, dz]) => [cx + dx, cz + dz] as [number, number])
    .filter(([x, z]) => x >= 0 && z >= 0 && x < MAZE && z < MAZE && joined.has(key(cx, cz, x, z)))
  // 3. distances from the start cell (BFS on the cell graph)
  const dist = new Map<string, number>([['0,0', 0]])
  const q: [number, number][] = [[0, 0]]
  while (q.length) {
    const [cx, cz] = q.shift()!
    for (const [x, z] of links(cx, cz)) if (!dist.has(`${x},${z}`)) { dist.set(`${x},${z}`, dist.get(`${cx},${cz}`)! + 1); q.push([x, z]) }
  }
  let far: [number, number] = [0, 0]
  for (const [k, d] of dist) if (d > dist.get(`${far[0]},${far[1]}`)!) far = k.split(',').map(Number) as [number, number]
  // 4. rooms: 2x2 blocks of cells opened into one hall (never the start or exit cell)
  const rooms: [number, number][] = []
  const usedCells = new Set<string>(['0,0', `${far[0]},${far[1]}`])
  for (let tries = 0; rooms.length < 3 && tries < 200; tries++) {
    const cx = 1 + Math.floor(r() * (MAZE - 2)), cz = 1 + Math.floor(r() * (MAZE - 2))
    const cells = [[cx, cz], [cx + 1, cz], [cx, cz + 1], [cx + 1, cz + 1]]
    // never beside the start: an elite's room there meant a fight the moment you landed (seen on prod, 09-29)
    if (cx + cz < 5) continue
    if (cells.some(([x, z]) => x >= MAZE || z >= MAZE || usedCells.has(`${x},${z}`))) continue
    for (let z = cz * CELL + 1; z < (cz + 2) * CELL; z++) for (let x = cx * CELL + 1; x < (cx + 2) * CELL; x++) open(x, z)
    join(cx, cz, cx + 1, cz); join(cx, cz, cx, cz + 1); join(cx + 1, cz, cx + 1, cz + 1); join(cx, cz + 1, cx + 1, cz + 1)
    cells.forEach(([x, z]) => usedCells.add(`${x},${z}`))
    rooms.push([cx, cz])
  }
  // 5. the terrace: in the first room's top-left corner, 2x2 tiles two tiers up (★ NOT 3x3: a maze corridor enters a
  //    room through a 3-tile gap, and a 3x3 terrace walled one off entirely, cutting the maze in two; at 2x2 every
  //    entrance keeps a ground-level third tile); the long way is a one-tier stair in the
  //    cell to the room's WEST, through a gap in the west wall beside the terrace (or NORTH if the room is on the edge)
  let stair: { x: number; z: number } | null = null
  const caches: ExpCache[] = []
  if (rooms.length) {
    const [rx, rz] = rooms[0]
    const x0 = rx * CELL + 1, z0 = rz * CELL + 1
    for (let z = z0; z < z0 + 2; z++) for (let x = x0; x < x0 + 2; x++) heights[z][x] = TERRACE_TIERS
    if (rx > 0) {
      const gz = z0                           // the gap in the room's west wall, level with the terrace's top row
      open(rx * CELL, gz); heights[gz][rx * CELL] = TERRACE_TIERS
      stair = { x: rx * CELL - 1, z: gz }     // the west cell's east column: one tier, climbed from its floor
    } else {
      const gx = x0
      open(gx, rz * CELL); heights[rz * CELL][gx] = TERRACE_TIERS
      stair = { x: gx, z: rz * CELL - 1 }
    }
    heights[stair.z][stair.x] = 1
    caches.push({ id: 'cache:terrace', x: x0 + 1, z: z0 + 1, y: TERRACE_TIERS, puzzle: true })
  }
  // 6. ground caches in dead ends (cells with one link), the farthest first
  const deadEnds = [...dist.entries()].map(([k, d]) => ({ c: k.split(',').map(Number) as [number, number], d }))
    .filter(({ c }) => links(c[0], c[1]).length === 1 && !usedCells.has(`${c[0]},${c[1]}`))
    .sort((a, b) => b.d - a.d)
  for (const { c } of deadEnds.slice(0, 2)) caches.push({ id: `cache:${c[0]},${c[1]}`, x: centre(c[0]), z: centre(c[1]), y: 0, puzzle: false })
  // 7. elites: one in each room (off the terrace), and one guarding the exit's approach
  const elites = rooms.map(([rx, rz]) => ({ x: (rx + 1) * CELL + 1.5, z: (rz + 1) * CELL + 1.5 }))
  const nearExit = [...dist.entries()].filter(([k, d]) => { const [x, z] = k.split(',').map(Number); return d === Math.max(1, (dist.get(`${far[0]},${far[1]}`) ?? 1) - 2) && x + z >= 5 })[0]
  if (nearExit) { const [ex, ez] = nearExit[0].split(',').map(Number); elites.push({ x: centre(ex) + 0.5, z: centre(ez) + 0.5 }) }
  // 8. the exit: a warp tile in the far cell
  const exit = { x: centre(far[0]), z: centre(far[1]) }
  grid[exit.z][exit.x] = EXP_WARP
  return { seed, grid, heights, start: { x: centre(0), z: centre(0) }, exit, elites, caches, stair }
}

// ── the loot ──────────────────────────────────────────────────────────────────────────────────────────────────
/** a puzzle cache that holds together when opened instead of breaking (Alex: "a high chance of breaking") */
export const HELD_CHANCE = 0.12
export const ELITE_WRACK = 2
export interface CacheLoot { wrack: number; marks: number; held: boolean }
export function rollCache(r: () => number, puzzle: boolean): CacheLoot {
  return {
    wrack: puzzle ? 2 + Math.floor(r() * 2) : Math.floor(r() * 2),
    marks: puzzle ? 20 + Math.floor(r() * 16) : 6 + Math.floor(r() * 8),
    held: puzzle && r() < HELD_CHANCE,
  }
}
export const lootRng = rng

// ── ELITES: the Crucible's brain with an elite's body ─────────────────────────────────────────────────────────
import { RANGE_HUNTER, type HunterTuning } from '../engine/hunter-ai'
export const ELITE_HUNTER: HunterTuning = { ...RANGE_HUNTER, hp: 140, speed: 2.6, fireCd: 1.6, closeRange: 8, firstShotCd: 0.8 }
