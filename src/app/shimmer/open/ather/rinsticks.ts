// RINSTICKS AT THE RINNSHOP (2026-11-17, play / Jin 30bbef32). Canon (game/shimmer-skilling.md › Rinsticks + Skill 4, the
// 11-16 re-amendment): a rinstick is BUILT FROM RINN (kin calls to kin); no tool breaks (M133, Alex 11-24);
// the rinn can get away and the reel is a skill; Jin's: "what the rinstick tier eases". The ladder, names, recipes,
// durability and XP bonus are the engine's (engine/tools.ts › TOOL_DEFS, the table play3d + voxel craft from).
//
// ★ WHAT A BETTER RINSTICK DOES HERE: it WIDENS THE REEL'S ZONE (shared/reel.ts › newReel's `ease`), so a rinn's pattern is
//   easier to follow, and it lifts Rinning XP by its own xpBonus. It never makes a rinn bite more or land itself: the keeper
//   still listens to the pattern (canon: asking, not tricking). PERMANENT (M133): no rinn, landed or gone, wears the stick.
// ★ A rinstick is EQUIPPED, not a bag item: the keeper holds bait and the rinstick comes out (rinning.ts). Saved per keeper
//   (open.tools.v1, keeper-key-specs), with the forestry/prospecting focuses riding the same record for when they upgrade.
import { loadTut, socketLit } from './glade-tutorial'
import { TOOL_DEFS, currentToolId, ensureBasicTools, type EquippedTool, type EquippedTools } from '../../engine/tools'
import { keeperKey } from '@/lib/keeper-local'
import { countOf, take, type Inv } from '../shared/inventory'
import { roomStore, type Works } from './rooms'
import { ownedWhy } from './focuses'
import { migrate, fresh, hasStick, RINQUEST_KEY, type RinQuest } from './rinquest'

export const RINSTICKS = ['basic_rinstick', 'glowfin_rinstick', 'moonkoi_rinstick'] as const
/** The reel zone's width per rinstick tier (worn = 1). A felt step per tier, never a free catch: the tightest tier-4
 *  pattern still needs following at ×1.45. */
export const EASE_BY_TIER = [1, 1.15, 1.3, 1.45] as const
const tierOf = (t: EquippedTool | undefined) => (t && !TOOL_DEFS[t.toolId]?.basic ? TOOL_DEFS[t.toolId]?.tier ?? 0 : 0)
export const easeOf = (t: EquippedTool | undefined) => EASE_BY_TIER[tierOf(t)] ?? 1
export const xpOf = (t: EquippedTool | undefined, xp: number) => Math.round(xp * (t?.xpBonus ?? 1))
export const rinstickName = (t: EquippedTool | undefined) => (t ? TOOL_DEFS[t.toolId]?.name ?? 'rinstick' : 'rinstick')

export type Make = { ok: true; works: Works; inv: Inv; tools: EquippedTools } | { ok: false; why: string }
/** Make + equip a rinstick at the Rinnshop bench: the rinn come from the room's store first, then the bag. Refused,
 *  spending nothing, at or below the tier in hand (focuses.ts › ownedWhy). */
export function makeRinstick(w: Works, roomId: string, inv: Inv, tools: EquippedTools, id: string): Make {
  const def = TOOL_DEFS[id], r = w.rooms.find(x => x.id === roomId)
  if (!def || def.skillId !== 'rinning' || def.basic || !r || r.kind !== 'rinnshop') return { ok: false, why: '' }
  const owned = ownedWhy(tools.rinning, id)
  if (owned) return { ok: false, why: owned }
  let stacks = roomStore(r).stacks.map(s => ({ ...s })), bag: Inv | null = inv
  for (const c of def.recipe) {
    const inStore = stacks.reduce((a, s) => a + (s.id === c.itemId ? s.n : 0), 0)
    if (inStore + countOf(inv, c.itemId) < c.count) return { ok: false, why: `Needs ${c.count} ${c.itemId.replace(/_/g, ' ')}.` }
    let need = c.count
    for (const s of stacks) if (need > 0 && s.id === c.itemId) { const t = Math.min(need, s.n); s.n -= t; need -= t }
    stacks = stacks.filter(s => s.n > 0)
    if (need > 0) { bag = bag && take(bag, c.itemId, need); if (!bag) return { ok: false, why: '' } }
  }
  const fresh: EquippedTool = { toolId: id, usesRemaining: def.durability, speedBonus: def.speedBonus, xpBonus: def.xpBonus }
  return { ok: true, works: { ...w, rooms: w.rooms.map(x => (x.id === roomId ? { ...x, store: stacks } : x)) }, inv: bag!, tools: { ...tools, rinning: fresh } }
}

export const TOOLS_KEY = 'open.tools.v1'
/** fired after the Rinnshop bench equips a rinstick, so the page (which holds the live tools) reloads them */
export const TOOLS_EVENT = 'open:tools'
export function loadTools(): EquippedTools {
  const out: EquippedTools = {}
  try {
    const v = JSON.parse(localStorage.getItem(keeperKey(TOOLS_KEY)) ?? 'null')
    if (v && typeof v === 'object') for (const [k, t] of Object.entries(v) as [keyof EquippedTools, EquippedTool][])
      // M185 s1: a retired spike id loads as the spike that took its tier (LEGACY_TOOL_ID)
      if (t && TOOL_DEFS[currentToolId(t.toolId)]?.skillId === k) out[k] = { ...t, toolId: currentToolId(t.toolId), usesRemaining: TOOL_DEFS[currentToolId(t.toolId)].durability }   // M133: permanent; a part-used tool from an older save is whole
  } catch { /* fresh */ }
  ensureBasicTools(out)
  // M68 s3a: a live tutorial keeper's spike + pruner sockets start EMPTY (Otto / Bonn light them, glade-friend-talk.ts);
  // only a WORN tool is held back, never a crafted one already in the save
  const tut = loadTut()
  for (const k of ['forestry', 'prospecting'] as const) if (!socketLit(tut, k) && out[k] && TOOL_DEFS[out[k]!.toolId]?.basic) delete out[k]
  // M22: the WORN rinstick is earned (rinquest.ts); a better one already in the save is never taken
  if (!hasStick(loadQuest()) && out.rinning && TOOL_DEFS[out.rinning.toolId]?.basic) delete out.rinning
  return out
}

// ── the first-rinstick quest's save (BETA M22, rinquest.ts holds the rules) ──
/** No flag = born before M22 = done (migrate); the birth gate writes `fresh()` for a new keeper (markBornWithoutStick). */
export function loadQuest(): RinQuest {
  try { return migrate(JSON.parse(localStorage.getItem(keeperKey(RINQUEST_KEY)) ?? 'null')) } catch { return migrate(null) }
}
/** Saves and tells the page to re-read its tools (the stick appears or goes with the quest's state). */
export function saveQuest(q: RinQuest) {
  try { localStorage.setItem(keeperKey(RINQUEST_KEY), JSON.stringify(q)) } catch { /* private window */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TOOLS_EVENT))
}
/** The birth gate, the moment a NEW keeper chooses their rune: born without the worn rinstick. */
export const markBornWithoutStick = () => saveQuest(fresh())
export function saveTools(t: EquippedTools, announce = false) {
  try { localStorage.setItem(keeperKey(TOOLS_KEY), JSON.stringify(t)) } catch { /* private window */ }
  if (announce && typeof window !== 'undefined') window.dispatchEvent(new Event(TOOLS_EVENT))
}
