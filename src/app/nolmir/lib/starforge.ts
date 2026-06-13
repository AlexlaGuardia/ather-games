// The Starforge — the tycoon half, Idle-Planet-Miner-shaped.
// Your ship (a young Pyramid node) sits at the center of the system. Planets
// unlock outward, each mined for ORES. Ores transmute to corelight or refine
// into CASTINGS (which will feed the research tree and guard gear).
// Mana (the Crucible's harvest) buys the armory. One loop, two rooms.

import { MatchMods } from './types'
import { mulberry32 } from './rng'
import { GuardCategory, ProfileRole, PROFILES, SkillEffect, profileById, skillEffectFor, starterCollection } from './profiles'

// for now the host owns the whole roster so the equip loop is playable; earning
// / tier-gating new profiles is the next slice.
const ownedForNow = (): string[] => PROFILES.map((p) => p.id)

export const FORGE_KEY = 'nolmir.forge.v2'
const OFFLINE_CAP_MS = 48 * 3600_000 // beyond two days the core settles

// ---- ores ----

export const ORES = ['ferrite', 'lumenglass', 'voidsteel', 'emberore', 'aetherite', 'manapearl'] as const
export type OreId = (typeof ORES)[number]

export const ORE_COLOR: Record<OreId, string> = {
  ferrite: '#94a3b8',
  lumenglass: '#7dd3fc',
  voidsteel: '#6366f1',
  emberore: '#fb923c',
  aetherite: '#2dd4bf',
  manapearl: '#e879f9',
}

// corelight per unit, transmuted
export const ORE_VALUE: Record<OreId, number> = {
  ferrite: 1,
  lumenglass: 2,
  voidsteel: 4,
  emberore: 6,
  aetherite: 10,
  manapearl: 25,
}

// ---- planets of the current system ----
// (Static for now; the WARP will reroll these into generated systems.)

export interface PlanetDef {
  name: string
  ores: Partial<Record<OreId, number>> // base units/sec at level 1
  unlockCost: number // corelight
  trait?: string // generated systems carry quirks; node 1 is plain
  heatMult?: number // volatile worlds burn loud; shielded ones mine quiet
}

// Rebalanced 2026-06-10 (Alex: "maxed in 3 hours — should take time").
// Bot-verified: claim-all-8 ~5.6h focused, deep levels run to days/weeks.
export const PLANETS: PlanetDef[] = [
  { name: 'Cinder', ores: { ferrite: 0.5 }, unlockCost: 400 },
  { name: 'Pale Echo', ores: { ferrite: 0.3, lumenglass: 0.25 }, unlockCost: 1_800 },
  { name: 'Brundt', ores: { ferrite: 0.6, voidsteel: 0.15 }, unlockCost: 7_200 },
  { name: 'Veilmoor', ores: { lumenglass: 0.4, emberore: 0.12 }, unlockCost: 29_000 },
  { name: 'Korrath', ores: { voidsteel: 0.3, emberore: 0.2 }, unlockCost: 110_000 },
  { name: 'Glasswomb', ores: { aetherite: 0.15, lumenglass: 0.5 }, unlockCost: 480_000 },
  { name: 'Null Choir', ores: { aetherite: 0.3, voidsteel: 0.4 }, unlockCost: 2_000_000 },
  { name: 'The Drowned Eye', ores: { manapearl: 0.08, aetherite: 0.2 }, unlockCost: 8_000_000 },
]

export function planetLevelCost(f: ForgeState, idx: number, level: number): number {
  return Math.round(activePlanets(f)[idx].unlockCost * 1.2 * Math.pow(1.75, level - 1))
}

// ---- generated systems (the warp rerolls strategic terrain) ----
// Node 1 is the hand-authored system above. Every system after is seeded:
// fresh names, rerolled ore mixes, richness, one trait each. The long-scan
// in the GATE room shows the next system before you commit.

const SYSTEM_NAMES = [
  'Sorrowlight', 'Brakkenhold', 'Cindermaw', 'Hollowreach', 'Veskarn', 'Mournvale', 'Iristide', 'Duskfall',
  'Ashpetal', 'Greyharbor', 'Kelvenn', 'The Pale Wake', 'Thornquiet', 'Lumenfall', 'Okkrest', 'Vainglass',
  'The Quiet Tooth', 'Embergrave', 'Saltspire', 'Wrenhollow', 'Caulderon', 'Nightloam', 'Virelle', 'Drownmark',
  'Stillwater Deep', 'Korrowind', 'Palechant', 'The Sunken Choir', 'Marrowgate', 'Femmering', 'Ghostvein', 'Aldspark',
]

const UNLOCK_LADDER = [400, 1_800, 7_200, 29_000, 110_000, 480_000, 2_000_000, 8_000_000]
// orbit bands: inner worlds carry common ores, the rim carries the rare
const BAND_ORES: OreId[][] = [
  ['ferrite', 'lumenglass'],
  ['ferrite', 'lumenglass'],
  ['ferrite', 'voidsteel'],
  ['lumenglass', 'voidsteel'],
  ['voidsteel', 'emberore'],
  ['emberore', 'aetherite'],
  ['aetherite', 'voidsteel'],
  ['manapearl', 'aetherite'],
]

export function genSystem(seed: number): PlanetDef[] {
  const rng = mulberry32(seed)
  const names = [...SYSTEM_NAMES]
  const out: PlanetDef[] = []
  for (let i = 0; i < 8; i++) {
    const name = names.splice(Math.floor(rng() * names.length), 1)[0]
    let richness = 0.8 + rng() * 0.7
    let rateMult = 1
    let unlockMult = 1
    let trait: string | undefined
    let heatMult: number | undefined
    const roll = rng()
    if (roll < 0.15) {
      trait = 'volatile — mines hot, burns loud'
      rateMult = 1.5
      heatMult = 2
    } else if (roll < 0.3) {
      trait = 'shielded — mines without heating'
      heatMult = 0
    } else if (roll < 0.45) {
      trait = 'rich vein'
      richness += 0.4
    } else if (roll < 0.58) {
      trait = 'pearl-bearing'
    } else if (roll < 0.7) {
      trait = 'barren — cheap, thin'
      rateMult = 0.6
      unlockMult = 0.5
    }
    const band = BAND_ORES[i]
    const ores: Partial<Record<OreId, number>> = {}
    ores[band[0]] = Math.round((0.25 + rng() * 0.35) * richness * rateMult * 100) / 100
    if (rng() < 0.6) ores[band[1]] = Math.round((0.1 + rng() * 0.2) * richness * rateMult * 100) / 100
    if (trait === 'pearl-bearing') ores.manapearl = Math.round(((ores.manapearl ?? 0) + 0.05) * 100) / 100
    out.push({
      name,
      ores,
      unlockCost: Math.round(UNLOCK_LADDER[i] * richness * unlockMult),
      trait,
      heatMult,
    })
  }
  return out
}

// memoized per seed — gen is cheap but the renderers ask every frame
const systemCache = new Map<number, PlanetDef[]>()

export function activePlanets(f: ForgeState): PlanetDef[] {
  const seed = f.systemSeed ?? 0
  if (!seed) return PLANETS
  let sys = systemCache.get(seed)
  if (!sys) {
    sys = genSystem(seed)
    systemCache.set(seed, sys)
  }
  return sys
}

// ---- castings (refined ores — will feed research + guard gear) ----

export interface CastingDef {
  id: string
  name: string
  inputs: Partial<Record<OreId, number>>
  value: number // corelight if transmuted; real worth comes later (research)
  craftSec: number
}

export const CASTINGS: CastingDef[] = [
  { id: 'steelglass', name: 'Steelglass', inputs: { ferrite: 3, lumenglass: 1 }, value: 18, craftSec: 5 },
  { id: 'voidplate', name: 'Voidplate', inputs: { voidsteel: 2, ferrite: 4 }, value: 45, craftSec: 9 },
  { id: 'embershard', name: 'Embershard', inputs: { emberore: 3, aetherite: 1 }, value: 95, craftSec: 14 },
]

// ---- guard sigils (the armory) ----
// Three slots — the host's Three Guards. The GUARD is the collectible shell
// (name + pattern art, Aseprite later); the SIGIL is the upgradable stats,
// fed by mana now and expedition rewards later. Sigils outlive shells.

// A SLOT is now just a REFERENCE — which creature is equipped here. Progression
// moved off the slot onto the owned creature (OwnedGuard) so a guard keeps its
// grind when swapped out and the Crucible can read the same creature's level.
export interface GuardSigil {
  profileId: string // which collectable profile this slot embodies
  name: string // cached profile name (display only)
  glyph: string // cached placeholder mark (display only)
}

// OWNED CREATURE — the source of truth for a creature's progression, intrinsic
// to the profile (not the equip slot), keyed by profileId in ForgeState.owned.
// This is what makes one shared roster work: Expeditions levels your copy from
// use; the Crucible can field the same creature (slice 5) reading its level.
export interface OwnedGuard {
  profileId: string
  level: number // grows from use — see host.ts guard-level curve
  xp: number
  vigor: number // aspect — endurance (hp), mark/mana-bought
  edge: number // aspect — lethality (atk)
  talent: number // walks the equipped profile's skill lineup (0..TALENT_CAP)
}

export function defaultOwned(profileId: string): OwnedGuard {
  return { profileId, level: 1, xp: 0, vigor: 0, edge: 0, talent: 0 }
}

export function defaultOwnedMap(ids: string[]): Record<string, OwnedGuard> {
  return Object.fromEntries(ids.map((id) => [id, defaultOwned(id)]))
}

// fetch (or lazily synth) the owned record for a profile. Callers that MUTATE
// must write back into f.owned[profileId] — this getter is read-safe only.
export function ownedFor(f: ForgeState, profileId: string): OwnedGuard {
  return f.owned?.[profileId] ?? defaultOwned(profileId)
}

// the three equipped slots — start as the host's starter collection (lancer /
// maw / bastion). swapping a slot to another owned profile re-points profileId
// and adopts its name/glyph; progression travels with the CREATURE, not the slot.
export function defaultSigils(): GuardSigil[] {
  return starterCollection().map((id) => {
    const p = profileById(id)
    return { profileId: p.id, name: p.name, glyph: p.glyph }
  })
}

export function vigorCost(o: OwnedGuard): number {
  return Math.round(120 * Math.pow(1.6, o.vigor))
}
export function edgeCost(o: OwnedGuard): number {
  return Math.round(120 * Math.pow(1.6, o.edge))
}
// expedition spoils feed the aspects too — "fed by expedition rewards + mana"
export function marksVigorCost(o: OwnedGuard): number {
  return Math.round(8 * Math.pow(1.6, o.vigor))
}
export function marksEdgeCost(o: OwnedGuard): number {
  return Math.round(8 * Math.pow(1.6, o.edge))
}
// talent walks the skill lineup — pricier, and capped at the lineup length (3)
export const TALENT_CAP = 3
export function marksTalentCost(o: OwnedGuard): number {
  return Math.round(20 * Math.pow(2, o.talent ?? 0))
}
// talent ranks are EARNED — each rank needs a minimum creature level, so skills
// feel like depth, not just coin (slice 4b). rank 1→lv2, rank 2→lv4, rank 3→lv6.
export function talentLevelReq(rank: number): number {
  return rank * 2
}

// +stat per creature level — the gentle curve on top of vigor/edge
export const LEVEL_STAT = 0.04

// champion stats from an owned creature — lv0 aspects are raw patterns; vigor,
// edge, and the creature's LEVEL are what make them monsters
export function championStats(o: OwnedGuard): { name: string; hp: number; atk: number } {
  const lvl = 1 + LEVEL_STAT * Math.max(0, o.level - 1)
  return {
    name: profileById(o.profileId).name,
    hp: Math.round(38 * (1 + 0.15 * o.vigor) * lvl),
    atk: Math.round(8 * (1 + 0.12 * o.edge) * lvl),
  }
}

// profile-aware stats: the creature's progression (championStats) biased by the
// equipped profile's role (bulwark tanky/low-bite, sear glass-cannon, etc.)
// plus the profile's engagement range. this is what Expedition fields.
export function profileChampion(o: OwnedGuard): {
  name: string
  glyph: string
  sprite: string
  hp: number
  atk: number
  range: number
  role: ProfileRole
  category: GuardCategory
  skills: SkillEffect
} {
  const base = championStats(o)
  const p = profileById(o.profileId)
  const eff = skillEffectFor(p.id, o.talent ?? 0) // talent-unlocked lineup
  return {
    name: p.name,
    glyph: p.glyph,
    sprite: p.sprite,
    hp: Math.max(1, Math.round(base.hp * p.hpMult * (eff.hpMult ?? 1))),
    atk: Math.max(1, Math.round(base.atk * p.atkMult * (eff.atkMult ?? 1))),
    range: p.range + (eff.range ?? 0),
    role: p.role,
    category: p.category,
    skills: eff,
  }
}

// ---- research (the refinery's true purpose — castings become knowledge) ----
// Three branches, linear chains: a node opens when the one before it holds
// at least one level. Castings are the fuel; the tree is where they stop
// being inventory and start being power.

export type ResearchBranch = 'core' | 'crucible' | 'expedition'

export interface ResearchDef {
  id: string
  branch: ResearchBranch
  name: string
  line: string
  cap: number
  cost: Partial<Record<string, number>> // casting id -> units at lv 0->1
  costRamp: number
}

export const RESEARCH: ResearchDef[] = [
  // CORE — the forge studies itself
  { id: 'deep-veins', branch: 'core', name: 'Deep Veins', line: '+10% ore rate per level', cap: 5, cost: { steelglass: 4 }, costRamp: 1.7 },
  { id: 'hot-conduits', branch: 'core', name: 'Hot Conduits', line: '+8% corelight rate per level', cap: 5, cost: { steelglass: 6, voidplate: 2 }, costRamp: 1.7 },
  { id: 'lossless-transmute', branch: 'core', name: 'Lossless Transmute', line: '+12% transmute value per level', cap: 4, cost: { voidplate: 5 }, costRamp: 1.8 },
  // CRUCIBLE — the machine sharpens its teeth
  { id: 'guard-lattice', branch: 'crucible', name: 'Guard Lattice', line: '+10% guard hp per level', cap: 5, cost: { steelglass: 5 }, costRamp: 1.7 },
  { id: 'spike-synthesis', branch: 'crucible', name: 'Spike Synthesis', line: '+12% spike damage per level', cap: 5, cost: { voidplate: 4 }, costRamp: 1.7 },
  { id: 'beacon-harmonics', branch: 'crucible', name: 'Beacon Harmonics', line: '+6% mana yield per level', cap: 5, cost: { embershard: 2 }, costRamp: 1.8 },
  // EXPEDITION — the gate learns the breach
  { id: 'gate-capacitors', branch: 'expedition', name: 'Gate Capacitors', line: '+12% gate integrity per level', cap: 5, cost: { steelglass: 5, voidplate: 2 }, costRamp: 1.7 },
  { id: 'salvage-doctrine', branch: 'expedition', name: 'Salvage Doctrine', line: 'squad upgrades 5% cheaper per level', cap: 4, cost: { voidplate: 4 }, costRamp: 1.8 },
]

export function researchLevel(f: ForgeState, id: string): number {
  return f.research?.[id] ?? 0
}

export function researchCost(def: ResearchDef, level: number): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [cid, base] of Object.entries(def.cost)) out[cid] = Math.ceil((base as number) * Math.pow(def.costRamp, level))
  return out
}

// a node is open when its branch predecessor holds at least one level
export function researchOpen(f: ForgeState, def: ResearchDef): boolean {
  const chain = RESEARCH.filter((r) => r.branch === def.branch)
  const idx = chain.findIndex((r) => r.id === def.id)
  if (idx <= 0) return true
  return researchLevel(f, chain[idx - 1].id) >= 1
}

export function canResearch(f: ForgeState, def: ResearchDef): boolean {
  const lv = researchLevel(f, def.id)
  if (lv >= def.cap || !researchOpen(f, def)) return false
  const cost = researchCost(def, lv)
  return Object.entries(cost).every(([cid, n]) => (f.castings[cid] ?? 0) >= n)
}

export function doResearch(f: ForgeState, def: ResearchDef): ForgeState | null {
  if (!canResearch(f, def)) return null
  const lv = researchLevel(f, def.id)
  const cost = researchCost(def, lv)
  const castings = { ...f.castings }
  for (const [cid, n] of Object.entries(cost)) castings[cid] -= n
  return { ...f, castings, research: { ...(f.research ?? {}), [def.id]: lv + 1 } }
}

// what the expedition mode reads off the tree
export function expeditionResearch(f: ForgeState): { gateMult: number; trackCostMult: number } {
  return {
    gateMult: 1 + 0.12 * researchLevel(f, 'gate-capacitors'),
    trackCostMult: Math.max(0.8, 1 - 0.05 * researchLevel(f, 'salvage-doctrine')),
  }
}

// ---- heat (the coupling — mining the core is LOUD) ----
// Heat is how bright this node burns on whatever senses these things.
// It rises with everything the forge does and it is what draws harder
// challenger tiers. Warp will be the only way to shed it.

export function forgeHeat(f: ForgeState): number {
  const sys = activePlanets(f)
  const planetSum = f.planets.reduce((a, b, i) => a + b * (sys[i]?.heatMult ?? 1), 0)
  return Math.round(f.depth * 12 + f.beaconTuning * 8 + (f.rigs - 1) + planetSum + f.conduit * 2)
}

export const HEAT_TIER_2 = 30
export const HEAT_TIER_3 = 90
export const HEAT_SAFE = 60 // below this the supply lines hold themselves

// ---- planet connections (the loop, phase 2) ----
// Claiming a planet is corelight; KEEPING it is mana. Each connected
// planet drains upkeep that scales with heat. Mana short -> the lines
// decay -> ore stops. A challenger taking the vault cuts a line outright.
// This is the spiral: the throttle is yours, the clock is real.

export function heatPressure(f: ForgeState): number {
  return Math.max(0, forgeHeat(f) - HEAT_SAFE) / 150
}

// mana per second across all worked planets
export function upkeepRate(f: ForgeState): number {
  const p = heatPressure(f)
  if (p <= 0) return 0
  const levels = f.planets.reduce((a, b) => a + b, 0)
  return (levels * p) / 3600
}

export function relinkCost(level: number): number {
  return 25 * Math.max(1, level)
}

const CONN_DECAY_PER_HOUR = 8 // % per hour, scaled by unpaid fraction
const CONN_CAP_MS = 48 * 3600_000

// Drains host mana for upkeep over elapsed time; shortfall decays the
// lines instead. Returns the new forge + mana and what happened (for UI).
export function settleConnections(
  f: ForgeState,
  mana: number,
  now: number,
): { forge: ForgeState; mana: number; drained: number; decayed: boolean } {
  const last = f.connTick ?? now
  const dt = Math.min(Math.max(0, now - last), CONN_CAP_MS) / 1000
  const next: ForgeState = { ...f, connections: [...(f.connections ?? f.planets.map(() => 100))], connTick: now }
  if (dt <= 0) return { forge: next, mana, drained: 0, decayed: false }
  const need = upkeepRate(f) * dt
  if (need <= 0) return { forge: next, mana, drained: 0, decayed: false }
  const paid = Math.min(mana, need)
  const shortfall = need > 0 ? (need - paid) / need : 0
  let decayed = false
  if (shortfall > 0) {
    const drop = CONN_DECAY_PER_HOUR * (dt / 3600) * shortfall
    next.connections = next.connections!.map((c, i) => {
      if (f.planets[i] <= 0) return c
      const nc = Math.max(0, c - drop)
      if (nc < c) decayed = true
      return nc
    })
  }
  return { forge: next, mana: mana - paid, drained: paid, decayed }
}

// a vault loss cuts the line to one worked planet — seeded, so live and
// away settles agree
export function cutConnection(f: ForgeState, seed: number): { forge: ForgeState; planet: number | null } {
  const conns = [...(f.connections ?? f.planets.map(() => 100))]
  const candidates = f.planets.map((l, i) => (l > 0 && conns[i] > 0 ? i : -1)).filter((i) => i >= 0)
  if (candidates.length === 0) return { forge: f, planet: null }
  const idx = candidates[seed % candidates.length]
  conns[idx] = 0
  return { forge: { ...f, connections: conns }, planet: idx }
}

export function connectionOf(f: ForgeState, idx: number): number {
  return f.connections?.[idx] ?? 100
}

// ---- THE WARP (the loop, phase 3 — the escape valve) ----
// When the node outpaces you, warp. The ship carries knowledge, the hold,
// the guards, the host. The node keeps its Starforge, still running —
// and sends a sliver home forever. The network of Year-600, founded here.

export const WARP_HEAT = 120

export function canWarp(f: ForgeState): boolean {
  return forgeHeat(f) >= WARP_HEAT
}

// deterministic — the long-scan shows THE next system, not a reroll
export function nextSystemSeed(f: ForgeState): number {
  return ((((f.systemSeed ?? 0) ^ 0x9e3779b9) + (f.node ?? 1) * 2654435761) >>> 0) || 1
}

export function warpPreview(f: ForgeState): {
  seed: number
  planets: PlanetDef[]
  echoesGained: number
  networkGain: number
} {
  const seed = nextSystemSeed(f)
  return {
    seed,
    planets: genSystem(seed),
    echoesGained: Math.floor(forgeHeat(f) / 40),
    // the abandoned node keeps tapping — 0.5% of its LOCAL rate beams back
    networkGain: (forgeRate(f) - (f.networkRate ?? 0)) * 0.005,
  }
}

export function doWarp(f: ForgeState, now: number): ForgeState {
  const p = warpPreview(f)
  const fresh = defaultForge(now)
  return {
    ...fresh,
    node: (f.node ?? 1) + 1,
    systemSeed: p.seed,
    echoes: (f.echoes ?? 0) + p.echoesGained,
    networkRate: (f.networkRate ?? 0) + p.networkGain,
    // the ship's hold: knowledge, castings, the guards, crucible-side levels
    castings: { ...f.castings },
    research: { ...f.research },
    sigils: f.sigils,
    guardPlating: f.guardPlating,
    spikeVenom: f.spikeVenom,
  }
}

// ---- state ----

export interface ForgeState {
  corelight: number
  rigs: number // core-tap arms — base corelight rate
  conduit: number // refine multiplier on the core tap
  depth: number // how deep the tap goes — big multiplier (heat later)
  guardPlating: number // +guard hp (mana)
  spikeVenom: number // +spike damage (mana)
  beaconTuning: number // +mana yield (corelight)
  planets: number[] // level per planet, 0 = locked
  stock: Record<string, number> // ore id -> units
  castings: Record<string, number> // casting id -> units
  refining: string | null // active casting recipe id
  refineCarry: number // fractional seconds carried between settles
  sigils: GuardSigil[] // the three equipped slots — references into the collection
  collection?: string[] // owned profile ids — the roster you equip 3 of
  owned?: Record<string, OwnedGuard> // per-creature progression (level/xp/aspects)
  research: Record<string, number> // node id -> level (the refinery's tree)
  connections?: number[] // per-planet supply line, 0-100 (mana-fed under heat)
  connTick?: number // last upkeep settle
  // ---- the warp (the loop, phase 3) ----
  node?: number // which node this is — 1 is the first waking
  systemSeed?: number // 0/absent = the hand-authored first system
  echoes?: number // core-songs collected at each departure — permanent
  networkRate?: number // corelight/s beamed back by every node left behind
  lastTick: number
}

export function defaultForge(now: number): ForgeState {
  return {
    corelight: 0,
    rigs: 1,
    conduit: 0,
    depth: 0,
    guardPlating: 0,
    spikeVenom: 0,
    beaconTuning: 0,
    planets: PLANETS.map(() => 0),
    stock: Object.fromEntries(ORES.map((o) => [o, 0])),
    castings: Object.fromEntries(CASTINGS.map((c) => [c.id, 0])),
    refining: null,
    refineCarry: 0,
    sigils: defaultSigils(),
    collection: ownedForNow(),
    owned: defaultOwnedMap(ownedForNow()),
    research: {},
    connections: PLANETS.map(() => 100),
    node: 1,
    systemSeed: 0,
    echoes: 0,
    networkRate: 0,
    lastTick: now,
  }
}

// the ship's collection of core-songs — every echo sharpens everything
export function echoMult(f: ForgeState): number {
  return Math.pow(1.03, f.echoes ?? 0)
}

// corelight per second from the core tap (the abandoned network whispers in)
export function forgeRate(f: ForgeState): number {
  return (
    f.rigs * 1 * Math.pow(1.5, f.conduit) * Math.pow(2.2, f.depth) * (1 + 0.08 * researchLevel(f, 'hot-conduits')) * echoMult(f) +
    (f.networkRate ?? 0)
  )
}

// ore units per second, all unlocked planets
export function oreRates(f: ForgeState): Record<OreId, number> {
  const out = Object.fromEntries(ORES.map((o) => [o, 0])) as Record<OreId, number>
  const veins = (1 + 0.1 * researchLevel(f, 'deep-veins')) * echoMult(f)
  const sys = activePlanets(f)
  f.planets.forEach((level, i) => {
    if (level <= 0) return
    // a frayed line ships less; a cut line ships nothing
    const conn = (f.connections?.[i] ?? 100) / 100
    if (conn <= 0) return
    const mult = Math.pow(1.25, level - 1) * veins * conn
    for (const [ore, base] of Object.entries(sys[i].ores)) {
      out[ore as OreId] += (base as number) * mult
    }
  })
  return out
}

// settle elapsed time: core tap + planet ores + active refining
export function settleForge(f: ForgeState, now: number): ForgeState {
  const elapsedMs = Math.min(Math.max(0, now - f.lastTick), OFFLINE_CAP_MS)
  if (elapsedMs <= 0) return { ...f, lastTick: now }
  const sec = elapsedMs / 1000

  const next: ForgeState = {
    ...f,
    stock: { ...f.stock },
    castings: { ...f.castings },
    lastTick: now,
  }

  // core tap
  next.corelight += sec * forgeRate(f)

  // planets
  const rates = oreRates(f)
  for (const ore of ORES) next.stock[ore] = (next.stock[ore] ?? 0) + rates[ore] * sec

  // refining — consumes stock, limited by ingredients
  if (next.refining) {
    const recipe = CASTINGS.find((c) => c.id === next.refining)
    if (recipe) {
      const wantCrafts = Math.floor((sec + next.refineCarry) / recipe.craftSec)
      next.refineCarry = (sec + next.refineCarry) % recipe.craftSec
      let maxByOre = wantCrafts
      for (const [ore, qty] of Object.entries(recipe.inputs)) {
        maxByOre = Math.min(maxByOre, Math.floor((next.stock[ore] ?? 0) / (qty as number)))
      }
      if (maxByOre > 0) {
        for (const [ore, qty] of Object.entries(recipe.inputs)) {
          next.stock[ore] -= maxByOre * (qty as number)
        }
        next.castings[recipe.id] = (next.castings[recipe.id] ?? 0) + maxByOre
      }
    }
  }

  return next
}

// sell the whole ore stockpile for corelight
export function transmuteValue(f: ForgeState): number {
  let v = 0
  for (const ore of ORES) v += Math.floor(f.stock[ore] ?? 0) * ORE_VALUE[ore]
  return Math.round(v * (1 + 0.12 * researchLevel(f, 'lossless-transmute')))
}

export function transmute(f: ForgeState): ForgeState {
  const v = transmuteValue(f)
  const stock = { ...f.stock }
  for (const ore of ORES) stock[ore] = (stock[ore] ?? 0) % 1 // keep fractional dust
  return { ...f, corelight: f.corelight + v, stock }
}

// ---- costs (geometric — the idle-game spine) ----

export function rigCost(f: ForgeState): number {
  return Math.round(25 * Math.pow(1.45, f.rigs - 1))
}
export function conduitCost(f: ForgeState): number {
  return Math.round(400 * Math.pow(3.0, f.conduit))
}
export function depthCost(f: ForgeState): number {
  return Math.round(5000 * Math.pow(5.5, f.depth))
}
export function beaconCost(f: ForgeState): number {
  return Math.round(1000 * Math.pow(2.6, f.beaconTuning))
}
// mana costs — the crucible's harvest, spent
export function platingCost(f: ForgeState): number {
  return Math.round(200 * Math.pow(1.9, f.guardPlating))
}
export function venomCost(f: ForgeState): number {
  return Math.round(150 * Math.pow(1.9, f.spikeVenom))
}

// how the forge sharpens the crucible
export function forgeMods(f: ForgeState): MatchMods {
  return {
    // legacy mana levels still honored; research multiplies on top
    guardHpMult: (1 + 0.12 * f.guardPlating) * (1 + 0.1 * researchLevel(f, 'guard-lattice')),
    spikeDmgMult: (1 + 0.15 * f.spikeVenom) * (1 + 0.12 * researchLevel(f, 'spike-synthesis')),
    // heat pays — the stakes knob rewards the risk it draws (the loop)
    yieldMult:
      (1 + 0.08 * f.beaconTuning) * (1 + 0.06 * researchLevel(f, 'beacon-harmonics')) * (1 + heatPressure(f) * 0.2),
    champions: f.sigils.map((s) => championStats(ownedFor(f, s.profileId))),
  }
}

// ---- persistence (migrates the v1 flat-forge save) ----

export function loadForge(now: number): ForgeState {
  try {
    const raw = localStorage.getItem(FORGE_KEY)
    if (raw) {
      const f = JSON.parse(raw) as ForgeState
      if (Array.isArray(f.planets) && f.planets.length === PLANETS.length && f.stock) {
        if (!Array.isArray(f.sigils) || f.sigils.length !== 3) f.sigils = defaultSigils()
        // collectable-guards migration: seed the roster + back-fill slot profiles
        if (!Array.isArray(f.collection) || f.collection.length === 0) f.collection = ownedForNow()
        f.sigils.forEach((s, i) => {
          if (!s.profileId) {
            const p = profileById(f.collection![i] ?? starterCollection()[i] ?? 'lancer')
            s.profileId = p.id
            s.name = p.name
            s.glyph = p.glyph
          }
        })
        // leveling migration (slice 4b): progression moves OFF the slot onto the
        // owned creature. Fold any legacy per-slot vigor/edge/talent into owned,
        // seed the rest of the collection, back-fill level/xp. Never resets a save.
        if (!f.owned || typeof f.owned !== 'object') f.owned = {}
        for (const s of f.sigils as Array<GuardSigil & { vigor?: number; edge?: number; talent?: number }>) {
          const pid = s.profileId
          if (!pid) continue
          const legacy = { vigor: s.vigor ?? 0, edge: s.edge ?? 0, talent: s.talent ?? 0 }
          const cur = f.owned[pid]
          if (!cur) {
            f.owned[pid] = { profileId: pid, level: 1, xp: 0, ...legacy }
          } else {
            // carry the deeper of the two — a re-migrate never drops investment
            cur.vigor = Math.max(cur.vigor ?? 0, legacy.vigor)
            cur.edge = Math.max(cur.edge ?? 0, legacy.edge)
            cur.talent = Math.max(cur.talent ?? 0, legacy.talent)
          }
          delete s.vigor
          delete s.edge
          delete s.talent
        }
        for (const pid of f.collection!) {
          if (!f.owned[pid]) f.owned[pid] = defaultOwned(pid)
        }
        for (const pid of Object.keys(f.owned)) {
          const o = f.owned[pid]
          o.level = typeof o.level === 'number' && o.level >= 1 ? o.level : 1
          o.xp = typeof o.xp === 'number' ? o.xp : 0
          o.vigor = o.vigor ?? 0
          o.edge = o.edge ?? 0
          o.talent = o.talent ?? 0
        }
        if (!f.research) f.research = {}
        if (!Array.isArray(f.connections) || f.connections.length !== PLANETS.length) {
          f.connections = PLANETS.map(() => 100)
        }
        if (!f.node) f.node = 1
        f.systemSeed = f.systemSeed ?? 0
        f.echoes = f.echoes ?? 0
        f.networkRate = f.networkRate ?? 0
        return f
      }
    }
    // v1 migration — carry the flat forge into the orrery
    const v1raw = localStorage.getItem('nolmir.forge.v1')
    if (v1raw) {
      const v1 = JSON.parse(v1raw)
      const f = defaultForge(now)
      f.corelight = v1.corelight ?? 0
      f.rigs = v1.rigs ?? 1
      f.conduit = v1.conduit ?? 0
      f.depth = v1.depth ?? 0
      f.guardPlating = v1.guardPlating ?? 0
      f.spikeVenom = v1.spikeVenom ?? 0
      f.beaconTuning = v1.beaconTuning ?? 0
      return f
    }
  } catch {}
  return defaultForge(now)
}

export function saveForge(f: ForgeState) {
  try {
    localStorage.setItem(FORGE_KEY, JSON.stringify(f))
  } catch {}
}
