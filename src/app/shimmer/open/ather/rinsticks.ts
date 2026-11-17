// RINSTICKS AT THE RINNSHOP (2026-11-17, play / Jin 30bbef32). Canon (game/shimmer-skilling.md › Rinsticks + Skill 4, the
// 11-16 re-amendment): a rinstick is BUILT FROM RINN (kin calls to kin); the default never breaks, upgrades carry durability;
// the rinn can get away and the reel is a skill; Jin's: "what the rinstick tier eases". The ladder, names, recipes,
// durability and XP bonus are the engine's (engine/tools.ts › TOOL_DEFS, the table play3d + voxel craft from).
//
// ★ WHAT A BETTER RINSTICK DOES HERE: it WIDENS THE REEL'S ZONE (shared/reel.ts › newReel's `ease`), so a rinn's pattern is
//   easier to follow, and it lifts Rinning XP by its own xpBonus. It never makes a rinn bite more or land itself: the keeper
//   still listens to the pattern (canon: asking, not tricking). Each LANDED rinn wears it one use; a rinn that gets away
//   costs the stick nothing (the line never parts). Worn out → the worn starter is back in hand, never empty-handed.
// ★ A rinstick is EQUIPPED, not a bag item: the keeper holds bait and the rinstick comes out (rinning.ts). Saved per keeper
//   (open.tools.v1, keeper-key-specs), with the forestry/prospecting focuses riding the same record for when they upgrade.
import { TOOL_DEFS, ensureBasicTools, makeBasicTool, type EquippedTool, type EquippedTools } from '../../engine/tools'
import { keeperKey } from '@/lib/keeper-local'
import { countOf, take, type Inv } from '../shared/inventory'
import { roomStore, type Works } from './rooms'

export const RINSTICKS = ['basic_rinstick', 'glowfin_rinstick', 'moonkoi_rinstick'] as const
/** The reel zone's width per rinstick tier (worn = 1). A felt step per tier, never a free catch: the tightest tier-4
 *  pattern still needs following at ×1.45. */
export const EASE_BY_TIER = [1, 1.15, 1.3, 1.45] as const
const tierOf = (t: EquippedTool | undefined) => (t && !TOOL_DEFS[t.toolId]?.basic ? TOOL_DEFS[t.toolId]?.tier ?? 0 : 0)
export const easeOf = (t: EquippedTool | undefined) => EASE_BY_TIER[tierOf(t)] ?? 1
export const xpOf = (t: EquippedTool | undefined, xp: number) => Math.round(xp * (t?.xpBonus ?? 1))
export const rinstickName = (t: EquippedTool | undefined) => (t ? TOOL_DEFS[t.toolId]?.name ?? 'rinstick' : 'rinstick')

export type Make = { ok: true; works: Works; inv: Inv; tools: EquippedTools } | { ok: false; why: string }
/** Make + equip a rinstick at the Rinnshop bench: the rinn come from the room's store first, then the bag. Refused while a
 *  BETTER rinstick still has uses (a downgrade would throw it away); the same tier again is a fresh one (a re-make). */
export function makeRinstick(w: Works, roomId: string, inv: Inv, tools: EquippedTools, id: string): Make {
  const def = TOOL_DEFS[id], r = w.rooms.find(x => x.id === roomId)
  if (!def || def.skillId !== 'rinning' || def.basic || !r || r.kind !== 'rinnshop') return { ok: false, why: '' }
  const cur = tools.rinning
  if (tierOf(cur) > def.tier) return { ok: false, why: `Your ${rinstickName(cur)} is better. Use it up first.` }
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

/** A landed rinn wears the rinstick one use. Returns the new tools and, when it wore out, its name (the worn one is back). */
export function wearRinstick(tools: EquippedTools): { tools: EquippedTools; broke: string | null } {
  const t = tools.rinning
  if (!t || TOOL_DEFS[t.toolId]?.basic) return { tools, broke: null }
  const left = t.usesRemaining - 1
  if (left > 0) return { tools: { ...tools, rinning: { ...t, usesRemaining: left } }, broke: null }
  return { tools: { ...tools, rinning: makeBasicTool('rinning') ?? undefined }, broke: rinstickName(t) }
}

export const TOOLS_KEY = 'open.tools.v1'
/** fired after the Rinnshop bench equips a rinstick, so the page (which holds the live tools) reloads them */
export const TOOLS_EVENT = 'open:tools'
export function loadTools(): EquippedTools {
  const out: EquippedTools = {}
  try {
    const v = JSON.parse(localStorage.getItem(keeperKey(TOOLS_KEY)) ?? 'null')
    if (v && typeof v === 'object') for (const [k, t] of Object.entries(v) as [keyof EquippedTools, EquippedTool][])
      if (t && TOOL_DEFS[t.toolId]?.skillId === k && Number.isFinite(t.usesRemaining) && t.usesRemaining > 0) out[k] = t
  } catch { /* fresh */ }
  return ensureBasicTools(out)
}
export function saveTools(t: EquippedTools, announce = false) {
  try { localStorage.setItem(keeperKey(TOOLS_KEY), JSON.stringify(t)) } catch { /* private window */ }
  if (announce && typeof window !== 'undefined') window.dispatchEvent(new Event(TOOLS_EVENT))
}
