// passage-hall.ts — THE PASSAGE as a place: the tunnel down, the cavern market, the arcade room.
//
// ★ PURE. The zone's grid + heights, where each stall and cabinet stands, and where the lanterns hang.
// `world/zones.ts` takes the grid from here and `world/heightmaps.ts` the heights, so the walker, the
// renderer (`PassageScene.tsx`) and the NPC anchors all read one map, as the Hold does.
//
// Canon (`world/rune-hold.md` § The Passage): *"Tunnel network, widening into cavern marketplaces.
// Lantern-lit. Surprisingly warm."* · traders take *"rotating spots. One leaves, another takes their
// place. No permanent claims."* · it runs *"through the mountain to the other side"* · the arcade ROOM
// is here and is where Marks are spent (RULED 2026-08-26). So the shape is those sentences in order:
// a stair down out of the town, a tunnel that opens into one warm cavern ringed with stall bays, a
// side arch into a room of cabinets, and the tunnel carrying on east toward the far side of the
// mountain, which is where the travelling traders come in from.
//
// ── ★ ON THE MORTAL SIDE THE GROUND IS CONTINUOUS (`two-lines-two-games.md`) ──────────────────────
// This is a play3d tile zone, not voxels, which is the ruled state of matter for a place under Rune
// Hold (GBOARD 08-12: the voxel-interior note was retracted for exactly this). The cells are the
// walker's collision grid; the look is `PassageScene`'s, which draws rock, not blocks.
//
// ── JIN'S (layout is a build call; Alex judges it on the walk, and every number here is a dial) ──
//   · 64 × 40 cells. Tunnel descends 4 tiers in steps of 3 cells: the stair is felt, not announced
//   · six stall bays round the cavern rim. Four hold today's shelves; two are travelling-trader bays
//   · cabinets stand shoulder to shoulder on the arcade room's walls, one per arcade game
// TODO(passage-layout): generated as a first draft for Alex's walk; placement is his call to move.

import { GAMES, type GameEntry } from '@/lib/games'
import { passage } from './scene-palette'

const cloth = passage.cloth

export const PASSAGE_COLS = 64
export const PASSAGE_ROWS = 40

/** tile ids this zone paints (`world/tilemap.ts` legend) */
export const T = { FLOOR: 98, ROCK: 103, EXIT: 14 } as const

/** The shelves `PassagePanel` can show, one or two to a stall. */
export type ShelfKey = 'rack' | 'teacher' | 'gems' | 'counter' | 'cutter' | 'secondhand'

export interface Stall {
  /** npc id — `stall:<key>`. The anchor is the COUNTER cell, which is solid, so a keeper talks
   *  across it from the bay floor (the walker's talk radius is 1.7, one cell clears it). */
  id: string
  /** what a keeper reads over the counter */
  name: string
  /** the shelves this stall opens; empty = a travelling-trader bay, shuttered until one rides in */
  shelves: ShelfKey[]
  /** counter cell */
  x: number; z: number
  /** unit vector from the counter toward the bay floor (where the keeper stands) */
  face: [number, number]
  /** awning cloth, a placeholder look */
  cloth: string
}

export interface Cabinet {
  id: string
  game: GameEntry
  x: number; z: number
  face: [number, number]
}

export interface PassageHall {
  grid: number[][]
  heights: number[][]
  arrival: { x: number; z: number }
  exit: { x: number; z: number }
  stalls: Stall[]
  cabinets: Cabinet[]
  lanterns: { x: number; z: number; y: number; big?: boolean }[]
  /** where the tunnel ends in rubble on the far side — the road the traders ride in on */
  farRoad: { x: number; z: number }
  cavern: { cx: number; cz: number; rx: number; rz: number }
  arcade: { x0: number; z0: number; x1: number; z1: number }
}

// ── the stall roster ─────────────────────────────────────────────────────────────────────────
// Names are ROLES, never people (the 08-13 trader note in `npcs3d.ts`: naming a Passage character is
// Magii's). The two open bays are the travelling traders' — CANON_GAPS [OPEN] 09-25 decides whether one
// of them is a stray-keeper; until then they stand shuttered.
const ROSTER: Omit<Stall, 'x' | 'z' | 'face'>[] = [
  { id: 'stall:rack',     name: 'the scroll racks',   shelves: ['rack'],                 cloth: cloth.rack },
  { id: 'stall:teacher',  name: "the teacher's bench", shelves: ['teacher'],             cloth: cloth.teacher },
  { id: 'stall:gems',     name: 'the gem merchants',  shelves: ['gems', 'counter'],      cloth: cloth.gems },
  { id: 'stall:vessels',  name: 'the vessel cutter',  shelves: ['cutter', 'secondhand'], cloth: cloth.vessels },
  { id: 'stall:bay-5',    name: 'an empty bay',       shelves: [],                       cloth: cloth.bay },
  { id: 'stall:bay-6',    name: 'an empty bay',       shelves: [],                       cloth: cloth.bay },
]

/** Games that are the world you are standing in (or a world of their own), not a cabinet in it. */
const NOT_A_CABINET = new Set(['shimmer', 'nolmir', 'magii'])

/** The games that get a cabinet: every PLAY-kind game the public can see, plus the back room for the
 *  owner. World-kind entries (Shimmer itself, Magii, Nolmir) are places, not cabinets. */
export function cabinetGames(isOwner: boolean): GameEntry[] {
  return GAMES.filter(g => g.kind === 'play' && !NOT_A_CABINET.has(g.id) && (g.tier === 'live' || (isOwner && g.tier === 'back-room')))
}

export function buildPassage(isOwner = true): PassageHall {
  const C = PASSAGE_COLS, R = PASSAGE_ROWS
  const grid = Array.from({ length: R }, () => new Array<number>(C).fill(T.ROCK))
  const heights = Array.from({ length: R }, () => new Array<number>(C).fill(0))
  const open = (x: number, z: number, h = 0) => {
    if (x < 1 || z < 1 || x >= C - 1 || z >= R - 1) return
    grid[z][x] = T.FLOOR; heights[z][x] = h
  }

  // ── the tunnel down: west edge → cavern, an S-bend, stepping down one tier every 3 cells ──
  const TZ = 14
  const tunnelZ = (x: number) => TZ + Math.round(1.6 * Math.sin(x / 4.5))
  const tierAt = (x: number) => Math.max(0, 4 - Math.floor(Math.max(0, x - 4) / 3))
  for (let x = 1; x <= 22; x++) for (let dz = -1; dz <= 1; dz++) open(x, tunnelZ(x) + dz, tierAt(x))
  const exit = { x: 1, z: tunnelZ(1) }
  grid[exit.z][exit.x] = T.EXIT; grid[exit.z + 1][exit.x] = T.EXIT
  const arrival = { x: 3, z: tunnelZ(3) }

  // ── the cavern: one warm oval, the rim wobbled so it reads as dug rock, not a drawn ellipse ──
  const cavern = { cx: 33, cz: 15, rx: 12.5, rz: 9 }
  const rimAt = (a: number) => 1 + 0.07 * Math.sin(3 * a + 0.4) + 0.05 * Math.sin(5 * a + 1.9)
  for (let z = 1; z < R - 1; z++) for (let x = 1; x < C - 1; x++) {
    const dx = (x - cavern.cx) / cavern.rx, dz = (z - cavern.cz) / cavern.rz
    if (Math.hypot(dx, dz) <= rimAt(Math.atan2(dz, dx))) open(x, z)
  }
  // the lantern pillar at its heart: solid, 2 × 2
  for (const [x, z] of [[33, 15], [34, 15], [33, 16], [34, 16]] as const) grid[z][x] = T.ROCK

  // ── the stall bays: six notches cut outward from the rim, the counter across each mouth ──
  // Angles avoid the west (the tunnel comes in there), the east (the far road leaves there) and the
  // south (the arcade arch). Two north, two north-east/west shoulders, two south shoulders.
  const BAY_ANGLES = [-2.25, -1.57, -0.9, 0.75, 2.4, 1.95] // radians, z grows south
  const stalls: Stall[] = []
  BAY_ANGLES.forEach((a, i) => {
    const ux = Math.cos(a), uz = Math.sin(a)
    // the rim point along this ray
    let t = 3   // start past the lantern pillar, which is solid
    while (t < 20) {
      const x = Math.round(cavern.cx + ux * cavern.rx * t / 10), z = Math.round(cavern.cz + uz * cavern.rz * t / 10)
      if (grid[z]?.[x] !== T.FLOOR) break
      t += 0.25
    }
    const rim = { x: Math.round(cavern.cx + ux * cavern.rx * (t - 0.5) / 10), z: Math.round(cavern.cz + uz * cavern.rz * (t - 0.5) / 10) }
    // snap the bay's axis to the nearer cardinal so the counter is a straight row
    const vert = Math.abs(uz) >= Math.abs(ux)
    const out: [number, number] = vert ? [0, Math.sign(uz) || 1] : [Math.sign(ux) || 1, 0]
    const side: [number, number] = vert ? [1, 0] : [0, 1]
    // carve the bay: 3 wide, 3 deep, outward from the rim
    for (let d = 1; d <= 3; d++) for (let s = -1; s <= 1; s++) open(rim.x + out[0] * d + side[0] * s, rim.z + out[1] * d + side[1] * s)
    // the counter: a solid row across the bay one cell in, the trader behind it
    const cx = rim.x + out[0] * 2, cz = rim.z + out[1] * 2
    for (let s = -1; s <= 1; s++) grid[cz + side[1] * s][cx + side[0] * s] = T.ROCK
    const r = ROSTER[i]
    stalls.push({ ...r, x: cx, z: cz, face: [-out[0], -out[1]] })
  })

  // ── the arcade room: south of the cavern through a short arch ──
  const arcade = { x0: 22, z0: 28, x1: 45, z1: 37 }
  for (let z = arcade.z0; z <= arcade.z1; z++) for (let x = arcade.x0; x <= arcade.x1; x++) open(x, z)
  for (let z = cavern.cz + Math.floor(cavern.rz) - 1; z < arcade.z0; z++) for (let x = 32; x <= 35; x++) open(x, z)
  // cabinets: shoulder to shoulder along the south wall, then the west and east walls
  const games = cabinetGames(isOwner)
  const spots: { x: number; z: number; face: [number, number] }[] = []
  for (let x = arcade.x0 + 1; x <= arcade.x1 - 1; x += 2) spots.push({ x, z: arcade.z1, face: [0, -1] })
  for (let z = arcade.z1 - 2; z >= arcade.z0 + 1; z -= 2) spots.push({ x: arcade.x0, z, face: [1, 0] })
  for (let z = arcade.z1 - 2; z >= arcade.z0 + 1; z -= 2) spots.push({ x: arcade.x1, z, face: [-1, 0] })
  const cabinets: Cabinet[] = games.slice(0, spots.length).map((g, i) => {
    const s = spots[i]
    grid[s.z][s.x] = T.ROCK
    return { id: `cabinet:${g.id}`, game: g, ...s }
  })

  // ── the far road: the tunnel carries on east toward the other side of the mountain ──
  const farZ = (x: number) => 15 + Math.round(1.2 * Math.sin(x / 3.8 + 1))
  for (let x = 44; x <= 61; x++) for (let dz = -1; dz <= 1; dz++) open(x, farZ(x) + dz)
  const farRoad = { x: 61, z: farZ(61) }

  // ── lanterns: the tunnel alternates walls every 4 cells; the cavern rim gets one between bays ──
  const lanterns: PassageHall['lanterns'] = []
  for (let x = 3; x <= 21; x += 4) {
    const up = (x / 4) % 2 === 0
    lanterns.push({ x, z: tunnelZ(x) + (up ? -1 : 1), y: tierAt(x) })
  }
  lanterns.push({ x: 33.5, z: 15.5, y: 0, big: true })
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2 + Math.PI / 6
    lanterns.push({ x: cavern.cx + Math.cos(a) * (cavern.rx - 1.5), z: cavern.cz + Math.sin(a) * (cavern.rz - 1.5), y: 0 })
  }
  lanterns.push({ x: 33.5, z: arcade.z0 - 1, y: 0 })
  for (let x = 48; x <= 58; x += 5) lanterns.push({ x, z: farZ(x) - 1, y: 0 })

  return { grid, heights, arrival, exit, stalls, cabinets, lanterns, farRoad, cavern, arcade }
}

/** The one built map every reader shares. Built with the owner's cabinet set: the ROOM is the same for
 *  everyone, and a back-room cabinet is refused at the coin slot for a public keeper, not hidden, so a
 *  keeper who is not the owner never walks into a gap in the row. */
export const PASSAGE = buildPassage(true)

/** Is this stall's shelf list served today? Bays with no shelves are the travelling traders'. */
export const isTravellerBay = (s: Stall) => s.shelves.length === 0

/** ASCII, for tests and for reading the layout in a terminal. */
export function passageAscii(h: PassageHall = PASSAGE): string {
  const at = new Map<string, string>()
  h.stalls.forEach((s, i) => at.set(`${s.x},${s.z}`, String(i + 1)))
  h.cabinets.forEach(c => at.set(`${c.x},${c.z}`, 'c'))
  at.set(`${h.arrival.x},${h.arrival.z}`, '@')
  return h.grid.map((row, z) => row.map((t, x) =>
    at.get(`${x},${z}`) ?? (t === T.ROCK ? '#' : t === T.EXIT ? 'X' : h.heights[z][x] > 0 ? String(h.heights[z][x]) : '.'),
  ).join('')).join('\n')
}
