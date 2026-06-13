import { CrucibleDoc, FloorDoc, TILE } from './types'

export const ARENA_W = 64
export const ARENA_H = 36
export const GAUNTLET_W = 40
export const GAUNTLET_H = 24
export const MID_W = 48
export const MID_H = 28

// the floor chain: arena -> mids -> gauntlet (vault floor last)
export function docFloors(doc: CrucibleDoc): FloorDoc[] {
  return [doc.arena, ...(doc.mids ?? []), doc.gauntlet]
}

// host lv3 unlocks the 3rd floor (one mid). Structure scales with the host,
// not the node — the ladder in the dev editor advertises this.
export function maxFloors(hostLevel: number): number {
  return hostLevel >= 3 ? 3 : 2
}

// a fresh mid floor: arrive at the bottom gate, the open portal waits at the
// top. The host carves the rest.
export function emptyMidFloor(): FloorDoc {
  const f = blankFloor(MID_W, MID_H)
  f.tiles[(MID_H - 3) * MID_W + Math.floor(MID_W / 2)] = TILE.GATE
  f.tiles[2 * MID_W + Math.floor(MID_W / 2)] = TILE.PORTAL
  return f
}

function blankFloor(w: number, h: number): FloorDoc {
  const tiles = new Array(w * h).fill(TILE.FLOOR)
  for (let x = 0; x < w; x++) {
    tiles[x] = TILE.WALL
    tiles[(h - 1) * w + x] = TILE.WALL
  }
  for (let y = 0; y < h; y++) {
    tiles[y * w] = TILE.WALL
    tiles[y * w + w - 1] = TILE.WALL
  }
  return { w, h, tiles, pieces: [] }
}

export function emptyCrucible(name = 'Unnamed Node'): CrucibleDoc {
  // arena: four corner gates + sealed portal at center
  const arena = blankFloor(ARENA_W, ARENA_H)
  const setA = (x: number, y: number, t: number) => (arena.tiles[y * ARENA_W + x] = t)
  setA(6, 6, TILE.GATE)
  setA(6, ARENA_H - 7, TILE.GATE)
  setA(ARENA_W - 7, 6, TILE.GATE)
  setA(ARENA_W - 7, ARENA_H - 7, TILE.GATE)
  setA(Math.floor(ARENA_W / 2), Math.floor(ARENA_H / 2), TILE.PORTAL)

  // gauntlet: arrive at the bottom, the vault waits at the top
  const gauntlet = blankFloor(GAUNTLET_W, GAUNTLET_H)
  const setG = (x: number, y: number, t: number) => (gauntlet.tiles[y * GAUNTLET_W + x] = t)
  setG(Math.floor(GAUNTLET_W / 2), GAUNTLET_H - 3, TILE.GATE)
  setG(Math.floor(GAUNTLET_W / 2), 2, TILE.VAULT)

  return { id: 'local', name, arena, gauntlet }
}

export function tileAt(floor: FloorDoc, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= floor.w || y >= floor.h) return TILE.WALL
  return floor.tiles[y * floor.w + x]
}

export function findTiles(floor: FloorDoc, id: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let y = 0; y < floor.h; y++)
    for (let x = 0; x < floor.w; x++) if (floor.tiles[y * floor.w + x] === id) out.push({ x, y })
  return out
}

// BFS distance field from the target tile type — fighters descend the
// gradient, and depth = how far down they got before falling.
export function distanceField(floor: FloorDoc, targetTile: number): Int32Array {
  const dist = new Int32Array(floor.w * floor.h).fill(-1)
  const queue: number[] = []
  for (const v of findTiles(floor, targetTile)) {
    dist[v.y * floor.w + v.x] = 0
    queue.push(v.y * floor.w + v.x)
  }
  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]
    const x = idx % floor.w
    const y = (idx / floor.w) | 0
    const d = dist[idx]
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= floor.w || ny >= floor.h) continue
      const nidx = ny * floor.w + nx
      if (dist[nidx] !== -1) continue
      if (floor.tiles[nidx] === TILE.WALL) continue
      dist[nidx] = d + 1
      queue.push(nidx)
    }
  }
  return dist
}

// Straight-line sight for shooters — blocked by walls only.
export function hasLineOfSight(floor: FloorDoc, x0: number, y0: number, x1: number, y1: number): boolean {
  let dx = Math.abs(x1 - x0)
  let dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  let x = x0
  let y = y0
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
    if (x === x1 && y === y1) break
    if (tileAt(floor, x, y) === TILE.WALL) return false
  }
  return true
}

// THE BASE FLOOR — the default node, built from Alex's sketch
// (uploads/2026-06-10/Quick-art.crucible1.png): four spawn rooms in the
// quadrants, funnel walls that force same-side teams to meet early, and the
// central ring holding the sealed portal (the red hex). The guards wait
// upstairs — the arena carries spikes only.
function demoArena(): FloorDoc {
  const f = blankFloor(ARENA_W, ARENA_H)
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.tiles[y * f.w + x] = t
  }
  const hwall = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) set(x, y, TILE.WALL)
  }
  const vwall = (y0: number, y1: number, x: number) => {
    for (let y = y0; y <= y1; y++) set(x, y, TILE.WALL)
  }

  // — spawn rooms (star rooms in the sketch) —
  const room = (x0: number, y0: number, openRight: boolean) => {
    const x1 = x0 + 9
    const y1 = y0 + 8
    hwall(x0, x1, y0)
    hwall(x0, x1, y1)
    vwall(y0, y1, x0)
    vwall(y0, y1, x1)
    const doorX = openRight ? x1 : x0
    set(doorX, y0 + 3, TILE.FLOOR)
    set(doorX, y0 + 4, TILE.FLOOR)
    set(doorX, y0 + 5, TILE.FLOOR)
  }
  room(6, 6, true) // Gold (top-left)
  room(6, 21, true) // Azure (bottom-left)
  room(48, 6, false) // Verdant (top-right)
  room(48, 21, false) // Violet (bottom-right)
  set(10, 10, TILE.GATE)
  set(10, 25, TILE.GATE)
  set(53, 10, TILE.GATE)
  set(53, 25, TILE.GATE)

  // — funnel walls: same-side teams must merge into one mid lane —
  vwall(2, 14, 20)
  vwall(22, 33, 20)
  vwall(2, 14, 44)
  vwall(22, 33, 44)

  // — the central ring (the sketch's circle, squared) —
  hwall(25, 39, 12)
  hwall(25, 39, 24)
  vwall(12, 24, 25)
  vwall(12, 24, 39)
  for (const x of [31, 32, 33]) {
    set(x, 12, TILE.FLOOR)
    set(x, 24, TILE.FLOOR)
  }
  for (const y of [17, 18, 19]) {
    set(25, y, TILE.FLOOR)
    set(39, y, TILE.FLOOR)
  }

  // the red hex — the way up, not the prize
  set(32, 18, TILE.PORTAL)

  f.pieces = (
    [
      [18, 17], [18, 19], [46, 17], [46, 19], // funnel mouths
      [23, 18], [41, 18], // side approaches
      [32, 14], [32, 22], // inside the ring, north/south doors
    ] as [number, number][]
  ).map(([x, y]) => ({ kind: 'spike' as const, x, y }))
  return f
}

// THE GUARD HALL — where the host's constructs wait. Two ranks with offset
// doors, then the vault flanked at the top.
function demoGauntlet(): FloorDoc {
  const f = blankFloor(GAUNTLET_W, GAUNTLET_H)
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < f.w && y < f.h) f.tiles[y * f.w + x] = t
  }
  const hwall = (x0: number, x1: number, y: number) => {
    for (let x = x0; x <= x1; x++) set(x, y, TILE.WALL)
  }

  // arrival at the bottom
  set(20, GAUNTLET_H - 3, TILE.GATE)

  // rank walls with offset doors
  hwall(1, GAUNTLET_W - 2, 16)
  for (const x of [8, 9, 10]) set(x, 16, TILE.FLOOR)
  hwall(1, GAUNTLET_W - 2, 9)
  for (const x of [29, 30, 31]) set(x, 9, TILE.FLOOR)

  // the vault
  set(20, 3, TILE.VAULT)

  f.pieces = [
    // one sentry per rank door — the vault itself belongs to the host's
    // three sigil champions, who spawn flanking it
    { kind: 'guard' as const, x: 9, y: 14 },
    { kind: 'guard' as const, x: 30, y: 7 },
    // spikes in the door lanes
    { kind: 'spike' as const, x: 9, y: 15 },
    { kind: 'spike' as const, x: 30, y: 8 },
    { kind: 'spike' as const, x: 20, y: 6 },
  ]
  return f
}

export function demoCrucible(): CrucibleDoc {
  return { id: 'local', name: 'The Base Floor', arena: demoArena(), gauntlet: demoGauntlet() }
}

const STORE_KEY = 'nolmir.crucible.v2'

function validFloor(f: FloorDoc | undefined): boolean {
  return !!f && Array.isArray(f.tiles) && f.tiles.length === f.w * f.h
}

export function saveCrucible(doc: CrucibleDoc) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(doc))
  } catch {}
}

export function loadCrucible(): CrucibleDoc | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const doc = JSON.parse(raw) as CrucibleDoc
    if (!validFloor(doc.arena) || !validFloor(doc.gauntlet)) return null
    if (doc.mids && !doc.mids.every(validFloor)) doc.mids = doc.mids.filter(validFloor)
    return doc
  } catch {
    return null
  }
}
