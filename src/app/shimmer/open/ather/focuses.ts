// BLADES + SPIKES IN THE OPEN WORLD (BETA M17, Alex 11-18). The gathering FOCUSES (canon game/shimmer-skilling.md: channeling
// focuses, not implements; design-briefs/shimmer-gathering-focuses.md: the tier IS the material) get the way rinsticks.ts gave
// rinning its ladder. Names, recipes, durability, xpBonus = the engine's (engine/tools.ts › TOOL_DEFS), untouched.
//
// ★ WHAT A TIER DOES (Alex 07-05, the soft-penalty model): a focus works nodes up to its REACH at the node's own mana cost; a node
//   ABOVE its reach costs DOUBLE mana (it still works: a struggle, never a wall). Reach: the worn starter = tier 1, a crafted tier k
//   = k + 1, so the Goldwood Blade works shimmeroak cleanly and the Starwillow Blade works dawnwood. Plus the focus's xpBonus.
//   Each node finished wears it one use; worn out = the worn starter back in hand, never empty-handed.
// ★ WHICH BENCH: RULED-AFK 11-18 (Magii, athernyx 5626aaf, "a focus binds where its material is worked"): blades at the
//   CARPENTRY bench, spikes at the STONEMASON bench (the Stonery). One constant, BENCH.
import { TOOL_DEFS, makeBasicTool, type EquippedTool, type EquippedTools } from '../../engine/tools'
import { countOf, take, type Inv } from '../shared/inventory'
import { roomStore, type Works, type RoomKind } from './rooms'

export type FocusSkill = 'forestry' | 'prospecting'
export const FOCUSES: Record<FocusSkill, readonly string[]> = {
  forestry: ['goldwood_blade', 'shimmeroak_blade', 'starwillow_blade'],
  prospecting: ['mana_spike', 'crystal_spike', 'pure_spike'],
}
/** PROPOSAL pending Magii (CANON_GAPS 11-18): which room's bench makes each family */
// RULED-AFK 11-18 (Magii, athernyx 5626aaf): a focus binds where its material is worked. ⚠ The Stonery is drawn up, not
// buildable yet (rooms.ts open:false): until it opens, no keeper can make a spike.
export const BENCH: Record<FocusSkill, RoomKind> = { forestry: 'carpentry', prospecting: 'stonemason' }
export const PENALTY = 2

const crafted = (t: EquippedTool | undefined) => !!t && !TOOL_DEFS[t.toolId]?.basic
/** the highest node tier this focus works cleanly */
export const reachOf = (t: EquippedTool | undefined) => (crafted(t) ? (TOOL_DEFS[t!.toolId]?.tier ?? 0) + 1 : 1)
/** the mana a node of `tier` costs with this focus: its own cost up to the reach, double above it */
export const manaFor = (t: EquippedTool | undefined, tier: number, base: number) => (tier > reachOf(t) ? base * PENALTY : base)
/** the extra XP the focus's xpBonus adds on top of the node's own (the node's XP lands in pruneCommit / mineCommit) */
export const bonusXp = (t: EquippedTool | undefined, xp: number) => Math.round(xp * (t?.xpBonus ?? 1)) - xp
export const focusName = (t: EquippedTool | undefined, skill: FocusSkill) => (t ? TOOL_DEFS[t.toolId]?.name ?? '' : skill === 'forestry' ? 'Worn Blade' : 'Worn Spike')

export type Make = { ok: true; works: Works; inv: Inv; tools: EquippedTools } | { ok: false; why: string }
/** Make + equip a focus at its bench: inputs from the room's store first, then the bag (like makeRinstick). Refused while a
 *  BETTER focus of the family still has uses (a downgrade would throw it away); the same tier again is a fresh one. */
export function makeFocus(w: Works, roomId: string, inv: Inv, tools: EquippedTools, id: string): Make {
  const def = TOOL_DEFS[id], r = w.rooms.find(x => x.id === roomId)
  const skill = def?.skillId as FocusSkill
  if (!def || def.basic || !(skill in FOCUSES) || !FOCUSES[skill].includes(id) || !r || r.kind !== BENCH[skill]) return { ok: false, why: '' }
  const cur = tools[skill]
  if (crafted(cur) && (TOOL_DEFS[cur!.toolId]?.tier ?? 0) > def.tier) return { ok: false, why: `Your ${focusName(cur, skill)} is better. Use it up first.` }
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
  return { ok: true, works: { ...w, rooms: w.rooms.map(x => (x.id === roomId ? { ...x, store: stacks } : x)) }, inv: bag!, tools: { ...tools, [skill]: fresh } }
}

/** A finished node wears the focus one use. Worn out: the worn starter is back, and its name comes out for the HUD line. */
export function wearFocus(tools: EquippedTools, skill: FocusSkill): { tools: EquippedTools; broke: string | null } {
  const t = tools[skill]
  if (!crafted(t)) return { tools, broke: null }
  const left = t!.usesRemaining - 1
  if (left > 0) return { tools: { ...tools, [skill]: { ...t!, usesRemaining: left } }, broke: null }
  return { tools: { ...tools, [skill]: makeBasicTool(skill) ?? undefined }, broke: focusName(t, skill) }
}
