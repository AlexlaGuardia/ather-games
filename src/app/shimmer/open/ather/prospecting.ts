// PROSPECTING IN THE WILDS (Alex 11-16: "lets plan this out ..first let's list the crystal node ladder and map them to
// each biome", then his calls). Canon: game/shimmer-skilling.md › Skill 3 (the ladder, "crystal nodes form naturally in
// rocky areas", "channel mana into the node and it fractures, releasing shards", "different crystal types appear in
// different zones") · shimmer-geography.md › crag is "the ground that offers stone, which is the prospector's business".
//
// THIS SEASON'S CRYSTAL ZONES (placement = Alex's call 11-16, like the trees; recorded in CANON_GAPS 5f2eedf):
//   Spirit Meadows  raw · VIOLET (Mana)                         Mana Springs  raw · WATER · rare pure core
//                                                                             (on rock AND the springs' shore stones, Alex: yes)
//   the Scald       raw · STORM · pure core                     the caverns   raw · EARTH · pure core · rare ATHER CRYSTAL
//   Wooded Trails   sparse, an EGG HUNT (Alex: "easter egg hunt vibes"): any of the four elements, and you do not know
//                   which until it shatters · pure core · rare ATHER CRYSTAL (Alex: agreed, caverns + Trails)
//   Twilight Thicket  no stone (0.1% rock), as the Scald has no trees
//
// ★ WHAT A CRYSTAL IS FOR (RULED 11-16, athernyx 3932d39, shimmer-casting-vessels.md › THE LETTER IS MADE AT A
//   RUNESMITH): a dug crystal is a plain GRADED stone, never already a letter. A letter is cut from one common BASE
//   STONE and inscribed with gems, so the crystals are the INK and every word has a recipe. The base stone's name is
//   Jin's: BLANKSTONE (a letter before it is cut). Every node pays some, because canon says it is "not a hard to get one".
//   Grade is never power (09-27): it is worth and look.
//
// Same verb as forestry: weapon STOWED, click a node within PROSPECT_RANGE, the Prospecting focus (engine/tools.ts: the
// Worn Spike, every keeper's) channels mana per second (M136) and the node fractures. XP and respawn are canon's table
// (20 / 60 / 150 / 400 · 2 / 10 / 20 / 45 min); NO level gate (M136, Alex 11-24); a fractured node grows back.
//
// ★ PURE but for the guarded localStorage load/save and a tiny subscribe store (as forestry.ts).

import { CRYSTAL_DIAL, HIGH_GEM_DIAL, SEEP_DIAL, STONE_DIAL, type GatherDial } from './gather-dials'
import { addOpenXp, type Zone } from './forestry'
import { perkFires, activeCompanion, perkLabel, GEM_DROP_CHANCE, GEM_ITEM } from '../shared/companion'
import { gardenKey } from '@/lib/keeper-local'
import { ownerSlot } from '../shared/owner-store'
import { isKeeperNode, onKeeperNodes, setSpent, spentUntil, waitClock } from './keeper-nodes'   // M153 s1b
import { withDewls } from './dewl'
import { KEEPSTONE_FIND, keepstoneFor } from './furniture'
import { rollHerb, CRYSTAL_HERB } from './infusions'   // M204

/** what stands on the rock. `egg` = a Wooded Trails element node: which element is only known when it shatters. */
export type CrystalKind = 'raw' | 'violet' | 'storm' | 'earth' | 'water' | 'egg' | 'pure' | 'ather' | SeepKind | 'stone'
export const CRYSTAL_KINDS: CrystalKind[] = ['raw', 'violet', 'storm', 'earth', 'water', 'egg', 'pure', 'ather', 'seep_s', 'seep_m', 'seep_l', 'stone']
// ★ M185 s2 (RULED athernyx c73ab4e, CANON_GAPS 'The four gems as the Wilds' mining nodes'): MANA SEEPS. Mana seeps out of a gap
// in the ground, pools in one spot and crystallises into raw mana shards; small / medium / large by the leak, the bigger the
// more shards and the rarer. On screen it is a 'mana seep', NEVER a spring or a well (mana-well = the Anemonyx fountain), and
// it is drawn as a low crystal tent over a crack (crystal-nodes.tsx › Seeps, look B), never a fountain. In the Wilds a seep takes the slot a raw node
// had (crystalFor), so no node id moved; the 'raw' kind stays for old placed scenery and the glade's keeper nodes.
// Worked with the spike like any node (Prospecting), its own dial (gather-dials.ts › SEEP_DIAL), canon's lowest grade.
export type SeepKind = 'seep_s' | 'seep_m' | 'seep_l'
export const SEEPS: readonly SeepKind[] = ['seep_s', 'seep_m', 'seep_l']
export const isSeep = (k: string): k is SeepKind => (SEEPS as readonly string[]).includes(k)
/** raw mana shards a seep gives: [min, max] (the companion's perk may add one) */
export const SEEP_SHARDS: Record<SeepKind, readonly [number, number]> = { seep_s: [1, 2], seep_m: [2, 4], seep_l: [4, 7] }
/** of the seeps the Wilds place, the share of each size (small common, large rare) */
export const SEEP_SHARE: Record<SeepKind, number> = { seep_s: 0.6, seep_m: 0.3, seep_l: 0.1 }
/** a raw-node roll's place inside its band (0..1) → which seep stands there */
export const seepOf = (u: number): SeepKind => (u < SEEP_SHARE.seep_s ? 'seep_s' : u < SEEP_SHARE.seep_s + SEEP_SHARE.seep_m ? 'seep_m' : 'seep_l')
// ★ M185 s3 (Alex 11-26: "stone nodes apear near the other nodes like chains so a player can find groups of nodes"; placement +
// numbers are Jin's, RULED c73ab4e): STONE. A plain boulder that pays BLANKSTONE (the base stone every letter, brick and stucco
// starts from), no crystal. Stones never stand alone: wilds.ts walks a CHAIN of them out from a crystal node or a seep
// (stoneChain), so where you find one node you find a string of them. Any spike works it (STONE_DIAL), canon's lowest grade.
export const isStone = (k: string): k is 'stone' => k === 'stone'
/** blankstone a stone gives: [min, max] (the companion's perk may add one) */
export const STONE_BLANKS = [2, 4] as const
/** the chain: how often a node has one, how many stones, how far the first stands off the node and each next from the last (m),
 *  how much the walk may bend at each step (rad). Placeholder numbers (Jin's, 11-26). */
export const STONE_CHAIN = { p: 0.3, min: 3, max: 5, first: 3, step: [2.2, 3.2] as const, turn: 0.7 }
/** a node's own deterministic rolls, from its id (the chain must never move: a worked stone's id is saved) */
export function idRoll(id: string): (salt: number) => number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
  return (salt: number) => {
    let x = Math.imul(h ^ Math.imul(salt + 1, 0x9e3779b1), 0x85ebca6b)
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296
  }
}
/** The stones walked out from one node: offsets from it (m) with their index k, or [] when this node has none. Stone k's id is
 *  `${node id}s${k}`. `fits(dx, dz)` says whether a stone may stand there (water, cliff, trunk, path, another node): a blocked
 *  step bends to the other side and further (BENDS) before that stone is given up, so a chain wraps round what is in its way. */
/** no two nodes of a chain closer than this (m) */
export const STONE_GAP = 1.6
export const BENDS = [0, 0.9, -0.9, 1.8, -1.8, 2.7, -2.7] as const
export function stoneChain(roll: (salt: number) => number, fits: (dx: number, dz: number) => boolean = () => true): { dx: number; dz: number; k: number }[] {
  const C = STONE_CHAIN
  if (roll(0) >= C.p) return []
  const n = C.min + Math.min(C.max - C.min, Math.floor(roll(1) * (C.max - C.min + 1)))
  let a = roll(2) * Math.PI * 2, x = 0, z = 0
  const out: { dx: number; dz: number; k: number }[] = []
  for (let k = 0; k < n; k++) {
    if (k) a += (roll(10 + k) * 2 - 1) * C.turn
    const d = k ? C.step[0] + roll(20 + k) * (C.step[1] - C.step[0]) : C.first
    const flip = roll(50 + k) < 0.5 ? 1 : -1
    for (const b of BENDS) {
      const t = a + b * flip, nx = x + Math.cos(t) * d, nz = z + Math.sin(t) * d
      // never back onto the node or its own earlier stones (a bent walk can fold back on itself)
      if (Math.hypot(nx, nz) < STONE_GAP || out.some(p => Math.hypot(p.dx - nx, p.dz - nz) < STONE_GAP) || !fits(nx, nz)) continue
      a = t; x = nx; z = nz; out.push({ dx: x, dz: z, k })
      break
    }
  }
  return out
}
export type Element = 'violet' | 'storm' | 'earth' | 'water'
export const ELEMENTS: Element[] = ['violet', 'storm', 'earth', 'water']
// ★ M185 s1 (RULED athernyx c73ab4e, Magii + Alex 11-26): THE FOUR GEMS ARE THE ELEMENT CRYSTALS. Each grade IS an element's
// crystal: Aqual = water, Dinloid = earth, Fuli = mana, Rhyloid = storm. The old names (Violet / Storm / Earth / Water Crystal)
// retire. The KIND ids and the bag ids (violet_crystal, ...) stay as they were ON PURPOSE: they are storage keys (bags, banks,
// room stores, ground loot, placed scenery `crystal:violet`, letters' ink), so an old keeper's crystals ARE the gems by
// construction and every recipe that asked for one takes the matching gem. Only what a player reads changed.
// Fuli + Rhyloid never sift from rubble (canon: Stonery sifting = the low two only); nothing sifts in the Wilds today.
export const GEM = { water: 'Aqual', earth: 'Dinloid', violet: 'Fuli', storm: 'Rhyloid' } as const
export const CRYSTAL_NAME: Record<CrystalKind, string> = {
  raw: 'Raw Mana', violet: GEM.violet, storm: GEM.storm, earth: GEM.earth, water: GEM.water,
  egg: 'Hidden Crystal', pure: 'Pure Mana Core', ather: 'Ather Crystal',
  seep_s: 'Small Mana Seep', seep_m: 'Medium Mana Seep', seep_l: 'Large Mana Seep',
  stone: 'Stone',
}
/** canon's grade (XP, reset, dewls): the four gems share one (game/shimmer-skilling.md's element row) */
export const TIER: Record<CrystalKind, 1 | 2 | 3 | 4> = { raw: 1, violet: 2, storm: 2, earth: 2, water: 2, egg: 2, pure: 3, ather: 4, seep_s: 1, seep_m: 1, seep_l: 1, stone: 1 }
/** M185 s1: low gems first (Alex's pick, 11-26): Aqual + Dinloid take the Goldwood spike, Fuli + Rhyloid the Shimmeroak. The
 *  hidden one may be any of the four, so it asks the higher one (never a Goldwood back door to Fuli). */
export const HIGH_GEMS: readonly CrystalKind[] = ['violet', 'storm', 'egg']
/** the gather dial a node is worked by (the page, the tool panel) */
export const crystalDial = (kind: CrystalKind): GatherDial => (isStone(kind) ? STONE_DIAL : isSeep(kind) ? SEEP_DIAL[kind] : HIGH_GEMS.includes(kind) ? HIGH_GEM_DIAL : CRYSTAL_DIAL[TIER[kind]])
/** canon's ladder: XP, respawn (game/shimmer-skilling.md › Prospecting) */
export const XP = [0, 20, 60, 150, 400] as const
export const RESPAWN_MS = CRYSTAL_DIAL.map(d => d.respawnMs)
export const PROSPECT_RANGE = 10

/** the bag ids (world/resources.ts › NODE_DEFS drops) and the base stone */
export const BLANKSTONE = 'blankstone'
export const CRYSTAL_ITEM: Record<Exclude<CrystalKind, 'egg'>, string> = {
  raw: 'raw_mana_shard', violet: 'violet_crystal', storm: 'storm_crystal', earth: 'earth_crystal', water: 'water_crystal',
  pure: 'pure_mana_core', ather: 'ather_crystal',
  seep_s: 'raw_mana_shard', seep_m: 'raw_mana_shard', seep_l: 'raw_mana_shard',
  stone: 'blankstone',
}

// biome ids, matched to wilds.ts › BIOME (literal, as forestry.ts)
const SHORE = 1, ROCK = 4

/** What stands on one 4 m cell: the chance a node is there, and which. `roll` picks within the zone's mix. */
export function crystalFor(zone: Zone, biome: number, roll: number): { p: number; kind: CrystalKind } | null {
  const c = crystalForRaw(zone, biome, roll)
  // M185 s2: where a raw node stood, a mana seep now pools; its size is where the roll fell inside the raw band
  if (c?.kind === 'raw') return { p: c.p, kind: seepOf((roll - RAW_FROM[zone]) / (1 - RAW_FROM[zone])) }
  return c
}
/** where each zone's raw band starts in crystalForRaw's roll (everything above it was raw) */
const RAW_FROM: Record<Zone, number> = { meadows: 0.22, springs: 0.42, arid: 0.36, caverns: 0.4, trails: 0.42, thicket: 0 }
function crystalForRaw(zone: Zone, biome: number, roll: number): { p: number; kind: CrystalKind } | null {
  switch (zone) {
    case 'meadows':
      return biome === ROCK ? { p: 0.03, kind: roll < 0.22 ? 'violet' : 'raw' } : null
    case 'springs':   // the springs' shore stones carry them too (Alex 11-16): rock is only 6% of the zone
      return biome === ROCK || biome === SHORE ? { p: biome === ROCK ? 0.04 : 0.02, kind: roll < 0.06 ? 'pure' : roll < 0.42 ? 'water' : 'raw' } : null
    case 'arid':
      return biome === ROCK ? { p: 0.02, kind: roll < 0.05 ? 'pure' : roll < 0.36 ? 'storm' : 'raw' } : null
    case 'caverns':
      return biome === ROCK ? { p: 0.02, kind: roll < 0.015 ? 'ather' : roll < 0.08 ? 'pure' : roll < 0.4 ? 'earth' : 'raw' } : null
    case 'trails':    // the egg hunt: sparse, and the elements hide
      return biome === ROCK ? { p: 0.012, kind: roll < 0.02 ? 'ather' : roll < 0.09 ? 'pure' : roll < 0.42 ? 'egg' : 'raw' } : null
    default:          // the Thicket: no stone
      return null
  }
}

// ── the open world's mined nodes (its own save, like forestry's pruned trees) ──────────────────────────────────
const MINED_KEY = 'open.mined.v1'
let mined: Record<string, number> = {}   // node id → when it has grown back (ms)
let rev = 0
const subs = new Set<() => void>()
const bump = () => { rev++; subs.forEach(f => f()) }
export const subscribeProspecting = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const prospectingRev = () => rev
// ★ LAZY + OWNER-AWARE (11-22, same defect as forestry.ts: an eager read at module evaluation read the anonymous garden).
const minedSlot = ownerSlot(() => gardenKey(MINED_KEY), () => { mined = {}; bump() })
function load(): void {
  if (!minedSlot.due()) return
  mined = {}
  try { const m = JSON.parse(localStorage.getItem(gardenKey(MINED_KEY)) ?? 'null'); if (m && typeof m === 'object' && !Array.isArray(m)) mined = m } catch { /* fresh */ }
}
const save = (now = Date.now()) => {
  load()
  for (const k of Object.keys(mined)) if (mined[k] <= now) delete mined[k]
  if (minedSlot.writable()) try { localStorage.setItem(gardenKey(MINED_KEY), JSON.stringify(mined)) } catch { /* private window */ }
}
onKeeperNodes(bump)
if (typeof window !== 'undefined') {
  setInterval(() => { load(); const now = Date.now(); if (Object.values(mined).some(t => t <= now)) { save(now); bump() } }, 10_000)
}
export const regrowIn = (id: string, now = Date.now()) => { load(); return Math.max(0, (isKeeperNode(id) ? spentUntil(id) : mined[id] ?? 0) - now) }
export const isMined = (id: string, now = Date.now()) => regrowIn(id, now) > 0

/** What working this node would say, without doing it (the prompt reads this). */
export function mineCheck(kind: CrystalKind, id: string, now = Date.now()): { ok: true } | { ok: false; why: string } {
  const left = regrowIn(id, now)
  if (left > 0) return { ok: false, why: `${CRYSTAL_NAME[kind]}, growing back (${waitClock(Math.floor(left / 1000))}).` }
  return { ok: true }
}

export type MineVerdict =
  | { ok: true; drops: { id: string; n: number }[]; xp: number; levelUp: number | null; found: Exclude<CrystalKind, 'egg'>
      /** the companion's perk fired (shared/companion.ts): its label, for the toast */
      perk?: string }
  | { ok: false; why: string }

/** Fracture a node: blankstone always (1–2), its crystal (raw: 1–3 shards), the egg reveals its element. */
export function mine(kind: CrystalKind, id: string, rand: () => number = Math.random, now = Date.now()): MineVerdict {
  const c = mineCheck(kind, id, now)
  if (!c.ok) return c
  const p = minePlan(kind, rand)
  return { ok: true, ...p, ...mineCommit(kind, id, now) }
}
/** What a node gives (rolled, nothing changes): rolled at the first touch, paid whole at the end (channel.ts). */
export function minePlan(kind: CrystalKind, rand: () => number = Math.random): { drops: { id: string; n: number }[]; found: Exclude<CrystalKind, 'egg'>; perk?: string } {
  const found: Exclude<CrystalKind, 'egg'> = kind === 'egg' ? ELEMENTS[Math.min(3, Math.floor(rand() * 4))] : kind
  const tier = TIER[kind]
  const sh = isSeep(found) ? SEEP_SHARDS[found] : isStone(found) ? STONE_BLANKS : null
  // a seep is a pool, not rock: shards only, no blankstone (M185 s2); a stone is blankstone only (M185 s3)
  const drops = sh ? [{ id: CRYSTAL_ITEM[found], n: sh[0] + Math.floor(rand() * (sh[1] - sh[0] + 1)) }]
    : [{ id: BLANKSTONE, n: 1 + (rand() < 0.5 ? 1 : 0) }, { id: CRYSTAL_ITEM[found], n: found === 'raw' ? 1 + Math.floor(rand() * 3) : 1 }]
  // Gemsense (Glowmite @15, Gemdigger @100): a bonus shard of what broke; Gemdigger's pouch now and then a gem too
  let perk: string | undefined
  if (perkFires('prospecting', rand)) {
    const c = activeCompanion()!
    drops[drops.length - 1].n += 1; perk = perkLabel(c)
    if (c.id === 'gemdigger' && rand() < GEM_DROP_CHANCE) drops.push({ id: GEM_ITEM, n: 1 })
  }
  // now and then a crystal node gives up an old UNIQUE Keepstone with its crystal still set (canon 5a20b8f; furniture.ts)
  if (rand() < (KEEPSTONE_FIND[CRYSTAL_ITEM[found]] ?? 0)) drops.push({ id: keepstoneFor(CRYSTAL_ITEM[found]), n: 1 })
  drops.push(...rollHerb(CRYSTAL_HERB[found], rand))   // M204: Violetbloom by a broken Fuli (infusions.ts)
  return { drops: withDewls(drops, tier), found, perk }   // M159: always, beside the usual drop
}
/** The node is done: XP lands on Prospecting and it stays spent till `until` (M136: this cycle's reset, counted from the first touch). */
export function mineCommit(kind: CrystalKind, id: string, now = Date.now(), until = now + crystalDial(kind).respawnMs): { xp: number; levelUp: number | null } {
  const tier = TIER[kind]
  const levelUp = addOpenXp('prospecting', XP[tier])
  load()
  if (isKeeperNode(id)) setSpent(id, until, now); else mined[id] = until
  save(now); bump()
  return { xp: XP[tier], levelUp }
}

/** Test hook: a clean slate of mined nodes (skills live in forestry.ts › _resetForestry). */
export function _resetProspecting() { load(); mined = {}; bump() }
