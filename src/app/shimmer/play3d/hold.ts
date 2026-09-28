// hold.ts — THE BREACH (build name: the hold): a season world's round survival, the first playable slice.
//
// ★ NAMES RULED 2026-09-26 (`game/two-lines-two-games.md` › ON A LIVE WORLD): the building is THE BREACH
// ("the Hold" retired: *hold* is canon's settlement word); the thing through the wall is THE TAP (the host's
// instrument drinking the core; shown, never the host); the device is THE TUNER; a gun is TUNED, then
// RE-KEYED, never "evolved"; loot is CACHES, never chests. Player text follows those words. Code identifiers
// (`hold`, `chest`, `device`, `zero`) are build words and stay, so saves and the zone id never move.
//
// ★ PURE. No react, no three, no DOM. The host (`FiringRange` in Shimmer3D) owns bodies, rounds in
// flight and the keeper's hp; this module owns the landing, the tide's rounds, the seals, the gates,
// salvage, the surge and the hush. Same split as `puppet-guards.ts`, so the whole run is provable
// headless and a tuning change is judged against numbers, not against a feeling at 2am.
//
// ── WHAT IT IS (GBOARD 🌊 SEASON EXPEDITIONS, Alex 2026-09-24) ─────────────────────────────────
// The CoD-Zombies loop in our clothes: rounds that escalate, seals on the windows the flooded tear
// down, salvage for every hit, gates you buy open to reach more of the map, a weapon on the wall,
// gear that CHARGES as you crush the flooded, and a clock that is the Lull Draught running out.
//
// ── ★ ALL POWER IS IN-RUN (the rule that keeps the colossus fair) ─────────────────────────────
// Nothing here reads a save. A new keeper and a veteran walk into the same landing with the same
// sidearm and the same hush. Whatever you buy is gone when the run ends. That is what lets a
// skilled newcomer beat a boss later without a level gate lying about it.
//
// ── CANON ──────────────────────────────────────────────────────────────────────────────────────
// `two-lines-two-games.md` › THE SIGNAL / THE HUSH DRAUGHT (renamed the LULL DRAUGHT 09-27: the lull is the stretch
// before the host notices you; code keeps the `hush` field): the draught hushes the drinker so the
// host does not hear them as *near*, and it RUNS OUT. So running out is not a timer ending, it is the
// keeper going LOUD: the tide stops coming and starts RUSHING. The flood is the host's raised body
// (`world/nolmir.md` › THE FLOOD) — shown, fought. What made the host stays unnamed (guardrail 1):
// no string in this file names a cause. "The hold", "seal", "surge", "salvage" are build words.
// ⚠ The landing is a BLOCKOUT for feel. Which world, whose host, what the rooms are = per-season.

import { HOLD_FLOORS, GARDEN_W, type FloorDef } from './hold-floors'
import { buildHold, surfacesAt, solidAt, slabAt, flatViews, kindAt, levelOfY, DIRS, K, STOREY, type Building, type Kind, type Surface } from './hold-building'

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
/** A floor grate the flooded crawl up through ('=' in the plans). No seals: it cannot be mended shut. */
export interface HoldVent { id: number; room: RoomId; lv: number; x: number; z: number; h: number }
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
  /** per node (floor × cell): the index into `rooms` of the region there, or -1 (a wall, gate, window…) */
  regionOf: Int32Array
  /** per node (floor × cell): the gate / window id there, or -1 */
  gateOf: Int16Array
  winOf: Int16Array
  start: HoldFixture
  exit: HoldFixture
  rack: HoldFixture
  font: HoldFixture
  cache: HoldFixture
  /** ground zero: where the device is planted (`Z`) */
  zero: HoldFixture
  /** every '$' in the plans: where a chest may appear */
  chestSpots: HoldFixture[]
  /** every '=' in the plans: a vent the flooded crawl up through */
  vents: HoldVent[]
}

// ── the dials (first guesses; Alex's feel pass) ───────────────────────────────────────────────
export const HOLD_TUNING = {
  seals: 6,              // planks per window
  tearSec: 1.3,          // seconds a flooded body takes to tear one plank
  mendSec: 0.55,         // seconds of holding E per plank mended
  mendReach: 1.9,        // how close to a window's inside cell you must stand to mend it
  gateCost: { A: 250, N: 750, E: 750, M: 1000, G: 1000, B: 1250, C: 1000, D: 1000, K: 1500 } as Record<string, number>, // A (the roof deck → the north roof + the way down — cheap: room to train is the first buy), N (the roof's plant yard, where the rack hangs), E (the office's cubicle farm), M (its meeting rooms + break room, the draught cache), G (its executive wing + the stair down to the elevator lobby), B (the lobby's grand hall), C/D (the gardens, off the hall), K (the café)
  gateCostDefault: 750,  // a gate letter with no price of its own
  rackCost: 500,         // the SPITTER off the wall
  rackWeapon: 'spitter',
  fontCost: 250,         // a full mana pool — mana is the clip, so this IS the ammo buy
  cacheCost: 400,        // +cacheSec of hush — only while draughtSold
  cacheSec: 60,
  // THE RUN CLOCK (Alex 09-27): the draught you walk in with is the whole run — 7:30 to reach as many rounds as you
  // can, then it runs out and they rush (canon: "the draught's duration is the mission's clock"). The in-run draught
  // cache is retired: topping up turned the clock into a 5-6k salvage tax (scripts/breach-pace.mts). Its spot, the
  // meeting rooms behind M, becomes the lab where flood samples buy more clock at a price (next).
  hushSec: 450,
  draughtSold: false,
  // THE LAB (Alex 09-27; canon two-lines-two-games.md › THE LAB, WRACK, AND STUDYING THE PITCH): a fallen special
  // leaves WRACK (in-run only); the bench in the meeting rooms (behind M, the old cache spot) spends it on LAB_NODES
  wrackChance: { drift: 0, swift: 0.5, bulk: 0.6 } as Record<string, number>,
  wrackTtl: 20,          // seconds wrack lies on the floor before it scatters
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
  // chests (Alex 09-26): every chestEvery-th round, each EMPTY spot rolls chestChance; an occupied spot never rolls
  chestEvery: 5,
  // the glove's stones (09-28): the first cache wave at or past this round holds them. 10 = the second wave,
  // after the tuner is usually planted (~r7, breach-pace) — a real hold, not a walk-in
  gloveRound: 10,
  chestChance: 0.25,
  chestOpenSec: 2,       // seconds of holding E — a real risk mid-round
  chestRarity: { common: 70, rare: 25, legendary: 5 },
  // bad-luck protection (Alex 09-27): this many rounds without a vessel piece and the next cache that appears is
  // legendary. Counted across runs (the page carries `dryRounds` in and out, `vessel-pieces.ts`), so an unlucky
  // keeper waits ≤ ~30 rounds a piece where pure chance left one in ten at 145+ rounds for three
  pityRounds: 30,
  // the device (Alex 09-26, our pack-a-punch): planted once at ground zero, then each weapon is tuned a tier at a time
  devicePlant: 2000,
  tuneCost: [5000, 7500],   // to tier 1, to tier 2
  // vents (Alex 09-26): the rooms grew and the walls got far away, so some of the tide comes up through the floor
  ventShare: 0.35,       // of the spawns, when an active room has a vent far enough away
  ventMinSteps: 12,      // a vent never opens closer than this (walking steps) to the keeper — you get to see it coming
  riseSec: 1.4,
  // the chase (Alex 09-27): smooth, eight-way, and a mob rather than a pile
  turnRate: 7,           // how fast a body's velocity eases toward its wish (1/s) — higher is snappier
  chaseSight: 14,        // within this many tiles on open floor with a clear line, a body runs straight at you
  bodyGap: 0.05,         // spacing between two bodies' edges
  aimSec: 0.2,           // how often a body re-picks where it is heading (also what keeps the chase cheap)
  lookahead: 24,         // how many cells down the field it looks for the farthest one in a clear line          // a body heaves up out of the grate this long before it can move or strike (shootable the whole time)
} as const
export type HoldTuning = typeof HOLD_TUNING

// ── ★ PARTY LOOT IS PERSONAL (Alex 09-27, locked ahead of co-op) ─────────────────────────────────
// Co-op Breach is not built (the party is presence-only; this sim runs per client). When it lands: a cache
// opened gives every keeper in the party their OWN roll; salvage, Marks and vessel pieces are per keeper; the
// pity counter (`dryRounds`) stays per keeper. Write new systems party-ready, solo-wired. GBOARD › the Breach.

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
  /** yard → at the window tearing → through and hunting · or up out of a vent (`rise`) → hunting */
  phase: 'approach' | 'tear' | 'rise' | 'inside'
  /** the window it came at, or -1 */
  win: number
  /** the vent it came up, or -1 */
  vent: number
  tearT: number
  strikeT: number
  alive: boolean
  /** velocity (tiles/s) — steered toward where it wants to go, never snapped (the chase) */
  vx: number
  vz: number
  /** where it is heading (a point down the field it can see, re-picked every `aimSec`) — the chase's own memory */
  aimX?: number
  aimZ?: number
  aimT?: number
  aimKeeper?: boolean
}
/** How big each kind is drawn (the renderer's scale × its 0.45 sphere) — the spacing reads the same numbers. */
export const BODY_SIZE: Record<FloodKind, number> = { drift: 1, swift: 0.8, bulk: 1.35 }
export const BODY_RADIUS: Record<FloodKind, number> = { drift: 0.45 * BODY_SIZE.drift, swift: 0.45 * BODY_SIZE.swift, bulk: 0.45 * BODY_SIZE.bulk }

// ── boosters: what the flooded sometimes leave behind ──────────────────────────────────────────
// Zombies' power-ups in our clothes. One so far: LAST LIGHT (Alex named it the Glimmer of Hope 09-24, renamed 09-26 —
// *glimmer* is the Cave Glimmer spirit's word, Magii's register note). The id stays 'glimmer' (a build word).
// refreshes the team's mana — solo today, so the keeper's. The union is the roster; a new booster is
// a new kind here and a new case where the host applies it.
export type HoldDropKind = 'glimmer' | 'wrack'
export const DROP_NAME: Record<HoldDropKind, string> = { glimmer: 'Last Light', wrack: 'Wrack' }

// ── the lab: wrack studied at the world's own bench ─────────────────────────────────────────────
// Canon (09-27): studying teaches the host's PITCH, so the lull sits deeper and lasts longer — and the study is
// LOUD, so every boon is paid in a harder flood. Nodes, costs and which harder bodies = Jin's. v1 banes only
// strengthen the kinds the build has (new specials are named with a season's host).
export type LabNodeId = 'lull1' | 'mend' | 'lull2' | 'pitch' | 'road'
export interface LabNode { id: LabNodeId; name: string; cost: number; needs?: LabNodeId; boon: string; bane: string }
export const LAB_NODES: readonly LabNode[] = [
  { id: 'lull1', name: 'A Deeper Lull', cost: 3, boon: '+75s of lull', bane: 'more of them come swift' },
  { id: 'mend', name: 'The Seal Notes', cost: 3, boon: 'mend seals twice as fast', bane: 'a bulk every fourth body, from round 3' },
  { id: 'lull2', name: 'Deeper Still', cost: 6, needs: 'lull1', boon: '+75s of lull', bane: 'every body moves faster' },
  { id: 'pitch', name: 'The Pitch', cost: 5, boon: 'mana drips twice as fast', bane: 'four more of them on the floor at once' },
  // THE CAPSTONE (Alex 09-27; canon: the Lenn's notes show where and when the Stillwind walks, never what, and
  // the keeper carries that out for good — access, never power). Studied once in any run; after that it is KNOWN
  // (the page seeds `roadKnown`) and the bench shows it read. Loud like every study: the rest of that run is heavier.
  { id: 'road', name: "The Stillwind's Road", cost: 8, needs: 'lull2', boon: 'where and when the Stillwind walks (kept)', bane: 'every body is sturdier for the rest of the run' },
]
export const LAB_ROAD_HP = 1.15
export const LAB_LULL_SEC = 75
export const LAB_SWIFT_ADD = 0.12
export const LAB_SPEED_ADD = 0.4
export const LAB_ALIVE_ADD = 4
export const studied = (s: HoldState, id: LabNodeId): boolean => s.studied.includes(id)
/** Why a node cannot be studied now, or null if it can. */
export function labBlock(s: HoldState, id: LabNodeId): 'studied' | 'known' | 'needs' | 'wrack' | null {
  const n = LAB_NODES.find(x => x.id === id)!
  if (studied(s, id)) return 'studied'
  if (id === 'road' && s.roadKnown) return 'known'
  if (n.needs && !studied(s, n.needs)) return 'needs'
  if (s.wrack < n.cost) return 'wrack'
  return null
}
/** Study a node at the bench. False = not here, or blocked (see labBlock), and nothing changed. */
export function studyNode(s: HoldState, id: LabNodeId): boolean {
  if (!s.rooms[s.map.cache.room] || labBlock(s, id) !== null) return false
  const n = LAB_NODES.find(x => x.id === id)!
  s.wrack -= n.cost
  s.studied.push(id)
  if (id === 'lull1' || id === 'lull2') s.hush += LAB_LULL_SEC
  if (id === 'road') s.roadKnown = true
  return true
}
/** The mana drip in this run (the page reads it — it owns the mana). */
export const holdManaDrip = (s: HoldState | null | undefined, tune: HoldTuning = HOLD_TUNING): number =>
  tune.manaDrip * (s && studied(s, 'pitch') ? 2 : 1)
/** Which kind the n-th body of round r is, after what the keeper's study has made the host send. */
export function kindForRun(s: HoldState, r: number, n: number): FloodKind {
  if (studied(s, 'mend') && r >= 3 && n % 4 === 3) return 'bulk'
  const k = kindFor(r, n)
  if (k === 'drift' && studied(s, 'lull1') && ((n * 0.618034 + 0.5) % 1) < LAB_SWIFT_ADD) return 'swift'
  return k
}
export interface HoldDrop { id: number; kind: HoldDropKind; x: number; z: number; y: number; ttl: number }

// ── chests: rare finds on marked spots, rarity tilts what is inside ─────────────────────────────
// Alex 09-26. What a chest holds lives HERE; the page applies what the sim cannot (Marks are the real
// wallet, `lib/wallet`). No cap on Marks, and a duplicate vessel part is kept, for trading (Alex).
export type ChestRarity = 'common' | 'rare' | 'legendary'
export type HoldLoot =
  | { kind: 'salvage'; n: number }
  | { kind: 'glimmer' }
  | { kind: 'marks'; n: number }
  | { kind: 'part' }
  | { kind: 'stones' }
/** `stones`: this cache holds Greg's glove stones (the glove's road, RULED 09-28) — whatever its rarity says */
export interface HoldChest { rarity: ChestRarity; openT: number; stones?: boolean }
/**
 * RULED LAWFUL 09-26 (ON A LIVE WORLD › CACHES): a cache may hold this season's vessel, whole or as pieces a
 * keeper carries home to the Passage's CUTTER, who finishes it (a keeper never assembles one). WIRED 09-27:
 * the page carries a piece into `vessel-pieces.ts`, and the cutter's shelf joins three into a vessel.
 */
export const VESSEL_PIECES_WIRED = true
export const CHEST_LOOT: Record<ChestRarity, { loot: HoldLoot; w: number }[]> = {
  common: [{ loot: { kind: 'salvage', n: 400 }, w: 60 }, { loot: { kind: 'glimmer' }, w: 40 }],
  rare: [{ loot: { kind: 'marks', n: 30 }, w: 60 }, { loot: { kind: 'salvage', n: 1500 }, w: 40 }],   // a bag of Marks ≈ 30 (Alex)
  legendary: [{ loot: { kind: 'part' }, w: 100 }],
}
/** the pickup line for the glove's stones — locked `breach:glove-stones` (shimmer-quest-glove-errand.md, 35e5821) */
export const GLOVE_STONES_LINE = 'What the glove is missing. For the Temple.'
export const lootLabel = (l: HoldLoot): string =>
  l.kind === 'salvage' ? `+${l.n} salvage` : l.kind === 'marks' ? `A bag of Marks (+${l.n})` : l.kind === 'glimmer' ? DROP_NAME.glimmer : l.kind === 'stones' ? GLOVE_STONES_LINE : 'A vessel piece'

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
  /** the room the keeper last stood in — spawns come from here and the open rooms next to it */
  here: RoomId
  /** set when the keeper falls into a shut room (a broken floor); the page reads it once and clears it */
  fell: RoomId | null
  salvage: number
  mendPaidThisRound: number
  mendT: number
  kills: number
  surge: number           // 0..1
  hush: number            // seconds left; 0 = LOUD
  rackBought: boolean
  drops: HoldDrop[]
  dropsThisRound: number
  /** per chest spot: the chest standing there, or null */
  chests: (HoldChest | null)[]
  /** rounds since this keeper's last vessel piece — ACROSS runs: the page seeds it and saves it (the pity counter) */
  dryRounds: number
  /** does the live Breach owe this keeper Greg's glove stones? The page seeds it (`breachOwesGloveStones`) */
  gloveOwed: boolean
  /** what opened chests gave that the page must apply (Marks, parts, the glove's stones) */
  loot: HoldLoot[]
  /** the device is planted at ground zero */
  devicePlanted: boolean
  /** each weapon's tier this run (weapon id → 0..2) */
  tuned: Record<string, number>
  /** wrack carried (in-run only) and the lab nodes studied this run */
  wrack: number
  studied: LabNodeId[]
  /** the keeper already read the Stillwind's road (any earlier run) — the page seeds it and saves it (`stillwind-road.ts`) */
  roadKnown: boolean
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
      if (!'@XRFHZ'.includes(ch) || ch === ' ') continue
      if (fx[ch]) throw new Error(`hold: two '${ch}' in the plans`)
      fx[ch] = { x: i % cols, z: (i / cols) | 0, lv }
    }
  })
  for (const k of '@XRFHZ') if (!fx[k]) throw new Error(`hold: the plans are missing '${k}'`)

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
  const chestSpots: HoldFixture[] = []
  b.levels.forEach((L, lv) => {
    for (let i = 0; i < per; i++) if (L.ch[i] === '$') {
      const x = i % cols, z = (i / cols) | 0
      chestSpots.push({ x, z, lv, h: L.y, room: roomAt(lv, x, z)! })
    }
  })
  const vents: HoldVent[] = []
  b.levels.forEach((L, lv) => {
    for (let i = 0; i < per; i++) if (L.ch[i] === '=') {
      const x = i % cols, z = (i / cols) | 0
      vents.push({ id: vents.length, x, z, lv, h: L.y, room: roomAt(lv, x, z)! })
    }
  })
  return {
    cols, rows, building: b, grid, heights, windows, gates, rooms, regionOf: region, gateOf, winOf,
    start: fixture('@'), exit: fixture('X'), rack: fixture('R'), font: fixture('F'), cache: fixture('H'), zero: fixture('Z'), chestSpots, vents,
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
  // retune 09-26 for the 100 × 120 floors (was 1.6 + 0.08r ≤ 3.2 · swift 4.2 · bulk 1.3). The keeper runs 6.5:
  // everything is still outrun, but a walk across a big room no longer takes most of a minute.
  const drift = Math.min(3.6, 2.2 + 0.08 * r)
  if (kind === 'swift') return { hp: Math.round(hp * 0.7), speed: 4.8 }
  if (kind === 'bulk') return { hp: Math.round(hp * 2.5), speed: 1.6 }
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
  fieldGraph(map)   // the flooded's path graph, once per map: paid at the start press, never mid-chase
  return {
    map, running: true, over: false,
    round: 1, toSpawn: roundCount(1), spawnT: 1.5, breakT: 0,
    flood: [],
    planks: map.windows.map(() => tune.seals),
    gatesOpen: map.gates.map(() => false),
    rooms: Object.fromEntries(map.rooms.map(r => [r, r === map.start.room])),
    here: map.start.room, fell: null,
    salvage: 500, mendPaidThisRound: 0, mendT: 0,
    kills: 0, surge: 0, hush: tune.hushSec, rackBought: false,
    drops: [], dropsThisRound: 0, pickups: [], wrack: 0, studied: [], roadKnown: false,
    chests: map.chestSpots.map(() => null), dryRounds: 0, gloveOwed: false, loot: [], devicePlanted: false, tuned: {},
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
export function holdSurfaces(m: HoldMap, x: number, z: number): readonly { y: number }[] {
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
    if (Math.abs(su.y - y) > 1.01 || !floodMay(s, su, x, z)) continue
    if (!best || su.y > best.y) best = su
  }
  return best
}
/** A gate must be open and a window's seals gone for a flooded body to stand in it. */
function floodMay(s: HoldState, su: Surface, x: number, z: number): boolean {
  const n = nodeIdx(s.map, su.lv, x, z)
  if (su.kind === K.GATE && !s.gatesOpen[s.map.gateOf[n]]) return false
  if (su.kind === K.WINDOW && s.planks[s.map.winOf[n]] > 0) return false
  return true
}
/** The highest floor under a body in its own cell (it is already falling). */
function fallTo(s: HoldState, x: number, z: number, y: number): Surface | null {
  let best: Surface | null = null
  for (const su of surfacesAt(s.map.building, x, z)) if (su.y < y && floodMay(s, su, x, z) && (!best || su.y > best.y)) best = su
  return best
}
/**
 * Where a flooded body at height `y` ends up moving into a cell: a step (`floodStand`), or — where its
 * own floor is BROKEN there (open air at its level, a floor below) — a DROP onto the highest floor
 * under it. Never up: nobody climbs a broken floor (Alex 09-26: "have to work their way back").
 * Open air only: a wall at your level is not a hole, so nothing drops through a wall or off a stair.
 */
function floodMove(s: HoldState, x: number, z: number, y: number): Surface | null {
  const step = floodStand(s, x, z, y)
  if (step) return step
  const b = s.map.building, lv = levelOfY(b, y)
  if (lv < 0 || kindAt(b, lv, x, z) !== K.VOID) return null
  let best: Surface | null = null
  // a broken floor INSIDE the building only: the floor it lands on is the storey straight below and not garden
  // ground — so a body out of a torn window never leaps a storey (or two) into a garden
  for (const su of surfacesAt(b, x, z)) {
    if (su.lv !== lv - 1 || su.y >= y - 1.01 || (su.kind !== K.FLOOR && su.kind !== K.LANDING)) continue
    if (b.levels[su.lv].tone[z * b.cols + x] === 1 || !floodMay(s, su, x, z)) continue
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
const DIRS8: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
/** Open, flat floor at height `y` all the way from (x0, z0) to (x1, z1)? Sampled every 0.35 of a tile. */
function clearLine(s: HoldState, x0: number, z0: number, x1: number, z1: number, y: number): boolean {
  const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / 0.35)
  for (let k = 1; k <= n; k++) {
    const t = k / n, su = floodStand(s, Math.round(x0 + (x1 - x0) * t), Math.round(z0 + (z1 - z0) * t), y)
    if (!su || Math.abs(su.y - y) > 0.5) return false
  }
  return true
}
/** Greedy walk down the field from (x, z): up to `n` cells, eight-way, no corner cutting. Cell 0 is the first step. */
function fieldAhead(s: HoldState, x: number, z: number, y: number, n: number): { x: number; z: number; y: number }[] {
  const out: { x: number; z: number; y: number }[] = []
  let here = floodMove(s, x, z, y)
  if (!here) return out
  let v = s.field[nodeIdx(s.map, here.lv, x, z)], hy = here.y
  for (let k = 0; k < n && v > 0; k++) {
    let bx = -1, bz = -1, bv = v, bs: Surface | null = null
    for (const [ox, oz] of DIRS8) {
      if (ox && oz && (!floodMove(s, x + ox, z, hy) || !floodMove(s, x, z + oz, hy))) continue
      const su = floodMove(s, x + ox, z + oz, hy)
      if (!su) continue
      const w = s.field[nodeIdx(s.map, su.lv, x + ox, z + oz)]
      if (w >= 0 && w < bv) { bv = w; bx = x + ox; bz = z + oz; bs = su }
    }
    if (!bs) break
    x = bx; z = bz; v = bv; hy = bs.y
    out.push({ x, z, y: hy })
  }
  return out
}
/** The field as it was first written — a plain BFS asking floodStand / floodMove at every step. KEPT AS THE
 *  REFERENCE: hold.test.ts proves `buildField` (below, precomputed) fills the identical field. Not called in play. */
export function buildFieldSlow(s: HoldState, start: number) {
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
      if (su) {
        const nn = nodeIdx(s.map, su.lv, x + dx, z + dz)
        if (f[nn] === -1) { f[nn] = f[n] + 1; q[tail++] = nn }
      }
      // a DROP is one-way, so the field (built from the keeper outward) walks it backwards: a body up
      // on the neighbour cell that would fall into this one is one step further than this cell
      for (const up of surfacesAt(b, x + dx, z + dz)) {
        if (up.y <= y + 1.01 || !floodMay(s, up, x + dx, z + dz)) continue
        const lands = floodMove(s, x, z, up.y)
        if (!lands || lands.lv !== lv) continue
        const nn = nodeIdx(s.map, up.lv, x + dx, z + dz)
        if (f[nn] === -1) { f[nn] = f[n] + 1; q[tail++] = nn }
      }
    }
  }
}

// ── the field, fast (Alex 09-28: lag with five chasers) ─────────────────────────────────────────
// The slow BFS cost ~30-45ms a rebuild on the server (worse on a desktop), up to ten rebuilds a second while the
// keeper moves: for every neighbour of every one of ~36k cells it asked floodStand, and walked every storey ABOVE
// the neighbour through floodMove only to find it lands on the wrong floor. The plan never changes; only gates and
// seals do. So the graph is built ONCE per map, each edge carrying the gate/window it depends on, and the BFS reads
// flags. Same answer as buildFieldSlow, cell for cell (hold.test.ts compares them on random gate/seal states).
// cond: -1 = always passable · >= 0 = gate id (open?) · <= -2 = window -2-cond (seals gone?) · BLOCKED = never
const BLOCKED = -1 << 30
interface FieldGraph {
  off: Int32Array      // per node: its edges are [off[n], off[n+1])
  kind: Uint8Array     // 0 step, 1 drop
  // step: candidates [cA, cB) in cNode/cCond, first passing one is the target
  // drop: target tNode if tCond passes AND the first passing of stand [cA, cB) — else fall [fA, fB) — is on n's floor
  cA: Int32Array; cB: Int32Array; fA: Int32Array; fB: Int32Array; tNode: Int32Array; tCond: Int32Array
  cNode: Int32Array; cCond: Int32Array; cLv: Int8Array
}
const FIELD_GRAPH = new WeakMap<HoldMap, FieldGraph>()
function condOf(m: HoldMap, su: Surface, x: number, z: number): number {
  const n = nodeIdx(m, su.lv, x, z)
  if (su.kind === K.GATE) { const g = m.gateOf[n]; return g >= 0 ? g : BLOCKED }
  if (su.kind === K.WINDOW) { const w = m.winOf[n]; return w >= 0 ? -2 - w : -1 }
  return -1
}
const passes = (s: HoldState, c: number): boolean =>
  c === -1 ? true : c === BLOCKED ? false : c >= 0 ? !!s.gatesOpen[c] : !(s.planks[-2 - c] > 0)
function fieldGraph(m: HoldMap): FieldGraph {
  const hit = FIELD_GRAPH.get(m)
  if (hit) return hit
  const { cols, rows, building: b } = m
  const per = cols * rows, total = per * b.levels.length
  const off = new Int32Array(total + 1)
  const E = { kind: [] as number[], cA: [] as number[], cB: [] as number[], fA: [] as number[], fB: [] as number[], tNode: [] as number[], tCond: [] as number[] }
  const C = { node: [] as number[], cond: [] as number[], lv: [] as number[] }
  // scratch lists, filled then put in floodStand's pick order: highest first, ties keep the lower storey (its strict `>`)
  const A: Surface[] = [], F: Surface[] = []
  const pickSort = (L: Surface[], n: number) => {
    for (let i = 1; i < n; i++) { const v = L[i]; let j = i - 1; while (j >= 0 && L[j].y < v.y) { L[j + 1] = L[j]; j-- } L[j + 1] = v }
  }
  const push = (L: Surface[], n: number, x: number, z: number): number => {
    for (let i = 0; i < n; i++) { const su = L[i]; C.node.push(nodeIdx(m, su.lv, x, z)); C.cond.push(condOf(m, su, x, z)); C.lv.push(su.lv) }
    return C.node.length
  }
  // can the first passing candidate of [a,b) (then of [fa,fb)) land on floor lv, under ANY gate/seal state?
  const mayLand = (a: number, bb: number, fa: number, fb: number, lv: number): boolean => {
    for (let i = a; i < bb; i++) { if (C.lv[i] === lv) return true; if (C.cond[i] === -1) return false }
    for (let i = fa; i < fb; i++) { if (C.lv[i] === lv) return true; if (C.cond[i] === -1) return false }
    return false
  }
  for (let n = 0; n < total; n++) {
    off[n] = E.kind.length
    const lv = (n / per) | 0, c = n % per, x = c % cols, z = (c / cols) | 0
    // only a surface is ever in the field (the BFS starts on one and only steps onto them): walls and air get no edges
    const k = b.levels[lv].kind[c] as Kind
    if (!(k === K.FLOOR || k === K.RAMP || k === K.LANDING || k === K.BLOCK || k === K.GATE || k === K.WINDOW)) continue
    const y = b.levels[lv].sy[c]
    const here = surfacesAt(b, x, z)
    for (let d = 0; d < DIRS.length; d++) {
      const nx = x + DIRS[d][0], nz = z + DIRS[d][1]
      const there = surfacesAt(b, nx, nz)
      // step: floodStand(nx, nz, y)
      let na = 0
      for (let i = 0; i < there.length; i++) if (Math.abs(there[i].y - y) <= 1.01) A[na++] = there[i]
      if (na) {
        pickSort(A, na)
        const a = C.node.length, bb = push(A, na, nx, nz)
        E.kind.push(0); E.cA.push(a); E.cB.push(bb); E.fA.push(0); E.fB.push(0); E.tNode.push(-1); E.tCond.push(-1)
      }
      // drop, walked backwards: a body up on the neighbour that would land in THIS cell (floodMove(x, z, up.y))
      for (let u = 0; u < there.length; u++) {
        const up = there[u]
        if (up.y <= y + 1.01) continue
        let ns = 0
        for (let i = 0; i < here.length; i++) if (Math.abs(here[i].y - up.y) <= 1.01) A[ns++] = here[i]
        pickSort(A, ns)
        // the common case: an always-open floor of ANOTHER storey is what floodStand picks (the storey above this
        // cell) — that never lands here, so no edge
        if (ns && A[0].lv !== lv && condOf(m, A[0], x, z) === -1) continue
        const lv2 = levelOfY(b, up.y)
        let nf = 0
        if (lv2 >= 0 && kindAt(b, lv2, x, z) === K.VOID) {
          for (let i = 0; i < here.length; i++) {
            const su = here[i]
            if (su.lv === lv2 - 1 && su.y < up.y - 1.01 && (su.kind === K.FLOOR || su.kind === K.LANDING) && b.levels[su.lv].tone[z * b.cols + x] !== 1) F[nf++] = su
          }
          pickSort(F, nf)
        }
        const mark = C.node.length
        const a = mark, bb = push(A, ns, x, z), fa = bb, fb = push(F, nf, x, z)
        if (!mayLand(a, bb, fa, fb, lv)) { C.node.length = C.cond.length = C.lv.length = mark; continue }
        E.kind.push(1); E.cA.push(a); E.cB.push(bb); E.fA.push(fa); E.fB.push(fb)
        E.tNode.push(nodeIdx(m, up.lv, nx, nz)); E.tCond.push(condOf(m, up, nx, nz))
      }
    }
  }
  off[total] = E.kind.length
  const g: FieldGraph = {
    off, kind: Uint8Array.from(E.kind), cA: Int32Array.from(E.cA), cB: Int32Array.from(E.cB), fA: Int32Array.from(E.fA), fB: Int32Array.from(E.fB),
    tNode: Int32Array.from(E.tNode), tCond: Int32Array.from(E.tCond),
    cNode: Int32Array.from(C.node), cCond: Int32Array.from(C.cond), cLv: Int8Array.from(C.lv),
  }
  FIELD_GRAPH.set(m, g)
  return g
}
let fieldQueue = new Int32Array(0)
export function buildField(s: HoldState, start: number) {
  const f = s.field
  f.fill(-1)
  s.fieldAt = start
  if (start < 0) return
  const g = fieldGraph(s.map)
  if (fieldQueue.length < f.length) fieldQueue = new Int32Array(f.length)
  const q = fieldQueue
  let head = 0, tail = 0
  f[start] = 0; q[tail++] = start
  while (head < tail) {
    const n = q[head++], d = f[n] + 1
    for (let e = g.off[n], eEnd = g.off[n + 1]; e < eEnd; e++) {
      let nn = -1
      if (g.kind[e] === 0) {
        for (let i = g.cA[e]; i < g.cB[e]; i++) if (passes(s, g.cCond[i])) { nn = g.cNode[i]; break }
      } else {
        if (!passes(s, g.tCond[e])) continue
        let lands = -1
        for (let i = g.cA[e]; i < g.cB[e]; i++) if (passes(s, g.cCond[i])) { lands = g.cLv[i]; break }
        if (lands < 0) for (let i = g.fA[e]; i < g.fB[e]; i++) if (passes(s, g.cCond[i])) { lands = g.cLv[i]; break }
        if (lands !== ((n / (s.map.cols * s.map.rows)) | 0)) continue
        nn = g.tNode[e]
      }
      if (nn >= 0 && f[nn] === -1) { f[nn] = d; q[tail++] = nn }
    }
  }
}

// ── where the tide comes in: Zombies' ACTIVE ZONES ──────────────────────────────────────────────
// A spawn used to pick any window of any opened room, so on a big building a body could climb in two
// floors away and take twenty seconds to arrive. Zombies keeps the pressure local: only the zone you
// stand in and the zones joined to it by a bought door spawn (`_zm_zonemgr` adjacency). Same here.
/** How many of the nearest opened windows (by walking distance) take over when no active room has one. */
const NEAREST_FALLBACK = 3
/** The keeper's room and every opened room joined to it by an open gate. */
export function activeRooms(s: HoldState, here: RoomId = s.here): Set<RoomId> {
  const act = new Set<RoomId>([here])
  s.map.gates.forEach((g, i) => {
    if (s.gatesOpen[i] && g.opens.includes(here)) for (const r of g.opens) if (s.rooms[r]) act.add(r)
  })
  return act
}
/**
 * The windows a body may come up at now: the NEARER HALF (never under NEAREST_FALLBACK) of the active
 * rooms' windows by walking distance — or, in a room with none, the nearest opened ones.
 * Retune 09-26 (measured, `hold.test.ts` › pacing): at 100 × 120 a body from any active window averaged
 * ~100 steps to a keeper mid-room (~50s at a round-5 drift). The nearer half, with faster bodies
 * (`bodyStats`), brings every stage to ~15–28s (the old 50 × 80 map ran 23s in its start room, 38–74s after).
 */
export function spawnWindows(s: HoldState): HoldWindow[] {
  const act = activeRooms(s)
  const dist = (w: HoldWindow) => {
    const v = s.field[nodeIdx(s.map, w.lv, Math.round(w.inside.x), Math.round(w.inside.z))]
    return v < 0 ? Infinity : v
  }
  const near = (ws: HoldWindow[], k: number) => ws.sort((a, c) => dist(a) - dist(c) || a.id - c.id).slice(0, k)
  const wins = s.map.windows.filter(w => act.has(w.room))
  if (wins.length) return near(wins, Math.max(NEAREST_FALLBACK, Math.ceil(wins.length / 2)))
  return near(s.map.windows.filter(w => s.rooms[w.room]), NEAREST_FALLBACK)
}

/**
 * The vents a body may come up now: the active rooms' vents at least `ventMinSteps` of walking from the
 * keeper (a vent at your feet is a cheap hit, not pressure), nearer half first like the windows.
 * The point of a vent is the middle of a big room, where every window is a long walk away.
 */
export function spawnVents(s: HoldState, tune: HoldTuning = HOLD_TUNING): HoldVent[] {
  const act = activeRooms(s)
  const dist = (v: HoldVent) => s.field[nodeIdx(s.map, v.lv, v.x, v.z)]
  const ok = s.map.vents.filter(v => act.has(v.room) && dist(v) >= tune.ventMinSteps)
  ok.sort((a, c) => dist(a) - dist(c) || a.id - c.id)
  return ok.slice(0, Math.max(2, Math.ceil(ok.length / 2)))
}

// ── chests ──────────────────────────────────────────────────────────────────────────────────
export function rollRarity(rng: () => number, tune: HoldTuning = HOLD_TUNING): ChestRarity {
  const w = { ...tune.chestRarity, legendary: VESSEL_PIECES_WIRED ? tune.chestRarity.legendary : 0 }
  let r = rng() * (w.common + w.rare + w.legendary)
  if ((r -= w.common) < 0) return 'common'
  return r - w.rare < 0 ? 'rare' : 'legendary'
}
/** Every EMPTY spot rolls; an occupied one does not. Returns how many chests appeared. */
export function rollChests(s: HoldState, tune: HoldTuning = HOLD_TUNING, chance: number = tune.chestChance): number {
  let n = 0
  const fresh: number[] = []
  s.chests.forEach((c, i) => {
    if (c || s.rng() >= chance) return
    s.chests[i] = { rarity: rollRarity(s.rng, tune), openT: 0 }
    fresh.push(i)
    n++
  })
  // the pity counter: dry long enough, and no legendary already standing unopened → one of the new caches is
  // legendary, in an opened room if any of them is (a promise behind a gate you cannot buy yet is no promise)
  // ★ THE GLOVE'S STONES (RULED 09-28): paid by holding out through a real round, never coin. From
  // `gloveRound` on, a keeper the Breach owes gets them in one of that wave's caches; if the wave rolled none,
  // one is set down anyway, in an opened room if there is one. Only one stones cache stands at a time.
  if (s.gloveOwed && s.round >= tune.gloveRound && !s.chests.some(c => c?.stones)) {
    const open = (i: number) => !!s.rooms[s.map.chestSpots[i].room]
    let pick = fresh.find(open) ?? fresh[0]
    if (pick === undefined) {
      const empty = s.chests.map((c, i) => (c ? -1 : i)).filter(i => i >= 0)
      pick = empty.find(open) ?? empty[0]
      if (pick !== undefined) { s.chests[pick] = { rarity: 'rare', openT: 0 }; fresh.push(pick); n++ }
    }
    if (pick !== undefined) s.chests[pick]!.stones = true
  }
  const standing = s.chests.some((c, i) => c?.rarity === 'legendary' && !fresh.includes(i))
  if (VESSEL_PIECES_WIRED && fresh.length && !standing && !fresh.some(i => s.chests[i]!.rarity === 'legendary') && s.dryRounds >= tune.pityRounds) {
    const pick = fresh.find(i => s.rooms[s.map.chestSpots[i].room]) ?? fresh[0]
    s.chests[pick]!.rarity = 'legendary'
  }
  return n
}
/** Hold E at a chest. When it opens: salvage lands now, a Glimmer goes to the pickups, Marks and parts to `loot`. */
export function chestTick(s: HoldState, spot: number, dt: number, tune: HoldTuning = HOLD_TUNING): HoldLoot | null {
  const c = s.chests[spot]
  if (!c || !s.running) return null
  c.openT += dt
  if (c.openT < tune.chestOpenSec) return null
  if (c.stones) { s.chests[spot] = null; s.gloveOwed = false; const got: HoldLoot = { kind: 'stones' }; s.loot.push(got); return got }
  const table = CHEST_LOOT[c.rarity]
  let r = s.rng() * table.reduce((a, e) => a + e.w, 0), loot = table[table.length - 1].loot
  for (const e of table) if ((r -= e.w) < 0) { loot = e.loot; break }
  s.chests[spot] = null
  if (loot.kind === 'salvage') s.salvage += loot.n
  else if (loot.kind === 'glimmer') s.pickups.push('glimmer')
  else s.loot.push(loot)
  if (loot.kind === 'part') s.dryRounds = 0
  return loot
}

// ── the device: Zombies' pack-a-punch, ours (Alex 09-26) ──────────────────────────────────────
// Plant it at ground zero with salvage, then tune the weapon in your hands a tier at a time. IN-RUN ONLY:
// it lives on the run's state, so leaving the Hold takes it away and every run starts level (the power
// law holds — `power-budget.ts` measures what a keeper BRINGS; this is what the run hands everyone).
// RULED 09-26: the device is THE TUNER, set against THE TAP; it takes the tap's pitch, and a weapon tuned to
// it bites the flood harder. It learns the pitch, not the meaning. A gun is TUNED, then RE-KEYED; it never
// EVOLVES (evolution belongs to living things).
export interface TuneTier { name: string; dmg: number; reloadMana: number; pierce: number }
export const TUNE_TIERS: readonly TuneTier[] = [
  { name: 'untuned', dmg: 1, reloadMana: 1, pierce: 1 },
  { name: 'tuned', dmg: 2, reloadMana: 0.75, pierce: 1 },
  { name: 're-keyed', dmg: 3, reloadMana: 0.6, pierce: 3 },   // a round goes through up to three bodies
]
export const weaponTier = (s: HoldState | null | undefined, weapon: string): number => (s?.tuned[weapon] ?? 0)
/** The next tier's price for this weapon, or null at the top. */
export const tuneCostFor = (s: HoldState, weapon: string, tune: HoldTuning = HOLD_TUNING): number | null =>
  tune.tuneCost[weaponTier(s, weapon)] ?? null
export function plantDevice(s: HoldState, tune: HoldTuning = HOLD_TUNING): boolean {
  if (s.devicePlanted || !s.rooms[s.map.zero.room] || !spend(s, tune.devicePlant)) return false
  s.devicePlanted = true
  return true
}
/** Tune the weapon a tier. Returns the new tier, or null (not planted, at the top, or short of salvage). */
export function tuneWeapon(s: HoldState, weapon: string, tune: HoldTuning = HOLD_TUNING): number | null {
  const cost = tuneCostFor(s, weapon, tune)
  if (!s.devicePlanted || cost === null || !spend(s, cost)) return null
  s.tuned[weapon] = weaponTier(s, weapon) + 1
  return s.tuned[weapon]
}

// ── the step ────────────────────────────────────────────────────────────────────────────────
export interface HoldStepOut {
  /** raw damage the keeper takes this frame (the host applies resist/shield) */
  strike: number
  /** a round just began — the host shows the number */
  roundBegan: number | null
  /** the keeper just went loud */
  wentLoud: boolean
  /** the keeper fell into a room nobody had opened (a broken floor) — it is awake now */
  fellInto?: RoomId
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
      s.dryRounds++
      if (s.round % tune.chestEvery === 0) rollChests(s, tune)
    }
  } else if (s.toSpawn <= 0 && alive === 0 && !loud) {
    s.breakT = tune.breakSec
    s.flood = []
  }

  // where the keeper is: a gate or window cell has no region, so the last room stands
  const pi = keeperNode(s, px, pz, py)
  const ri = pi >= 0 ? s.map.regionOf[pi] : -1
  if (ri >= 0) s.here = s.map.rooms[ri]
  // the keeper can only be in a shut room by FALLING into it (a broken floor): being there wakes it
  if (!s.rooms[s.here]) { s.rooms[s.here] = true; out.fellInto = s.here; s.fell = s.here }

  // spawns: from the windows of the active rooms (above), and a share up through their vents.
  // LOUD = no ration and no break: they rush.
  s.spawnT -= dt
  const cap = tune.maxAlive + (studied(s, 'pitch') ? LAB_ALIVE_ADD : 0)
  if (s.spawnT <= 0 && s.breakT <= 0 && (s.toSpawn > 0 || loud) && alive < cap) {
    const n = roundCount(s.round) - s.toSpawn
    const kind: FloodKind = loud ? 'swift' : kindForRun(s, s.round, n)
    const st = bodyStats(kind, s.round)
    if (studied(s, 'lull2')) st.speed += LAB_SPEED_ADD
    if (studied(s, 'road')) st.hp = Math.round(st.hp * LAB_ROAD_HP)
    const vents = spawnVents(s, tune)
    const base = { id: s.nextId++, kind, hp: st.hp, maxHp: st.hp, speed: st.speed, tearT: 0, strikeT: 0.6, alive: true, vx: 0, vz: 0 }
    if (vents.length && s.rng() < tune.ventShare) {
      const v = vents[Math.floor(s.rng() * vents.length)]
      s.flood.push({ ...base, x: v.x, z: v.z, y: v.h - 1.2, phase: 'rise', win: -1, vent: v.id })
    } else {
      const wins = spawnWindows(s)
      const w = wins[Math.floor(s.rng() * wins.length)]
      s.flood.push({
        ...base, x: w.spawn.x + (s.rng() - 0.5) * 0.8, z: w.spawn.z + (s.rng() - 0.5) * 0.8, y: w.spawnH,
        phase: 'approach', win: w.id, vent: -1,
      })
    }
    if (s.toSpawn > 0) s.toSpawn--
    s.spawnT = loud ? 0.3 : spawnEvery(s.round)
  }

  // the field
  s.fieldT -= dt
  if (pi !== s.fieldAt || s.fieldT <= 0) { buildField(s, pi); s.fieldT = 0.25 }

  for (const b of s.flood) {
    if (!b.alive) continue
    b.strikeT = Math.max(0, b.strikeT - dt)
    if (b.phase === 'rise') {
      // up out of the grate: it cannot move or strike until it is standing on the floor
      const v = s.map.vents[b.vent]
      b.y = Math.min(v.h, b.y + (1.2 / tune.riseSec) * dt)
      if (b.y >= v.h - 1e-6) { b.y = v.h; b.phase = 'inside' }
      continue
    }
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
    // over a broken floor this is the floor below, and mid-fall (between floors, matching no step and no
    // hole) it is still the highest floor under the body — so it lands, never hangs in the air
    const here = floodMove(s, cx, cz, b.y) ?? fallTo(s, cx, cz, b.y)
    const hy = here ? here.y : b.y
    b.y += Math.max(-10 * dt, Math.min(10 * dt, hy - b.y))
    const dpx = px - b.x, dpz = pz - b.z, dp = Math.hypot(dpx, dpz)
    if (dp < tune.reach && Math.abs(py - b.y) < tune.level) {
      if (b.strikeT <= 0) { out.strike += tune.strikeDmg * (b.kind === 'bulk' ? 1.5 : 1); b.strikeT = tune.strikeCd }
      b.vx *= 0.5; b.vz *= 0.5
      continue
    }
    // ★ THE CHASE (Alex 09-27: "tracking seemed very sharp like they only move in four directions").
    // Where to head: straight at the keeper across open floor when the line is clear; otherwise down the field,
    // choosing among EIGHT neighbours (a diagonal only where both of its sides are open — no corner cutting).
    // The heading is then STEERED, never snapped: velocity eases toward the wish at `turnRate`, so a body
    // arcs round a corner and drifts sideways into a crowd instead of turning on the spot like a grid piece.
    // String-pulled (09-27, second pass: 8 neighbours alone still read as eight directions): every `aimSec` the
    // body walks the field `lookahead` cells ahead and aims at the FARTHEST of them it has a clear line to, so
    // across a room with cover it cuts one straight line at any angle. In sight of the keeper it aims at them.
    b.aimT = (b.aimT ?? 0) - dt
    const arrived = b.aimX !== undefined && Math.hypot((b.aimX ?? 0) - b.x, (b.aimZ ?? 0) - b.z) < 0.35
    if (b.aimT <= 0 || arrived || b.aimX === undefined) {
      b.aimT = tune.aimSec
      const sees = here !== null && Math.abs(py - hy) < 0.6 && dp < tune.chaseSight && clearLine(s, b.x, b.z, px, pz, hy)
      b.aimX = undefined; b.aimZ = undefined; b.aimKeeper = sees
      if (!sees && here) {
        const path = fieldAhead(s, cx, cz, hy, tune.lookahead)
        for (let k = path.length - 1; k >= 0; k--) {
          const c = path[k]
          if (k === 0 || (Math.abs(c.y - hy) < 0.6 && clearLine(s, b.x, b.z, c.x, c.z, hy))) { b.aimX = c.x; b.aimZ = c.z; break }
        }
      }
    }
    const bx = b.aimKeeper || b.aimX === undefined ? px : b.aimX, bz = b.aimKeeper || b.aimZ === undefined ? pz : b.aimZ
    // a body cut off by a shut gate (field -1) heads for the keeper anyway and is stopped by the wall
    const mx = bx - b.x, mz = bz - b.z, md = Math.hypot(mx, mz) || 1
    const ease = Math.min(1, tune.turnRate * dt)
    b.vx += ((mx / md) * b.speed - b.vx) * ease
    b.vz += ((mz / md) * b.speed - b.vz) * ease
    const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt
    if (Math.round(nx) === cx || floodMove(s, Math.round(nx), cz, hy)) b.x = nx   // floodMove: a body may step OFF into a broken floor
    else b.vx = 0
    const cx2 = Math.round(b.x)
    if (Math.round(nz) === cz || floodMove(s, cx2, Math.round(nz), hy)) b.z = nz
    else b.vz = 0
  }
  // ★ bodies do not stack into one (Alex 09-27: "they shouldnt overlap each other so they can form a mob").
  // Spacing is each body's DRAWN radius (`BODY_RADIUS`, the renderer reads the same table), relaxed over a few
  // passes so a crowd settles into a mob, not a pile. The heavier body gives less ground. Two bodies on the
  // very same point (a vent spawns at its centre) are split along an id-seeded angle; before 09-27 they were
  // skipped, so a pair out of one vent chased as one body for its whole life.
  const live = s.flood.filter(b => b.alive && b.phase === 'inside')
  const canShove = (b: FloodBody, x: number, z: number) => (Math.round(x) === Math.round(b.x) && Math.round(z) === Math.round(b.z)) || floodStand(s, Math.round(x), Math.round(z), b.y) !== null
  for (let pass = 0; pass < 3; pass++) for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], c = live[j]
    if (Math.abs(a.y - c.y) >= tune.level) continue
    let dx = c.x - a.x, dz = c.z - a.z, d = Math.hypot(dx, dz)
    const ra = BODY_RADIUS[a.kind], rc = BODY_RADIUS[c.kind], min = ra + rc + tune.bodyGap
    if (d >= min) continue
    if (d < 1e-4) { const ang = ((a.id * 2654435761 + c.id) % 6283) / 1000; dx = Math.cos(ang); dz = Math.sin(ang); d = 1 } else { dx /= d; dz /= d }
    const over = min - Math.min(d, min), ma = ra * ra, mc = rc * rc, pa = over * mc / (ma + mc), pc = over * ma / (ma + mc)
    if (canShove(a, a.x - dx * pa, a.z - dz * pa)) { a.x -= dx * pa; a.z -= dz * pa }
    if (canShove(c, c.x + dx * pc, c.z + dz * pc)) { c.x += dx * pc; c.z += dz * pc }
  }
  // boosters wait, then fade; walking over one takes it
  for (const d of s.drops) {
    d.ttl -= dt
    if (d.ttl > 0 && (px - d.x) ** 2 + (pz - d.z) ** 2 <= tune.pickupReach ** 2 && Math.abs(py - d.y) < tune.level) {
      s.pickups.push(d.kind); d.ttl = 0
      if (d.kind === 'wrack') s.wrack++
    }
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
    // a fallen special leaves wrack where it fell (never in the rush — the loud tide is not a farm)
    if (s.hush > 0 && s.rng() < (tune.wrackChance[b.kind] ?? 0)) {
      const w = s.map.windows[b.win], v = s.map.vents[b.vent]
      const at = b.phase === 'inside' ? { x: b.x, z: b.z, y: b.y } : v ? { x: v.x, z: v.z, y: v.h } : { ...w.inside, y: w.h }
      s.drops.push({ id: s.nextId++, kind: 'wrack', x: at.x, z: at.z, y: at.y, ttl: tune.wrackTtl })
    }
    if (s.dropsThisRound < tune.dropCap && s.rng() < tune.dropChance) {
      // a body killed in the yard (shot through a window) leaves its booster just inside that
      // window — a drop the keeper cannot reach is a drop that taunts
      const w = s.map.windows[b.win], v = s.map.vents[b.vent]
      const at = b.phase === 'inside' ? { x: b.x, z: b.z, y: b.y } : v ? { x: v.x, z: v.z, y: v.h } : { ...w.inside, y: w.h }
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
  | { kind: 'bench'; wrack: number }
  | { kind: 'chest'; spot: number; rarity: ChestRarity; progress: number }
  | { kind: 'device'; planted: boolean; cost: number }

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
  for (let i = 0; i < s.map.chestSpots.length; i++) {
    const c = s.chests[i], sp = s.map.chestSpots[i]
    if (c && near(px, pz, py, sp.x, sp.z, sp.h, tune.interact, tune)) return { kind: 'chest', spot: i, rarity: c.rarity, progress: Math.min(1, c.openT / tune.chestOpenSec) }
  }
  const { rack, font, cache, zero } = s.map
  if (s.rooms[zero.room] && near(px, pz, py, zero.x, zero.z, zero.h, tune.interact, tune)) return { kind: 'device', planted: s.devicePlanted, cost: tune.devicePlant }
  if (near(px, pz, py, rack.x, rack.z, rack.h, tune.interact, tune)) return { kind: 'rack', cost: tune.rackCost, bought: s.rackBought }
  if (near(px, pz, py, font.x, font.z, font.h, tune.interact, tune)) return { kind: 'font', cost: tune.fontCost }
  if (tune.draughtSold && s.rooms[cache.room] && near(px, pz, py, cache.x, cache.z, cache.h, tune.interact, tune)) return { kind: 'cache', cost: tune.cacheCost }
  if (s.rooms[cache.room] && near(px, pz, py, cache.x, cache.z, cache.h, tune.interact, tune)) return { kind: 'bench', wrack: s.wrack }
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
  if (!tune.draughtSold || !s.rooms[s.map.cache.room] || !spend(s, tune.cacheCost)) return false
  s.hush += tune.cacheSec
  return true
}
/** Held E at a window: one plank per `mendSec`. Salvage is paid up to the round's cap. */
export function mendTick(s: HoldState, win: number, dt: number, tune: HoldTuning = HOLD_TUNING): boolean {
  if (s.planks[win] === undefined || s.planks[win] >= tune.seals) { s.mendT = 0; return false }
  s.mendT += dt
  if (s.mendT < tune.mendSec * (studied(s, 'mend') ? 0.5 : 1)) return false
  s.mendT = 0
  s.planks[win]++
  if (s.mendPaidThisRound < tune.mendSalvageCap) {
    const pay = Math.min(tune.salvageMend, tune.mendSalvageCap - s.mendPaidThisRound)
    s.salvage += pay; s.mendPaidThisRound += pay
  }
  return true
}

// ── the owner's layout-walk shortcuts (the range console, owner-only, in the hold) ──────────────
// A layout pass is a WALK, and every floor below the roof sits behind salvage a real run takes rounds
// to earn. These exist so Alex can judge the floors in a minute. They are not a game control.
/** Every gate open, every room awake. */
export function ownerOpenAll(s: HoldState): void {
  s.gatesOpen = s.gatesOpen.map(() => true)
  for (const r of s.map.rooms) s.rooms[r] = true
  s.fieldAt = -1
}
/** The tide stops: the flooded are gone and none come until the run starts again. */
/** Owner layout walk: a chest on every empty spot, rarity rolled as usual. */
export function ownerChests(s: HoldState, tune: HoldTuning = HOLD_TUNING): number {
  return rollChests(s, tune, 1)
}
export function ownerCalm(s: HoldState): void {
  s.flood = []
  s.toSpawn = 0
  s.breakT = 1e9
  s.hush = Math.max(s.hush, 1e6)
}
/** Somewhere to stand on each floor and in each garden, for the jump buttons. */
export function holdSpots(m: HoldMap): { label: string; x: number; z: number; y: number }[] {
  const b = m.building
  const at = (label: string, lv: number, x: number, z: number) => {
    // the nearest plain floor cell to (x, z) on that floor
    let best: { x: number; z: number } | null = null, bd = Infinity
    for (let i = 0; i < b.cols * b.rows; i++) {
      if (b.levels[lv].kind[i] !== K.FLOOR) continue
      const cx = i % b.cols, cz = (i / b.cols) | 0, d = (cx - x) ** 2 + (cz - z) ** 2
      if (d < bd) { bd = d; best = { x: cx, z: cz } }
    }
    return { label, x: best!.x, z: best!.z, y: b.levels[lv].y }
  }
  const top = b.levels.length - 1
  // the tower plate sits between the gardens; aim each jump at the middle of what it names
  const cx = Math.round(b.cols / 2), cz = Math.round(b.rows / 2), gx = Math.round(GARDEN_W / 2)
  return [
    { label: 'Roof', x: m.start.x, z: m.start.z, y: m.start.h },
    at('Office', Math.max(0, top - 1), cx + 25, 25),
    at('Lobby', 0, cx, cz),
    at('West garden', 0, gx, cz),
    at('East garden', 0, b.cols - gx, cz),
  ]
}

/** The keeper fell. The run is over; what it reached is the record. */
export function endHold(s: HoldState): { round: number; kills: number } {
  s.running = false
  s.over = true
  return { round: s.round, kills: s.kills }
}

export const fmtHush = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
