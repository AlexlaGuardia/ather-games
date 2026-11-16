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
// Worn Spike, every keeper's) channels MANA_COST mana and the node fractures. Level gates, XP and respawn are canon's
// table (1 / 4 / 7 / 10 · 20 / 60 / 150 / 400 · 2 / 10 / 20 / 45 min); a fractured node grows back.
//
// ★ PURE but for the guarded localStorage load/save and a tiny subscribe store (as forestry.ts).

import { NODE_DEFS } from '../../world/resources'
import { addOpenXp, openLevel, type Zone } from './forestry'
import { perkFires, activeCompanion, perkLabel, GEM_DROP_CHANCE, GEM_ITEM } from '../shared/companion'

/** what stands on the rock. `egg` = a Wooded Trails element node: which element is only known when it shatters. */
export type CrystalKind = 'raw' | 'violet' | 'storm' | 'earth' | 'water' | 'egg' | 'pure' | 'ather'
export const CRYSTAL_KINDS: CrystalKind[] = ['raw', 'violet', 'storm', 'earth', 'water', 'egg', 'pure', 'ather']
export type Element = 'violet' | 'storm' | 'earth' | 'water'
export const ELEMENTS: Element[] = ['violet', 'storm', 'earth', 'water']
export const CRYSTAL_NAME: Record<CrystalKind, string> = {
  raw: 'Raw Mana', violet: 'Violet Crystal', storm: 'Storm Crystal', earth: 'Earth Crystal', water: 'Water Crystal',
  egg: 'Hidden Crystal', pure: 'Pure Mana Core', ather: 'Ather Crystal',
}
export const TIER: Record<CrystalKind, 1 | 2 | 3 | 4> = { raw: 1, violet: 2, storm: 2, earth: 2, water: 2, egg: 2, pure: 3, ather: 4 }
/** canon's ladder: level gate, XP, respawn (game/shimmer-skilling.md › Prospecting) */
export const GATE = [0, 1, 4, 7, 10] as const
export const XP = [0, 20, 60, 150, 400] as const
export const RESPAWN_MS = [0, 2, 10, 20, 45].map(m => m * 60_000)
export const PROSPECT_RANGE = 10
export const MANA_COST = NODE_DEFS.raw_mana_node.manaCost   // 7: the node table's prospecting cost

/** the bag ids (world/resources.ts › NODE_DEFS drops) and the base stone */
export const BLANKSTONE = 'blankstone'
export const CRYSTAL_ITEM: Record<Exclude<CrystalKind, 'egg'>, string> = {
  raw: 'raw_mana_shard', violet: 'violet_crystal', storm: 'storm_crystal', earth: 'earth_crystal', water: 'water_crystal',
  pure: 'pure_mana_core', ather: 'ather_crystal',
}

// biome ids, matched to wilds.ts › BIOME (literal, as forestry.ts)
const SHORE = 1, ROCK = 4

/** What stands on one 4 m cell: the chance a node is there, and which. `roll` picks within the zone's mix. */
export function crystalFor(zone: Zone, biome: number, roll: number): { p: number; kind: CrystalKind } | null {
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
const save = (now = Date.now()) => {
  for (const k of Object.keys(mined)) if (mined[k] <= now) delete mined[k]
  try { localStorage.setItem(MINED_KEY, JSON.stringify(mined)) } catch { /* private window */ }
}
if (typeof window !== 'undefined') {
  setInterval(() => { const now = Date.now(); if (Object.values(mined).some(t => t <= now)) { save(now); bump() } }, 10_000)
  try { const m = JSON.parse(localStorage.getItem(MINED_KEY) ?? 'null'); if (m && typeof m === 'object') mined = m } catch { /* fresh */ }
}
export const regrowIn = (id: string, now = Date.now()) => Math.max(0, (mined[id] ?? 0) - now)
export const isMined = (id: string, now = Date.now()) => regrowIn(id, now) > 0

/** What working this node would say, without doing it (the prompt reads this). */
export function mineCheck(kind: CrystalKind, id: string, level = openLevel('prospecting'), now = Date.now()): { ok: true } | { ok: false; why: string } {
  const gate = GATE[TIER[kind]]
  if (level < gate) return { ok: false, why: `Prospecting ${gate} to work ${CRYSTAL_NAME[kind]} (you are ${level}).` }
  const left = regrowIn(id, now)
  if (left > 0) return { ok: false, why: `${CRYSTAL_NAME[kind]}, growing back (${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}).` }
  return { ok: true }
}

export type MineVerdict =
  | { ok: true; drops: { id: string; n: number }[]; xp: number; levelUp: number | null; found: Exclude<CrystalKind, 'egg'>
      /** the companion's perk fired (shared/companion.ts): its label, for the toast */
      perk?: string }
  | { ok: false; why: string }

/** Fracture a node: blankstone always (1–2), its crystal (raw: 1–3 shards), the egg reveals its element. */
export function mine(kind: CrystalKind, id: string, rand: () => number = Math.random, now = Date.now()): MineVerdict {
  const c = mineCheck(kind, id, openLevel('prospecting'), now)
  if (!c.ok) return c
  const found: Exclude<CrystalKind, 'egg'> = kind === 'egg' ? ELEMENTS[Math.min(3, Math.floor(rand() * 4))] : kind
  const tier = TIER[kind]
  const drops = [{ id: BLANKSTONE, n: 1 + (rand() < 0.5 ? 1 : 0) }, { id: CRYSTAL_ITEM[found], n: found === 'raw' ? 1 + Math.floor(rand() * 3) : 1 }]
  // Gemsense (Glowmite @15, Gemdigger @100): a bonus shard of what broke; Gemdigger's pouch now and then a gem too
  let perk: string | undefined
  if (perkFires('prospecting', rand)) {
    const c = activeCompanion()!
    drops[1].n += 1; perk = perkLabel(c)
    if (c.id === 'gemdigger' && rand() < GEM_DROP_CHANCE) drops.push({ id: GEM_ITEM, n: 1 })
  }
  const levelUp = addOpenXp('prospecting', XP[tier])
  mined[id] = now + RESPAWN_MS[tier]
  save(now); bump()
  return { ok: true, drops, xp: XP[tier], levelUp, found, perk }
}

/** Test hook: a clean slate of mined nodes (skills live in forestry.ts › _resetForestry). */
export function _resetProspecting() { mined = {}; bump() }
