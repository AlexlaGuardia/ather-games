// BETA M233 CLASH v2b part 1: THE LIVE AUTO-BATTLE ENGINE. Pure logic: no React, no three, no Math.random.
// A 1v1 in a round RING (x, z, radius RING.r), stepped at a fixed TICK_HZ, deterministic from a seed: the same entrants +
// seed + cheer inputs always play the same fight. The renderer (v2a / v2b-2) imports this, steps it, and draws each TickLog.
//
// THE PLAY (Alex 11-27): the spirit fights ON HER OWN. FOUR moves only:
//  - MELEE      : a close strike (PWR vs GRD), needs her within MELEE.range of the foe
//  - BONDED     : the move she and her keeper made THEIRS (canon shimmer-battles.md, ruled 11-24): ONE move she already
//                 knows, set by the keeper, deepened by a TWIST (never more damage). An INPUT here: { id, twist }. Unset =
//                 M238: a SEEDED RANDOM known move (resolveBonded; Magii 4204f49), no longer defaultBonded(). The move table is keyed by MOVE ID (clashMoveOf), from engine/moves.ts.
//  - EVADE or GUARD (one per species, KIND table): evade = a side-dash with a moment of no-hit; guard = brace, most damage turned.
//  - REPOSITION : close in / back off toward her kind's preferred range.
// Every action has phases (windup -> active -> recover); a WIND-UP is public state (Fighter.act), which is what the foe
// reads to evade/guard and what the renderer shows. THE CHEER: once per match the keeper cheers -> she regains CHEER_HEAL
// of max HP (cheer()).
// STATS COUNT: the entrant's party stats (engine/party-stats.ts derivePartyStats, evened per tent by fair-clash.ts
// evenSpirit as s3 did: easy Lv12, average Lv40). AGI -> speed + reaction + cooldowns, PWR/GRD -> melee, FOC/RES or
// PWR/GRD (by the move's state) -> bonded, maxHp -> HP; element matchup on the bonded move. Each stat is read RELATIVE to
// the tent's reference spirit (refOf(level)), so a fight lasts as long at Lv12 as at Lv40 and stats decide who wins it.
// Names: no new player-facing words here. Move names come from engine/moves.ts (canon registry); action/twist ids are code
// ids, their labels are a renderer row (@lark).
import type { Species, Element } from '../../spirits/spirit'
import { ALL_MOVES, MOVE_MANA_PULSE, MOVE_SPIRIT_WARD, getMovesForSpirit, getEffectiveness, toBattleElement, type Move, type BattleElement } from '../../engine/moves'
import { baseLearnedBy } from '../../engine/base-learnset'
import { derivePartyStats, moveCategory, SPECIES_STATS_V2, type PartyStats } from '../../engine/party-stats'
import { evenSpirit } from './fair-clash'
import { TENT_LEVEL, type ClashTier } from './fair-clash-rules'

// ───────────────────────────── dials (Jin's; tuned with scripts/clash-sim.mts) ─────────────────────────────
export const TICK_HZ = 20
export const DT = 1 / TICK_HZ
/** decide every DECIDE_EVERY ticks while free (0.25 s) */
export const DECIDE_EVERY = 5
export const RING = { r: 7, start: 5 } as const            // ring radius (m); fighters start `start` m apart
export const BODY = 0.5                                     // body radius: two bodies never overlap closer than 2*BODY
export const MAX_S = 240                                    // hard stop: past it the fight ends on HP fraction
export const FATIGUE = { from: 120, perS: 0.02 } as const   // after `from` s every hit lands harder by perS per s (a long fight closes)
export const CHEER_HEAL = 0.2
export const MELEE = { range: 1.6, power: 40, windup: 0.35, recover: 0.3, cooldown: 7 }
export const DEFENSE = {
  evade: { dash: 2.6, time: 0.3, iframe: 0.3, recover: 0.2, cooldown: 3.2 },
  guard: { time: 0.9, cut: 0.7, recover: 0.15, cooldown: 3.2 },
} as const
/** how often she reads the foe's wind-up and answers it: base, plus AGI edge, clamped */
export const READ = { base: 0.45, perAgi: 0.5, min: 0.2, max: 0.7, guardBase: 0.55, guardPerAgi: 0.15 } as const
/** hit size: a melee hit of an even pair takes DMG_K of the reference HP */
export const DMG_K = 0.11
export const SPEED = 2.6                                    // m/s at the reference AGI
/** the slowest kinds still cross the ring: a kiting foe cannot keep a wall out of reach for ever */
export const SPEED_FLOOR = 0.8
export const STAT_EXP = { speed: 0.5, dmg: 0.5, cd: 0.2, hp: 0.7 }
/** a close strike follows a foe stepping away: it still lands this far past its reach (a ranged one does not) */
export const CLOSE_SLACK = 1.1
/** the fight's luck, so an even-level stat edge decides the odds, not the outcome (power = choice): each hit rolls
 *  1 +- roll, and a CLEAN hit (chance `clean`) lands x cleanMul */
export const LUCK = { roll: 0.3, clean: 0.15, cleanMul: 2 }
/** a caster melees with FOC only when it beats her PWR by this factor (Infinity = melee is always a body strike) */
export let MELEE_FOC = 1.3
export const RIDER_S = 3                                    // slow / weaken / brace / haste last this long
export const DOT_FRAC = 0.04                                // a dot takes this much of her max HP over RIDER_S
export const MEND_FRAC = 0.14                               // a mend heals this much of her max HP

// ───────────────────────────── the KIND table: per base species ─────────────────────────────
export type Defense = 'evade' | 'guard'
/** how she fights by kind: preferred range (m) and which defense she has. A game call from the archetypes in
 *  party-stats.ts (walls guard, the quick ones evade), not lore. stamina retuned 11-27 (play-clash-fix) for the M238 random
 *  favourite: the old spread (.9-1.2) compensated each kind's ONE fixed move; with any known move drawn it made water-bear
 *  and hummingbird win 85-90%. */
export const KIND: Readonly<Record<Species, { pref: number; defense: Defense; stamina: number }>> = {
  fox:           { pref: 2.2, defense: 'evade', stamina: 1.02 },
  axolotl:       { pref: 3.5, defense: 'guard', stamina: 0.97},
  owl:           { pref: 4.0, defense: 'evade', stamina: 0.98 },
  frog:          { pref: 1.8, defense: 'evade', stamina: 1.04 },
  firefly:       { pref: 5.5, defense: 'evade', stamina: 0.99 },
  rabbit:        { pref: 1.5, defense: 'guard', stamina: 1.0 },
  'water-bear':  { pref: 1.4, defense: 'guard', stamina: 1.06 },
  hummingbird:   { pref: 3.0, defense: 'evade', stamina: 1.06 },
  turtle:        { pref: 3.0, defense: 'guard', stamina: 1.1 },
  bat:           { pref: 4.5, defense: 'evade', stamina: 0.99 },
}

// ───────────────────────────── the MOVE table, keyed by move id ─────────────────────────────
export type Rider = 'none' | 'slow' | 'root' | 'weaken' | 'dot' | 'mend' | 'brace' | 'haste' | 'drain'
export interface ClashMove {
  id: string; name: string; element: BattleElement; cat: 'phys' | 'spirit'
  power: number                 // 0 = a utility move (no hit; its rider lands on herself)
  range: number; windup: number; recover: number; cooldown: number
  /** what it does besides damage: on the FOE when it hits (slow/root/weaken/dot), on HERSELF otherwise (mend/brace/haste/drain) */
  rider: Rider; riderChance: number
}
/** reach by the move's canon STATE (shimmer-battles.md's seven): solid/compact are close, expanding/scatter mid, the rest far */
export const REACH_COST = { power: 0.85, windup: 0.2 }
const STATE_REACH: Record<string, number> = { solid: 2.4, compact: 2.0, expanding: 4.5, scatter: 4.0, ignite: 6.0, flow: 5.0, bind: 5.5 }
function riderOf(mv: Move): [Rider, number] {
  if (mv.selfEffect === 'regen') return ['mend', mv.power ? (mv.selfEffectChance ?? 100) / 100 : 1]
  const self = mv.statChanges?.filter(c => c.target === 'self') ?? [], foe = mv.statChanges?.filter(c => c.target === 'foe') ?? []
  if (mv.power === 0 && self.some(c => c.stat === 'grd')) return ['brace', 1]
  if (mv.power === 0 && self.length) return ['haste', 1]
  if (mv.effect === 'anchor') return ['root', (mv.effectChance ?? 100) / 100]
  if (mv.effect === 'ignition' || mv.effect === 'erosion') return ['dot', (mv.effectChance ?? 100) / 100]
  if (foe.some(c => c.stat === 'agi')) return ['slow', 1]
  if (foe.length) return ['weaken', 1]
  if (self.length) return ['haste', 1]
  return ['none', 0]
}
/** any registered move -> its Clash shape. Power sets wind-up and cooldown (a big move is slower to throw and to come back). */
export function clashMoveOf(mv: Move): ClashMove {
  const [rider, riderChance] = riderOf(mv)
  const reach = STATE_REACH[mv.state] ?? 3
  const far = reach > 2.5
  // REACH COSTS: a move thrown from outside melee lands from safety, so it hits softer and winds up longer (easier to read)
  const p = Math.round(mv.power * (far ? REACH_COST.power : 1))
  return {
    id: mv.id, name: mv.name, element: mv.element, cat: moveCategory(mv), power: p,
    range: p === 0 ? Infinity : reach,
    windup: p === 0 ? 0.5 : 0.45 + mv.power / 160 - (mv.priority > 0 ? 0.15 : 0) + (far ? REACH_COST.windup : 0),
    recover: 0.35,
    cooldown: p === 0 ? 12 : 10 + p / 15,
    rider, riderChance,
  }
}
/** THE TWIST (canon: the bonded move deepens with the bond by a twist, never more damage). Levels 0..3, each adds one:
 *  1 = quicker wind-up (harder to read), 2 = longer reach, 3 = its rider always lands (and a hit move gains a slow). */
export const TWIST_MAX = 3
export function twisted(m: ClashMove, twist: number): ClashMove {
  const t = Math.max(0, Math.min(TWIST_MAX, Math.floor(twist)))
  const out = { ...m }
  if (t >= 1) out.windup = m.windup * 0.7
  if (t >= 2 && Number.isFinite(m.range)) out.range = m.range + 1.5
  if (t >= 3) { out.riderChance = 1; if (out.rider === 'none' && out.power > 0) out.rider = 'slow' }
  return out
}

/** the moves she KNOWS (engine/moves.ts progression, the retired Bond signatures left out): the born pair, her species'
 *  learnset (raw = neutral while base, runed once evolved), and her element tiers when evolved. */
export function knownMoves(species: Species, element: Element, level: number): Move[] {
  const base = element === 'base'
  const out: Move[] = []
  const add = (mv: Move) => { if (!out.some(o => o.id === mv.id)) out.push(mv) }
  add(MOVE_MANA_PULSE); add(MOVE_SPIRIT_WARD)
  for (const mv of baseLearnedBy(species, level)) add(base ? (mv.element === 'neutral' ? mv : { ...mv, element: 'neutral' as BattleElement }) : mv)
  for (const mv of getMovesForSpirit(species, element, level, 0)) add(mv)
  return out
}
export interface Bonded { id: string; twist: number }
/** M238 (Magii ruling 4204f49): with NO favourite picked she uses a RANDOM known move, seeded (a fight replays the same).
 *  Drawn from her damaging moves (the born Spirit Ward would make a bout a ward-off); any known move if she has none. */
export function randomBonded(k: readonly Move[], seed: number): Bonded {
  // the born pair is every spirit's, never her nature (as defaultBonded): a drawn Mana Pulse made far kinds lose and
  // guard-vs-guard bouts stall to the cap (clash-sim 11-27: worst 78% -> 92%, 0 -> 263 capped). Born pair only if nothing else.
  const own = k.filter(m => m.power > 0 && m.id !== MOVE_MANA_PULSE.id && m.id !== MOVE_SPIRIT_WARD.id)
  const pool = own.length ? own : k.filter(m => m.power > 0).length ? k.filter(m => m.power > 0) : k.length ? k : [MOVE_MANA_PULSE]
  let t = (seed ^ 0x85ebca6b) >>> 0
  t = Math.imul(t ^ (t >>> 16), 0x7feb352d) >>> 0; t = Math.imul(t ^ (t >>> 15), 0x846ca68b) >>> 0; t = (t ^ (t >>> 16)) >>> 0
  return { id: pool[t % pool.length].id, twist: 0 }
}
/** M238: the moves an ENTRANT knows: her own saved list when she brings one (spirit-bond-move.ts, read at that list's
 *  level, not the tent's: evening her stats does not unlearn her moves), else knownMoves at her level */
export function entrantKnown(e: Pick<Entrant, 'species' | 'element' | 'level' | 'known'>): Move[] {
  if (!e.known) return knownMoves(e.species, e.element, e.level)
  const all = knownMoves(e.species, e.element, KNOWN_ALL_LEVEL)
  return e.known.flatMap(id => { const m = all.find(x => x.id === id); return m ? [m] : [] })
}
/** M238: her favourite as thrown in this fight: the keeper's pick when she knows it (with its twist), else seeded random */
export function resolveBonded(e: Pick<Entrant, 'species' | 'element' | 'level' | 'known' | 'bonded'>, seed: number): Bonded {
  const k = entrantKnown(e)
  if (e.bonded && k.some(m => m.id === e.bonded!.id)) return { id: e.bonded.id, twist: Math.max(0, Math.min(TWIST_MAX, Math.floor(e.bonded.twist) || 0)) }
  return randomBonded(k, seed)
}
/** the level a saved known-moves list is read at (every learnset move + the element mid tier: engine/moves.ts) */
export const KNOWN_ALL_LEVEL = 40
/** unset bonded move = her first SPECIES move (the born pair is every spirit's; the first learnset move is her nature),
 *  no twist. Falls back to Mana Pulse before she has learned one. */
export function defaultBonded(species: Species, element: Element, level: number): Bonded {
  const k = knownMoves(species, element, level)
  return { id: (k.find(m => m.id !== MOVE_MANA_PULSE.id && m.id !== MOVE_SPIRIT_WARD.id && m.power > 0) ?? k[0]).id, twist: 0 }
}
/** the bonded move as she throws it: the id must be one she knows (else the default), twisted */
export function bondedMove(species: Species, element: Element, level: number, b?: Bonded | null): ClashMove {
  const k = knownMoves(species, element, level)
  const pick = (b && k.find(m => m.id === b.id)) || k.find(m => m.id === defaultBonded(species, element, level).id) || MOVE_MANA_PULSE
  return twisted(clashMoveOf(pick), b && k.some(m => m.id === b.id) ? b.twist : 0)
}

// ───────────────────────────── entrants ─────────────────────────────
export interface Entrant {
  species: Species; element: Element; level: number; stats: PartyStats
  bonded?: Bonded | null; name?: string
  /** M238: her own known move ids (the pot's saved list); unset = knownMoves at her level */
  known?: readonly string[]
  /** M233 v2c: the tactics her LESSONS taught her (clash-lessons.ts tacticsOf); unset = none */
  tactics?: readonly Tactic[]
}
/** M233 v2c FIGHT MEMORY: one tactic shift each, read by decide()/react(). Never a stat, damage or cooldown (power = choice).
 *  saveDefense: no dodge/guard spent on a melee while the foe's bonded move (strong vs her) is nearly ready.
 *  watchBonded: reads a bonded wind-up more often, a melee one less. pressKiter: closes on a far kind while her strike is near.
 *  spaceBrawler: a step off a close kind while its strike is ready and hers is not (a close kind herself: only while hers is long off). trustReach: throws the bonded from the edge of
 *  its reach. pressMelee: darts in whenever her strike is ready. bold: no backing off when hurt. wary: hurt, she strikes only
 *  with her dodge/guard ready. closeIn: throws her bonded move only well inside its reach. waitGuard: no strike into a raised guard. baitDodge:
 *  melee before the bonded move while an evader's dodge is ready. shakeOff: slowed or rooted, she backs off instead of striking. */
export type Tactic = 'saveDefense' | 'watchBonded' | 'pressKiter' | 'spaceBrawler' | 'trustReach' | 'pressMelee' | 'bold' | 'wary' | 'closeIn' | 'waitGuard' | 'baitDodge' | 'shakeOff'
/** a tent entrant evened as s3 did (fair-clash.ts evenSpirit): tent level, even seeds, neutral temperament */
export function tentEntrant(species: Species, element: Element, tier: ClashTier, bonded?: Bonded | null): Entrant {
  const s = evenSpirit(species, element, tier)
  return { species, element, level: TENT_LEVEL[tier], stats: derivePartyStats(s), bonded, name: s.name }
}
/** the tent's reference spirit: the species-average stats at that level (what a stat is read against) */
const refCache = new Map<number, PartyStats>()
export function refOf(level: number): PartyStats {
  let r = refCache.get(level)
  if (r) return r
  const sp = Object.keys(SPECIES_STATS_V2) as Species[]
  const all = sp.map(s => { const e = evenSpirit(s, 'base', 'easy'); e.level = level; return derivePartyStats(e) })
  const avg = (k: keyof PartyStats) => all.reduce((n, s) => n + s[k], 0) / all.length
  r = { pwr: avg('pwr'), grd: avg('grd'), foc: avg('foc'), res: avg('res'), agi: avg('agi'), vig: avg('vig'), maxHp: avg('maxHp') }
  refCache.set(level, r)
  return r
}

// ───────────────────────────── state ─────────────────────────────
export type ActKind = 'idle' | 'melee' | 'bonded' | 'evade' | 'guard' | 'reposition' | 'stagger'
export type Phase = 'windup' | 'active' | 'recover'
export interface Act { kind: ActKind; phase: Phase; t: number; dur: number; dx?: number; dz?: number; read?: boolean }
export interface Fighter {
  side: 0 | 1; species: Species; element: Element; name: string
  x: number; z: number; face: number         // face = yaw (radians, atan2(dx, dz)) toward where she looks
  hp: number; maxHp: number
  act: Act
  cd: { melee: number; bonded: number; defense: number }
  cheered: boolean
  slowT: number; rootT: number; weakT: number; braceT: number; hasteT: number; dotT: number; iframeT: number
  /** private */
  _: { stats: PartyStats; bonded: ClashMove; defense: Defense; pref: number; speed: number; cdMul: number; dmgRef: number; read: number; strafe: number; nextDecide: number; dotPerS: number; tac: ReadonlySet<Tactic> }
}
export type FightEventKind = 'start' | 'hit' | 'miss' | 'evaded' | 'guarded' | 'rider' | 'cheer' | 'ko' | 'end' | 'tactic'
/** 'tactic' (M233 v2c) = a lesson CHANGED her choice this tick (the pick without it would have been another) */
export interface FightEvent { kind: FightEventKind; side: 0 | 1; move?: 'melee' | 'bonded' | 'evade' | 'guard' | 'reposition'; moveId?: string; dmg?: number; rider?: Rider; eff?: number; clean?: boolean; tactic?: Tactic }
export interface FighterSnap { x: number; z: number; face: number; hp: number; maxHp: number; act: ActKind; phase: Phase; actT: number; cheered: boolean }
export interface TickLog { tick: number; t: number; f: [FighterSnap, FighterSnap]; ev: FightEvent[] }
export interface FightState {
  tick: number; t: number; seed: number; rng: number
  f: [Fighter, Fighter]
  over: boolean; winner: 0 | 1 | null; reason: 'ko' | 'time' | null
  ref: PartyStats
}

// mulberry32, its state kept IN the fight state (so a fight can be copied, saved and resumed)
function rnd(s: FightState): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function mkFighter(e: Entrant, side: 0 | 1, ref: PartyStats, seed: number): Fighter {
  const st = e.stats, kind = KIND[e.species], bm = bondedOfEntrant(e, seed, side)
  const rel = (v: number, r: number) => Math.max(0.2, v / Math.max(1, r))
  const x = side === 0 ? -RING.start / 2 : RING.start / 2
  return {
    side, species: e.species, element: e.element, name: e.name ?? e.species,
    x, z: 0, face: side === 0 ? Math.PI / 2 : -Math.PI / 2,
    hp: Math.round(ref.maxHp * Math.pow(rel(st.maxHp, ref.maxHp), STAT_EXP.hp) * kind.stamina), maxHp: 0,
    act: { kind: 'idle', phase: 'active', t: 0, dur: 0 },
    cd: { melee: 0, bonded: 1.5, defense: 0 },
    cheered: false,
    slowT: 0, rootT: 0, weakT: 0, braceT: 0, hasteT: 0, dotT: 0, iframeT: 0,
    _: {
      stats: st, bonded: bm, defense: kind.defense, pref: stanceOf(kind.pref, bm),
      speed: SPEED * Math.max(SPEED_FLOOR, Math.pow(rel(st.agi, ref.agi), STAT_EXP.speed)),
      cdMul: Math.pow(rel(ref.agi, st.agi), STAT_EXP.cd),
      dmgRef: ref.maxHp, read: 0, strafe: side === 0 ? 1 : -1, nextDecide: side, dotPerS: 0, tac: new Set(e.tactics ?? []),
    },
  }
}

/** her stance follows the move she throws: a far kind holding a NEAR move stands in to STANCE.near. Before M238 every
 *  kind threw one fixed move and its pref was tuned to it; a drawn near move left a far kind standing where it never
 *  lands (clash-sim 11-27: far kinds lost, guard pairs stalled to the cap). A near kind with a far move keeps her pref
 *  (standing her off too made near kinds lose: sim). */
export const STANCE = { near: 2.2 }
export function stanceOf(pref: number, b: Pick<ClashMove, 'range' | 'power'>): number {
  if (b.power <= 0 || !Number.isFinite(b.range)) return pref
  return b.range > 2.5 ? pref : Math.min(pref, STANCE.near)
}
/** M238: the bonded move a side throws (resolveBonded on the fight seed, one draw per side), twisted */
export const bondSeed = (seed: number, side: 0 | 1) => (seed * 2 + side + 0x238) >>> 0
function bondedOfEntrant(e: Entrant, seed: number, side: 0 | 1): ClashMove {
  const b = resolveBonded(e, bondSeed(seed, side))
  return twisted(clashMoveOf(entrantKnown(e).find(m => m.id === b.id) ?? MOVE_MANA_PULSE), b.twist)
}
export function createFight(a: Entrant, b: Entrant, seed: number): FightState {
  const ref = refOf(Math.round((a.level + b.level) / 2))
  const f: [Fighter, Fighter] = [mkFighter(a, 0, ref, seed), mkFighter(b, 1, ref, seed)]
  for (const x of f) x.maxHp = x.hp
  const s: FightState = { tick: 0, t: 0, seed, rng: (seed ^ 0x9e3779b9) >>> 0, f, over: false, winner: null, reason: null, ref }
  for (const x of f) {
    const foe = f[1 - x.side]
    const edge = (x._.stats.agi - foe._.stats.agi) / Math.max(1, ref.agi)
    // evading is quickness (AGI decides it); guarding is bracing, so AGI only nudges it
    x._.read = x._.defense === 'evade' ? clamp(READ.base + READ.perAgi * edge, READ.min, READ.max) : clamp(READ.guardBase + READ.guardPerAgi * edge, READ.min, READ.max)
  }
  return s
}

const dist = (a: Fighter, b: Fighter) => Math.hypot(b.x - a.x, b.z - a.z)
const busy = (f: Fighter) => f.act.kind !== 'idle' && f.act.kind !== 'reposition'
const begin = (f: Fighter, kind: ActKind, phase: Phase, dur: number, extra: Partial<Act> = {}) => { f.act = { kind, phase, t: 0, dur, ...extra } }

/** the keeper's CHEER: once a match, she regains CHEER_HEAL of max HP. false if spent, she is down, or the fight is over. */
export function cheer(s: FightState, side: 0 | 1, ev?: FightEvent[]): boolean {
  const f = s.f[side]
  if (s.over || f.cheered || f.hp <= 0) return false
  f.cheered = true
  f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * CHEER_HEAL))
  ev?.push({ kind: 'cheer', side })
  return true
}

/** what an attack of hers would do to the foe (no roll): used by the foe's read and by the hit */
function dmgOf(s: FightState, atk: Fighter, def: Fighter, power: number, cat: 'phys' | 'spirit', el: BattleElement): number {
  const a = cat === 'phys' ? atk._.stats.pwr : atk._.stats.foc, d = cat === 'phys' ? def._.stats.grd : def._.stats.res
  const ra = cat === 'phys' ? s.ref.pwr : s.ref.foc, rd = cat === 'phys' ? s.ref.grd : s.ref.res
  const ratio = Math.pow((a / ra) / Math.max(0.2, d / rd), STAT_EXP.dmg)
  const eff = getEffectiveness(el, toBattleElement(def.element))
  const fat = s.t > FATIGUE.from ? 1 + (s.t - FATIGUE.from) * FATIGUE.perS : 1
  return s.ref.maxHp * DMG_K * (power / MELEE.power) * ratio * eff * fat * (atk.weakT > 0 ? 0.75 : 1) * (def.braceT > 0 ? 0.6 : 1)
}

/** MELEE lands with her stronger attack: a body strike (PWR vs GRD) or, for a caster, a close burst of mana (FOC vs RES) */
export const meleeCat = (f: Fighter): 'phys' | 'spirit' => (f._.stats.pwr >= f._.stats.foc * MELEE_FOC ? 'phys' : 'spirit')

function land(s: FightState, atk: Fighter, def: Fighter, kind: 'melee' | 'bonded', ev: FightEvent[]) {
  const mv = kind === 'bonded' ? atk._.bonded : null
  const range = kind === 'melee' ? MELEE.range : mv!.range
  const moveId = mv?.id
  if (mv && mv.power === 0) { selfRider(s, atk, mv, ev); return }
  if (dist(atk, def) > range + (range <= 2.5 ? CLOSE_SLACK : 0.4)) { ev.push({ kind: 'miss', side: atk.side, move: kind, moveId }); return }
  if (def.iframeT > 0) { ev.push({ kind: 'evaded', side: def.side, move: kind, moveId }); return }
  const el: BattleElement = mv ? mv.element : 'neutral'
  const clean = rnd(s) < LUCK.clean
  let dmg = dmgOf(s, atk, def, mv ? mv.power : MELEE.power, mv ? mv.cat : meleeCat(atk), el) * (1 - LUCK.roll + 2 * LUCK.roll * rnd(s)) * (clean ? LUCK.cleanMul : 1)
  const guarded = def.act.kind === 'guard' && def.act.phase === 'active'
  if (guarded) dmg *= 1 - DEFENSE.guard.cut
  const d = Math.max(1, Math.round(dmg))
  def.hp = Math.max(0, def.hp - d)
  ev.push({ kind: guarded ? 'guarded' : 'hit', side: atk.side, move: kind, moveId, dmg: d, eff: getEffectiveness(el, toBattleElement(def.element)), clean })
  if (!guarded && def.act.kind === 'reposition') begin(def, 'stagger', 'active', 0.25)
  if (mv && mv.rider !== 'none' && !guarded && rnd(s) < mv.riderChance) {
    if (mv.rider === 'drain' || mv.rider === 'mend' || mv.rider === 'brace' || mv.rider === 'haste') selfRider(s, atk, mv, ev, d)
    else {
      if (mv.rider === 'slow') def.slowT = RIDER_S
      if (mv.rider === 'root') def.rootT = RIDER_S / 2
      if (mv.rider === 'weaken') def.weakT = RIDER_S
      if (mv.rider === 'dot') { def.dotT = RIDER_S; def._.dotPerS = def.maxHp * DOT_FRAC / RIDER_S }
      ev.push({ kind: 'rider', side: atk.side, move: 'bonded', moveId, rider: mv.rider })
    }
  }
}
function selfRider(s: FightState, f: Fighter, mv: ClashMove, ev: FightEvent[], dealt = 0) {
  if (mv.rider === 'mend') f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * MEND_FRAC * (mv.power ? 0.35 : 1)))
  else if (mv.rider === 'drain') f.hp = Math.min(f.maxHp, f.hp + Math.round(dealt / 2))
  else if (mv.rider === 'brace') f.braceT = RIDER_S + 1
  else if (mv.rider === 'haste') f.hasteT = RIDER_S + 1
  if (mv.rider !== 'none') ev.push({ kind: 'rider', side: f.side, move: 'bonded', moveId: mv.id, rider: mv.rider })
}

/** the foe just began a wind-up: does she read it, and answer with her defense? (once per foe action) */
function react(s: FightState, me: Fighter, foe: Fighter, ev: FightEvent[]) {
  // she can answer while free, while recovering, or by dropping her own melee wind-up (a read beats a trade)
  const free = !busy(me) || me.act.phase === 'recover' || (me.act.kind === 'melee' && me.act.phase === 'windup')
  if (foe.act.phase !== 'windup' || foe.act.read || !free || me.cd.defense > 0 || me.rootT > 0) return
  foe.act.read = true
  const mv = foe.act.kind === 'bonded' ? foe._.bonded : null
  if (mv && mv.power === 0) return
  const reach = foe.act.kind === 'melee' ? MELEE.range : mv!.range
  if (dist(me, foe) > reach + 1) return
  const tac = me._.tac
  // M233 v2c saveDefense: the foe's bonded move is strong against her and nearly ready -> let the melee through, keep the dodge
  if (tac.has('saveDefense') && foe.act.kind === 'melee' && foe._.bonded.power > 0 && foe.cd.bonded <= 2
    && getEffectiveness(foe._.bonded.element, toBattleElement(me.element)) > 1) { ev.push({ kind: 'tactic', side: me.side, tactic: 'saveDefense' }); return }
  const roll = rnd(s)
  if (tac.has('watchBonded')) {
    // M233 v2c watchBonded: her attention moves to the big move (a bonded wind-up read more, a melee one less)
    const r = clamp(me._.read + (foe.act.kind === 'bonded' ? 0.15 : -0.15), 0.05, 0.85)
    if ((roll < r) !== (roll < me._.read)) ev.push({ kind: 'tactic', side: me.side, tactic: 'watchBonded' })
    if (roll >= r) return
  } else if (roll >= me._.read) return
  const left = foe.act.dur - foe.act.t
  if (me._.defense === 'evade') {
    if (left > DEFENSE.evade.time + 0.1) { foe.act.read = false; return }   // too early to dash: look again next tick
    const ang = Math.atan2(me.x - foe.x, me.z - foe.z) + (rnd(s) < 0.5 ? 1 : -1) * Math.PI / 2.4
    begin(me, 'evade', 'active', DEFENSE.evade.time, { dx: Math.sin(ang), dz: Math.cos(ang) })
    me.iframeT = DEFENSE.evade.iframe
    me.cd.defense = DEFENSE.evade.cooldown * me._.cdMul
  } else {
    begin(me, 'guard', 'active', Math.max(DEFENSE.guard.time, left + 0.15))
    me.cd.defense = DEFENSE.guard.cooldown * me._.cdMul
  }
  ev.push({ kind: 'start', side: me.side, move: me._.defense })
}

/** a utility pick each decision tick: range, her HP, her cooldowns. Readable on purpose. M233 v2c: her lessons' tactics shift
 *  the pick (plan with them); when the pick differs from the one without them, a 'tactic' event names each shift that applied. */
type Cand = { w: number; key: string; run: (s: FightState, ev: FightEvent[]) => void }
function plan(me: Fighter, foe: Fighter, tac: ReadonlySet<Tactic>, used: Set<Tactic>): Cand[] {
  const d = dist(me, foe), b = me._.bonded, hpF = me.hp / me.maxHp
  const has = (t: Tactic, cond: boolean) => { if (cond && tac.has(t)) { used.add(t); return true } return false }
  const cands: Cand[] = []
  const guardUp = has('waitGuard', foe.act.kind === 'guard' && foe.act.phase === 'active')
  const snared = has('shakeOff', me.slowT > 0 || me.rootT > 0)
  const close = (r: number) => (tac.has('closeIn') ? d <= r * 0.9 : d <= r)
  const hurtWait = has('wary', hpF < 0.4 && me.cd.defense > 0 && me.cd.melee <= 0 && d <= MELEE.range)
  const meleeOk = !guardUp && !snared && !hurtWait && me.cd.melee <= 0 && d <= MELEE.range
  if (me.cd.bonded <= 0) {
    const start = (s: FightState, ev: FightEvent[]) => { begin(me, 'bonded', 'windup', b.windup); ev.push({ kind: 'start', side: me.side, move: 'bonded', moveId: b.id }) }
    if (b.power === 0) {
      const want = b.rider === 'mend' ? (hpF < 0.6 ? 1.2 : 0) : (d < 4 ? 0.9 : 0.4)
      if (want) cands.push({ w: want, key: 'bonded', run: start })
    } else if (!guardUp && close(b.range)) {
      cands.push({ w: has('baitDodge', meleeOk && foe._.defense === 'evade' && foe.cd.defense <= 0) ? 0.8 : 1.1, key: 'bonded', run: start })
    } else if (tac.has('closeIn') && d <= b.range && !guardUp) used.add('closeIn')
  }
  if (meleeOk) {
    const keen = me._.pref <= 2.5 || has('pressMelee', true) ? 1.0 : 0.6
    cands.push({ w: keen, key: 'melee', run: (_s, ev) => { begin(me, 'melee', 'windup', MELEE.windup); ev.push({ kind: 'start', side: me.side, move: 'melee' }) } })
  }
  // where she wants to stand: in reach of what is ready, else her kind's range; hurt and far-preferring = further
  let want = me._.pref
  if (me.cd.bonded <= 0.5 && b.power > 0) want = has('trustReach', b.range > 2.5) ? b.range * 0.95 : Math.min(want, b.range * 0.8)
  else if (me.cd.melee <= 0.3 && (me._.pref <= 2.5 || me.cd.bonded > 1.5 || has('pressMelee', true))) want = MELEE.range * 0.8   // far kinds dart in while the bonded move rests
  if (hpF < 0.35 && me._.pref > 2.5 && !has('bold', true)) want += 1
  if (has('pressKiter', foe._.pref > 2.5 && me.cd.melee <= 1)) want = Math.min(want, MELEE.range * 0.8)
  if (has('spaceBrawler', foe._.pref <= 2.5 && foe.cd.melee <= 1 && me.cd.melee > (me._.pref > 2.5 ? 0.3 : 3))) want = Math.max(want, MELEE.range + 1.2)
  if (snared) want = Math.max(want, me._.pref + 1)
  const off = d - want
  const radial = clamp(off, -1, 1)
  cands.push({ w: Math.abs(off) > 0.6 ? 0.5 : 0.15, key: `pos:${radial.toFixed(1)}`, run: (s) => {
    const ux = (foe.x - me.x) / (d || 1), uz = (foe.z - me.z) / (d || 1)
    if (rnd(s) < 0.08) me._.strafe *= -1
    const tx = ux * radial + -uz * me._.strafe * 0.45, tz = uz * radial + ux * me._.strafe * 0.45
    const n = Math.hypot(tx, tz) || 1
    begin(me, 'reposition', 'active', DECIDE_EVERY * DT, { dx: tx / n, dz: tz / n })
  } })
  return cands.sort((p, q) => q.w - p.w)
}
const NO_TAC: ReadonlySet<Tactic> = new Set()
function decide(s: FightState, me: Fighter, foe: Fighter, ev: FightEvent[]) {
  const used = new Set<Tactic>()
  const pick = plan(me, foe, me._.tac, used)[0]
  if (me._.tac.size && used.size && plan(me, foe, NO_TAC, new Set())[0].key !== pick.key) for (const t of used) ev.push({ kind: 'tactic', side: me.side, tactic: t })
  pick.run(s, ev)
}

function moveBy(f: Fighter, foe: Fighter, dx: number, dz: number) {
  f.x += dx; f.z += dz
  const r = Math.hypot(f.x, f.z), lim = RING.r - BODY
  if (r > lim) { f.x *= lim / r; f.z *= lim / r }
  const d = dist(f, foe), min = 2 * BODY
  if (d < min && d > 1e-6) { const k = (min - d) / d; f.x -= (foe.x - f.x) * k; f.z -= (foe.z - f.z) * k }
}

/** ONE tick (DT s). `input.cheer[side]` = the keeper pressed cheer this tick. Mutates s, returns this tick's log. */
export function step(s: FightState, input?: { cheer?: [boolean, boolean] }): TickLog {
  const ev: FightEvent[] = []
  if (!s.over) {
    s.tick++; s.t = s.tick * DT
    for (const side of [0, 1] as const) if (input?.cheer?.[side]) cheer(s, side, ev)
    for (const me of s.f) {
      const foe = s.f[1 - me.side]
      for (const k of ['slowT', 'rootT', 'weakT', 'braceT', 'hasteT', 'iframeT'] as const) me[k] = Math.max(0, me[k] - DT)
      if (me.dotT > 0) { me.dotT = Math.max(0, me.dotT - DT); me.hp = Math.max(0, me.hp - me._.dotPerS * DT) }
      const tick = me.hasteT > 0 ? 1.35 : 1
      me.cd.melee = Math.max(0, me.cd.melee - DT * tick); me.cd.bonded = Math.max(0, me.cd.bonded - DT); me.cd.defense = Math.max(0, me.cd.defense - DT)
      const a = me.act
      a.t += DT
      if (a.kind === 'reposition' && me.rootT <= 0) {
        const v = me._.speed * (me.slowT > 0 ? 0.6 : 1) * (me.hasteT > 0 ? 1.25 : 1) * DT
        moveBy(me, foe, (a.dx ?? 0) * v, (a.dz ?? 0) * v)
      }
      if (a.kind === 'evade' && me.rootT <= 0) {
        const v = DEFENSE.evade.dash / DEFENSE.evade.time * DT
        moveBy(me, foe, (a.dx ?? 0) * v, (a.dz ?? 0) * v)
      }
      if (a.kind !== 'evade') me.face = Math.atan2(foe.x - me.x, foe.z - me.z)
      if (a.t >= a.dur - 1e-9) {
        if ((a.kind === 'melee' || a.kind === 'bonded') && a.phase === 'windup') {
          land(s, me, foe, a.kind, ev)
          if (a.kind === 'melee') me.cd.melee = MELEE.cooldown * me._.cdMul
          else me.cd.bonded = me._.bonded.cooldown * me._.cdMul
          begin(me, a.kind, 'recover', a.kind === 'melee' ? MELEE.recover : me._.bonded.recover)
        } else if ((a.kind === 'evade' || a.kind === 'guard') && a.phase === 'active') {
          begin(me, a.kind, 'recover', a.kind === 'evade' ? DEFENSE.evade.recover : DEFENSE.guard.recover)
        } else if (a.kind !== 'idle') begin(me, 'idle', 'active', 0)
      }
    }
    for (const me of s.f) react(s, me, s.f[1 - me.side], ev)
    for (const me of s.f) {
      if (me.act.kind === 'idle' || (me.act.kind === 'reposition' && s.tick >= me._.nextDecide)) {
        if (s.tick >= me._.nextDecide || me.act.kind === 'idle') { decide(s, me, s.f[1 - me.side], ev); me._.nextDecide = s.tick + DECIDE_EVERY + Math.floor(rnd(s) * 3) }
      }
    }
    const down = s.f.filter(f => f.hp <= 0)
    if (down.length) {
      s.over = true; s.reason = 'ko'
      for (const f of down) ev.push({ kind: 'ko', side: f.side })
      s.winner = down.length === 2 ? (s.f[0].hp / s.f[0].maxHp >= s.f[1].hp / s.f[1].maxHp ? 0 : 1) : (down[0].side === 0 ? 1 : 0)
    } else if (s.t >= MAX_S) {
      s.over = true; s.reason = 'time'
      s.winner = s.f[0].hp / s.f[0].maxHp >= s.f[1].hp / s.f[1].maxHp ? 0 : 1
    }
    if (s.over) ev.push({ kind: 'end', side: s.winner! })
  }
  return { tick: s.tick, t: s.t, f: [snap(s.f[0]), snap(s.f[1])], ev }
}
const snap = (f: Fighter): FighterSnap => ({ x: f.x, z: f.z, face: f.face, hp: Math.round(f.hp), maxHp: f.maxHp, act: f.act.kind, phase: f.act.phase, actT: f.act.t, cheered: f.cheered })

/** the sim's / tests' keeper: cheer once when her HP falls under `at` (null = never cheers) */
export type CheerPolicy = { at: number | null }
/** run a whole fight headless. keepLog = return every TickLog (the renderer replays them). */
export function runFight(a: Entrant, b: Entrant, seed: number, opts: { cheer?: [CheerPolicy, CheerPolicy]; keepLog?: boolean } = {}) {
  const s = createFight(a, b, seed)
  const log: TickLog[] = []
  while (!s.over) {
    const c = opts.cheer
    const press: [boolean, boolean] = [0, 1].map(i => !!c && c[i].at !== null && !s.f[i].cheered && s.f[i].hp / s.f[i].maxHp < c[i].at!) as [boolean, boolean]
    const l = step(s, { cheer: press })
    if (opts.keepLog) log.push(l)
  }
  return { winner: s.winner!, reason: s.reason!, seconds: s.t, hp: [s.f[0].hp / s.f[0].maxHp, s.f[1].hp / s.f[1].maxHp] as [number, number], log, state: s }
}
