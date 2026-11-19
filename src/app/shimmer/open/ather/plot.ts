// THE HOME PLOT in 3D — a keeper's fold, a floating island whose edge is a fall
// (game/shimmer-geography.md › THE HOME PLOT IS A FLOATING ISLAND, RULED 2026-08-15). Walking off the edge is
// "falling through your own fold, which returns you to your threshold" — so the fall is the way home, not a death.
//
// ★ THE GARDEN GRID (Alex 2026-11-14, the Ather revamp; logged [OPEN] in CANON_GAPS for Magii to author):
// the island is full size from day one and cut into a 9×9 grid of garden squares. The CORNER 3×3 by the gate is
// yours when Greg hands you the plot (Alex 11-15, the cluster sketch: "starting plot" in the corner beside the "main
// gate", the rest hatched); the rest stands under fold-mist and you buy your way across the grid AWAY from the gate. Squares are bought from Greg with GREY MATTER (what the
// Hollows in the Wilds drop), but the grimoire decides which squares Greg will sell at all:
//   ring 1 (the 5×5 band from the corner)  — once 10 grimoire pages are filled
//   ring 2 (the 7×7 band)                  — at 15
//   ring 3 (the 9×9 band)                  — at 25: the garden is fully expandable
// (the bands are counted out from the start corner, not the middle: 9 / 16 / 24 / 32 squares, the same counts as the
// old centred rings, so the pacing and the grimoire gates carry over unchanged)
// A square must touch ground you already hold. Mist is a wall, not a fall: you cannot walk onto ground you do not hold.
//
// ★ ONE GATE (Alex 11-14): the half-circle station is gone. The plot carries a single gate; its face is the fold map
// (the Wilds you have walked + your waymarks; Tab to Athernyx). Greg stands by the threshold and sells ground.
// The gate stands at the island's SOUTH-WEST corner, in the start ground: in a cluster that corner faces the shared
// square, so you step out of your gate onto the crossroads (ather/cluster.ts turns each garden so it does).
//
// ★ PURE. The island's land is a grid of triangles: what you see is what you stand on.

import type { Box, Shape } from '../terrain-world'
import { shiftLegacyOwned, cornerTo15, LAYOUT } from './garden-snapshot'
import { gardenKey } from '@/lib/keeper-local'

// ── the garden grid ───────────────────────────────────────────────────────────────────────────────────────────
// ★ 300 × 300 m (CANON_GAPS 2026-11-15, RULED: "the home plot is a square on a grid, up to 300 × 300 m at full size",
// growing outward from its inner corner). Square size is build: Alex 11-15 picked 15×15 squares of 20 m.
export const SQ = 20                         // metres per garden square
export const GRID = 15                       // squares per side
export const GRID_HALF = (GRID * SQ) / 2     // 72
/** The start corner: south-west (low i, high j; north = −z). */
const START_CORNER = { i: 0, j: GRID - 1 }

export type SquareId = `${number},${number}`
export const sqId = (i: number, j: number): SquareId => `${i},${j}`
export const parseSq = (id: string) => { const [i, j] = id.split(',').map(Number); return { i, j } }
/** 0 = the starting 3×3 in the corner, 1..3 = the bands outward from it (each four squares deep: 40 / 72 / 104). */
export const ringOf = (i: number, j: number) => {
  const c = Math.max(Math.abs(i - START_CORNER.i), Math.abs(j - START_CORNER.j))
  return c <= 2 ? 0 : Math.ceil((c - 2) / 4)
}
export const squareAt = (x: number, z: number) => {
  const i = Math.floor((x + GRID_HALF) / SQ), j = Math.floor((z + GRID_HALF) / SQ)
  return i >= 0 && j >= 0 && i < GRID && j < GRID ? { i, j } : null
}
export const squareCentre = (i: number, j: number) => ({ x: (i + 0.5) * SQ - GRID_HALF, z: (j + 0.5) * SQ - GRID_HALF })
export const STARTING_SQUARES: SquareId[] = []
for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) if (ringOf(i, j) === 0) STARTING_SQUARES.push(sqId(i, j))

/** Grimoire pages filled before Greg will sell a ring (Alex 11-14). */
export const RING_PAGES = [0, 10, 15, 25] as const
/** Grey matter per square, by ring. Build pacing (Jin); tune with play. */
export const RING_COST = [0, 12, 20, 30] as const   // 216 squares to buy (was 72): 480 + 1440 + 3120 grey for all
/** The grimoire's capacity at each stage: 10 empty pages from Greg, then 15, then 25. */
export const GRIMOIRE_SIZE = (pages: number) => pages < 10 ? 10 : pages < 15 ? 15 : 25

export type BuyVerdict = { ok: true; cost: number } | { ok: false; why: string; cost?: number }
export function canBuy(owned: ReadonlySet<string>, i: number, j: number, pages: number, grey: number): BuyVerdict {
  if (i < 0 || j < 0 || i >= GRID || j >= GRID) return { ok: false, why: 'There is no ground there.' }
  if (owned.has(sqId(i, j))) return { ok: false, why: 'That ground is already yours.' }
  const ring = ringOf(i, j), cost = RING_COST[ring]
  if (pages < RING_PAGES[ring]) return { ok: false, why: `Fill ${RING_PAGES[ring]} grimoire pages first (${pages} so far).`, cost }
  const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => owned.has(sqId(i + di, j + dj)))
  if (!touches) return { ok: false, why: 'It has to touch ground you already hold.', cost }
  if (grey < cost) return { ok: false, why: `It costs ${cost} grey matter. You have ${grey}.`, cost }
  return { ok: true, cost }
}

// ── the island ────────────────────────────────────────────────────────────────────────────────────────────────
// 4 m cells (was 2): a 300 m plot at 2 m, four of them and the valley between, is more triangles than the UHD 630
// should carry; the ground is a gentle rise, 4 m holds its shape. N is kept EVEN so the island's vertices land on
// multiples of 4 m, which is what lets the cluster's valley (meadow.ts) share them exactly.
export const PLOT_CELL = 4
export const PLOT_R = GRID_HALF + 18                 // the island reaches past the outer ring (a shore band), then falls
const N = 2 * Math.ceil((PLOT_R + 6) * 2 / PLOT_CELL / 2)
const HALF = (N * PLOT_CELL) / 2
export const PLOT_N = N
export const PLOT_HALF = HALF

/** Where the keeper stands on arriving home: inside the start ground, facing the gate in its corner. Yaw 0 faces −z;
 *  forward is (−sin yaw, −cos yaw), so 3π/4 faces south-west. */
/** The one gate, beside the start ground's outer corner (the island's south-west) and OFF the diagonal (Alex 11-15:
 *  "the gate should sit off to the side of the bridge not blocking it"): a linked cluster's path leaves along the
 *  diagonal and runs past it. */
export const GATE = { x: -GRID_HALF + 4, z: GRID_HALF - 22 }
const TH = { x: -GRID_HALF + 22, z: GRID_HALF - 22 }
export const THRESHOLD = { ...TH, yaw: Math.atan2(-(GATE.x - TH.x), -(GATE.z - TH.z)) }
/** Where a linked cluster's path leaves the start ground: on the corner's diagonal, the gate off to its side. */
export const PATH_START = { x: -GRID_HALF + 10, z: GRID_HALF - 10 }
/** The gate's ring turns to face the threshold (rotation.y; the ring's face is +z unturned). */
export const GATE_FACE = Math.atan2(THRESHOLD.x - GATE.x, THRESHOLD.z - GATE.z)
/** ★ A PLOT ANCHOR ONLY since BETA M30 part 2 (canon 44bc0c1: Greg is NOT on the plot; he lives at Moonwell Glade, moonwell-glade.ts
 *  gregSpot). The numbers are kept EXACTLY because the planning TABLE, the starting rooms, the ground pad and the collision
 *  box are anchored to them, and a keeper's saved plot must not move. Nothing is drawn or talked to here any more. */
export const GREG = { x: -GRID_HALF + 32, z: GRID_HALF - 14 }
export const GREG_PLOT_ANCHOR = GREG
/** The rise of the island is centred on the start ground (home is the high ground; the far corner runs low). */
const DOME = { x: -GRID_HALF + 40, z: GRID_HALF - 40 }
/** The building grid's one floor height (the old pad height, so the gate, Greg and the threshold do not move). */
export const GROUND_Y = 2.0
const GRID_EASE = 10
/** flat one mesh cell past the grid edge: the edge falls mid-cell (the mesh's vertices sit at 4 m off its own origin) */
const FLAT_HALF = GRID_HALF + PLOT_CELL
export const FALL_Y = -30
export const REACH = 2.4

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** A rounded square with a lumpy shore: wide enough that every garden square is whole land. */
export function insideIsland(x: number, z: number): boolean {
  const a = Math.atan2(z, x)
  const wob = Math.sin(a * 3 + 0.7) * 2.2 + Math.sin(a * 7 - 1.3) * 1.3 + Math.sin(a * 13) * 0.6
  const R = PLOT_R + wob, p = 12   // squarer than it was (8): the grid's corner square must be whole land
  return (Math.abs(x) / R) ** p + (Math.abs(z) / R) ** p < 1
}

function rawHeight(x: number, z: number): number {
  const r = Math.hypot(x - DOME.x, z - DOME.z)
  let y = 2.2 * (1 - Math.min(1, (r / (PLOT_R * 1.5)) ** 2))
  y += (hash(Math.round(x), Math.round(z)) - 0.5) * 0.14
  y += Math.sin(x * 0.11 + 1) * Math.cos(z * 0.09) * 0.7 + Math.sin(x * 0.27 - z * 0.21) * 0.25
  // ★ THE BUILDING GRID IS FLAT (Alex 11-16: "the building grid should be a flat space"). Every garden square stands
  // at GROUND_Y; the rise and roll live only in the shore band past the grid, easing in over GRID_EASE metres.
  const out = Math.max(Math.abs(x) - FLAT_HALF, Math.abs(z) - FLAT_HALF, 0)
  const kf = Math.min(1, out / GRID_EASE); y = y * kf + GROUND_Y * (1 - kf)
  // level pads where the gate, Greg and the threshold stand
  const pad = (cx: number, cz: number, R: number, h: number) => {
    const k = Math.max(0, Math.min(1, (Math.hypot(x - cx, z - cz) - R) / 4)); y = y * k + h * (1 - k)
  }
  pad(GATE.x, GATE.z, 5, 2.0); pad(THRESHOLD.x, THRESHOLD.z, 4, 2.0); pad(GREG.x, GREG.z, 4, 2.0)
  // the corner's apron: level ground out to the shore along the diagonal, where a cluster's path leaves
  for (let t = 0; t <= 22; t += 5.5) pad(PATH_START.x - t * Math.SQRT1_2, PATH_START.z + t * Math.SQRT1_2, 4, 2.0)
  return y
}

const VH = new Float32Array((N + 1) * (N + 1))
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) VH[j * (N + 1) + i] = rawHeight(i * PLOT_CELL - HALF, j * PLOT_CELL - HALF)
const CELLS = new Uint8Array(N * N)
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x0 = i * PLOT_CELL - HALF, z0 = j * PLOT_CELL - HALF, x1 = x0 + PLOT_CELL, z1 = z0 + PLOT_CELL
  CELLS[j * N + i] = insideIsland(x0, z0) && insideIsland(x1, z0) && insideIsland(x0, z1) && insideIsland(x1, z1) ? 1 : 0
}
export const plotVertexHeight = (i: number, j: number) => VH[j * (N + 1) + i]
export const plotCellIsLand = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && CELLS[j * N + i] === 1
/** A vertex of the island's mesh: one that touches a land cell (the cluster meadow pins its edge to these). */
export const plotVertexTouchesLand = (i: number, j: number) =>
  plotCellIsLand(i, j) || plotCellIsLand(i - 1, j) || plotCellIsLand(i, j - 1) || plotCellIsLand(i - 1, j - 1)

export function plotHeightAt(x: number, z: number): number {
  const fx = (x + HALF) / PLOT_CELL, fz = (z + HALF) / PLOT_CELL
  const i = Math.floor(fx), j = Math.floor(fz)
  if (!plotCellIsLand(i, j)) return -Infinity
  const u = fx - i, v = fz - j
  const h00 = VH[j * (N + 1) + i], h10 = VH[j * (N + 1) + i + 1], h01 = VH[(j + 1) * (N + 1) + i], h11 = VH[(j + 1) * (N + 1) + i + 1]
  return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
}

// ── solids: the gate's plinth, Greg, and the mist walls round the ground you hold ─────────────────────────────
const MIST_T = 0.3, MIST_H = 40
/** Every edge between a held square and one you do not hold is a wall, and so is the OUTER edge of every square you
 *  do not hold on the grid's rim: the start is a corner now, so the island's shore band (past the outer ring) is
 *  walkable from day one and would otherwise lead round the outside into the unbought squares. Past the band the
 *  island simply ends, and the fall takes you home. */
export function mistWalls(owned: ReadonlySet<string>): Box[] {
  const out: Box[] = []
  const inGrid = (i: number, j: number) => i >= 0 && j >= 0 && i < GRID && j < GRID
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
    const held = owned.has(sqId(i, j))
    const x0 = i * SQ - GRID_HALF, z0 = j * SQ - GRID_HALF, x1 = x0 + SQ, z1 = z0 + SQ
    // held: walls toward unheld neighbours; unheld: walls toward the outside of the grid
    const wall = (ni: number, nj: number) => held ? inGrid(ni, nj) && !owned.has(sqId(ni, nj)) : !inGrid(ni, nj)
    if (wall(i, j - 1)) out.push({ x0, x1, z0: z0 - MIST_T, z1: z0 + MIST_T, y0: -20, y1: MIST_H })
    if (wall(i, j + 1)) out.push({ x0, x1, z0: z1 - MIST_T, z1: z1 + MIST_T, y0: -20, y1: MIST_H })
    if (wall(i - 1, j)) out.push({ x0: x0 - MIST_T, x1: x0 + MIST_T, z0, z1, y0: -20, y1: MIST_H })
    if (wall(i + 1, j)) out.push({ x0: x1 - MIST_T, x1: x1 + MIST_T, z0, z1, y0: -20, y1: MIST_H })
  }
  return out
}

const FIXED: Box[] = [
  (() => { const y0 = plotHeightAt(GATE.x, GATE.z) - 0.4; return { x0: GATE.x - 1.6, x1: GATE.x + 1.6, z0: GATE.z - 1.6, z1: GATE.z + 1.6, y0, y1: y0 + 0.75 } })(),
  (() => { const y0 = plotHeightAt(GREG.x, GREG.z); return { x0: GREG.x - 0.4, x1: GREG.x + 0.4, z0: GREG.z - 0.4, z1: GREG.z + 0.4, y0, y1: y0 + 1.8 } })(),
]

/** `walls` replaces the mist walls (a linked plot's lane cuts them, ather/cluster.ts); `extra` adds ground beyond the
 *  island (the cluster's bridges, the shared ground, a mate's plot). Both default to the plot alone. */
export function plotShape(owned: ReadonlySet<string>, walls: Box[] = mistWalls(owned), extra?: (x: number, z: number) => number): Shape {
  const boxes = [...FIXED, ...walls]
  return {
    ground: extra ? (x, z) => Math.max(plotHeightAt(x, z), extra(x, z)) : plotHeightAt,
    solids: (x0, _y0, z0, x1, _y1, z1) => boxes.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0),
    water: () => [],
  }
}

// ── the keeper's garden ledger (per browser, the trial save; NOT the account) ────────────────────────────────
const KEY = 'ather.garden.v1'
export interface Garden { owned: string[]; grey: number; pages: number }
export const freshGarden = (): Garden => ({ owned: [...STARTING_SQUARES], grey: 0, pages: 0 })

/** A save from before the corner start (no `layout`): the old centred 3×3 moves onto the corner and everything
 *  bought moves with it; a square the move pushes off the grid is refunded at what it cost then (the 9×9's prices).
 *  Then, like a layout-2 save, it is re-anchored onto the 15×15's corner. */
const OLD_RING_COST = [0, 20, 35, 55]
export function migrateLegacy(owned: readonly string[], grey: number): { owned: string[]; grey: number } {
  const { kept, dropped } = shiftLegacyOwned(owned)
  const oldRing = (i: number, j: number) => Math.max(0, Math.max(Math.abs(i - 4), Math.abs(j - 4)) - 1)
  const refund = dropped.reduce((a, id) => { const { i, j } = parseSq(id); return a + OLD_RING_COST[oldRing(i, j)] }, 0)
  return { owned: cornerTo15(kept), grey: grey + refund }
}

export function loadGarden(): Garden {
  try {
    const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null')
    if (v && Array.isArray(v.owned) && typeof v.grey === 'number') {
      let owned: string[] = v.owned.filter((s: unknown): s is string => typeof s === 'string')
      let grey = Math.max(0, v.grey)
      if (v.layout === 2) owned = cornerTo15(owned)
      else if (v.layout !== LAYOUT) ({ owned, grey } = migrateLegacy(owned, grey))
      owned = [...new Set([...STARTING_SQUARES, ...owned])]
      return { owned, grey, pages: Math.max(0, Number(v.pages) || 0) }
    }
  } catch { /* fall through */ }
  return freshGarden()
}
export function saveGarden(g: Garden): void {
  try { localStorage.setItem(gardenKey(KEY), JSON.stringify({ ...g, layout: LAYOUT })) } catch { /* private window: the session keeps it */ }
}
