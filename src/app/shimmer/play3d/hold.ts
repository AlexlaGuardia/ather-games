// hold.ts — THE HOLD: a season world's round survival, the first playable slice.
//
// ★ PURE. No react, no three, no DOM. The host (`FiringRange` in Shimmer3D) owns bodies, rounds in
// flight and the keeper's hp; this module owns the landing, the tide's rounds, the seals, the gates,
// salvage, the surge and the hush. Same split as `puppet-guards.ts`, so the whole run is provable
// headless and a tuning change is judged against numbers, not against a feeling at 2am.
//
// ── WHAT IT IS (GBOARD 🌊 SEASON EXPEDITIONS, Alex 2026-09-24) ─────────────────────────────────
// The CoD-Zombies loop in our clothes: rounds that escalate, seals on the windows the flooded tear
// down, salvage for every hit, gates you buy open to reach more of the map, a weapon on the wall,
// gear that CHARGES as you crush the flooded, and a clock that is the Hush Draught running out.
//
// ── ★ ALL POWER IS IN-RUN (the rule that keeps the colossus fair) ─────────────────────────────
// Nothing here reads a save. A new keeper and a veteran walk into the same landing with the same
// sidearm and the same hush. Whatever you buy is gone when the run ends. That is what lets a
// skilled newcomer beat a boss later without a level gate lying about it.
//
// ── CANON ──────────────────────────────────────────────────────────────────────────────────────
// `two-lines-two-games.md` › THE SIGNAL / THE HUSH DRAUGHT: the draught hushes the drinker so the
// host does not hear them as *near*, and it RUNS OUT. So running out is not a timer ending, it is the
// keeper going LOUD: the tide stops coming and starts RUSHING. The flood is the host's raised body
// (`world/nolmir.md` › THE FLOOD) — shown, fought. What made the host stays unnamed (guardrail 1):
// no string in this file names a cause. "The hold", "seal", "surge", "salvage" are build words.
// ⚠ The landing is a BLOCKOUT for feel. Which world, whose host, what the rooms are = per-season.

import { HOLD_FLOORS, type FloorDef } from './hold-floors'
import { buildHold, surfacesAt, solidAt, slabAt, flatViews, kindAt, DIRS, K, STOREY, type Building, type Kind, type Surface } from './hold-building'

// ── the landing: THE TOP THREE FLOORS OF A TOWER, STACKED (Alex 09-25) ─────────────────────────────
// *"they are at the top of a sky scraper building and they can access the top three floors starting on
// the top floor with the bottom floor opening up to the east and west into open air gardens."*
// First built as a setback (a wedding cake), because play3d's ground could only say one height per cell.
// Alex then sized the floors at 50 × 80 each and chose TRULY STACKED, so the floors now sit straight over
// each other: `hold-floors.ts` holds the plans (the thing to edit), `hold-building.ts` turns them into
// the one building the walker, the flooded and every round read. Walls fill a storey and a ramp is the
// only way between floors. The flooded climb the OUTSIDE of the tower to the windows of every floor.

export type RoomId = string

/** Tile ids the zone's flat grid is painted with — the mortal-side pair every stub map uses, plus WARP. */
export const HOLD_TILE = { FLOOR: 98, WALL: 103, WARP: 14, VOID: -1 } as const

export interface Cell { x: number; z: number }
export interface HoldWindow {
  id: number
  room: RoomId
  /** the floor it is on */
  lv: number
  cells: Cell[]
  /** the floor cell just inside — where a keeper stands to mend it */
  inside: { x: number; z: number }
  /** two cells out, in the air — where a flooded body comes up the face */
  spawn: { x: number; z: number }
  /** the window's middle, the point a flooded body climbs to */
  mid: { x: number; z: number }
  /** the sill's height (the floor's) and the height the flooded climb from (a storey down the face) */
  h: number
  spawnH: number
}
export interface HoldGate { id: number; letter: string; cost: number; cells: Cell[]; lv: number; opens: RoomId[]; mid: { x: number; z: number }; h: number }
export interface HoldFixture { x: number; z: number; h: number; lv: number; room: RoomId }
export interface HoldMap {
  cols: number
  rows: number
  building: Building
  /** flat views for the zone (`hold-building.ts` › flatViews) — the walker reads the building itself */
  grid: number[][]
  heights: number[][]
  windows: HoldWindow[]
  gates: HoldGate[]
  /** every region of floor between walls and gates, by name (`<floor>-<n>`) */
  rooms: RoomId[]
  /** per node (floor × cell): the gate / window id there, or -1 */
  gateOf: Int16Array
  winOf: Int16Array
  start: HoldFixture
  exit: HoldFixture
  rack: HoldFixture
  font: HoldFixture
  cache: HoldFixture
}

// ── the dials (first guesses; Alex's feel pass) ───────────────────────────────────────────────
export const HOLD_TUNING = {
  seals: 6,              // planks per window
  tearSec: 1.3,          // seconds a flooded body takes to tear one plank
  mendSec: 0.55,         // seconds of holding E per plank mended
  mendReach: 1.9,        // how close to a window's inside cell you must stand to mend it
  gateCost: { A: 250, B: 500, E: 750, C: 1000, D: 1000 } as Record<string, number>, // A (the top floor's north wing — cheap: room to train is the first buy), B (its south wing), E (the middle floor's halls), C/D (the gardens)
  gateCostDefault: 750,  // a gate letter with no price of its own
  rackCost: 500,         // the SPITTER off the wall
  rackWeapon: 'spitter',
  fontCost: 250,         // a full mana pool — mana is the clip, so this IS the ammo buy
  cacheCost: 400,        // +cacheSec of hush
  cacheSec: 60,
  hushSec: 300,          // the draught you walk in with
  manaPool: 100,         // FIXED — a new keeper's pool; only the birth rune's bonus rides on it (no skill level)
  manaDrip: 0.35,        // mana/sec in the hold — a drip, not a supply (Alex: "not enough but a drip")
  dropChance: 0.03,      // a kill drops a booster this often
  dropCap: 2,            // boosters per round, at most
  dropTtl: 25,           // seconds a booster waits on the floor
  pickupReach: 1.1,
  fieldFullTargets: 2,   // a field damages at most this many bodies at full rate; more inside share it (power-budget.ts)
  breakSec: 8,           // quiet between rounds
  maxAlive: 14,          // bodies in the landing at once, loud or hushed
  salvageHit: 10,
  salvageKill: 50,
  salvageCritKill: 90,
  salvageMend: 10,
  mendSalvageCap: 60,    // per round, so mending a window a body keeps tearing is not a farm
  surgeKills: 18,        // kills to a full surge
  surgeRadius: 5,
  surgeDamage: 60,
  surgeShove: 3,
  reach: 0.85,           // a flooded body strikes inside this
  strikeDmg: 22,
  strikeCd: 1.1,
  interact: 1.8,         // how close to stand to a gate / rack / font / cache
  level: 2,              // tiers apart that still count as the same floor (strikes, prompts, pickups, fields)
  climbRate: 5,          // tiers/sec a body climbs a floor face
} as const
export type HoldTuning = typeof HOLD_TUNING

// ── the tide's bodies ────────────────────────────────────────────────────────────────────────
export type FloodKind = 'drift' | 'swift' | 'bulk'
export interface FloodBody {
  id: number
  kind: FloodKind
  x: number
  z: number
  /** height in tiers — climbs the face while it approaches, follows the floor once inside */
  y: number
  hp: number
  maxHp: number
  speed: number
  /** yard → at the window tearing → through and hunting */
  phase: 'approach' | 'tear' | 'inside'
  win: number
  tearT: number
  strikeT: number
  alive: boolean
}

// ── boosters: what the flooded sometimes leave behind ──────────────────────────────────────────
// Zombies' power-ups in our clothes. One so far, named by Alex (2026-09-24): the GLIMMER OF HOPE
// refreshes the team's mana — solo today, so the keeper's. The union is the roster; a new booster is
// a new kind here and a new case where the host applies it.
export type HoldDropKind = 'glimmer'
export const DROP_NAME: Record<HoldDropKind, string> = { glimmer: 'Glimmer of Hope' }
export interface HoldDrop { id: number; kind: HoldDropKind; x: number; z: number; y: number; ttl: number }

export interface HoldState {
  map: HoldMap
  running: boolean
  over: boolean
  round: number
  /** bodies still to come this round (not yet spawned) */
  toSpawn: number
  spawnT: number
  /** >0 while the tide ebbs between rounds */
  breakT: number
  flood: FloodBody[]
  planks: number[]        // per window
  gatesOpen: boolean[]    // per gate
  rooms: Record<RoomId, boolean>
  salvage: number
  mendPaidThisRound: number
  mendT: number
  kills: number
  surge: number           // 0..1
  hush: number            // seconds left; 0 = LOUD
  rackBought: boolean
  drops: HoldDrop[]
  dropsThisRound: number
  /** boosters picked up and not yet applied — the host drains this (it owns mana, hp, the team) */
  pickups: HoldDropKind[]
  elapsed: number
  nextId: number
  rng: () => number
  /** the flow field toward the keeper — distance in steps per cell, -1 unreachable */
  field: Int16Array
  fieldT: number
  fieldAt: number         // cell index the field was built from
}

// ── parse ────────────────────────────────────────────────────────────────────────────────────
const WALKABLE = (k: Kind) => k === K.FLOOR || k === K.RAMP || k === K.LANDING

export function parseLanding(floors: readonly FloorDef[] = HOLD_FLOORS, tune: HoldTuning = HOLD_TUNING): HoldMap {
  const b = buildHold(floors)
  const { cols, rows } = b
  const per = cols * rows, nodes = per * b.levels.length
  const fx: Record<string, { x: number; z: number; lv: number }> = {}
  b.levels.forEach((L, lv) => {
    for (let i = 0; i < per; i++) {
      const ch = L.ch[i]
      if (!'@XRFH'.includes(ch) || ch === ' ') continue
      if (fx[ch]) throw new Error(`hold: two '${ch}' in the plans`)
      fx[ch] = { x: i % cols, z: (i / cols) | 0, lv }
    }
  })
  for (const k of '@XRFH') if (!fx[k]) throw new Error(`hold: the plans are missing '${k}'`)

  // regions: walkable floor joined by the walker's step (a ramp joins two floors), split by walls, gates, windows
  const region = new Int32Array(nodes).fill(-1)
  const rooms: RoomId[] = []
  const perLevel = new Array(b.levels.length).fill(0)
  for (let lv = 0; lv < b.levels.length; lv++) for (let i = 0; i < per; i++) {
    const n0 = lv * per + i
    if (!WALKABLE(b.levels[lv].kind[i] as Kind) || region[n0] >= 0) continue
    const r = rooms.length
    rooms.push(`${b.levels[lv].name}-${++perLevel[lv]}`)
    region[n0] = r
    const stack = [n0]
    while (stack.length) {
      const n = stack.pop()!, l = (n / per) | 0, c = n % per, x = c % cols, z = (c / cols) | 0, y = b.levels[l].sy[c]
      for (const [dx, dz] of DIRS) {
        for (const su of surfacesAt(b, x + dx, z + dz)) {
          if (!WALKABLE(su.kind) || Math.abs(su.y - y) > 1.01) continue
          const nn = su.lv * per + (z + dz) * cols + x + dx
          if (region[nn] < 0) { region[nn] = r; stack.push(nn) }
        }
      }
    }
  }
  const roomAt = (lv: number, x: number, z: number): RoomId | null => {
    const r = region[lv * per + z * cols + x]
    return r >= 0 ? rooms[r] : null
  }

  // openings: gates and windows, each a 4-connected run of one character on one floor
  const gateOf = new Int16Array(nodes).fill(-1), winOf = new Int16Array(nodes).fill(-1)
  const windows: HoldWindow[] = [], gates: HoldGate[] = []
  const seen = new Uint8Array(nodes)
  for (let lv = 0; lv < b.levels.length; lv++) for (let i = 0; i < per; i++) {
    const L = b.levels[lv], k = L.kind[i]
    if ((k !== K.GATE && k !== K.WINDOW) || seen[lv * per + i]) continue
    const ch = L.ch[i]
    const cells: Cell[] = [], stack = [i]
    seen[lv * per + i] = 1
    while (stack.length) {
      const c = stack.pop()!, x = c % cols, z = (c / cols) | 0
      cells.push({ x, z })
      for (const [dx, dz] of DIRS) {
        const nx = x + dx, nz = z + dz, ni = nz * cols + nx
        if (nx >= 0 && nz >= 0 && nx < cols && nz < rows && !seen[lv * per + ni] && L.ch[ni] === ch) { seen[lv * per + ni] = 1; stack.push(ni) }
      }
    }
    cells.sort((a, c) => a.z - c.z || a.x - c.x)
    const mx = cells.reduce((a, c) => a + c.x, 0) / cells.length
    const mz = cells.reduce((a, c) => a + c.z, 0) / cells.length
    if (k === K.GATE) {
      const id = gates.length
      const opens = new Set<RoomId>()
      for (const c of cells) {
        gateOf[lv * per + c.z * cols + c.x] = id
        for (const [dx, dz] of DIRS) {
          for (const su of surfacesAt(b, c.x + dx, c.z + dz)) {
            if (!WALKABLE(su.kind) || Math.abs(su.y - L.y) > 1.01) continue
            const r = roomAt(su.lv, c.x + dx, c.z + dz)
            if (r) opens.add(r)
          }
        }
      }
      if (opens.size < 2) throw new Error(`hold: gate '${ch}' on ${L.name} at ${cells[0].x},${cells[0].z} does not stand between two rooms`)
      gates.push({ id, letter: ch, cost: tune.gateCost[ch] ?? tune.gateCostDefault, cells, lv, opens: [...opens], mid: { x: mx, z: mz }, h: L.y })
      continue
    }
    // a window faces OUT: the floor side is inside, the open air is where the flooded come from
    const c0 = cells[0]
    const d = DIRS.find(([dx, dz]) => WALKABLE(kindAt(b, lv, c0.x + dx, c0.z + dz)) && kindAt(b, lv, c0.x - dx, c0.z - dz) === K.VOID)
    if (!d) throw new Error(`hold: the window on ${L.name} at ${c0.x},${c0.z} is not in an outside wall (floor on one side, air on the other)`)
    const room = roomAt(lv, c0.x + d[0], c0.z + d[1])!
    const id = windows.length
    for (const c of cells) winOf[lv * per + c.z * cols + c.x] = id
    windows.push({
      id, room, lv, cells,
      inside: { x: mx + d[0], z: mz + d[1] }, spawn: { x: mx - d[0] * 2, z: mz - d[1] * 2 }, mid: { x: mx, z: mz },
      h: L.y, spawnH: L.y - STOREY,
    })
  }
  gates.sort((a, c) => a.cost - c.cost || a.letter.localeCompare(c.letter)).forEach((g, i) => {
    for (const c of g.cells) gateOf[g.lv * per + c.z * cols + c.x] = i
    g.id = i
  })

  // the flat grid draws NOTHING but the way out (`HoldBuilding` draws the floors); the walker stands on
  // `holdSurfaces`, so an empty grid here is not an empty map
  const { heights } = flatViews(b, HOLD_TILE)
  const grid = heights.map(r => r.map(() => HOLD_TILE.VOID as number))
  grid[fx.X.z][fx.X.x] = HOLD_TILE.WARP
  const fixture = (k: string): HoldFixture => {
    const f = fx[k]
    return { x: f.x, z: f.z, lv: f.lv, h: b.levels[f.lv].y, room: roomAt(f.lv, f.x, f.z)! }
  }
  return {
    cols, rows, building: b, grid, heights, windows, gates, rooms, gateOf, winOf,
    start: fixture('@'), exit: fixture('X'), rack: fixture('R'), font: fixture('F'), cache: fixture('H'),
  }
}

// ── rounds ──────────────────────────────────────────────────────────────────────────────────
/** Bodies in round r. Zombies' curve in spirit: a handful, then a climb that keeps climbing. */
export const roundCount = (r: number): number => Math.min(80, Math.round(4 + r * 2.5 + r * r * 0.15))
/** A drift's hp in round r: linear to 9, then ×1.1 a round — the wall every round-game has. */
export function roundHp(r: number): number {
  const lin = 14 + 7 * (Math.min(r, 9) - 1)
  return r <= 9 ? lin : Math.round(lin * Math.pow(1.1, r - 9))
}
/** Seconds between spawns in round r — brisk early, relentless late. */
export const spawnEvery = (r: number): number => Math.max(0.6, 2.0 - (r - 1) * 0.15)
/** Which kind the n-th body of round r is. Deterministic, so a round is the same round every time. */
export function kindFor(r: number, n: number): FloodKind {
  if (r >= 5 && n % 5 === 4) return 'bulk'
  const swiftShare = r < 3 ? 0 : Math.min(0.35, 0.12 + (r - 3) * 0.04)
  return (n * 0.618034) % 1 < swiftShare ? 'swift' : 'drift'
}
export function bodyStats(kind: FloodKind, r: number): { hp: number; speed: number } {
  const hp = roundHp(r)
  const drift = Math.min(3.2, 1.6 + 0.08 * r)
  if (kind === 'swift') return { hp: Math.round(hp * 0.7), speed: 4.2 }
  if (kind === 'bulk') return { hp: Math.round(hp * 2.5), speed: 1.3 }
  return { hp, speed: drift }
}

// ── lifecycle ───────────────────────────────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function startHold(map: HoldMap = parseLanding(), seed = 0x401D, tune: HoldTuning = HOLD_TUNING): HoldState {
  return {
    map, running: true, over: false,
    round: 1, toSpawn: roundCount(1), spawnT: 1.5, breakT: 0,
    flood: [],
    planks: map.windows.map(() => tune.seals),
    gatesOpen: map.gates.map(() => false),
    rooms: Object.fromEntries(map.rooms.map(r => [r, r === map.start.room])),
    salvage: 500, mendPaidThisRound: 0, mendT: 0,
    kills: 0, surge: 0, hush: tune.hushSec, rackBought: false,
    drops: [], dropsThisRound: 0, pickups: [],
    elapsed: 0, nextId: 1, rng: mulberry32(seed),
    field: new Int16Array(map.cols * map.rows * map.building.levels.length).fill(-1), fieldT: 0, fieldAt: -1,
  }
}

export const isLoud = (s: HoldState) => s.hush <= 0

// ── what is solid to whom ─────────────────────────────────────────────────────────────────────
const nodeIdx = (m: HoldMap, lv: number, x: number, z: number) => lv * m.cols * m.rows + z * m.cols + x
/**
 * Is a keeper at height `y` (tiers, feet) stopped at this cell? Walls fill their storey, rails stop
 * the legs, windows never let a keeper through, a shut gate is a wall — all on the keeper's own floor.
 * `gatesOpen` null = before a run exists: every gate shut.
 */
export function holdSolid(m: HoldMap, gatesOpen: readonly boolean[] | null, x: number, z: number, y: number): boolean {
  const open = (lv: number, i: number, k: Kind) => k === K.GATE && gatesOpen?.[m.gateOf[lv * m.cols * m.rows + i]] === true
  return solidAt(m.building, Math.round(x), Math.round(z), y + 0.05, open)
}
export const keeperBlocked = (s: HoldState, x: number, z: number, y: number) => holdSolid(s.map, s.gatesOpen, x, z, y)
/** Every surface a keeper may stand on in a cell — the walker's collision context reads this. */
export function holdSurfaces(m: HoldMap, x: number, z: number): { y: number }[] {
  return surfacesAt(m.building, x, z)
}
/** The highest floor at a cell, in tiers (0 where there is none). */
export const heightAt = (s: HoldState, x: number, z: number): number => {
  const su = surfacesAt(s.map.building, Math.round(x), Math.round(z))
  return su.length ? su[su.length - 1].y : 0
}
/** The floor under something at height `y`: the surface in that cell nearest it. */
export function floorAt(s: HoldState, x: number, z: number, y: number): number {
  let best = -Infinity
  for (const su of surfacesAt(s.map.building, Math.round(x), Math.round(z))) if (Math.abs(su.y - y) < Math.abs(best - y)) best = su.y
  return best === -Infinity ? y : best
}
/**
 * What stops a round: a wall, a shut gate, a rail below its top, a floor slab, a ramp, the roof.
 * Windows let rounds through — you shoot out of them, and down the face at what is climbing.
 */
export function roundBlocked(s: HoldState, x: number, z: number, y: number): boolean {
  const cx = Math.round(x), cz = Math.round(z), b = s.map.building
  const open = (lv: number, i: number, k: Kind) => k === K.WINDOW || s.gatesOpen[s.map.gateOf[lv * s.map.cols * s.map.rows + i]] === true
  return solidAt(b, cx, cz, y, open) || slabAt(b, cx, cz, y)
}
/**
 * The surface a flooded body at height `y` can move onto in a cell: the highest one within a step of
 * it, up or down (they do not drop off ledges, and they only climb the face at a window). A gate must
 * be open and a window's seals gone.
 */
function floodStand(s: HoldState, x: number, z: number, y: number): Surface | null {
  let best: Surface | null = null
  for (const su of surfacesAt(s.map.building, x, z)) {
    if (Math.abs(su.y - y) > 1.01) continue
    const n = nodeIdx(s.map, su.lv, x, z)
    if (su.kind === K.GATE && !s.gatesOpen[s.map.gateOf[n]]) continue
    if (su.kind === K.WINDOW && s.planks[s.map.winOf[n]] > 0) continue
    if (!best || su.y > best.y) best = su
  }
  return best
}

// ── the flow field: BFS from the keeper over every floor, rebuilt when they change cell or every 0.25s ──
/** The keeper's node: the surface in their cell nearest their feet. */
function keeperNode(s: HoldState, px: number, pz: number, py: number): number {
  const x = Math.round(px), z = Math.round(pz)
  let best: Surface | null = null
  for (const su of surfacesAt(s.map.building, x, z)) if (!best || Math.abs(su.y - py) < Math.abs(best.y - py)) best = su
  return best ? nodeIdx(s.map, best.lv, x, z) : -1
}
function buildField(s: HoldState, start: number) {
  const { cols, rows, building: b } = s.map
  const per = cols * rows
  const f = s.field
  f.fill(-1)
  s.fieldAt = start
  if (start < 0) return
  const q = new Int32Array(f.length)
  let head = 0, tail = 0
  f[start] = 0; q[tail++] = start
  while (head < tail) {
    const n = q[head++], lv = (n / per) | 0, c = n % per, x = c % cols, z = (c / cols) | 0
    const y = b.levels[lv].sy[c]
    for (const [dx, dz] of DIRS) {
      const su = floodStand(s, x + dx, z + dz, y)
      if (!su) continue
      const nn = nodeIdx(s.map, su.lv, x + dx, z + dz)
      if (f[nn] !== -1) continue
      f[nn] = f[n] + 1; q[tail++] = nn
    }
  }
}

// ── the step ────────────────────────────────────────────────────────────────────────────────
export interface HoldStepOut {
  /** raw damage the keeper takes this frame (the host applies resist/shield) */
  strike: number
  /** a round just began — the host shows the number */
  roundBegan: number | null
  /** the keeper just went loud */
  wentLoud: boolean
}

export function stepHold(s: HoldState, dt: number, px: number, pz: number, py: number = heightAt(s, px, pz), tune: HoldTuning = HOLD_TUNING): HoldStepOut {
  const out: HoldStepOut = { strike: 0, roundBegan: null, wentLoud: false }
  if (!s.running || s.over) return out
  dt = Math.min(dt, 0.1)
  s.elapsed += dt
  const wasHushed = s.hush > 0
  s.hush = Math.max(0, s.hush - dt)
  // going loud is heard at once: the rush does not wait out the current spawn timer or a lull
  if (wasHushed && s.hush <= 0) { out.wentLoud = true; s.spawnT = Math.min(s.spawnT, 0.3); s.breakT = 0 }
  const loud = s.hush <= 0

  // round flow — the tide ebbs, then comes again, bigger
  const alive = s.flood.filter(b => b.alive).length
  if (s.breakT > 0) {
    s.breakT -= dt
    if (s.breakT <= 0) {
      s.round++
      s.toSpawn = roundCount(s.round)
      s.spawnT = 1
      s.mendPaidThisRound = 0
      s.dropsThisRound = 0
      out.roundBegan = s.round
    }
  } else if (s.toSpawn <= 0 && alive === 0 && !loud) {
    s.breakT = tune.breakSec
    s.flood = []
  }

  // spawns: from the windows of rooms you have opened. LOUD = no ration and no break: they rush.
  s.spawnT -= dt
  const cap = tune.maxAlive
  if (s.spawnT <= 0 && s.breakT <= 0 && (s.toSpawn > 0 || loud) && alive < cap) {
    const wins = s.map.windows.filter(w => s.rooms[w.room])
    const w = wins[Math.floor(s.rng() * wins.length)]
    const n = roundCount(s.round) - s.toSpawn
    const kind: FloodKind = loud ? 'swift' : kindFor(s.round, n)
    const st = bodyStats(kind, s.round)
    s.flood.push({
      id: s.nextId++, kind, x: w.spawn.x + (s.rng() - 0.5) * 0.8, z: w.spawn.z + (s.rng() - 0.5) * 0.8, y: w.spawnH,
      hp: st.hp, maxHp: st.hp, speed: st.speed, phase: 'approach', win: w.id, tearT: 0, strikeT: 0.6, alive: true,
    })
    if (s.toSpawn > 0) s.toSpawn--
    s.spawnT = loud ? 0.3 : spawnEvery(s.round)
  }

  // the field
  const pi = keeperNode(s, px, pz, py)
  s.fieldT -= dt
  if (pi !== s.fieldAt || s.fieldT <= 0) { buildField(s, pi); s.fieldT = 0.25 }

  for (const b of s.flood) {
    if (!b.alive) continue
    b.strikeT = Math.max(0, b.strikeT - dt)
    const w = s.map.windows[b.win]
    if (b.phase === 'approach') {
      // cross to the foot of the face, then CLIMB it to hang under the sill
      const tx = w.mid.x + (w.spawn.x - w.mid.x) * 0.5, tz = w.mid.z + (w.spawn.z - w.mid.z) * 0.5
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz)
      if (d >= 0.15) { const k = Math.min(1, (b.speed * dt) / d); b.x += dx * k; b.z += dz * k; continue }
      const sill = w.h - 0.6
      b.y = Math.min(sill, b.y + tune.climbRate * dt)
      if (b.y >= sill - 1e-6) b.phase = s.planks[w.id] > 0 ? 'tear' : 'inside'
      if (b.phase === 'inside') { b.x = w.mid.x; b.z = w.mid.z; b.y = w.h }
      continue
    }
    if (b.phase === 'tear') {
      if (s.planks[w.id] <= 0) { b.phase = 'inside'; b.x = w.mid.x; b.z = w.mid.z; b.y = w.h; continue }
      b.tearT += dt * (b.kind === 'bulk' ? 2 : 1)
      if (b.tearT >= tune.tearSec) { b.tearT = 0; s.planks[w.id]-- }
      continue
    }
    // inside: follow the floor, down the field toward the keeper — on whichever floor the body is on
    const cx = Math.round(b.x), cz = Math.round(b.z)
    const here = floodStand(s, cx, cz, b.y)
    const hy = here ? here.y : b.y
    b.y += Math.max(-10 * dt, Math.min(10 * dt, hy - b.y))
    const dpx = px - b.x, dpz = pz - b.z, dp = Math.hypot(dpx, dpz)
    if (dp < tune.reach && Math.abs(py - b.y) < tune.level) {
      if (b.strikeT <= 0) { out.strike += tune.strikeDmg * (b.kind === 'bulk' ? 1.5 : 1); b.strikeT = tune.strikeCd }
      continue
    }
    let best = here ? s.field[nodeIdx(s.map, here.lv, cx, cz)] : -1, bx = px, bz = pz
    if (best > 1) {
      for (const [ox, oz] of DIRS) {
        const su = floodStand(s, cx + ox, cz + oz, hy)
        if (!su) continue
        const v = s.field[nodeIdx(s.map, su.lv, cx + ox, cz + oz)]
        if (v >= 0 && v < best) { best = v; bx = cx + ox; bz = cz + oz }
      }
    }
    // a body cut off by a shut gate (field -1) heads for the keeper anyway and is stopped by the wall
    const mx = bx - b.x, mz = bz - b.z, md = Math.hypot(mx, mz) || 1
    const step = Math.min(md, b.speed * dt)
    const nx = b.x + (mx / md) * step, nz = b.z + (mz / md) * step
    if (Math.round(nx) === cx || floodStand(s, Math.round(nx), cz, hy)) b.x = nx
    const cx2 = Math.round(b.x)
    if (Math.round(nz) === cz || floodStand(s, cx2, Math.round(nz), hy)) b.z = nz
  }
  // bodies do not stack into one: a soft shove apart (same floor only)
  const live = s.flood.filter(b => b.alive && b.phase === 'inside')
  const canShove = (b: FloodBody, x: number, z: number) => (Math.round(x) === Math.round(b.x) && Math.round(z) === Math.round(b.z)) || floodStand(s, Math.round(x), Math.round(z), b.y) !== null
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j], dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz
    if (Math.abs(a.y - c.y) >= tune.level) continue
    if (d2 > 0.0001 && d2 < 0.49) {
      const d = Math.sqrt(d2), push = (0.7 - d) * 0.5, ux = dx / d, uz = dz / d
      if (canShove(a, a.x - ux * push, a.z - uz * push)) { a.x -= ux * push; a.z -= uz * push }
      if (canShove(c, c.x + ux * push, c.z + uz * push)) { c.x += ux * push; c.z += uz * push }
    }
  }
  // boosters wait, then fade; walking over one takes it
  for (const d of s.drops) {
    d.ttl -= dt
    if (d.ttl > 0 && (px - d.x) ** 2 + (pz - d.z) ** 2 <= tune.pickupReach ** 2 && Math.abs(py - d.y) < tune.level) { s.pickups.push(d.kind); d.ttl = 0 }
  }
  s.drops = s.drops.filter(d => d.ttl > 0)
  return out
}

// ── what the keeper does ─────────────────────────────────────────────────────────────────────
/** A round lands. Returns salvage earned and whether it killed. */
export function hitBody(s: HoldState, id: number, dmg: number, crit: boolean, tune: HoldTuning = HOLD_TUNING): { salvage: number; killed: boolean } {
  const b = s.flood.find(f => f.id === id)
  if (!b || !b.alive) return { salvage: 0, killed: false }
  b.hp -= dmg
  let salvage = tune.salvageHit
  let killed = false
  if (b.hp <= 0) {
    b.alive = false; killed = true
    s.kills++
    salvage += crit ? tune.salvageCritKill : tune.salvageKill
    s.surge = Math.min(1, s.surge + 1 / tune.surgeKills)
    if (s.dropsThisRound < tune.dropCap && s.rng() < tune.dropChance) {
      // a body killed in the yard (shot through a window) leaves its booster just inside that
      // window — a drop the keeper cannot reach is a drop that taunts
      const w = s.map.windows[b.win]
      const at = b.phase === 'inside' ? { x: b.x, z: b.z, y: b.y } : { ...w.inside, y: w.h }
      s.drops.push({ id: s.nextId++, kind: 'glimmer', x: at.x, z: at.z, y: at.y, ttl: tune.dropTtl })
      s.dropsThisRound++
    }
  }
  s.salvage += salvage
  return { salvage, killed }
}

/**
 * A field ticks over the landing. It strikes the `fieldFullTargets` bodies nearest its centre and no
 * more: area damage scales with how many stand in it, and the flooded pile up at the windows, so an
 * uncapped field is the one move that lets a single keeper carry a round (power-budget.ts, 09-24).
 * Returns how many it struck.
 */
export function fieldStrike(s: HoldState, x: number, z: number, radius: number, dmg: number, fy: number = heightAt(s, x, z), tune: HoldTuning = HOLD_TUNING): number {
  if (!s.running || dmg <= 0) return 0
  const r2 = radius * radius
  const inside = s.flood
    .filter(b => b.alive && (b.x - x) ** 2 + (b.z - z) ** 2 <= r2 && Math.abs(b.y - fy) < tune.level)
    .sort((a, b) => ((a.x - x) ** 2 + (a.z - z) ** 2) - ((b.x - x) ** 2 + (b.z - z) ** 2))
    .slice(0, tune.fieldFullTargets)
  for (const b of inside) hitBody(s, b.id, dmg, false, tune)
  return inside.length
}

/** G — the surge: everything close takes a blow and is thrown back. Needs a full charge. */
export function releaseSurge(s: HoldState, px: number, pz: number, py: number = heightAt(s, px, pz), tune: HoldTuning = HOLD_TUNING): { hit: number; killed: number } {
  if (s.surge < 1 || !s.running) return { hit: 0, killed: 0 }
  s.surge = 0
  let hit = 0, killed = 0
  for (const b of s.flood) {
    if (!b.alive) continue
    const dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz)
    if (d > tune.surgeRadius || Math.abs(b.y - py) >= tune.level) continue
    hit++
    const dmg = b.kind === 'bulk' ? tune.surgeDamage * 0.5 : tune.surgeDamage
    const r = hitBody(s, b.id, dmg, false, tune)
    if (r.killed) { killed++; continue }
    if (b.phase === 'inside' && d > 0.01) {
      const shove = tune.surgeShove * (1 - d / tune.surgeRadius)
      const nx = b.x + (dx / d) * shove, nz = b.z + (dz / d) * shove
      if (floodStand(s, Math.round(nx), Math.round(nz), b.y)) { b.x = nx; b.z = nz }
    }
  }
  // a surge's kills do not charge the next surge
  s.surge = 0
  return { hit, killed }
}

export type HoldPrompt =
  | { kind: 'mend'; win: number; planks: number }
  | { kind: 'gate'; gate: number; cost: number }
  | { kind: 'rack'; cost: number; bought: boolean }
  | { kind: 'font'; cost: number }
  | { kind: 'cache'; cost: number }

/** Close enough on the ground AND on the same floor — a gate one storey down is not "near". */
const near = (px: number, pz: number, py: number, x: number, z: number, h: number, r: number, tune: HoldTuning) =>
  (px - x) ** 2 + (pz - z) ** 2 <= r * r && Math.abs(py - h) < tune.level

/** What E would do where the keeper stands, if anything. The HUD shows it; E performs it. */
export function promptAt(s: HoldState, px: number, pz: number, py: number = heightAt(s, px, pz), tune: HoldTuning = HOLD_TUNING): HoldPrompt | null {
  if (!s.running) return null
  for (const w of s.map.windows) {
    if (!s.rooms[w.room]) continue
    if (s.planks[w.id] < tune.seals && near(px, pz, py, w.inside.x, w.inside.z, w.h, tune.mendReach, tune)) return { kind: 'mend', win: w.id, planks: s.planks[w.id] }
  }
  for (const g of s.map.gates) {
    if (s.gatesOpen[g.id]) continue
    if (near(px, pz, py, g.mid.x, g.mid.z, g.h, tune.interact, tune)) return { kind: 'gate', gate: g.id, cost: g.cost }
  }
  const { rack, font, cache } = s.map
  if (near(px, pz, py, rack.x, rack.z, rack.h, tune.interact, tune)) return { kind: 'rack', cost: tune.rackCost, bought: s.rackBought }
  if (near(px, pz, py, font.x, font.z, font.h, tune.interact, tune)) return { kind: 'font', cost: tune.fontCost }
  if (s.rooms[cache.room] && near(px, pz, py, cache.x, cache.z, cache.h, tune.interact, tune)) return { kind: 'cache', cost: tune.cacheCost }
  return null
}

/** Spend salvage. False = not enough, and nothing changed. */
function spend(s: HoldState, cost: number): boolean {
  if (s.salvage < cost) return false
  s.salvage -= cost
  return true
}
export function buyGate(s: HoldState, gate: number): boolean {
  const g = s.map.gates[gate]
  if (!g || s.gatesOpen[gate] || !spend(s, g.cost)) return false
  s.gatesOpen[gate] = true
  for (const r of g.opens) s.rooms[r] = true
  s.fieldAt = -1
  return true
}
/** The rack: the first buy is the weapon; after that it refills that weapon's clip at half price. */
export function buyRack(s: HoldState, tune: HoldTuning = HOLD_TUNING): 'weapon' | 'refill' | null {
  const cost = s.rackBought ? Math.round(tune.rackCost / 2) : tune.rackCost
  if (!spend(s, cost)) return null
  const first = !s.rackBought
  s.rackBought = true
  return first ? 'weapon' : 'refill'
}
export const buyFont = (s: HoldState, tune: HoldTuning = HOLD_TUNING) => spend(s, tune.fontCost)
export function buyCache(s: HoldState, tune: HoldTuning = HOLD_TUNING): boolean {
  if (!s.rooms[s.map.cache.room] || !spend(s, tune.cacheCost)) return false
  s.hush += tune.cacheSec
  return true
}
/** Held E at a window: one plank per `mendSec`. Salvage is paid up to the round's cap. */
export function mendTick(s: HoldState, win: number, dt: number, tune: HoldTuning = HOLD_TUNING): boolean {
  if (s.planks[win] === undefined || s.planks[win] >= tune.seals) { s.mendT = 0; return false }
  s.mendT += dt
  if (s.mendT < tune.mendSec) return false
  s.mendT = 0
  s.planks[win]++
  if (s.mendPaidThisRound < tune.mendSalvageCap) {
    const pay = Math.min(tune.salvageMend, tune.mendSalvageCap - s.mendPaidThisRound)
    s.salvage += pay; s.mendPaidThisRound += pay
  }
  return true
}

/** The keeper fell. The run is over; what it reached is the record. */
export function endHold(s: HoldState): { round: number; kills: number } {
  s.running = false
  s.over = true
  return { round: s.round, kills: s.kills }
}

export const fmtHush = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
