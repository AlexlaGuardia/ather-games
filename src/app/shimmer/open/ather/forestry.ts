// FORESTRY IN THE WILDS (Alex 11-15: "lets do the tree nodes first lets list the ather tree ladder and then we can match
// them per biome" → his zones). The Ather's four trees (canon: game/shimmer-skilling.md › Forestry) grow by ZONE, the
// layer tools/worldmap/zone_wilds.py stamps on every 200 m node of the continent:
//   meadows → Goldwood · thicket → Shimmeroak inside, Goldwood at the edges · springs → Starwillow by the water ·
//   trails (the Spine's foothills) → Dawnwood, old giants spaced out · arid, caverns → no trees.
// Zone ids are build words; their NAMES are RULED (11-15: ZONE_NAME below; the dry zone is the Scald; the layer is
// PER-SEASON, this season's shape). Tree names are canon.
//
// A tree is a node (canon: "walk up to a tree → channel mana → resources drop. Trees don't die — they regrow").
// ★ PRUNING FROM A DISTANCE (Alex 11-15: "click a tree from about 10 blocks out and use mana to prune a tree from a
// distance and then the tree could drop a few logs and a small chance for a sapling"): with the weapon STOWED
// (shared/stance.ts) click a tree within PRUNE_RANGE and the Forestry socket's tool works it (engine/tools.ts: Greg's
// Worn Blade, canon's tier-0 focus, "you prune; the light cuts"), MANA_COST mana channels down the
// stream (forestry-fx.tsx draws it), and the tree drops 2–4 LOGS and, rarely, a SAPLING. Logs, not planks: the voxel
// world's 08-13 ruling (tree-node.ts) made a log's whole job to be refined into planks / bark / sap, so the tree pays the
// raw wood. Sapling odds are SMALL on purpose: tree-node's 35 % is for FELLING (the tree is gone); a pruned tree regrows
// in minutes, so a 35 % sapling would be a sapling farm. The node table (world/resources.ts › NODE_DEFS) still sets the
// level gate (1/4/7/10), the XP and the regrow; Forestry XP rides engine/skills.ts (canon's curve).
//
// ★ PURE but for the guarded localStorage load/save and a tiny subscribe store.

import { NODE_DEFS } from '../../world/resources'
import { createSkillSet, addSkillXP, skillSetToSave, skillSetFromSave, type SkillSet, type SkillId } from '../../engine/skills'
import { keeperKey, gardenKey } from '@/lib/keeper-local'

export type Zone = 'meadows' | 'thicket' | 'springs' | 'trails' | 'arid' | 'caverns'
/** This season's zone names (RULED 2026-11-15, game/shimmer-geography.md › THE WILDS' ZONES, THIS SEASON): they may
 *  show. ⛔ The cave that holds the Silt door is NEVER "Voranyx" on screen until the door is understood (the earned name). */
export const ZONE_NAME: Record<Zone, string> = {
  meadows: 'Spirit Meadows', thicket: 'Twilight Thicket', springs: 'Mana Springs', trails: 'Wooded Trails', arid: 'the Scald', caverns: 'the caverns',
}
export type TreeKind = 'goldwood' | 'shimmeroak' | 'starwillow' | 'dawnwood'
export const TREE_KINDS: TreeKind[] = ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood']
export const TREE_NAME: Record<TreeKind, string> = { goldwood: 'Goldwood', shimmeroak: 'Shimmeroak', starwillow: 'Starwillow', dawnwood: 'Dawnwood' }
/** Trunk radius for the walker's bump box (a dawnwood is an ancient, thick trunk). */
export const TRUNK: Record<TreeKind, number> = { goldwood: 0.35, shimmeroak: 0.45, starwillow: 0.32, dawnwood: 0.7 }

// biome ids, matched to wilds.ts › BIOME (kept literal so this file does not import the tile parser)
const SHORE = 1, MEADOW = 2, WOODS = 3

/** What grows on one 4 m cell: the chance a tree stands there, and which. `roll` picks among a zone's mix. */
export function treeFor(zone: Zone, biome: number, canopy: number, roll: number): { p: number; kind: TreeKind } | null {
  switch (zone) {
    case 'arid': case 'caverns': return null
    case 'meadows':
      return biome === WOODS ? { p: 0.42, kind: 'goldwood' } : biome === MEADOW ? { p: 0.012, kind: 'goldwood' } : null
    case 'thicket':   // the groves: shimmeroak where the canopy closes, goldwood at the woods' edges and in the clearings
      return biome === WOODS ? { p: 0.42, kind: canopy >= 0.55 ? 'shimmeroak' : 'goldwood' } : biome === MEADOW ? { p: 0.012, kind: 'goldwood' } : null
    case 'springs':   // by the water: the willows line the banks
      return biome === SHORE ? { p: 0.05, kind: 'starwillow' }
        : biome === WOODS ? { p: 0.3, kind: roll < 0.6 ? 'starwillow' : 'goldwood' }
        : biome === MEADOW ? { p: 0.015, kind: 'starwillow' } : null
    case 'trails':    // the foothills: old giants, spaced out (rarity is the spacing, the trees are big)
      return biome === WOODS ? { p: 0.22, kind: 'dawnwood' } : biome === MEADOW ? { p: 0.009, kind: 'dawnwood' } : null
  }
}

// ── the open world's Forestry (its own save, like its own bag; the voxel world keeps its own) ──────────────────
const SKILL_KEY = 'open.skills.v1', PRUNE_KEY = 'open.pruned.v1'
let skills: SkillSet = createSkillSet()
let pruned: Record<string, number> = {}   // tree id → the time it has regrown (ms)
let rev = 0
const subs = new Set<() => void>()
const bump = () => { rev++; subs.forEach(f => f()) }
export const subscribeForestry = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const forestryRev = () => rev
if (typeof window !== 'undefined') {
  // a tree whose timer ran out redraws whole: every 10 s, if any prune has expired since the last look, tell the scene
  setInterval(() => { const now = Date.now(); if (Object.values(pruned).some(t => t <= now)) { save(now); bump() } }, 10_000)
  try { const s = JSON.parse(localStorage.getItem(keeperKey(SKILL_KEY)) ?? 'null'); if (Array.isArray(s)) skills = skillSetFromSave(s) } catch { /* fresh */ }
  try { const p = JSON.parse(localStorage.getItem(gardenKey(PRUNE_KEY)) ?? 'null'); if (p && typeof p === 'object') pruned = p } catch { /* fresh */ }
}
const save = (now = Date.now()) => {
  try { localStorage.setItem(keeperKey(SKILL_KEY), JSON.stringify(skillSetToSave(skills))) } catch { /* private window */ }
  for (const k of Object.keys(pruned)) if (pruned[k] <= now) delete pruned[k]   // the SAME clock prune used (a test's, or the real one)
  try { localStorage.setItem(gardenKey(PRUNE_KEY), JSON.stringify(pruned)) } catch { /* private window */ }
}
export const forestryLevel = () => skills.forestry.level
/** Any open-world skill's level, and XP granted to it (saved with Forestry's: one open-world skill set). Rinning uses it. */
export const openLevel = (id: SkillId) => skills[id].level
/** Gathering XP multiplier: a Starlight Tincture lifts it (ather/alchemy.ts; the page sets it while the buff runs). */
let xpMult = 1
export const setOpenXpMult = (m: number) => { xpMult = m > 0 ? m : 1 }
const scaled = (xp: number) => Math.round(xp * xpMult)
export function addOpenXp(id: SkillId, xp: number): number | null {
  const r = addSkillXP(skills[id], scaled(xp)); save(); bump()
  return r.leveled ? r.newLevel : null
}
/** The open world's skill set (the HUD's tool sockets read it; addSkillXP mutates it in place, so a ref to it stays live). */
export const openSkills = () => skills
/** ms until this tree has regrown, or 0. */
export const regrowIn = (id: string, now = Date.now()) => Math.max(0, (pruned[id] ?? 0) - now)
export const isPruned = (id: string, now = Date.now()) => regrowIn(id, now) > 0

export const PRUNE_RANGE = 10
export const MANA_COST = NODE_DEFS.goldwood.manaCost   // 5: the node table's forestry cost (every tier the same)
/** Sapling odds per prune (build; tree-node.ts's felling odds are 0.35 / 0.28 / … and a pruned tree comes back). */
export const SAPLING_CHANCE: Record<TreeKind, number> = { goldwood: 0.08, shimmeroak: 0.06, starwillow: 0.05, dawnwood: 0.04 }
/** Mast per prune (BETA M6e; canon 017be29: any pruned Ather tree): bait's floor for a keeper out of bait with nothing landed. 2 bait each, ~3 prunes = a few casts. */
export const MAST_CHANCE = 0.35
export const logItem =(k: TreeKind) => `${k}_log`
export const saplingItem = (k: TreeKind) => `${k}_sapling`

export type PruneVerdict =
  | { ok: true; drops: { id: string; n: number }[]; xp: number; levelUp: number | null }
  | { ok: false; why: string }

/** Where a tree's crown stands (world y of its centre, half its height, its radius) and how tall the trunk is: ONE
 *  answer for the scene that draws it, the aim ray that picks it and the stream that hits it. `f` shrinks a pruned crown. */
export function crownOf(t: { y: number; tall: number; r: number; kind: TreeKind }, f = 1): { cy: number; hh: number; r: number; trunkH: number } {
  if (t.kind === 'starwillow') { const hh = t.tall * 0.45 * f; return { cy: t.y + 1.3 + hh, hh, r: t.r * 1.15 * f, trunkH: 2.8 } }   // the weeping skirt hangs low
  if (t.kind === 'dawnwood') { const hh = t.tall * 0.34 * f; return { cy: t.y + 3.8 + hh, hh, r: t.r * 1.1 * f, trunkH: 4.2 } }
  const hh = t.tall * 0.3 * f
  return { cy: t.y + 2.4 + hh, hh, r: t.r * f, trunkH: 2.8 }
}

// ── the shake: which tree the light is cutting right now (the tree meshes sway that one crown) ─────────────────
let shaking: { id: string; t0: number } | null = null
export const SHAKE_MS = 1100
export function startShake(id: string, now = Date.now()) { shaking = { id, t0: now } }
export const shakeOf = (id: string, now = Date.now()) => (shaking && shaking.id === id && now - shaking.t0 < SHAKE_MS ? (now - shaking.t0) / SHAKE_MS : -1)

/** What pruning would say, without doing it (the prompt reads this). */
export function pruneCheck(kind: TreeKind, id: string, level = forestryLevel(), now = Date.now()): { ok: true } | { ok: false; why: string } {
  const def = NODE_DEFS[kind]
  if (level < def.minLevel) return { ok: false, why: `Forestry ${def.minLevel} to prune ${TREE_NAME[kind]} (you are ${level}).` }
  const left = regrowIn(id, now)
  if (left > 0) return { ok: false, why: `${TREE_NAME[kind]}, regrowing (${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}).` }
  return { ok: true }
}

/** Prune: the node table pays (every drop rolls its chance), XP lands on Forestry, the tree regrows on the table's timer. */
export function prune(kind: TreeKind, id: string, rand: () => number = Math.random, now = Date.now()): PruneVerdict {
  const c = pruneCheck(kind, id, forestryLevel(), now)
  if (!c.ok) return c
  const def = NODE_DEFS[kind]
  const drops = [{ id: logItem(kind), n: 2 + Math.floor(rand() * 3) }]
  if (rand() < SAPLING_CHANCE[kind]) drops.push({ id: saplingItem(kind), n: 1 })
  if (rand() < MAST_CHANCE) drops.push({ id: 'mast', n: 1 })   // bait's floor (inventory.ts › BAIT_FROM)
  const r =addSkillXP(skills.forestry, scaled(def.xp))   // mutates the skill in place (engine/skills.ts)
  pruned[id] = now + def.respawnMs
  save(now); bump()
  return { ok: true, drops, xp: def.xp, levelUp: r.leveled ? r.newLevel : null }
}

/** Test hook: set any open-world skill's level (prospecting.test, rinning checks). */
export function _setOpenLevel(id: SkillId, level: number) { skills = { ...skills, [id]: { ...skills[id], level } }; bump() }
/** Test hook: a clean slate (no storage). */
export function _resetForestry(level = 1) {
  skills = createSkillSet()
  if (level > 1) skills = { ...skills, forestry: { ...skills.forestry, level } }
  pruned = {}; bump()
}
