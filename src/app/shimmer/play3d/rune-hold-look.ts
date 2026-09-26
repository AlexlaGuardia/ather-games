// ★ PURE. Rune Hold's LOOK, derived from the town's own grid — never a second copy of the layout.
//
// Canon (`world/rune-hold.md`): *"Mountain village carved into hillside... Stone buildings stacked along
// winding streets. Warm lantern light. Steam rising from smithies."* The town borrows the Passage's
// MATERIALS (stone courses, lanterns, laid ground) and not its SHAPE: canon keeps exactly one underground,
// so the town stays open-sky and reads from the square.
//
// The layout is Alex's (the 2D map editor, TODO(rune-hold-layout)). This file only reads it:
//   · every 4-connected run of building tiles becomes one BLOCK
//   · a block that fills its bounding box is a HOUSE (stone walls, lit windows, a gabled roof, a chimney)
//   · a long, ragged block is the HILLSIDE the town is carved into (dug rock, no roof)
//   · a very small block is a KIOSK — today the two PIERS of THE LANDING (`world/landing.ts`), so it stands
//     door-high and the scene spans a lintel across the gate between them (canon: a *framed* gate)
//   · path tiles are laid as cobbles; lanterns stand on street edges, spaced, never in a doorway
// Collision is untouched: the walker still reads the grid.

export const BUILDING = 103
export const PATH = 3
export const WARP = 14

export type BlockKind = 'house' | 'hillside' | 'kiosk'
export interface Block {
  kind: BlockKind
  /** inclusive bounding box, in cells */
  x0: number; z0: number; x1: number; z1: number
  cells: number
  /** wall height (houses/kiosks) or crest height (hillside), in blocks */
  h: number
  /** the ridge runs along x when the block is wider than it is deep */
  ridgeX: boolean
}
export interface Lantern { x: number; z: number }

/** deterministic 0..1 per cell */
export const hash = (x: number, z: number, k = 0) => {
  let s = (x * 73856093) ^ (z * 19349663) ^ (k * 83492791)
  s = (s ^ (s >>> 13)) * 1274126177
  return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff
}

const id = (v: number | undefined) => (v === undefined || v < 0 ? -1 : v & 0xff)
export const isBuilding = (g: number[][], x: number, z: number) => id(g[z]?.[x]) === BUILDING

/** a house fills its box; the hillside is long and ragged */
export const HOUSE_FILL = 0.8
export const KIOSK_MAX_CELLS = 20
export const HILLSIDE_ASPECT = 4

export function blocksOf(g: number[][]): Block[] {
  const seen = new Set<number>()
  const R = g.length, C = g[0]?.length ?? 0
  const out: Block[] = []
  for (let z = 0; z < R; z++) for (let x = 0; x < C; x++) {
    if (!isBuilding(g, x, z) || seen.has(z * C + x)) continue
    let x0 = x, x1 = x, z0 = z, z1 = z, cells = 0
    const stack = [[x, z]]
    seen.add(z * C + x)
    while (stack.length) {
      const [cx, cz] = stack.pop()!
      cells++
      x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); z0 = Math.min(z0, cz); z1 = Math.max(z1, cz)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, nz = cz + dz
        if (nx < 0 || nz < 0 || nx >= C || nz >= R || seen.has(nz * C + nx) || !isBuilding(g, nx, nz)) continue
        seen.add(nz * C + nx); stack.push([nx, nz])
      }
    }
    const w = x1 - x0 + 1, d = z1 - z0 + 1
    const fill = cells / (w * d), aspect = Math.max(w, d) / Math.min(w, d)
    const kind: BlockKind = cells <= KIOSK_MAX_CELLS ? 'kiosk'
      : fill < HOUSE_FILL || aspect >= HILLSIDE_ASPECT ? 'hillside' : 'house'
    const r = hash(x0, z0, 7)
    // two storeys of stone, give or take a course; the hillside stands well over the roofs
    const h = kind === 'kiosk' ? 3.4 : kind === 'house' ? 4.2 + r * 1.4 : 7.5 + r * 1.5
    out.push({ kind, x0, z0, x1, z1, cells, h, ridgeX: w >= d })
  }
  return out
}

/** A wall cell: a building tile with open ground on at least one side (only these are ever seen). */
export function openSides(g: number[][], x: number, z: number): [number, number][] {
  const sides: [number, number][] = []
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    const v = g[z + dz]?.[x + dx]
    if (v !== undefined && id(v) !== BUILDING) sides.push([dx, dz])
  }
  return sides
}

/** Lanterns stand on the street's edge (a path cell beside grass), spaced, and never on a doorstep. */
export const LANTERN_SPACING = 7
export function lanternsOf(g: number[][]): Lantern[] {
  const out: Lantern[] = []
  const R = g.length, C = g[0]?.length ?? 0
  for (let z = 1; z < R - 1; z++) for (let x = 1; x < C - 1; x++) {
    if (id(g[z][x]) !== PATH) continue
    let edge = false, doorstep = false
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = id(g[z + dz][x + dx])
      if (n !== PATH && n !== BUILDING && n !== WARP && n >= 0) edge = true
      if (n === WARP || n === BUILDING) doorstep = true
    }
    if (!edge || doorstep) continue
    if (out.some(l => Math.hypot(l.x - x, l.z - z) < LANTERN_SPACING)) continue
    out.push({ x, z })
  }
  return out
}
