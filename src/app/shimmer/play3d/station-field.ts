// ★ PURE. The Travelers Station's grid, and where its terminal, doors and berths stand.
//
// Canon (`world/rune-hold.md` › *The Station in 1672 is a SPACEPORT, and it is big*, ruled 2026-09-26):
// *"ships leave the planet from here"* · *"several berths, a field, a terminal"* · **one Station** (no second
// fixture for a second purpose) · *"the cap is visible: each saved world the player has seated holds a berth,
// and a ship stands in it."* The chain stands: Muster (the Center, on the square) → Depart (here) → Launch
// (Pyramid Zero). Alex asked for it after walking the stone town: *"the travelers station is a spaceport it
// should be a lot bigger."*
//
// The shape (Jin's — size, layout, berth count are build):
//   · the TERMINAL, west: a stone hall the town's road comes into. The range door is on its north wall, the
//     Crucible's (passage to Pyramid Zero) on its south, and its east side is open onto the field.
//   · the FIELD, east: a paved apron with BERTHS in two rows. A seated berth has a ship standing in it and its
//     gangway is the door; an unseated one is an empty pad. Today the only seated world is THE HOLD (the season
//     proof, owner-only), so its ship stands in berth 1 and the rest are open pads, which IS the visible cap.
//
// Generated like the Passage and the Hold: no literal in `tilemap.ts`, this file is the thing to edit. Every
// door into the Station (`zones.ts`) lands on a spot named here, never on a typed coordinate.

export const T = { FLOOR: 98, WALL: 103, DOOR: 14 } as const

export const STATION_COLS = 80
export const STATION_ROWS = 50

/** Berths on the field. Canon says "several"; the count is Jin's. Two rows of three. */
export const BERTH_COUNT = 6

export interface Door { x: number; z: number; w: number; h: number }
export interface Berth {
  /** 1-based, the number painted on the pad */
  n: number
  /** pad centre */
  x: number; z: number
  /** pad radius, in cells */
  r: number
  /** the season world seated here, or null for an open pad */
  seated: string | null
}
/** A ship at a seated berth: its hull footprint (solid cells), and which way its gangway faces. */
export interface Ship {
  berth: number
  x0: number; z0: number; x1: number; z1: number
  /** the gangway door, on the terminal side of the hull */
  door: Door
  /** where a keeper stands coming back off this ship */
  arrival: { x: number; z: number }
}

export interface StationField {
  grid: number[][]
  heights: number[][]
  terminal: { x0: number; z0: number; x1: number; z1: number; open: { z0: number; z1: number } }
  field: { x0: number; z0: number; x1: number; z1: number }
  doors: { town: Door; range: Door; crucible: Door }
  /** where a keeper stands coming in from each door */
  arrivals: { town: { x: number; z: number }; range: { x: number; z: number }; crucible: { x: number; z: number } }
  berths: Berth[]
  ships: Ship[]
  lanterns: { x: number; z: number }[]
  /** the departures board: the manifest, on the terminal's back wall */
  board: { x: number; z: number }
}

/**
 * The worlds seated today, berth 1 first. The Hold is the only season world built. Its GANGWAY is owner-only
 * (the door's flag in `zones.ts`, a proof), but the SHIP stands for everyone: the hull is solid in the one
 * grid every walker reads, and a hull you bump into but cannot see is a bug, not a secret.
 */
export const SEATED: readonly string[] = ['the-hold']

export function buildStation(seated: readonly string[] = SEATED): StationField {
  const C = STATION_COLS, R = STATION_ROWS
  const grid = Array.from({ length: R }, () => new Array<number>(C).fill(T.FLOOR))
  const heights = Array.from({ length: R }, () => new Array<number>(C).fill(0))
  const wall = (x: number, z: number) => { if (grid[z]?.[x] !== undefined) grid[z][x] = T.WALL }
  const paint = (d: Door) => { for (let dz = 0; dz < d.h; dz++) for (let dx = 0; dx < d.w; dx++) grid[d.z + dz][d.x + dx] = T.DOOR }

  // ── the boundary: a stone rim round everything, so nothing walks off the world ──
  for (let x = 0; x < C; x++) { wall(x, 0); wall(x, R - 1) }
  for (let z = 0; z < R; z++) { wall(0, z); wall(C - 1, z) }

  // ── the terminal: a stone hall, west. Its east side stands open onto the field ──
  const terminal = { x0: 1, z0: 13, x1: 24, z1: 36, open: { z0: 19, z1: 30 } }
  for (let x = terminal.x0; x <= terminal.x1; x++) { wall(x, terminal.z0); wall(x, terminal.z1) }
  for (let z = terminal.z0; z <= terminal.z1; z++) {
    wall(terminal.x0, z)
    if (z < terminal.open.z0 || z > terminal.open.z1) wall(terminal.x1, z)
  }
  // the ground west of the terminal outside it is not the Station's: fill the strips above and below solid
  for (let z = 1; z < terminal.z0; z++) for (let x = 1; x < terminal.x1; x++) wall(x, z)
  for (let z = terminal.z1 + 1; z < R - 1; z++) for (let x = 1; x < terminal.x1; x++) wall(x, z)

  const mid = Math.round((terminal.z0 + terminal.z1) / 2)
  const doors = {
    // west wall: the road from the town
    town: { x: terminal.x0, z: mid - 1, w: 2, h: 2 },
    // north wall: the practice range
    range: { x: 9, z: terminal.z0, w: 2, h: 2 },
    // south wall: the Crucible, passage to Pyramid Zero
    crucible: { x: 9, z: terminal.z1 - 1, w: 2, h: 2 },
  }
  // a door two deep reaches INTO the hall from its wall; the wall cells it replaces are the opening
  paint(doors.town); paint(doors.range); paint(doors.crucible)
  const arrivals = {
    town: { x: doors.town.x + 3, z: doors.town.z },
    range: { x: doors.range.x, z: doors.range.z + 3 },
    crucible: { x: doors.crucible.x, z: doors.crucible.z - 2 },
  }

  // ── the field: berths in two rows of three ──
  const field = { x0: terminal.x1 + 1, z0: 1, x1: C - 2, z1: R - 2 }
  const berths: Berth[] = []
  const cols = [38, 55, 71], rows = [12, 37]
  for (const z of rows) for (const x of cols) {
    const n = berths.length + 1
    berths.push({ n, x, z, r: 8, seated: seated[n - 1] ?? null })
  }

  // ── a ship at every seated berth: a hull you cannot walk through, its gangway facing the terminal ──
  const ships: Ship[] = []
  for (const b of berths) {
    if (!b.seated) continue
    const x0 = b.x - 3, x1 = b.x + 3, z0 = b.z - 7, z1 = b.z + 7
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) wall(x, z)
    // the gangway comes down off the hull's west flank, amidships
    // one cell of apron between the hull and the door, so the gangway has room to slope
    const door = { x: x0 - 3, z: b.z - 1, w: 2, h: 2 }
    paint(door)
    ships.push({ berth: b.n, x0, z0, x1, z1, door, arrival: { x: door.x - 2, z: door.z } })
  }

  // ── lanterns: along the terminal's inside walls and round the field's edge ──
  const lanterns: { x: number; z: number }[] = []
  for (let x = terminal.x0 + 4; x < terminal.x1 - 1; x += 6) { lanterns.push({ x, z: terminal.z0 + 1 }); lanterns.push({ x, z: terminal.z1 - 1 }) }
  for (let x = field.x0 + 4; x <= field.x1; x += 9) { lanterns.push({ x, z: field.z0 + 1 }); lanterns.push({ x, z: field.z1 - 1 }) }
  const board = { x: terminal.x0 + 1, z: mid + 5 }

  return { grid, heights, terminal, field, doors, arrivals, berths, ships, lanterns, board }
}

/** The shipped Station: the grid every walker reads. */
export const STATION = buildStation()

/** THE HOLD's ship: the door out to it, and where you come back down. */
export const holdShip = (): Ship | undefined => STATION.ships.find(s => STATION.berths[s.berth - 1].seated === 'the-hold')

export function stationAscii(s: StationField = STATION): string {
  const ch = (v: number): string => v === T.WALL ? '#' : v === T.DOOR ? 'D' : '.'
  const rows = s.grid.map(r => r.map(ch))
  for (const b of s.berths) rows[b.z][b.x] = b.seated ? 'S' : String(b.n)
  for (const a of Object.values(s.arrivals)) rows[a.z][a.x] = '@'
  return rows.map(r => r.join('')).join('\n')
}
