// COMBAT IN THE WILDS — real time, in the walker (Alex 11-14: "everything real time… the hallows will basically be
// the drowned of the ather, the combat should feel like zombies").
//
// ★ CANON: the Hollows are canon (game/shimmer-geography.md › THE HOLLOWS 08-07; look locked in
// design-briefs/hollows.md 08-15: goopy bipeds, ONLY the ranged form floats, no colour of its own, wet so it borrows
// the world's). Their widened role (infesting the Wilds, dropping grey matter) is Alex's revamp, [OPEN] in
// CANON_GAPS. Guns in the Ather: Alex 08-07 (engine/weapons.ts header). The gun table is shared; hit detection is
// ours (each walker owns its own, per weapons.ts).
//
// Zombie feel, as build: slow, relentless, dangerous in NUMBERS not alone. A shambler drifts until it notices you,
// closes at a stagger, then commits to a lunge you can read and side-step. A hit staggers it. Each kill leaves a
// little grey matter to walk over.
//
// ★ PURE. No react, no three. The scene layer feeds it the keeper's eye and aim, and draws what it returns.

import { canFire, spreadDeg, bloomAfterShot, bloomAfterRest, weaponDef, type WeaponDef } from '../../engine/weapons'
import { stepChampion, hitChampion, CHAMP, type Champion } from './champion'
import { easeRemote } from '../shared/fight-share'   // M28: a non-host's Hollows ease to the host's snapshot
import { ECON, payReload } from '../shared/vitals-economy'
import { stepFlit, flitHit, type FlitStep } from './flit-pose'
import { bodyBlocked, segmentHit, lineOfSight, steer, type Structures, type SteerMem } from './obstacles'

export interface Terrain {
  heightAt: (x: number, z: number) => number
  /** May a Hollow stand here (dry land, no trunk)? */
  walkable: (x: number, z: number) => boolean
  /** M117 s3: the structures (buildings, solid placed pieces) a Hollow steers round and a shot stops on (obstacles.ts). Unset = none. */
  structures?: Structures
}

/** M120 s2: 'crawler' = the MERGING Hollow (a build word; its in-world name is @lark's). Low, plated, many-legged. */
export type HollowKind = 'shambler' | 'floater' | 'crawler'
export type HollowState = 'wander' | 'chase' | 'windup' | 'lunge' | 'recover' | 'stagger' | 'charge'
export interface Hollow {
  id: number; kind: HollowKind
  x: number; y: number; z: number; yaw: number
  hp: number; maxHp: number
  state: HollowState; t: number          // seconds left in the current state
  wx: number; wz: number                 // wander target
  lx: number; lz: number                 // lunge direction
  hitFlash: number
  hitThisLunge: boolean
  /** cast statuses on this body, seconds left each (combat-casts.ts lays them; stepCombat honours and counts them down) */
  fx?: Partial<Record<HollowFx, number>>
  /** M117 s3: which way round a structure it committed to (obstacles.ts steer) */
  sm?: SteerMem
  /** M120: the pack it moves with (Combat.packs) and its loose slot in the formation round the pack's heading */
  pack?: number; px?: number; pz?: number
  /** M120 floater: zips left before it holds, the spot it is zipping to, shots left in the burst */
  zips?: number; zx?: number; zz?: number; shots?: number
  /** M120 s2 crawler: how many bodies have pooled into this one (1 = never merged); its strength and hp are the sum */
  mass?: number
  /** M120 s3c floater: its pose, stepped here (flit-pose.ts); what a round can hit follows it and FlitBody draws it */
  flit?: FlitStep
}
/** M120: a pack's shared heading (where its members drift while nobody has noticed the keeper) */
export interface Pack { wx: number; wz: number; t: number }
/** The engine's statuses that mean something to a Hollow (engine/statuses.ts; `revealed`, `silenced`, `sealed`,
 *  `shieldBroken` do not: a Hollow neither hides, casts, nor carries a shield). */
export type HollowFx = 'rooted' | 'disarmed' | 'blinded' | 'slowed' | 'staggered' | 'vulnerable' | 'burning'
export const fxOn = (h: Hollow, k: HollowFx) => (h.fx?.[k] ?? 0) > 0
/** what a cast status does to a Hollow (build; tune with play) */
export const FX = { slowMult: 0.45, vulnerableMult: 1.3, burnDps: 5 } as const
/** A floater's spit: slow enough to see coming and side-step. */
export interface Spit { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg?: number
  /** M120: a floater's shot SPLASHES where it lands: this much to a keeper inside FLOATER.splashR of the landing (a direct hit pays `dmg` instead) */
  splash?: number }
export interface Round { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; dmg: number; crit: number
  /** M151: metres a hit shoves the body (a breacher's pellet, behind M151.shell) */
  shove?: number }
export interface Drop { id: number; x: number; y: number; z: number; amount: number; age: number }

export interface Keeper {
  hp: number; maxHp: number; sinceHurt: number
  ammo: number; reloading: number; sinceShot: number; bloom: number
  /** M148: a burst in flight (rounds still to leave, seconds to the next) and last frame's trigger */
  burstLeft?: number; burstT?: number; wasDown?: boolean
  /** an infusion cast on the gun: rounds hit harder until the combat clock passes this */
  ampUntil?: number
  /** M29 FRAME (keeper-look.ts › FRAME_STATS): `hit` scales how close a blow or a spit must come (Small 0.88, Large 1.16),
   *  `takes` scales what a hit costs (Large 0.9 = +10% defence). Unset = the baseline 1. The page sets both from the look. */
  hit?: number
  takes?: number
  /** where the keeper's feet were on the last stepCombat (M59: which field's Mana Skin holds them when a blow lands) */
  at?: { x: number; z: number }
}
/** what a blow of `amount` costs this keeper (rounded, never below 1 so a hit always registers) */
export const blowCost = (k: Keeper, amount: number) => Math.max(1, Math.round(amount * (k.takes ?? 1)))
export const AMP_MULT = 1.3

export const KEEPER_HP = 100
/** M78: the dials live in shared/vitals-economy.ts (was 8/s) */
export const REGEN_DELAY = ECON.hpDelay, REGEN_RATE = ECON.hpRegen
/** Shambler tuning (build pacing, Jin). M120 (Alex 11-24 'the wilds are tame'): hp 30 -> 45 = five Repeater body shots or three
 *  to the head (sized for a keeper + a party); chase 1.7 -> 2.1 and wander 0.55 -> 0.7 ('a little bit faster'). */
export const SHAMBLER = {
  hp: 45, wanderSpeed: 0.7, chaseSpeed: 2.1, notice: 24, forget: 40,
  lungeRange: 2.6, windup: 0.45, lungeSpeed: 6.5, lungeTime: 0.32, recover: 1.1,
  hitReach: 1.15, damage: 14, stagger: 0.28, radius: 0.42, height: 1.75,
}
/** The floater: the one Hollow that floats (design-briefs/hollows.md), the ranged form. Keeps its distance and spits.
 *  M120 (Alex 11-24): it ZIPS 2-3 spots (zipSpeed, inside keepNear..keepFar), then HOLDS (`charge` = the tell) and fires a
 *  burst of `shots` spits `shotGap` apart; each SPLASHES where it lands (splashR / splash). hp 20 -> 30, damage 10 -> 6 a shot (+3 splash on a near miss). */
export const FLOATER = {
  hp: 30, hover: 2.2, keepNear: 9, keepFar: 16, notice: 30, forget: 44, speed: 2.1,
  charge: 0.7, recover: 1.8, spitSpeed: 11, spitLife: 3, spitR: 0.35, damage: 6, share: 0.25,
  zipSpeed: 9, zipTime: 0.9, zipPause: 0.25, zipsMin: 2, zipsMax: 3, shots: 3, shotGap: 0.22, splashR: 1.6, splash: 3,
}
/** M120: Hollows come in PACKS (Alex 11-24 'move in groups'): `min`..`max` to a pack, at most `floaters` floaters each, a
 *  loose formation `spread` m round the pack's heading; one member noticing the keeper sets the whole pack on them. */
export const PACK = { min: 3, max: 5, floaters: 1, spread: 3.5, roam: 12, catchUp: 1.7 }
/** M120 s2: THE MERGING HOLLOW (canon c01931e: grey that meets grey POOLS; two of this kind that touch become one larger body,
 *  mass and strength ADDED, without end; only on drained ground; a compacted-mana round still disperses it, however big).
 *  Build calls (Jin): it forms in broods of 2-3 strays that drift toward each other on drained ground (`seekR`) and pool on
 *  touch. hp and damage ADD with mass; speed falls as mass^-speedExp; the body grows on a tapered (log) scale so a big one stays
 *  readable; it flinches less the bigger it is. A round DISPERSES it like any Hollow (hp to 0, it ends; no split, so a merge only
 *  ever lowers the entity count). populate counts a crawler by its MASS, so pooling never pulls in fresh spawns. */
export const CRAWLER = {
  hp: 35, damage: 8, wanderSpeed: 0.8, chaseSpeed: 2.5, notice: 20, forget: 36,
  lungeRange: 1.9, windup: 0.5, lungeSpeed: 6, lungeTime: 0.3, recover: 1.2, hitReach: 1.0, stagger: 0.24,
  radius: 0.5, bodyY: 0.35, bodyR: 0.5, height: 0.7,
  seekR: 14, touch: 0.25, speedExp: 0.3, scaleK: 0.55, scaleMax: 4, share: 0.22, brood: [2, 3] as [number, number],
  /** M122 (Alex 11-24 night play): a lone crawler STARTS at half its M120 size; the merge curve multiplies from this base */
  scaleBase: 0.5,
}
/** the drawn (and hit) size of a crawler of `mass`: scaleBase (0.5) at mass 1, then the same log taper times the base
 *  (2 -> 0.69, 4 -> 0.88, 8 -> 1.07, capped at scaleMax x the base = 2.0). M122: was 1 / 1.38 / 1.76 / 2.14 (cap 4). */
export const crawlerScale = (mass = 1) => CRAWLER.scaleBase * crawlerGrowth(mass)
/** the merge curve alone (1 at mass 1): M122 keeps the SHOT sphere's radius and the pooling TOUCH on this, the M120 numbers. The
 *  keeper rule sim (wilds-merge.test (9)) took champion+brood deaths 7 -> 20 / 200 when they halved too (a newcomer's hip-fire
 *  on a 0.25 m sphere; fewer pools = more fast lone bodies). The look, the aim centre, footprint, reach and lunge are half. */
export const crawlerGrowth = (mass = 1) => Math.min(CRAWLER.scaleMax, 1 + CRAWLER.scaleK * Math.log(Math.max(1, mass)))
/** a walker's live tuning: the shambler's dials, or a crawler's scaled by its mass */
export function walkerOf(h: Hollow) {
  if (h.kind !== 'crawler') return SHAMBLER
  const m = Math.max(1, h.mass ?? 1), s = crawlerScale(m), slow = Math.pow(m, -CRAWLER.speedExp)
  return { ...CRAWLER, wanderSpeed: CRAWLER.wanderSpeed * slow, chaseSpeed: CRAWLER.chaseSpeed * slow, damage: CRAWLER.damage * m,
    lungeRange: CRAWLER.lungeRange * s, hitReach: CRAWLER.hitReach * s, radius: CRAWLER.radius * s, stagger: CRAWLER.stagger / m }
}
/** what a body counts for against populate's target (a crawler: its mass) */
export const weightOf = (h: Hollow) => h.kind === 'crawler' ? Math.max(1, h.mass ?? 1) : 1
/** grey matter a dispersed Hollow leaves */
const dropOf = (c: Combat, h: Hollow) => (h.kind === 'floater' ? 2 : h.kind === 'crawler' ? Math.min(8, Math.max(1, h.mass ?? 1)) : 1) + Math.floor(rnd(c) * 3)
export const HEAD_Y = 1.55, HEAD_R = 0.26, BODY_Y = 0.85, BODY_R = 0.44
export const PICKUP_R = 1.4, MAGNET_R = 4.5

/** A placed field: a ground area at (x,z), `r` m radius, until `until` (c.clock seconds). The numbers are castForMove's. */
export interface CombatField {
  id: number; moveId: string; x: number; y: number; z: number; r: number; until: number; nextTick: number
  dps: number; hps: number; cage: boolean; stopsShots: boolean; colour: string
  /** M59 MANA SKIN (name ruled athernyx ae322a9): the field's shell (spec.fieldHp: Threshold 20, Overpressure 60). While the
   *  keeper stands inside, every blow drains it before health (hurtKeeper). At 0 it POPS once and the field is gone. */
  shell?: number; shellMax?: number; popped?: boolean
}
/** A raised terrain piece (terrain casts): grid cells (1 m, the engine's rounding), each `base` to `base + rise` m tall, until `until`. The numbers are castForMove's. */
export interface CombatPiece {
  id: number; moveId: string; until: number
  cells: { x: number; z: number; base: number; rise: number }[]
}
/** Is the ground cell at (x,z) held by a raised piece? Returns the piece cell's top (m), or null. */
export function solidTop(c: Combat, x: number, z: number): number | null {
  const ps = c.pieces
  if (!ps?.length) return null
  const cx = Math.round(x), cz = Math.round(z)
  for (const p of ps) for (const q of p.cells) if (q.x === cx && q.z === cz) return q.base + q.rise
  return null
}
/** A veil's false keeper: foes that would aim at the keeper aim here until `until` (c.clock seconds). Heat Mirage: decoySecs, decoyOffset. */
export interface CombatDecoy { x: number; z: number; y: number; until: number; moveId: string }
export interface Combat {
  hollows: Hollow[]; rounds: Round[]; drops: Drop[]; spits: Spit[]
  /** M78: the keeper's mana bar (the page's manaRef object). A reload pays ECON.reloadMana from it; unset = reloads are free. */
  mana?: { cur: number }
  /** M80: the keeper's OWN Mana Skin, charged by holding F (shared/use-skin-charge.ts). Takes a blow after any field's skin;
   *  pops at 0 like it. Unset = none. */
  skin?: { cur: number }
  /** BETA M28 shared fights: a NON-HOST in a party. The host runs the Hollows (fight-share.ts snapshots); here they only
   *  ease to the host's word: no AI, no spawning, no spit; a round that hits one flashes it and queues the hit in `netHits`
   *  (slice 3 sends them to the host), and never changes its hp (the host decides that). */
  remote?: boolean
  /** #1651 (Alex 11-19: Hollows hunt guests too): the HOST's party mates here, by their synced spot. Each Hollow chases the
   *  NEAREST keeper (me or one of these); what reaches one of them is an event ('hurt-other'), never my hp. Unset = solo. */
  others?: { id: string; x: number; y: number; z: number }[]
  /** M151: metres each body has been shoved by the shell in flight */
  shoved?: Map<number, number>
  netHits?: { id: number; dmg: number; head: boolean }[]
  keeper: Keeper; gun: WeaponDef
  nextId: number; seed: number
  clock?: number
  /** Fields placed by field casts (combat-casts.ts › stepFields): each lasts its spec's secs and ticks on its own clock. */
  fields?: CombatField[]
  /** Terrain raised by terrain casts (combat-casts.ts, stepPieces): Hollows cannot step into a cell, spit stops on it. */
  pieces?: CombatPiece[]
  /** The veil's decoy (combat-casts.ts › runCast 'veil'): Hollows target it instead of the keeper while it lasts. */
  decoy?: CombatDecoy | null
  /** M127 s1b: a walker (by id) drawn off the keeper this frame by something it can chase but never reach: it walks at this
   *  spot while chasing and stops LURE_STOP m short. It never winds up, lunges or spits at it; the keeper in reach is still
   *  lunged at. Set by the caller every frame; unset = nobody is drawn off. */
  lures?: ReadonlyMap<number, { x: number; z: number }>
  /** The node's champion, when one is up (champion.ts). */
  champ?: Champion
  /** Champions that went back under, by node: the bar each had reached. */
  dormant?: Record<string, number>
  /** Events this step, for the scene (sounds, flashes) and the page (grey matter, death). */
  events: CombatEvent[]
  /** M117 s3: shots (rounds + spits) stopped by a structure so far (checks read it; events clear every step) */
  wallHits?: number
  /** M120: floater shots that landed and splashed so far (checks read it; events clear every step) */
  splashes?: number
  /** M120 s2: is this DRAINED (Hollow) ground? Crawlers pool only there. Unset = nowhere (the page sets it from the node map). */
  drained?: (x: number, z: number) => boolean
  /** M120 s2: crawler merges so far (checks read it; events clear every step) */
  merges?: number
  /** M120: the packs, by id (a pack with no member left is dropped on the next step) */
  packs?: Record<number, Pack>
}
export type CombatEvent =
  | { kind: 'hit'; id: number; head: boolean; killed: boolean }
  | { kind: 'hurt'; amount: number }
  | { kind: 'skin'; absorbed: number }
  | { kind: 'skin-pop' }
  /** #1651 (host only): a Hollow's blow or spit reached ANOTHER keeper in the party; `dmg` is RAW (their frame applies there) */
  | { kind: 'hurt-other'; id: string; dmg: number }
  | { kind: 'pickup'; amount: number }
  | { kind: 'fired' }
  | { kind: 'reload-dry' }
  | { kind: 'down' }
  | { kind: 'champ-wake'; nodeId: string }
  | { kind: 'champ-break'; nodeId: string; bar: number }
  | { kind: 'champ-down'; nodeId: string }
  /** M117 s3: a round or a spit hit a structure here (it stops; nobody behind it is hurt) */
  | { kind: 'impact'; x: number; y: number; z: number; by: 'round' | 'spit' }
  /** M120: a floater's shot landed (ground or wall) and splashed here, FLOATER.splashR round */
  | { kind: 'splash'; x: number; y: number; z: number; hurt: boolean }
  /** M120 s2: crawler `gone` pooled into crawler `id`, which is now `mass` strong */
  | { kind: 'merge'; id: number; gone: number; mass: number; x: number; z: number }

export function newCombat(seed = 1, gunId = 'repeater'): Combat {
  const gun = weaponDef(gunId)!
  return {
    hollows: [], rounds: [], drops: [], spits: [], gun, nextId: 1, seed, events: [],
    keeper: { hp: KEEPER_HP, maxHp: KEEPER_HP, sinceHurt: 99, ammo: gun.clip, reloading: 0, sinceShot: 99, bloom: 0 },
  }
}

const rnd = (c: Combat) => { c.seed = (c.seed * 1664525 + 1013904223) >>> 0; return c.seed / 4294967296 }

const HP0: Record<HollowKind, number> = { get shambler() { return SHAMBLER.hp }, get floater() { return FLOATER.hp }, get crawler() { return CRAWLER.hp } }
export function spawnHollow(c: Combat, T: Terrain, x: number, z: number, kind: HollowKind = 'shambler'): Hollow {
  const h: Hollow = {
    id: c.nextId++, kind, x, y: T.heightAt(x, z) + (kind === 'floater' ? FLOATER.hover : 0), z, yaw: rnd(c) * Math.PI * 2,
    hp: HP0[kind], maxHp: HP0[kind], state: 'wander', t: 0, wx: x, wz: z, lx: 0, lz: 0, hitFlash: 0, hitThisLunge: false,
  }
  if (kind === 'crawler') h.mass = 1
  c.hollows.push(h)
  return h
}

/** BETA M28 slice 3: a GUEST's round landed (fight-share relays it to the host). The host applies it as its own round
 *  would (the guest already folded in its own amp; the Hollow's 'vulnerable' is the host's to know). The KILL is not made
 *  here: the next stepCombat gives a Hollow taken to 0 between steps its kill event + drop (1f0e15d2), so a guest's kill
 *  drops exactly once, and the host's drop-watch tells every keeper. Unknown or dead id = ignored (it died first). */
/** #1651: the host says one of its Hollows reached ME (a guest). Raw damage; MY frame's defence applies, as if local. */
export function applyNetHurt(c: Combat, raw: number) {
  const k = c.keeper
  if (!(raw > 0) || raw > 50 || k.hp <= 0) return
  hurtKeeper(c, raw)
}

// ── M59 THE MANA SKIN ──────────────────────────────────────────────────────────────────────────────────────────────────
/** The field whose Mana Skin holds the keeper right now: the one with the most shell left, among the live, unpopped fields
 *  with a shell whose disc the keeper's feet stand in. None = blows go straight to health. */
export function skinField(c: Combat): CombatField | null {
  const at = c.keeper.at, now = c.clock ?? 0
  if (!at || !c.fields?.length) return null
  let best: CombatField | null = null
  for (const f of c.fields) if ((f.shell ?? 0) > 0 && !f.popped && f.until > now && Math.hypot(at.x - f.x, at.z - f.z) <= f.r && (!best || f.shell! > best.shell!)) best = f
  return best
}
/** What the HUD draws over the health bar: the skin holding the keeper and its full size (0 / 0 = none). */
export function skinOf(c: Combat): { skin: number; skinMax: number } {
  const f = skinField(c)
  if (f) return { skin: f.shell!, skinMax: f.shellMax ?? f.shell! }
  return c.skin && c.skin.cur > 0 ? { skin: c.skin.cur, skinMax: ECON.skinCap } : { skin: 0, skinMax: 0 }   // M80: the keeper's own
}
function popSkin(c: Combat, f: CombatField) {
  f.shell = 0; f.popped = true; f.until = c.clock ?? 0   // "gone at the first hard blow": the field goes with its skin
  c.events.push({ kind: 'skin-pop' })
}
/** THE one way a blow reaches the keeper. The frame's defence first (blowCost), then the Mana Skin holding them takes what
 *  it can ({kind:'skin'}), popping once at 0 ({kind:'skin-pop'}); only the rest reaches health ({kind:'hurt'}, regen
 *  delay restarts, {kind:'down'} at 0). A blow the skin swallows whole leaves health and its regen alone. */
export function hurtKeeper(c: Combat, raw: number) {
  const k = c.keeper
  if (k.hp <= 0) return
  let cost = blowCost(k, raw)
  const f = skinField(c)
  if (f) {
    const absorbed = Math.min(f.shell!, cost)
    f.shell! -= absorbed; cost -= absorbed
    c.events.push({ kind: 'skin', absorbed })
    if (f.shell! <= 0) popSkin(c, f)
  }
  const own = c.skin
  if (cost > 0 && own && own.cur > 0) {   // M80: the keeper's own skin (hold F) takes what is left
    const absorbed = Math.min(own.cur, cost)
    own.cur -= absorbed; cost -= absorbed
    c.events.push({ kind: 'skin', absorbed })
    if (own.cur <= 1e-6) { own.cur = 0; c.events.push({ kind: 'skin-pop' }) }
  }
  if (cost <= 0) return
  k.hp = Math.max(0, k.hp - cost); k.sinceHurt = 0
  c.events.push({ kind: 'hurt', amount: cost })
  if (k.hp <= 0) c.events.push({ kind: 'down' })
}
/** The EMP (Meltbore's shieldStrip, Alex 11-18): pops the skin holding the keeper outright. ⚠ Nothing in the open world aims
 *  a shieldStrip AT the keeper yet (Hollows carry no EMP); this is the hook for when something does. */
export function stripSkin(c: Combat): boolean {
  const f = skinField(c)
  if (!f) return false
  popSkin(c, f); return true
}

export function applyNetHit(c: Combat, id: number, dmg: number) {
  const h = c.hollows.find(o => o.id === id)
  if (!h || h.hp <= 0 || !(dmg > 0) || dmg > 200) return
  h.hp -= dmg * (fxOn(h, 'vulnerable') ? FX.vulnerableMult : 1); h.hitFlash = 0.12
  if (h.state !== 'lunge' && h.state !== 'charge') { h.state = 'stagger'; h.t = h.kind === 'floater' ? SHAMBLER.stagger : walkerOf(h).stagger }
}

const bodyR = (h: Hollow) => h.kind === 'crawler' ? CRAWLER.radius * crawlerGrowth(h.mass) : SHAMBLER.radius   // M122: pooling touch keeps M120's size
/** M120 s2: pool every touching pair of crawlers standing on drained ground. One pass, so a chain of three pools over two steps. */
export function mergeCrawlers(c: Combat, T: Terrain) {
  if (!c.drained) return
  const cs = c.hollows.filter(h => h.kind === 'crawler' && h.hp > 0)
  if (cs.length < 2) return
  const gone = new Set<number>()
  for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
    const A = cs[a], B = cs[b]
    if (gone.has(A.id) || gone.has(B.id)) continue
    if (Math.hypot(B.x - A.x, B.z - A.z) > bodyR(A) + bodyR(B) + CRAWLER.touch) continue
    if (!c.drained(A.x, A.z) || !c.drained(B.x, B.z)) continue
    const ma = Math.max(1, A.mass ?? 1), mb = Math.max(1, B.mass ?? 1)
    const [K, L] = ma >= mb ? [A, B] : [B, A], m = ma + mb
    const x = (A.x * ma + B.x * mb) / m, z = (A.z * ma + B.z * mb) / m
    if (T.walkable(x, z)) { K.x = x; K.z = z; K.y = T.heightAt(x, z) }
    K.mass = m; K.hp += L.hp; K.maxHp += L.maxHp
    if (L.state !== 'wander' && K.state === 'wander') K.state = 'chase'   // an alerted half keeps the whole on the keeper
    K.pack = undefined; gone.add(L.id)
    c.merges = (c.merges ?? 0) + 1
    c.events.push({ kind: 'merge', id: K.id, gone: L.id, mass: m, x: K.x, z: K.z })
  }
  if (gone.size) c.hollows = c.hollows.filter(h => !gone.has(h.id))
}

/** M120: tie these Hollows into one pack: a shared heading where they stand now, each a loose slot round it. */
export function groupPack(c: Combat, ids: number[]): number {
  const hs = c.hollows.filter(h => ids.includes(h.id))
  if (!hs.length) return 0
  const id = c.nextId++, cx = hs.reduce((a, h) => a + h.x, 0) / hs.length, cz = hs.reduce((a, h) => a + h.z, 0) / hs.length
  ;(c.packs ??= {})[id] = { wx: cx, wz: cz, t: 0 }
  for (const h of hs) { h.pack = id; h.px = h.x - cx; h.pz = h.z - cz }
  return id
}

/** Alex 11-15 (cleared ground stays quiet), held for M120's packs: a Hollow that is only WANDERING never steps from drained
 *  ground onto cleared ground (a pack's heading, its own wander, a floater's drift, a crawler seeking its kind). A chaser
 *  still follows the keeper in, and one already standing on cleared ground may walk off it. No drained map = no border. */
export const holdsBorder = (c: Combat, h: Hollow, x: number, z: number) =>
  h.state === 'wander' && !!c.drained && c.drained(h.x, h.z) && !c.drained(x, z)

/** How long after an arrival the keeper's spot is trusted (s): in the first frames the camera still holds the OLD zone's spot. */
export const SETTLE = 1.5
/** Is the strays' top-up due? Never before the keeper has SETTLED (M120 s3c: the first ring could sit round the spot they left). */
export const topUpDue = (popT: number, settled: number) => popT <= 0 && settled > SETTLE

/** Keep the Wilds peopled round the keeper: top up in a ring out of sight, in PACKS (M120), cull the far ones. */
export function populate(c: Combat, T: Terrain, kx: number, kz: number, target: number, safe?: { x: number; z: number; r: number }, infested?: (x: number, z: number) => boolean) {
  c.hollows = c.hollows.filter(h => Math.hypot(h.x - kx, h.z - kz) < 130)
  const may = (x: number, z: number) => T.walkable(x, z) && Number.isFinite(T.heightAt(x, z)) && !(safe && Math.hypot(x - safe.x, z - safe.z) < safe.r)
    && !(infested && !infested(x, z))   // cleared ground stays quiet (nodes.ts › ownerOf)
  let have = c.hollows.reduce((a, h) => a + weightOf(h), 0)   // M120 s2: a pooled crawler counts by its mass
  for (let tries = 0; have < target && tries < 24; tries++) {
    const a = rnd(c) * Math.PI * 2, r = 55 + rnd(c) * 45
    const x = kx + Math.cos(a) * r, z = kz + Math.sin(a) * r
    if (!may(x, z)) continue
    if (target - have >= CRAWLER.brood[0] && rnd(c) < CRAWLER.share) {   // M120 s2: a brood of crawlers, loose strays a few m apart
      const n = Math.min(target - have, CRAWLER.brood[0] + Math.floor(rnd(c) * (CRAWLER.brood[1] - CRAWLER.brood[0] + 1)))
      for (let m = 0, mt = 0; m < n && mt < n * 4; mt++) {
        const ma = rnd(c) * Math.PI * 2, mr = m ? 4 + rnd(c) * 6 : 0, bx = x + Math.cos(ma) * mr, bz = z + Math.sin(ma) * mr
        if (!may(bx, bz)) continue
        spawnHollow(c, T, bx, bz, 'crawler'); m++; have++
      }
      continue
    }
    const want = Math.min(target - have, PACK.min + Math.floor(rnd(c) * (PACK.max - PACK.min + 1)))
    const ids: number[] = []
    let floaters = 0
    for (let m = 0, mt = 0; ids.length < want && mt < want * 4; mt++, m++) {
      const ma = rnd(c) * Math.PI * 2, mr = ids.length ? 1 + rnd(c) * PACK.spread : 0
      const mx = x + Math.cos(ma) * mr, mz = z + Math.sin(ma) * mr
      if (!may(mx, mz)) continue
      const kind: HollowKind = floaters < PACK.floaters && rnd(c) < FLOATER.share ? 'floater' : 'shambler'
      if (kind === 'floater') floaters++
      ids.push(spawnHollow(c, T, mx, mz, kind).id)
    }
    have += ids.length
    groupPack(c, ids)
  }
}

/** M120: move each pack's heading on when its members reach it (or it goes stale); drop the packs with nobody left. */
function stepPacks(c: Combat, T: Terrain, dt: number) {
  if (!c.packs) return
  for (const key in c.packs) {
    const id = Number(key), P = c.packs[id], ms = c.hollows.filter(h => h.pack === id)
    if (!ms.length) { delete c.packs[id]; continue }
    P.t -= dt
    const cx = ms.reduce((a, h) => a + h.x, 0) / ms.length, cz = ms.reduce((a, h) => a + h.z, 0) / ms.length
    if (P.t <= 0 || Math.hypot(P.wx - cx, P.wz - cz) < 1.5) {
      for (let k = 0; k < 6; k++) {
        const wx = cx + (rnd(c) - 0.5) * 2 * PACK.roam, wz = cz + (rnd(c) - 0.5) * 2 * PACK.roam
        if (T.walkable(wx, wz) && (!c.drained || c.drained(wx, wz))) { P.wx = wx; P.wz = wz; break }   // never a heading on cleared ground
      }
      P.t = 5 + rnd(c) * 4
    }
  }
}
/** M120: where a pack member drifts while wandering (its slot round the heading), and how far it is from it. */
function packSlot(c: Combat, h: Hollow): { x: number; z: number; far: number } | null {
  const P = h.pack ? c.packs?.[h.pack] : undefined
  if (!P) return null
  const x = P.wx + (h.px ?? 0), z = P.wz + (h.pz ?? 0)
  return { x, z, far: Math.hypot(x - h.x, z - h.z) }
}

/** BETA M151, OFF until Alex has seen the newcomer sim: `hold` = the single-round guns that keep firing while held (their own
 *  fireCd, as the Backbone does since M148), `shell` = a breacher's pellets + shove. Build-time; only tests and the sim turn it on. */
export const M151: { hold: readonly string[]; shell: boolean } = { hold: [], shell: false }
/** guns driven by stepTrigger every frame (hold = keeps firing); the rest fire once a pull (auto guns: every frame held) */
export const heldGun = (g: { id: string; burst?: number; charge?: number }) => (g.burst ?? 1) > 1 || (!g.charge && M151.hold.includes(g.id))
/** M151: a pellet's hit shoves a body along its flight, never into anything solid, over the border, or in a committed lunge; a pooled crawler gives less. */
export const SHOVE_MAX = 1.2
function shoveBody(c: Combat, T: Terrain, h: Hollow, r: Round) {
  if (!r.shove || h.hp <= 0 || h.state === 'lunge') return
  const l = Math.hypot(r.vx, r.vz); if (l < 1e-6) return
  const left = SHOVE_MAX - (c.shoved?.get(h.id) ?? 0), m = Math.min(r.shove / weightOf(h), left); if (m <= 0) return
  const nx = h.x + r.vx / l * m, nz = h.z + r.vz / l * m, sfree = structFree(T, h, h.kind === 'crawler' ? CRAWLER.radius : SHAMBLER.radius)
  if (!T.walkable(nx, nz) || solidTop(c, nx, nz) !== null || (sfree && !sfree(nx, nz)) || holdsBorder(c, h, nx, nz)) return
  h.x = nx; h.z = nz; (c.shoved ??= new Map()).set(h.id, SHOVE_MAX - left + m)
}

/** Pull the trigger along an aim (unit vector). Returns false when the gun cannot fire. */
/** `ads` = aiming down the sights (Alex 11-18): the tighter cone (gunplay's adsSpread), the same rule the range uses. */
export function fire(c: Combat, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }, ads = false): boolean {
  const k = c.keeper, w = c.gun
  if (!canFire(w, k.sinceShot, k.ammo, k.reloading)) {
    if (k.ammo <= 0 && k.reloading <= 0) reload(c)
    return false
  }
  // a cone around the aim: pick a random direction inside spreadDeg
  const shell = M151.shell ? w as typeof w & { pellets?: number; shove?: number } : undefined, pellets = shell?.pellets ?? 1
  if (pellets > 1) c.shoved = undefined   // each shell shoves afresh
  for (let pel = 0; pel < pellets; pel++) {
    const cone = (spreadDeg(w, k.bloom, ads) * Math.PI) / 180
    const r = Math.sqrt(rnd(c)) * Math.tan(cone), th = rnd(c) * Math.PI * 2
    // two perpendiculars to aim
    const ux = Math.abs(aim.y) < 0.95 ? 0 : 1, uy = Math.abs(aim.y) < 0.95 ? 1 : 0
    let px = aim.y * 0 - aim.z * uy, py = aim.z * ux - aim.x * 0, pz = aim.x * uy - aim.y * ux
    const pl = Math.hypot(px, py, pz) || 1; px /= pl; py /= pl; pz /= pl
    const qx = aim.y * pz - aim.z * py, qy = aim.z * px - aim.x * pz, qz = aim.x * py - aim.y * px
    let dx = aim.x + (px * Math.cos(th) + qx * Math.sin(th)) * r
    let dy = aim.y + (py * Math.cos(th) + qy * Math.sin(th)) * r
    let dz = aim.z + (pz * Math.cos(th) + qz * Math.sin(th)) * r
    const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl
    c.rounds.push({ x: eye.x + dx * 0.4, y: eye.y - 0.08 + dy * 0.4, z: eye.z + dz * 0.4, vx: dx * w.projSpeed, vy: dy * w.projSpeed, vz: dz * w.projSpeed, life: w.projLife, dmg: w.damage, crit: w.crit, ...(pellets > 1 ? { shove: shell!.shove } : {}) })
  }
  k.ammo--; k.sinceShot = 0; k.bloom = bloomAfterShot(w, k.bloom)
  c.events.push({ kind: 'fired' })
  if (k.ammo <= 0) reload(c)
  return true
}

/** M148: a BURST gun's trigger for one frame (call it every frame, before stepCombat). Holding fires burst after burst, the gun's
 *  fireCd from a burst's last round to the next one's first; a burst in flight finishes trigger or not; a tap = one burst. Frame
 *  overshoot is carried, so the rhythm is the same at 20 fps and at 60. Returns the rounds that left. */
export function stepTrigger(c: Combat, eye: { x: number; y: number; z: number }, aim: { x: number; y: number; z: number }, ads: boolean, down: boolean, dt: number): number {
  const k = c.keeper, w = c.gun as typeof c.gun & { burst?: number; burstGap?: number }, gap = w.burstGap ?? 0
  const pressed = down && !k.wasDown; k.wasDown = down
  let n = 0
  const out = (over: number) => { k.sinceShot = 99; if (!fire(c, eye, aim, ads)) return false; k.sinceShot = over; n++; return true }
  if ((k.burstLeft ?? 0) > 0) {
    k.burstT = (k.burstT ?? 0) - dt
    while (k.burstLeft! > 0 && k.burstT! <= 1e-6 && k.ammo > 0 && k.reloading <= 0) { if (!out(Math.max(0, -k.burstT!))) break; k.burstLeft!--; k.burstT! += gap }
    if (k.ammo <= 0 || k.reloading > 0) k.burstLeft = 0
    return n
  }
  if (!down || k.reloading > 0) return 0
  if (k.ammo <= 0) { if (pressed) reload(c); return 0 }   // dry: a fresh pull asks for the reload, a held trigger does not nag
  const late = k.sinceShot - w.fireCd
  if (late < -1e-6) return 0
  const over = late < dt ? Math.max(0, late) : 0
  if (out(over)) { k.burstLeft = k.ammo > 0 ? (w.burst ?? 1) - 1 : 0; k.burstT = gap - over }
  return n
}
/** the burst in flight is dropped (gun put away, swapped, a panel open, the keeper down) */
export function dropBurst(c: Combat) { c.keeper.burstLeft = 0; c.keeper.wasDown = false }

export function reload(c: Combat) {
  const k = c.keeper
  if (k.reloading > 0 || k.ammo >= c.gun.clip) return
  if (!payReload(c.mana, (c.gun as { reloadPay?: number }).reloadPay)) { c.events.push({ kind: 'reload-dry' }); return }   // M78: a reload spends mana; short = no reload
  k.reloading = c.gun.reloadTime
}

/** Does the ground rise above the segment a→b anywhere along it? Marched at RAY_STEP (BETA M16: the Wilds have hills now, and
 *  a round or a spit stepped ~10-30 m in one slow frame used to test only its END point, so it passed clean through a crest).
 *  The end point is tested too; the start is where the shot was last frame, already above ground. */
export const RAY_STEP = 4
export function throughGround(T: Terrain, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / RAY_STEP))
  for (let k = 1; k <= n; k++) { const t = k / n; if (ay + (by - ay) * t < T.heightAt(ax + (bx - ax) * t, az + (bz - az) * t)) return true }
  return false
}

/** Closest approach of segment a→b to point p, squared. */
function segDist2(ax: number, ay: number, az: number, bx: number, by: number, bz: number, px: number, py: number, pz: number) {
  const dx = bx - ax, dy = by - ay, dz = bz - az, L = dx * dx + dy * dy + dz * dz
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy + (pz - az) * dz) / L)) : 0
  const ex = ax + dx * t - px, ey = ay + dy * t - py, ez = az + dz * t - pz
  return ex * ex + ey * ey + ez * ez
}

/** One step. `feet` is the keeper's feet position. */
export function stepCombat(c: Combat, T: Terrain, feet: { x: number; y: number; z: number }, dt: number) {
  c.events = []
  c.clock = (c.clock ?? 0) + dt
  const k = c.keeper
  k.at = { x: feet.x, z: feet.z }   // M59: the skin under the keeper is read from here (hurtKeeper)
  k.sinceShot += dt; k.sinceHurt += dt
  k.bloom = bloomAfterRest(c.gun, k.bloom, dt)
  if (k.reloading > 0) { k.reloading -= dt; if (k.reloading <= 0) { k.reloading = 0; k.ammo = c.gun.clip } }
  if (k.sinceHurt > REGEN_DELAY && k.hp > 0) k.hp = Math.min(k.maxHp, k.hp + REGEN_RATE * dt)

  // rounds
  for (const r of c.rounds) {
    const ox = r.x, oy = r.y, oz = r.z
    r.x += r.vx * dt; r.y += r.vy * dt; r.z += r.vz * dt; r.life -= dt
    if (throughGround(T, ox, oy, oz, r.x, r.y, r.z)) { r.life = 0; continue }
    // M117 s3: a wall stops it. Clip the step at the wall first, so a body in front of the wall is still hit, one behind it never
    const wall = T.structures ? segmentHit(T.structures, ox, oy, oz, r.x, r.y, r.z) : null
    if (wall) { r.x = wall.x; r.y = wall.y; r.z = wall.z }
    const ch = c.champ
    if (ch && Math.hypot(ch.x - r.x, ch.z - r.z) < 4) {
      const head = segDist2(ox, oy, oz, r.x, r.y, r.z, ch.x, ch.y + CHAMP.headY, ch.z) < CHAMP.headR * CHAMP.headR
      if (head || segDist2(ox, oy, oz, r.x, r.y, r.z, ch.x, ch.y + CHAMP.bodyY, ch.z) < CHAMP.bodyR * CHAMP.bodyR * 1.6) {
        r.life = 0; hitChampion(c, T, ch, head, r.dmg, r.crit); continue
      }
    }
    let best: { h: Hollow; head: boolean } | null = null
    for (const h of c.hollows) {
      if (h.hp <= 0 || Math.hypot(h.x - r.x, h.z - r.z) > 6) continue
      if (h.kind === 'floater') {
        if (flitHit(h, ox, oy, oz, r.x, r.y, r.z)) {   // M120 s3c: core, wings, tail, legs (Alex 11-24)
          best = { h, head: false }; break }
        continue
      }
      if (h.kind === 'crawler') {   // M120 s2: low and plated, no head to aim for; the body grows with its mass
        const sc = crawlerScale(h.mass), br = CRAWLER.bodyR * crawlerGrowth(h.mass)   // M122: aimed at the drawn body's middle; the sphere keeps M120's size
        if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y + CRAWLER.bodyY * sc, h.z) < br * br * 1.3) { best = { h, head: false }; break }
        continue
      }
      if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y + HEAD_Y, h.z) < HEAD_R * HEAD_R) { best = { h, head: true }; break }
      if (segDist2(ox, oy, oz, r.x, r.y, r.z, h.x, h.y + BODY_Y, h.z) < BODY_R * BODY_R * 1.6) best = { h, head: false }
    }
    if (best && c.remote) {   // M28: a non-host's round: feedback now, the host decides the damage (slice 3)
      const h = best.h, dmg = (best.head ? r.crit : r.dmg) * ((k.ampUntil ?? 0) > (c.clock ?? 0) ? AMP_MULT : 1)
      h.hitFlash = 0.12; r.life = 0
      ;(c.netHits ??= []).push({ id: h.id, dmg, head: best.head })
      c.events.push({ kind: 'hit', id: h.id, head: best.head, killed: false })
      continue
    }
    if (best) {
      const h = best.h
      const mult = (fxOn(h, 'vulnerable') ? FX.vulnerableMult : 1) * ((k.ampUntil ?? 0) > (c.clock ?? 0) ? AMP_MULT : 1)
      h.hp -= (best.head ? r.crit : r.dmg) * mult; h.hitFlash = 0.12; r.life = 0
      if (h.state !== 'lunge' && h.state !== 'charge') { h.state = 'stagger'; h.t = h.kind === 'floater' ? SHAMBLER.stagger : walkerOf(h).stagger }
      shoveBody(c, T, h, r)
      const killed = h.hp <= 0
      c.events.push({ kind: 'hit', id: h.id, head: best.head, killed })
      if (killed) c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: dropOf(c, h), age: 0 })
    }
    if (wall && r.life > 0) { r.life = 0; impact(c, wall, 'round') }
  }
  c.rounds = c.rounds.filter(r => r.life > 0)
  // a Hollow taken to 0 OUTSIDE this step (a cast lands between steps) dies like any other: event + drop. A round's kill
  // above already pushed both (11-19, sprites' prod find: it was swept here silently, no kill event, no grey matter).
  for (const h of c.hollows) if (h.hp <= 0 && !c.events.some(e => e.kind === 'hit' && e.id === h.id && e.killed)) {
    c.events.push({ kind: 'hit', id: h.id, head: false, killed: true })
    c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: dropOf(c, h), age: 0 })
  }
  c.hollows = c.hollows.filter(h => h.hp > 0)

  // hollows
  if (!c.remote) stepPacks(c, T, dt)
  // M120: a pack with one member on the keeper (chasing, winding up, spitting) has ALL its members on them
  const roused = new Set<number>()
  for (const h of c.hollows) if (h.pack && h.state !== 'wander') roused.add(h.pack)
  for (const h of c.hollows) {
    h.hitFlash = Math.max(0, h.hitFlash - dt); h.t -= dt
    if (c.remote) { easeRemote(h, dt); h.y = T.heightAt(h.x, h.z) + (h.kind === 'floater' ? FLOATER.hover : 0); continue }   // M28: the host's word
    if (h.fx) {
      for (const key in h.fx) { const kk = key as HollowFx; h.fx[kk] = Math.max(0, (h.fx[kk] ?? 0) - dt) }
      if (fxOn(h, 'burning')) h.hp -= FX.burnDps * dt
    }
    const held = fxOn(h, 'rooted') || fxOn(h, 'staggered'), blind = fxOn(h, 'blinded'), unarmed = fxOn(h, 'disarmed')
    // a veil's decoy stands in for the keeper: foes close on it, face it and spit at it (the real keeper is still hit by what reaches them)
    let tgt: { x: number; y: number; z: number } = c.decoy && c.decoy.until > (c.clock ?? 0) ? c.decoy : feet
    let ty = feet.y, alive = k.hp > 0
    // #1651: in a party the host's Hollows hunt the NEAREST keeper (a downed one goes home and leaves `others`)
    if (c.others?.length) {
      let best = alive ? Math.hypot(tgt.x - h.x, tgt.z - h.z) : Infinity
      for (const o of c.others) { const od = Math.hypot(o.x - h.x, o.z - h.z); if (od < best) { best = od; tgt = o; ty = o.y; alive = true } }
    }
    const dx = tgt.x - h.x, dz = tgt.z - h.z, d = Math.hypot(dx, dz)
    if (h.kind === 'floater') {
      // a held, blinded or disarmed floater hangs where it is and spits nothing; a slowed one does all of it at half pace
      if (!(held || blind || unarmed)) stepFloater(c, T, h, { x: tgt.x, y: ty, z: tgt.z }, d, dx, dz, fxOn(h, 'slowed') ? dt * FX.slowMult : dt, alive, !!h.pack && roused.has(h.pack))
      continue
    }
    // blinded: it has lost you, and blunders about; disarmed: it will not wind up to lunge
    if (blind && (h.state === 'chase' || h.state === 'windup')) { h.state = 'wander'; h.t = 0 }
    if (unarmed && h.state === 'windup') { h.state = 'chase' }
    let speed = 0, mx = 0, mz = 0
    const W = walkerOf(h)
    switch (h.state) {
      case 'wander': {
        if (alive && !blind && (d < W.notice || (h.pack && roused.has(h.pack) && d < W.forget))) { h.state = 'chase'; break }
        // M120 s2: a crawler on drained ground drifts toward the nearest of its kind (to pool with it)
        if (h.kind === 'crawler' && c.drained?.(h.x, h.z)) {
          let o: Hollow | null = null, od = CRAWLER.seekR
          for (const q of c.hollows) if (q !== h && q.kind === 'crawler' && q.hp > 0) { const qd = Math.hypot(q.x - h.x, q.z - h.z); if (qd < od) { od = qd; o = q } }
          if (o) { mx = o.x - h.x; mz = o.z - h.z; speed = W.wanderSpeed * 1.4; break }
        }
        const slot = packSlot(c, h)
        if (slot) {   // M120: drift with the pack, in a loose slot round its heading; a straggler catches up
          if (slot.far < 0.6) break
          mx = slot.x - h.x; mz = slot.z - h.z; speed = W.wanderSpeed * (slot.far > 3 ? PACK.catchUp : 1)
          break
        }
        if (h.t <= 0 || Math.hypot(h.wx - h.x, h.wz - h.z) < 1) {
          h.wx = h.x + (rnd(c) - 0.5) * 16; h.wz = h.z + (rnd(c) - 0.5) * 16; h.t = 3 + rnd(c) * 4
        }
        mx = h.wx - h.x; mz = h.wz - h.z; speed = W.wanderSpeed
        break
      }
      case 'chase':
        if (d > W.forget || !alive) { h.state = 'wander'; h.t = 0; break }
        if (d < W.lungeRange && !unarmed) { h.state = 'windup'; h.t = W.windup; h.lx = dx / d; h.lz = dz / d; break }
        mx = dx; mz = dz; speed = W.chaseSpeed * (0.8 + 0.35 * Math.sin(h.id * 1.7 + h.x * 0.3))   // the stagger
        {   // M127 s1b: drawn off: at the lure, stopping short of it
          const lure = c.lures?.get(h.id)
          if (lure) {
            mx = lure.x - h.x; mz = lure.z - h.z; h.yaw = Math.atan2(mx, mz)
            if (Math.hypot(mx, mz) <= LURE_STOP) speed = 0
            break
          }
        }
        // M120: a pack comes in as a loose ARC, not single file: each member leans to its own side until it is close
        if (h.pack && d > 5) { const side = Math.sign(h.px ?? 0) * Math.min(1, Math.hypot(h.px ?? 0, h.pz ?? 0) / PACK.spread) * Math.min(0.6, (d - 5) / 10); mx += -dz * side; mz += dx * side }
        break
      case 'windup':
        h.yaw = Math.atan2(h.lx, h.lz)
        if (h.t <= 0) { h.state = 'lunge'; h.t = W.lungeTime; h.hitThisLunge = false }
        break
      case 'lunge':
        mx = h.lx; mz = h.lz; speed = W.lungeSpeed
        if (!h.hitThisLunge && !unarmed && Math.hypot(feet.x - h.x, feet.z - h.z) < W.hitReach * (k.hit ?? 1) && Math.abs(feet.y - h.y) < 1.6 && k.hp > 0 && sees(T, h.x, h.y + BODY_Y, h.z, feet.x, feet.y + 0.9, feet.z)) {
          h.hitThisLunge = true
          hurtKeeper(c, W.damage)
        }
        if (!h.hitThisLunge && !unarmed && c.others) for (const o of c.others) if (Math.hypot(o.x - h.x, o.z - h.z) < W.hitReach && Math.abs(o.y - h.y) < 1.6) {
          h.hitThisLunge = true; c.events.push({ kind: 'hurt-other', id: o.id, dmg: W.damage }); break   // #1651: their frame applies on their side
        }
        if (h.t <= 0) { h.state = 'recover'; h.t = W.recover }
        break
      case 'recover': case 'stagger':
        if (h.t <= 0) h.state = d < W.notice ? 'chase' : 'wander'
        break
    }
    if (held) speed = 0
    else if (fxOn(h, 'slowed')) speed *= FX.slowMult
    if (speed > 0) {
      // M117 s3: round a structure, not through it (a lunge is committed: it stops at the wall instead)
      const sfree = structFree(T, h, W.radius)
      if (sfree && h.state !== 'lunge') { const v = steer(sfree, h.x, h.z, mx, mz, STEER_LOOK, (h.sm ??= {}), dt); if (v) { mx = v.x; mz = v.z } }
      const l = Math.hypot(mx, mz) || 1
      const nx = h.x + (mx / l) * speed * dt, nz = h.z + (mz / l) * speed * dt
      // a raised piece is a wall: a Hollow already standing in one (it rose on them) may walk out, never in
      const out = solidTop(c, h.x, h.z) !== null, free = (x: number, z: number) => T.walkable(x, z) && (out || solidTop(c, x, z) === null) && (!sfree || sfree(x, z)) && !holdsBorder(c, h, x, z)
      if (free(nx, nz)) { h.x = nx; h.z = nz }
      else if (free(nx, h.z)) h.x = nx
      else if (free(h.x, nz)) h.z = nz
      else if (h.state === 'wander') h.t = 0
      if (h.state !== 'lunge') h.yaw = Math.atan2(mx, mz)
    }
    h.y = T.heightAt(h.x, h.z)
  }
  // a burn can finish one off between rounds: it drops like any other
  for (const h of c.hollows) if (h.hp <= 0) {
    c.events.push({ kind: 'hit', id: h.id, head: false, killed: true })
    c.drops.push({ id: c.nextId++, x: h.x, y: T.heightAt(h.x, h.z), z: h.z, amount: dropOf(c, h), age: 0 })
  }
  c.hollows = c.hollows.filter(h => h.hp > 0)
  // M120 s2: crawlers that touch on drained ground POOL into one (mass, hp, strength add); the bigger keeps its id
  if (!c.remote) mergeCrawlers(c, T)
  // keep a crowd from stacking into one body
  for (let a = 0; a < c.hollows.length; a++) for (let b = a + 1; b < c.hollows.length; b++) {
    const A = c.hollows[a], B = c.hollows[b], dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), min = bodyR(A) + bodyR(B)
    if (d > 0.001 && d < min) {
      const p = (min - d) / 2 / d, ax = A.x - dx * p, az = A.z - dz * p, bx = B.x + dx * p, bz = B.z + dz * p
      if (!holdsBorder(c, A, ax, az)) { A.x = ax; A.z = az }   // a crowd held at the border is not shoved over it
      if (!holdsBorder(c, B, bx, bz)) { B.x = bx; B.z = bz }
    }
  }

  for (const h of c.hollows) if (h.kind === 'floater') stepFlit(h, dt, c.clock ?? 0, FLOATER.charge)

  stepChampion(c, T, feet, dt)

  // spits
  for (const p of c.spits) {
    const px0 = p.x, py0 = p.y, pz0 = p.z
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 2.5 * dt; p.life -= dt
    if (throughGround(T, px0, py0, pz0, p.x, p.y, p.z)) { p.life = 0; if (p.splash) splash(c, T, p, { x: p.x, y: T.heightAt(p.x, p.z), z: p.z }, feet); continue }
    const wall = T.structures ? segmentHit(T.structures, px0, py0, pz0, p.x, p.y, p.z) : null
    if (wall) { p.life = 0; impact(c, wall, 'spit'); if (p.splash) splash(c, T, p, wall, feet); continue }   // M117 s3: it splashes on the wall; the keeper behind is untouched
    const top = solidTop(c, p.x, p.z)
    if (top !== null && p.y < top) { p.life = 0; continue }   // stopped by a raised piece
    const bx = p.x - feet.x, bz = p.z - feet.z, by = p.y - (feet.y + 0.9)
    if (k.hp > 0 && bx * bx + bz * bz < (FLOATER.spitR + 0.35 * (k.hit ?? 1)) ** 2 && Math.abs(by) < 1.0) {
      p.life = 0; hurtKeeper(c, p.dmg ?? FLOATER.damage)
    }
    if (p.life > 0 && c.others) for (const o of c.others) {   // #1651: a spit can reach a party mate
      const ox = p.x - o.x, oz = p.z - o.z, oy = p.y - (o.y + 0.9)
      if (ox * ox + oz * oz < (FLOATER.spitR + 0.35) ** 2 && Math.abs(oy) < 1.0) { p.life = 0; c.events.push({ kind: 'hurt-other', id: o.id, dmg: p.dmg ?? FLOATER.damage }); break }
    }
  }
  c.spits = c.spits.filter(p => p.life > 0)

  // drops: drift to the keeper inside the magnet, collect inside the pickup radius
  for (const p of c.drops) {
    p.age += dt
    const dx = feet.x - p.x, dz = feet.z - p.z, d = Math.hypot(dx, dz)
    if (d < MAGNET_R && p.age > 0.4) { const s = Math.min(d, (8 + (MAGNET_R - d) * 3) * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; p.y = T.heightAt(p.x, p.z) }
    if (d < PICKUP_R && p.age > 0.4 && k.hp > 0) { c.events.push({ kind: 'pickup', amount: p.amount }); p.amount = 0 }
  }
  c.drops = c.drops.filter(p => p.amount > 0 && p.age < 300)
}

/** M127 s1b: how far short of a lure a Hollow stops (m) */
export const LURE_STOP = 2.4
/** M117 s3: how far ahead a Hollow looks for a wall (m) */
export const STEER_LOOK = 1.2
/** Where a body of radius r may stand, structures-wise, at the ground under it. One already standing in a structure (spawned
 *  into it, or a building went up round it) is let walk out: null = no structure rule here. */
export function structFree(T: Terrain, h: { x: number; z: number }, r: number, tall: number = SHAMBLER.height): ((x: number, z: number) => boolean) | null {
  const q = T.structures
  if (!q) return null
  const at = (x: number, z: number) => bodyBlocked(q, x, T.heightAt(x, z), z, r, tall)
  if (at(h.x, h.z)) return null
  return (x, z) => !at(x, z)
}
/** No structure between a and b (no structures = it always sees). */
export const sees = (T: Terrain, ax: number, ay: number, az: number, bx: number, by: number, bz: number) => !T.structures || lineOfSight(T.structures, ax, ay, az, bx, by, bz)
/** M120: a floater's shot lands at `at` and splashes: a keeper (or party mate) inside FLOATER.splashR that the landing
 *  can SEE takes `p.splash` (a wall keeps the splash on its own side: the point is read a hand back along the flight). */
function splash(c: Combat, T: Terrain, p: Spit, at: { x: number; y: number; z: number }, feet: { x: number; y: number; z: number }) {
  const v = Math.hypot(p.vx, p.vy, p.vz) || 1, bx = at.x - (p.vx / v) * 0.15, by = at.y - (p.vy / v) * 0.15 + 0.05, bz = at.z - (p.vz / v) * 0.15
  const reach = (o: { x: number; y: number; z: number }, r: number) => Math.hypot(o.x - at.x, o.z - at.z) < r && Math.abs(o.y - at.y) < 1.8 && sees(T, bx, by, bz, o.x, o.y + 0.9, o.z)
  let hurt = false
  if (c.keeper.hp > 0 && reach(feet, FLOATER.splashR * (c.keeper.hit ?? 1))) { hurtKeeper(c, p.splash ?? 0); hurt = true }
  if (c.others) for (const o of c.others) if (reach(o, FLOATER.splashR)) c.events.push({ kind: 'hurt-other', id: o.id, dmg: p.splash ?? 0 })
  c.splashes = (c.splashes ?? 0) + 1
  c.events.push({ kind: 'splash', x: at.x, y: at.y, z: at.z, hurt })
}
function impact(c: Combat, at: { x: number; y: number; z: number }, by: 'round' | 'spit') {
  c.wallHits = (c.wallHits ?? 0) + 1
  c.events.push({ kind: 'impact', x: at.x, y: at.y, z: at.z, by })
}

function stepFloater(c: Combat, T: Terrain, h: Hollow, feet: { x: number; y: number; z: number }, d: number, dx: number, dz: number, dt: number, alive = c.keeper.hp > 0, roused = false) {
  let mx = 0, mz = 0, speed = 0
  switch (h.state) {
    case 'wander': {
      if ((d < FLOATER.notice || (roused && d < FLOATER.forget)) && alive) { h.state = 'chase'; h.t = 0.3 + rnd(c) * 0.5; h.zips = undefined; h.zx = undefined; break }
      const slot = packSlot(c, h)
      if (slot) { if (slot.far > 0.6) { mx = slot.x - h.x; mz = slot.z - h.z; speed = SHAMBLER.wanderSpeed * (slot.far > 3 ? PACK.catchUp : 1) } break }   // M120: with its pack
      if (h.t <= 0) { h.wx = h.x + (rnd(c) - 0.5) * 20; h.wz = h.z + (rnd(c) - 0.5) * 20; h.t = 4 + rnd(c) * 4 }
      mx = h.wx - h.x; mz = h.wz - h.z; speed = FLOATER.speed * 0.4
      break
    }
    case 'chase': {   // M120: ZIP 2-3 spots round the keeper (inside the keepNear..keepFar band), then hold and burst
      if (d > FLOATER.forget || !alive) { h.state = 'wander'; h.t = 0; break }
      h.yaw = Math.atan2(dx, dz)
      // M117 s3: a wall between: no spit wasted on it; it comes round (and in) until it sees the keeper again
      const see = sees(T, h.x, h.y, h.z, feet.x, feet.y + 0.9, feet.z)
      if (!see) { mx = dx; mz = dz; speed = FLOATER.speed; h.zx = undefined; break }
      h.zips ??= FLOATER.zipsMin + Math.floor(rnd(c) * (FLOATER.zipsMax - FLOATER.zipsMin + 1))
      if (h.zx === undefined || h.zz === undefined) {
        if (h.t > 0) break   // the beat between zips: it hangs there
        if (h.zips <= 0 && d < FLOATER.keepFar + 4) { h.state = 'charge'; h.t = FLOATER.charge; h.shots = FLOATER.shots; break }
        if (h.zips <= 0) { mx = dx; mz = dz; speed = FLOATER.speed; break }   // out of range: drift in, then hold
        // the next spot: round the keeper by 25-60 degrees, at a distance inside the band
        const a = Math.atan2(h.x - feet.x, h.z - feet.z) + (rnd(c) < 0.5 ? -1 : 1) * (0.45 + rnd(c) * 0.6)
        const r = FLOATER.keepNear + rnd(c) * (FLOATER.keepFar - FLOATER.keepNear)
        h.zx = feet.x + Math.sin(a) * r; h.zz = feet.z + Math.cos(a) * r; h.t = FLOATER.zipTime
        break
      }
      const zx = h.zx - h.x, zz = h.zz - h.z
      if (Math.hypot(zx, zz) < 0.4 || h.t <= 0) { h.zx = h.zz = undefined; h.zips--; h.t = FLOATER.zipPause; break }
      mx = zx; mz = zz; speed = FLOATER.zipSpeed
      break
    }
    case 'charge':   // the HOLD (its tell), then the burst: `shots` spits, each at where the keeper is now. Committed: it was
      // seeing the keeper when it began to hold, so a keeper who ducks behind a wall mid-burst takes it on the wall (M117)
      h.yaw = Math.atan2(dx, dz)
      if (h.t <= 0) {
        const ty = feet.y + 0.9, sy = h.y, l = Math.hypot(dx, dz) || 1, flight = l / FLOATER.spitSpeed
        c.spits.push({ x: h.x, y: sy, z: h.z, vx: (dx / l) * FLOATER.spitSpeed, vz: (dz / l) * FLOATER.spitSpeed, vy: (ty - sy) / flight + 1.25 * flight, life: FLOATER.spitLife, dmg: FLOATER.damage, splash: FLOATER.splash })
        h.shots = (h.shots ?? FLOATER.shots) - 1
        if (h.shots > 0) h.t = FLOATER.shotGap
        else { h.state = 'recover'; h.t = FLOATER.recover; h.zips = undefined }
      }
      break
    case 'recover': case 'stagger':
      h.zx = h.zz = undefined
      mx = -dz; mz = dx; speed = FLOATER.speed * 0.5
      if (h.t <= 0) { h.state = d < FLOATER.notice ? 'chase' : 'wander'; h.t = 0.2 + rnd(c) * 0.4 }
      break
  }
  if (speed > 0) {
    // M117 s3: it floats at body height, so a building is in its way like any wall: round it
    const sfree = structFree(T, h, 0.5, FLOATER.hover + 0.5)
    if (sfree) { const v = steer(sfree, h.x, h.z, mx, mz, STEER_LOOK, (h.sm ??= {}), dt); if (v) { mx = v.x; mz = v.z } }
    const l = Math.hypot(mx, mz) || 1, step = Math.min(speed * dt, l)
    const nx = h.x + (mx / l) * step, nz = h.z + (mz / l) * step
    const free = (x: number, z: number) => Number.isFinite(T.heightAt(x, z)) && (solidTop(c, h.x, h.z) !== null || solidTop(c, x, z) === null) && (!sfree || sfree(x, z)) && !holdsBorder(c, h, x, z)
    if (free(nx, nz)) { h.x = nx; h.z = nz }
    else if (sfree && free(nx, h.z)) h.x = nx   // slide along a wall's face
    else if (sfree && free(h.x, nz)) h.z = nz
    else if (h.state === 'wander' && !h.pack) h.t = 0   // held at the border: pick another drift
  }
  const want = T.heightAt(h.x, h.z) + FLOATER.hover + Math.sin(h.id + performanceSafeNow(c) * 1.3) * 0.25
  h.y += (want - h.y) * Math.min(1, dt * 3)
}
/** A clock that lives in the sim (tests step time), for the floater's bob. */
const performanceSafeNow = (c: Combat) => (c.clock = (c.clock ?? 0))

/** After the fold returns a downed keeper home: full health, a full clip, the Wilds' crowd forgets them. */
export function revive(c: Combat) {
  c.keeper.hp = c.keeper.maxHp; c.keeper.sinceHurt = 99; c.keeper.ammo = c.gun.clip; c.keeper.reloading = 0
  c.hollows = []; c.rounds = []; c.spits = []; c.fields = []; c.pieces = []; c.decoy = null; c.champ = undefined
}
