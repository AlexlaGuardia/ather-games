// THE HOME PLOT in 3D — a keeper's fold, a cloud-walled floating island whose edge is a fall
// (game/shimmer-geography.md › THE HOME PLOT IS A FLOATING ISLAND, RULED 2026-08-15). Walking off the edge is
// "falling through your own fold, which returns you to your threshold" — so the fall is the way home, not a death.
//
// ★ THE GATE STATION (shimmer-geography.md › THE GATE STATION, RULED 2026-08-24): Gregory pre-places a LOW
// HALF-CIRCLE OF SOCKETS on the plot, FACING THE THRESHOLD. The station grants nothing; it displays reach the keeper
// has already earned.
//   centre      = the one GATE (crosses out of the Ather; home-cost; Greg's gift). Rendered unlike its neighbours.
//   left arc    = PASSAGES to the Wilds, one per keeper-planted WAYMARK.
//   right arc   = the Chord plot · Lingston (a landing the place keeps) · fold-settlements kept — dark until earned.
// Vocabulary that may ship: waymark · passage · fold · threshold · chord · gate (centre ONLY). Never a bought rune.
//
// ★ PURE. The island's land is a grid of triangles like land.ts: what you see is what you stand on, and the edge
// is a stair of whole cells, which is the Ather's quantized ground showing at the one place you can see its edge.

import type { Box, Shape } from '../terrain-world'

export const PLOT_CELL = 1.5
export const PLOT_R = 30                       // metres; the radius wobbles ±3 around it
const N = Math.ceil((PLOT_R + 4) * 2 / PLOT_CELL)
const HALF = (N * PLOT_CELL) / 2
export const PLOT_N = N
export const PLOT_HALF = HALF

/** Where the keeper stands on arriving home. Canon: one threshold, folded by Greg, the least arbitrary point. */
export const THRESHOLD = { x: 0, z: 16, yaw: 0 }      // yaw 0 faces −z: straight at the station
/** The station's centre: the half-circle stands north of the threshold and opens toward it. */
export const STATION = { x: 0, z: -2 }
export const FALL_Y = -30                              // below this the fold returns you to the threshold

const hash = (a: number, b: number) => {
  let h = (a * 374761393 + b * 668265263) ^ 0x5bd1e995
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** Edge radius at an angle — a soft, lumpy shore, not a disc. */
export function edgeR(a: number): number {
  return PLOT_R + Math.sin(a * 3 + 0.7) * 1.8 + Math.sin(a * 5 - 1.3) * 1.1 + Math.sin(a * 11) * 0.4
}
const insideIsland = (x: number, z: number) => Math.hypot(x, z) < edgeR(Math.atan2(z, x))

/** Vertex height: a low dome with knolls, flattened where the station and threshold stand. */
function rawHeight(x: number, z: number): number {
  const r = Math.hypot(x, z)
  let y = 1.4 * (1 - (r / PLOT_R) ** 2)
  y += (hash(Math.round(x * 2), Math.round(z * 2)) - 0.5) * 0.12
  y += Math.sin(x * 0.31 + 1) * Math.cos(z * 0.27) * 0.35
  // the station's terrace and the threshold pad sit level
  const pad = (cx: number, cz: number, R: number) => Math.max(0, Math.min(1, (Math.hypot(x - cx, z - cz) - R) / 3))
  const kStation = pad(STATION.x, STATION.z - 4, 12), kThresh = pad(THRESHOLD.x, THRESHOLD.z, 3)
  y = y * kStation + 1.0 * (1 - kStation)
  y = y * kThresh + 0.9 * (1 - kThresh)
  return y
}

const VH = new Float32Array((N + 1) * (N + 1))
for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) VH[j * (N + 1) + i] = rawHeight(i * PLOT_CELL - HALF, j * PLOT_CELL - HALF)
/** A cell is land when all four corners are inside the shore. */
const CELLS = new Uint8Array(N * N)
for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
  const x0 = i * PLOT_CELL - HALF, z0 = j * PLOT_CELL - HALF, x1 = x0 + PLOT_CELL, z1 = z0 + PLOT_CELL
  CELLS[j * N + i] = insideIsland(x0, z0) && insideIsland(x1, z0) && insideIsland(x0, z1) && insideIsland(x1, z1) ? 1 : 0
}
export const plotVertexHeight = (i: number, j: number) => VH[j * (N + 1) + i]
export const plotCellIsLand = (i: number, j: number) => i >= 0 && j >= 0 && i < N && j < N && CELLS[j * N + i] === 1

export function plotHeightAt(x: number, z: number): number {
  const fx = (x + HALF) / PLOT_CELL, fz = (z + HALF) / PLOT_CELL
  const i = Math.floor(fx), j = Math.floor(fz)
  if (!plotCellIsLand(i, j)) return -Infinity
  const u = fx - i, v = fz - j
  const h00 = VH[j * (N + 1) + i], h10 = VH[j * (N + 1) + i + 1], h01 = VH[(j + 1) * (N + 1) + i], h11 = VH[(j + 1) * (N + 1) + i + 1]
  return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v
}

// ── the gate station ──────────────────────────────────────────────────────────────────────────────────────────
export const SOCKET_ARC_R = 10
export const SOCKET_REACH = 1.6            // stand this close to a socket to use it
export type SocketClass = 'gate' | 'wilds' | 'chord' | 'landing'
export interface SocketSlot { id: string; cls: SocketClass; x: number; z: number; label: string }

/** Left arc slots for Wilds passages. Canon puts no number on passages ("as many as the build wants"); the build
 *  shows this many and the waymark rules (waymarks.ts) keep the keeper inside them. */
export const WILDS_SOCKETS = 6

/** The half-circle opens toward the threshold (+z). Seen from the threshold, LEFT is −x. */
export function stationSockets(): SocketSlot[] {
  const out: SocketSlot[] = []
  const at = (t: number) => {   // t: −1 far left … 0 centre … +1 far right, as seen from the threshold
    const a = t * (Math.PI / 2) * 0.92
    return { x: STATION.x + Math.sin(a) * SOCKET_ARC_R, z: STATION.z - Math.cos(a) * SOCKET_ARC_R }
  }
  out.push({ id: 'gate', cls: 'gate', ...at(0), label: 'The gate · home in Athernyx' })
  for (let k = 0; k < WILDS_SOCKETS; k++) {
    const t = -1 + (k / WILDS_SOCKETS) * 0.86
    out.push({ id: `wilds-${k}`, cls: 'wilds', ...at(t), label: 'Passage · the Wilds' })
  }
  out.push({ id: 'chord', cls: 'chord', ...at(0.32), label: 'The Chord · not yet' })
  out.push({ id: 'lingston', cls: 'landing', ...at(0.58), label: 'Lingston · not yet' })
  out.push({ id: 'settle-0', cls: 'landing', ...at(0.84), label: 'A kept settlement · not yet' })
  return out
}

/** Pedestals are solid: the walker steps up onto a socket's low plinth (a 0.35 rise is under the 0.5 step rule). */
const SOCKET_BOXES: Box[] = stationSockets().map(s => {
  const r = s.cls === 'gate' ? 1.0 : 0.75, y0 = plotHeightAt(s.x, s.z) - 0.4
  return { x0: s.x - r, x1: s.x + r, z0: s.z - r, z1: s.z + r, y0, y1: y0 + 0.75 }
})

export const PLOT_SHAPE: Shape = {
  ground: plotHeightAt,
  solids: (x0, _y0, z0, x1, _y1, z1) => SOCKET_BOXES.filter(b => b.x0 <= x1 && b.x1 >= x0 && b.z0 <= z1 && b.z1 >= z0),
  water: () => [],
}
