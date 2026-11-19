// Placed things clear the grass (BETA M23, Alex 11-18 playtest: "when you place a room or anything really the floor of
// the garden should be cleared so the ground cover isn't poking through from the bottom").
// One footprint GRID, built once per change of the works (rooms, furniture + decor + the water tap/tank, every
// Keepstone chest, the planning table), so ground-cover.tsx's skip(x, z) is a Set lookup, never a scan of every piece.
// Pure: tested in cover-clear.test.ts.
import { footprint, pieceRect, allChests, chestBox, TABLE, type Works } from './rooms'
import { FURNITURE } from './furniture'
import { wallRects, findRooms } from './plot-walls'

/** Grid cell (m). A tuft is ~0.7 m across, so half a metre keeps the cleared edge tight to the footprint. */
export const CLEAR_CELL = 0.5
/** Cleared margin round each footprint (m): a crossed tuft standing just outside still leans in over the floor. */
export const CLEAR_PAD = 0.35
/** The planning table's half-size (m): workshop.tsx draws it about 2 x 1.2 m. */
const TABLE_HALF = { hw: 1.3, hd: 0.9 }

type Rect = { x0: number; x1: number; z0: number; z1: number }
const key = (i: number, j: number) => i * 100003 + j

/** Every ground rectangle a placed thing covers. */
export function placedRects(w: Works): Rect[] {
  const out: Rect[] = []
  for (const r of w.rooms) out.push(footprint(r.kind, r.x, r.z, r.q))
  for (const p of w.pieces) if (FURNITURE[p.item]) out.push(pieceRect(p.item, p.x, p.z, p.q))
  for (const c of allChests(w)) { const b = chestBox(c); out.push({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }) }
  // M37: drawn walls and the floors of the rooms they close (one rect per room's bounding box when it is a rectangle)
  if (w.walls) {
    out.push(...wallRects(w.walls))
    for (const room of findRooms(w.walls)) { if (room.rect) out.push(room.rect); else for (const [i, j] of room.cells) out.push({ x0: i, x1: i + 1, z0: j, z1: j + 1 }) }
  }
  out.push({ x0: TABLE.x - TABLE_HALF.hw, x1: TABLE.x + TABLE_HALF.hw, z0: TABLE.z - TABLE_HALF.hd, z1: TABLE.z + TABLE_HALF.hd })
  return out
}

/** skip(x, z) for the ground cover: true where a placed thing stands (plus CLEAR_PAD). */
export function coverClear(w: Works): (x: number, z: number) => boolean {
  const cells = new Set<number>()
  for (const r of placedRects(w)) {
    const i0 = Math.floor((r.x0 - CLEAR_PAD) / CLEAR_CELL), i1 = Math.floor((r.x1 + CLEAR_PAD) / CLEAR_CELL)
    const j0 = Math.floor((r.z0 - CLEAR_PAD) / CLEAR_CELL), j1 = Math.floor((r.z1 + CLEAR_PAD) / CLEAR_CELL)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) cells.add(key(i, j))
  }
  return (x, z) => cells.has(key(Math.floor(x / CLEAR_CELL), Math.floor(z / CLEAR_CELL)))
}
