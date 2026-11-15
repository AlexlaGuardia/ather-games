// FORESTRY IN THE WILDS (Alex 11-15: "lets do the tree nodes first lets list the ather tree ladder and then we can match
// them per biome" → his zones). The Ather's four trees (canon: game/shimmer-skilling.md › Forestry) grow by ZONE, the
// layer tools/worldmap/zone_wilds.py stamps on every 200 m node of the continent:
//   meadows → Goldwood · thicket → Shimmeroak inside, Goldwood at the edges · springs → Starwillow by the water ·
//   trails (the Spine's foothills) → Dawnwood, old giants spaced out · arid, caverns → no trees.
// ⚠ Zone ids are BUILD words. Alex's names (Spirit Meadows, Twilight Thicket, Mana Springs, Wooded Trails, Arid Fields,
// caverns + one Voranyx Caverns) are [OPEN] in CANON_GAPS and stay OFF SCREEN until Magii rules. Tree names are canon.
//
// A tree is a node (canon: "walk up to a tree → channel mana → resources drop. Trees don't die — they regrow"): E
// prunes it, the shared node table (world/resources.ts › NODE_DEFS: level 1/4/7/10, drops, XP, regrow) pays out, and the
// tree stands thinned until it regrows. Forestry XP rides the game's own skill engine (engine/skills.ts, canon's curve).
//
// ★ PURE but for the guarded localStorage load/save and a tiny subscribe store.

import { NODE_DEFS } from '../../world/resources'
import { createSkillSet, addSkillXP, skillSetToSave, skillSetFromSave, type SkillSet } from '../../engine/skills'

export type Zone = 'meadows' | 'thicket' | 'springs' | 'trails' | 'arid' | 'caverns'
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
  try { const s = JSON.parse(localStorage.getItem(SKILL_KEY) ?? 'null'); if (Array.isArray(s)) skills = skillSetFromSave(s) } catch { /* fresh */ }
  try { const p = JSON.parse(localStorage.getItem(PRUNE_KEY) ?? 'null'); if (p && typeof p === 'object') pruned = p } catch { /* fresh */ }
}
const save = (now = Date.now()) => {
  try { localStorage.setItem(SKILL_KEY, JSON.stringify(skillSetToSave(skills))) } catch { /* private window */ }
  for (const k of Object.keys(pruned)) if (pruned[k] <= now) delete pruned[k]   // the SAME clock prune used (a test's, or the real one)
  try { localStorage.setItem(PRUNE_KEY, JSON.stringify(pruned)) } catch { /* private window */ }
}
export const forestryLevel = () => skills.forestry.level
/** ms until this tree has regrown, or 0. */
export const regrowIn = (id: string, now = Date.now()) => Math.max(0, (pruned[id] ?? 0) - now)
export const isPruned = (id: string, now = Date.now()) => regrowIn(id, now) > 0

export type PruneVerdict =
  | { ok: true; drops: { id: string; n: number }[]; xp: number; levelUp: number | null }
  | { ok: false; why: string }

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
  const drops = def.drops.filter(d => rand() < d.chance).map(d => ({ id: d.itemId, n: 1 }))
  const r = addSkillXP(skills.forestry, def.xp)   // mutates the skill in place (engine/skills.ts)
  pruned[id] = now + def.respawnMs
  save(now); bump()
  return { ok: true, drops, xp: def.xp, levelUp: r.leveled ? r.newLevel : null }
}

/** Test hook: a clean slate (no storage). */
export function _resetForestry(level = 1) {
  skills = createSkillSet()
  if (level > 1) skills = { ...skills, forestry: { ...skills.forestry, level } }
  pruned = {}; bump()
}
