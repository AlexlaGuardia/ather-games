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

// ── the landing ─────────────────────────────────────────────────────────────────────────────────
// Legend: '#' wall · '.' floor · ' ' the yard outside (the flood's side) · 'l'/'g'/'c' a window of
// the landing / gallery / cistern · '1'/'2' a gate · '@' where you stand · 'x' the way out ·
// 'R' the wall rack · 'F' the mana font · 'H' the draught cache.
export const HOLD_LANDING: readonly string[] = [
  '################################',
  '#                              #',
  '#                              #',
  '#       ###gg####gg###         #',
  '#       #...........H#         #',
  '#       #............#         #',
  '#       #............#         #',
  '#       g............#         #',
  '#       g............#         #',
  '#       #............#         #',
  '#       #............#         #',
  '#       #............#         #',
  '#       ######11########cc###  #',
  '#       #F...........#......#  #',
  '#       #...........R#......#  #',
  '#       #............#......c  #',
  '#       #............#......c  #',
  '#       l............2......#  #',
  '#       l.....@......2......#  #',
  '#       #............#......c  #',
  '#       #............#......c  #',
  '#       #............#......#  #',
  '#       #x...........#......#  #',
  '#       ###ll####ll##########  #',
  '#                              #',
  '#                              #',
  '################################',
]

export type RoomId = 'landing' | 'gallery' | 'cistern'
const ROOM_OF: Record<string, RoomId> = { l: 'landing', g: 'gallery', c: 'cistern' }

/** Tile ids the grid is painted with — the mortal-side pair every stub map uses, plus WARP. */
export const HOLD_TILE = { FLOOR: 98, WALL: 103, WARP: 14 } as const

export interface Cell { x: number; z: number }
export interface HoldWindow {
  id: number
  room: RoomId
  cells: Cell[]
  /** the floor cell just inside — where a keeper stands to mend it */
  inside: { x: number; z: number }
  /** the yard cell two out — where the flooded gather before they tear */
  spawn: { x: number; z: number }
  /** the window's middle, the point a flooded body walks to */
  mid: { x: number; z: number }
}
export interface HoldGate { id: number; cost: number; cells: Cell[]; opens: RoomId; mid: { x: number; z: number } }
export interface HoldMap {
  cols: number
  rows: number
  grid: number[][]
  windows: HoldWindow[]
  gates: HoldGate[]
  start: Cell
  exit: Cell
  rack: Cell
  font: Cell
  cache: Cell
}

// ── the dials (first guesses; Alex's feel pass) ───────────────────────────────────────────────
export const HOLD_TUNING = {
  seals: 6,              // planks per window
  tearSec: 1.3,          // seconds a flooded body takes to tear one plank
  mendSec: 0.55,         // seconds of holding E per plank mended
  mendReach: 1.9,        // how close to a window's inside cell you must stand to mend it
  gateCost: [750, 1000], // gate 1 (gallery), gate 2 (cistern)
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
} as const
export type HoldTuning = typeof HOLD_TUNING

// ── the tide's bodies ────────────────────────────────────────────────────────────────────────
export type FloodKind = 'drift' | 'swift' | 'bulk'
export interface FloodBody {
  id: number
  kind: FloodKind
  x: number
  z: number
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
export interface HoldDrop { id: number; kind: HoldDropKind; x: number; z: number; ttl: number }

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
const DIRS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const isRoomFloor = (ch: string | undefined) => ch !== undefined && ch !== '#' && ch !== ' ' && !(ch in ROOM_OF) && ch !== '1' && ch !== '2'

export function parseLanding(rows: readonly string[] = HOLD_LANDING, tune: HoldTuning = HOLD_TUNING): HoldMap {
  const rowsN = rows.length, cols = rows[0].length
  const at = (x: number, z: number) => rows[z]?.[x]
  const grid: number[][] = []
  let start: Cell | null = null, exit: Cell | null = null, rack: Cell | null = null, font: Cell | null = null, cache: Cell | null = null
  for (let z = 0; z < rowsN; z++) {
    if (rows[z].length !== cols) throw new Error(`hold: row ${z} is ${rows[z].length} wide, not ${cols}`)
    const row: number[] = []
    for (let x = 0; x < cols; x++) {
      const ch = rows[z][x]
      if (ch === '@') start = { x, z }
      if (ch === 'x') exit = { x, z }
      if (ch === 'R') rack = { x, z }
      if (ch === 'F') font = { x, z }
      if (ch === 'H') cache = { x, z }
      row.push(ch === '#' ? HOLD_TILE.WALL : ch === 'x' ? HOLD_TILE.WARP : HOLD_TILE.FLOOR)
    }
    grid.push(row)
  }
  if (!start || !exit || !rack || !font || !cache) throw new Error('hold: the landing is missing @ x R F or H')

  // group same-char openings into windows / gates (4-connected runs)
  const seen = new Set<string>()
  const windows: HoldWindow[] = [], gates: HoldGate[] = []
  for (let z = 0; z < rowsN; z++) for (let x = 0; x < cols; x++) {
    const ch = at(x, z)!
    const isWin = ch in ROOM_OF, isGate = ch === '1' || ch === '2'
    if ((!isWin && !isGate) || seen.has(`${x},${z}`)) continue
    const cells: Cell[] = [], stack: Cell[] = [{ x, z }]
    seen.add(`${x},${z}`)
    while (stack.length) {
      const c = stack.pop()!
      cells.push(c)
      for (const [dx, dz] of DIRS) {
        const n = { x: c.x + dx, z: c.z + dz }
        if (at(n.x, n.z) === ch && !seen.has(`${n.x},${n.z}`)) { seen.add(`${n.x},${n.z}`); stack.push(n) }
      }
    }
    cells.sort((a, b) => a.z - b.z || a.x - b.x)
    const mx = cells.reduce((s, c) => s + c.x, 0) / cells.length
    const mz = cells.reduce((s, c) => s + c.z, 0) / cells.length
    if (isGate) {
      const n = Number(ch)
      gates.push({ id: gates.length, cost: tune.gateCost[n - 1], cells, opens: n === 1 ? 'gallery' : 'cistern', mid: { x: mx, z: mz } })
      continue
    }
    // which way is the room? the side whose neighbour is room floor. The yard is the other side.
    const c0 = cells[0]
    const dir = DIRS.find(([dx, dz]) => isRoomFloor(at(c0.x + dx, c0.z + dz)))
    if (!dir) throw new Error(`hold: window at ${c0.x},${c0.z} opens on no room`)
    const [dx, dz] = dir
    windows.push({
      id: windows.length, room: ROOM_OF[ch], cells,
      inside: { x: mx + dx, z: mz + dz },
      spawn: { x: mx - dx * 2, z: mz - dz * 2 },
      mid: { x: mx, z: mz },
    })
  }
  gates.sort((a, b) => a.cost - b.cost).forEach((g, i) => { g.id = i })
  return { cols, rows: rowsN, grid, windows, gates, start, exit, rack, font, cache }
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
    rooms: { landing: true, gallery: false, cistern: false },
    salvage: 500, mendPaidThisRound: 0, mendT: 0,
    kills: 0, surge: 0, hush: tune.hushSec, rackBought: false,
    drops: [], dropsThisRound: 0, pickups: [],
    elapsed: 0, nextId: 1, rng: mulberry32(seed),
    field: new Int16Array(map.cols * map.rows).fill(-1), fieldT: 0, fieldAt: -1,
  }
}

export const isLoud = (s: HoldState) => s.hush <= 0

// ── what is solid to whom ─────────────────────────────────────────────────────────────────────
function cellKind(s: HoldState, x: number, z: number): 'wall' | 'window' | 'gate' | 'open' {
  const t = s.map.grid[z]?.[x]
  if (t === undefined || t === HOLD_TILE.WALL) return 'wall'
  for (const w of s.map.windows) if (w.cells.some(c => c.x === x && c.z === z)) return 'window'
  for (const g of s.map.gates) if (g.cells.some(c => c.x === x && c.z === z)) return s.gatesOpen[g.id] ? 'open' : 'gate'
  return 'open'
}
/** A keeper never climbs through a window, and a shut gate is a wall. */
export function keeperBlocked(s: HoldState, x: number, z: number): boolean {
  const k = cellKind(s, Math.round(x), Math.round(z))
  return k === 'window' || k === 'gate'
}
/** Every cell a keeper may not stand in right now, as `x,z` keys — the walker's cheap lookup. */
export function keeperBlockSet(s: HoldState): Set<string> {
  const out = new Set<string>()
  for (const w of s.map.windows) for (const c of w.cells) out.add(`${c.x},${c.z}`)
  for (const g of s.map.gates) if (!s.gatesOpen[g.id]) for (const c of g.cells) out.add(`${c.x},${c.z}`)
  return out
}
/** Rounds stop at a shut gate (it is a wall). Windows let them through — you shoot out of them. */
export function roundBlocked(s: HoldState, x: number, z: number): boolean {
  const k = cellKind(s, Math.round(x), Math.round(z))
  return k === 'wall' || k === 'gate'
}
function floodPassable(s: HoldState, x: number, z: number): boolean {
  const k = cellKind(s, x, z)
  if (k === 'wall' || k === 'gate') return false
  if (k === 'window') {
    const w = s.map.windows.find(w => w.cells.some(c => c.x === x && c.z === z))!
    return s.planks[w.id] <= 0
  }
  return true
}

// ── the flow field: BFS from the keeper, rebuilt when they change cell or every 0.25s ─────────
function buildField(s: HoldState, px: number, pz: number) {
  const { cols, rows } = s.map
  const f = s.field
  f.fill(-1)
  const sx = Math.round(px), sz = Math.round(pz)
  if (sx < 0 || sz < 0 || sx >= cols || sz >= rows) return
  const q = new Int32Array(cols * rows)
  let head = 0, tail = 0
  const si = sz * cols + sx
  f[si] = 0; q[tail++] = si
  while (head < tail) {
    const i = q[head++], x = i % cols, z = (i / cols) | 0
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz
      if (nx < 0 || nz < 0 || nx >= cols || nz >= rows) continue
      const ni = nz * cols + nx
      if (f[ni] !== -1 || !floodPassable(s, nx, nz)) continue
      f[ni] = f[i] + 1; q[tail++] = ni
    }
  }
  s.fieldAt = si
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

export function stepHold(s: HoldState, dt: number, px: number, pz: number, tune: HoldTuning = HOLD_TUNING): HoldStepOut {
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
      id: s.nextId++, kind, x: w.spawn.x + (s.rng() - 0.5) * 0.8, z: w.spawn.z + (s.rng() - 0.5) * 0.8,
      hp: st.hp, maxHp: st.hp, speed: st.speed, phase: 'approach', win: w.id, tearT: 0, strikeT: 0.6, alive: true,
    })
    if (s.toSpawn > 0) s.toSpawn--
    s.spawnT = loud ? 0.3 : spawnEvery(s.round)
  }

  // the field
  const pi = Math.round(pz) * s.map.cols + Math.round(px)
  s.fieldT -= dt
  if (pi !== s.fieldAt || s.fieldT <= 0) { buildField(s, px, pz); s.fieldT = 0.25 }

  const cols = s.map.cols
  for (const b of s.flood) {
    if (!b.alive) continue
    b.strikeT = Math.max(0, b.strikeT - dt)
    const w = s.map.windows[b.win]
    if (b.phase === 'approach') {
      // walk to the window's yard face, then tear
      const tx = w.mid.x + (w.spawn.x - w.mid.x) * 0.5, tz = w.mid.z + (w.spawn.z - w.mid.z) * 0.5
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz)
      if (d < 0.15) b.phase = s.planks[w.id] > 0 ? 'tear' : 'inside'
      else { const k = Math.min(1, (b.speed * dt) / d); b.x += dx * k; b.z += dz * k }
      continue
    }
    if (b.phase === 'tear') {
      if (s.planks[w.id] <= 0) { b.phase = 'inside'; continue }
      b.tearT += dt * (b.kind === 'bulk' ? 2 : 1)
      if (b.tearT >= tune.tearSec) { b.tearT = 0; s.planks[w.id]-- }
      continue
    }
    // inside: down the field toward the keeper
    const dpx = px - b.x, dpz = pz - b.z, dp = Math.hypot(dpx, dpz)
    if (dp < tune.reach) {
      if (b.strikeT <= 0) { out.strike += tune.strikeDmg * (b.kind === 'bulk' ? 1.5 : 1); b.strikeT = tune.strikeCd }
      continue
    }
    const cx = Math.round(b.x), cz = Math.round(b.z)
    let best = s.field[cz * cols + cx], bx = px, bz = pz
    if (best > 1) {
      for (const [ox, oz] of DIRS) {
        const v = s.field[(cz + oz) * cols + (cx + ox)]
        if (v >= 0 && v < best) { best = v; bx = cx + ox; bz = cz + oz }
      }
    }
    // a body cut off by a shut gate (field -1) heads for the keeper anyway and is stopped by the wall
    const mx = bx - b.x, mz = bz - b.z, md = Math.hypot(mx, mz) || 1
    const step = Math.min(md, b.speed * dt)
    const nx = b.x + (mx / md) * step, nz = b.z + (mz / md) * step
    if (floodPassable(s, Math.round(nx), Math.round(b.z))) b.x = nx
    if (floodPassable(s, Math.round(b.x), Math.round(nz))) b.z = nz
  }
  // bodies do not stack into one: a soft shove apart
  const live = s.flood.filter(b => b.alive && b.phase === 'inside')
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j], dx = c.x - a.x, dz = c.z - a.z, d2 = dx * dx + dz * dz
    if (d2 > 0.0001 && d2 < 0.49) {
      const d = Math.sqrt(d2), push = (0.7 - d) * 0.5, ux = dx / d, uz = dz / d
      if (floodPassable(s, Math.round(a.x - ux * push), Math.round(a.z - uz * push))) { a.x -= ux * push; a.z -= uz * push }
      if (floodPassable(s, Math.round(c.x + ux * push), Math.round(c.z + uz * push))) { c.x += ux * push; c.z += uz * push }
    }
  }
  // boosters wait, then fade; walking over one takes it
  for (const d of s.drops) {
    d.ttl -= dt
    if (d.ttl > 0 && (px - d.x) ** 2 + (pz - d.z) ** 2 <= tune.pickupReach ** 2) { s.pickups.push(d.kind); d.ttl = 0 }
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
      const at = b.phase === 'inside' ? { x: b.x, z: b.z } : w.inside
      s.drops.push({ id: s.nextId++, kind: 'glimmer', x: at.x, z: at.z, ttl: tune.dropTtl })
      s.dropsThisRound++
    }
  }
  s.salvage += salvage
  return { salvage, killed }
}

/** G — the surge: everything close takes a blow and is thrown back. Needs a full charge. */
export function releaseSurge(s: HoldState, px: number, pz: number, tune: HoldTuning = HOLD_TUNING): { hit: number; killed: number } {
  if (s.surge < 1 || !s.running) return { hit: 0, killed: 0 }
  s.surge = 0
  let hit = 0, killed = 0
  for (const b of s.flood) {
    if (!b.alive) continue
    const dx = b.x - px, dz = b.z - pz, d = Math.hypot(dx, dz)
    if (d > tune.surgeRadius) continue
    hit++
    const dmg = b.kind === 'bulk' ? tune.surgeDamage * 0.5 : tune.surgeDamage
    const r = hitBody(s, b.id, dmg, false, tune)
    if (r.killed) { killed++; continue }
    if (b.phase === 'inside' && d > 0.01) {
      const shove = tune.surgeShove * (1 - d / tune.surgeRadius)
      const nx = b.x + (dx / d) * shove, nz = b.z + (dz / d) * shove
      if (floodPassable(s, Math.round(nx), Math.round(nz))) { b.x = nx; b.z = nz }
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

const near = (px: number, pz: number, x: number, z: number, r: number) => (px - x) ** 2 + (pz - z) ** 2 <= r * r

/** What E would do where the keeper stands, if anything. The HUD shows it; E performs it. */
export function promptAt(s: HoldState, px: number, pz: number, tune: HoldTuning = HOLD_TUNING): HoldPrompt | null {
  if (!s.running) return null
  for (const w of s.map.windows) {
    if (!s.rooms[w.room]) continue
    if (s.planks[w.id] < tune.seals && near(px, pz, w.inside.x, w.inside.z, tune.mendReach)) return { kind: 'mend', win: w.id, planks: s.planks[w.id] }
  }
  for (const g of s.map.gates) {
    if (s.gatesOpen[g.id]) continue
    if (near(px, pz, g.mid.x, g.mid.z, tune.interact)) return { kind: 'gate', gate: g.id, cost: g.cost }
  }
  const { rack, font, cache } = s.map
  if (near(px, pz, rack.x, rack.z, tune.interact)) return { kind: 'rack', cost: tune.rackCost, bought: s.rackBought }
  if (near(px, pz, font.x, font.z, tune.interact)) return { kind: 'font', cost: tune.fontCost }
  if (s.rooms.gallery && near(px, pz, cache.x, cache.z, tune.interact)) return { kind: 'cache', cost: tune.cacheCost }
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
  s.rooms[g.opens] = true
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
  if (!s.rooms.gallery || !spend(s, tune.cacheCost)) return false
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
