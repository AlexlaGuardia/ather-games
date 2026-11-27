// THE SMITHY'S EDGES AND TIPS (BETA M134 s1, Alex 11-24 + 11-26; RULED athernyx 4d65536). Pure.
// On the TOP pruner (Starwillow Pruner) the keeper fits an EDGE, on the top spike (Starwillow Spike) a TIP, of a metal:
//   Venium (purple ring) = faster + the best XP · Eurleen (gold ring) = lasts longer, a little less mana, the same best XP.
// ★ Canon: an edge is a swappable FITTING the mana runs along, never a sharpened blade. Venium + Eurleen are mortal-side metals
//   (the Ather grows no ore), bought in bulk on the Nyx side (game/economy.md).
// ★ What an edge of ANY metal does: one rung up (focuses.ts › rungOf), so the Starwillow Pruner reaches Tensacia's rung (4) and the
//   spike its equal (5). Tensacia itself is not in the game yet (M135 / M137).
// ★ ONLY THE EDGE WEARS (M133: tools are permanent). One finished node = one use. Below WARN_FRAC of its uses it warns; at 0 it
//   BREAKS AWAY: gone, a new one must be fitted; the tool and its tier stay. Each metal keeps its OWN wear (`left` per metal):
//   fitting a metal whose edge still has wear puts that one back (no metal spent); a broken or never-made one costs FIT_METAL.
// ★ The SPIKE's own ladder was 'to be set': our call (Jin, 11-27) = the pruner's numbers, mirrored.
// Numbers are placeholders to feel (🟨, Alex's queue). Words below = plain labels for @lark.
// The record rides on the tool's own save (open.tools.v1 › EquippedTool.edge), so no new key.
//
// s2 (Alex 11-24, this file): REPAIR before 0 (metal cost scales with the wear used, REPAIR_MAX at most: cheaper than a new edge
//   so mending early pays), REPAIR ALL (repairAllPlan: the total shown FIRST, then repairAll charges it whole or not at all), at 0
//   there is nothing to repair (it broke away; refit). SWAPS = fitEdge: the other metal's kept edge goes on free, else a new one for
//   FIT_METAL; the edge taken off keeps its wear. Metal itself is bought in bulk at the Nyx supplier (business/suppliers.ts).
import { TOOL_DEFS, type EquippedTool, type EquippedTools } from '../../engine/tools'
import type { GatherDial } from './gather-dials'
import { countOf, take, type Inv } from '../shared/inventory'

export type EdgeMetal = 'venium' | 'eurleen'
export const EDGE_METALS: readonly EdgeMetal[] = ['venium', 'eurleen']
export type EdgeState = { on: EdgeMetal | null; left: Partial<Record<EdgeMetal, number>> }
export type EdgedTool = EquippedTool & { edge?: EdgeState }

/** per metal: uses, how much faster the mana runs (drain ×), how much of the mana it takes (×), the XP multiplier */
export const EDGE: Readonly<Record<EdgeMetal, { name: string; uses: number; speed: number; mana: number; xp: number }>> = {
  venium:  { name: 'Venium',  uses: 30, speed: 1.5, mana: 1,    xp: 1.5 },
  eurleen: { name: 'Eurleen', uses: 50, speed: 1,   mana: 0.85, xp: 1.5 },
}
/** metal pieces one new edge takes */
export const FIT_METAL = 3
/** warn when this share of an edge's uses (or less) is left */
export const WARN_FRAC = 0.2
export const warnAt = (m: EdgeMetal) => Math.ceil(EDGE[m].uses * WARN_FRAC)
/** the tools an edge fits: the top tier of each focus family */
export const EDGE_TOOLS = { forestry: 'starwillow_blade', prospecting: 'starwillow_spike' } as const
export type EdgeFamily = keyof typeof EDGE_TOOLS

export const canTakeEdge = (t: EquippedTool | undefined): boolean => !!t && (Object.values(EDGE_TOOLS) as string[]).includes(t.toolId)
/** the metal on the tool now (null = no edge) */
export function edgeOn(t: EquippedTool | undefined): EdgeMetal | null {
  const e = (t as EdgedTool | undefined)?.edge
  if (!canTakeEdge(t) || !e || !e.on || !EDGE[e.on]) return null
  return (e.left[e.on] ?? 0) > 0 ? e.on : null
}
export const edgeLeft = (t: EquippedTool | undefined, m: EdgeMetal) => Math.max(0, (t as EdgedTool | undefined)?.edge?.left[m] ?? 0)

/** a save's edge, cleaned (unknown metals, bad numbers dropped; a fitted metal with nothing left is off) */
export function adoptEdge(v: unknown): EdgeState | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as { on?: unknown; left?: unknown }, left: Partial<Record<EdgeMetal, number>> = {}
  if (o.left && typeof o.left === 'object') for (const m of EDGE_METALS) {
    const n = (o.left as Record<string, unknown>)[m]
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) left[m] = Math.min(EDGE[m].uses, Math.floor(n))
  }
  const on = typeof o.on === 'string' && (EDGE_METALS as string[]).includes(o.on) && (left[o.on as EdgeMetal] ?? 0) > 0 ? o.on as EdgeMetal : null
  if (!on && !Object.keys(left).length) return undefined
  return { on, left }
}

export type Fit = { ok: true; tool: EdgedTool; inv: Inv; spent: number } | { ok: false; why: string }
/** Fit `metal` on the tool. Its own kept edge (wear left) goes back on for nothing; else a new edge takes FIT_METAL from the bag. */
export function fitEdge(t: EquippedTool | undefined, metal: EdgeMetal, inv: Inv): Fit {
  if (!t || !canTakeEdge(t)) return { ok: false, why: 'Only a Starwillow Pruner or Starwillow Spike takes an edge.' }
  const cur = adoptEdge((t as EdgedTool).edge) ?? { on: null, left: {} }
  if (cur.on === metal) return { ok: false, why: `The ${EDGE[metal].name} edge is already on.` }
  if ((cur.left[metal] ?? 0) > 0) return { ok: true, tool: { ...t, edge: { ...cur, on: metal } }, inv, spent: 0 }
  if (countOf(inv, metal) < FIT_METAL) return { ok: false, why: `Needs ${FIT_METAL} ${EDGE[metal].name}.` }
  const bag = take(inv, metal, FIT_METAL)
  if (!bag) return { ok: false, why: `Needs ${FIT_METAL} ${EDGE[metal].name}.` }
  return { ok: true, tool: { ...t, edge: { on: metal, left: { ...cur.left, [metal]: EDGE[metal].uses } } }, inv: bag, spent: FIT_METAL }
}

export type Wear = { tool: EdgedTool; event: 'none' | 'worn' | 'warn' | 'broke'; metal: EdgeMetal | null; left: number }
/** One finished node: the fitted edge loses a use (the tool itself never). At 0 the edge breaks away. */
export function wearEdge(t: EquippedTool): Wear {
  const m = edgeOn(t)
  if (!m) return { tool: t, event: 'none', metal: null, left: 0 }
  const e = (t as EdgedTool).edge!, n = (e.left[m] ?? 0) - 1
  if (n <= 0) {
    const left = { ...e.left }; delete left[m]
    return { tool: { ...t, edge: { on: null, left } }, event: 'broke', metal: m, left: 0 }
  }
  return { tool: { ...t, edge: { on: m, left: { ...e.left, [m]: n } } }, event: n <= warnAt(m) ? 'warn' : 'worn', metal: m, left: n }
}

/** the node's dial with the fitted edge: Venium runs the mana faster (same total), Eurleen takes a little less */
export function edgeDial<D extends GatherDial>(d: D, t: EquippedTool | undefined): D {
  const m = edgeOn(t)
  if (!m) return d
  const e = EDGE[m]
  return { ...d, drain: d.drain * e.speed, mana: d.mana * e.mana, low: [d.low[0] * e.mana, d.low[1] * e.mana] as const }
}
/** the rung an edge adds (any metal) */
export const edgeRung = (t: EquippedTool | undefined) => (edgeOn(t) ? 1 : 0)
/** the XP multiplier with the edge on (else the tool's own) */
export const edgeXp = (t: EquippedTool | undefined) => { const m = edgeOn(t); return m ? EDGE[m].xp : t?.xpBonus ?? 1 }
/** words (placeholders, @lark) */
export const EDGE_TEXT = {
  warn: (m: EdgeMetal, n: number) => `Your ${EDGE[m].name} edge is wearing thin: ${n} ${n === 1 ? 'use' : 'uses'} left.`,
  broke: (m: EdgeMetal) => `Your ${EDGE[m].name} edge broke away. Fit a new one at the Smithy.`,
  fitted: (m: EdgeMetal) => `${EDGE[m].name} edge fitted.`,
}
// ── s2: REPAIR + REPAIR ALL ──
/** the most metal one repair takes (a nearly-broken edge); a new edge is FIT_METAL, so repairing before 0 is always cheaper */
export const REPAIR_MAX = FIT_METAL - 1
/** metal to bring `metal`'s edge back to full from `left` uses: ceil(REPAIR_MAX x the share worn). Full or broken (0) = 0. */
export function repairCost(metal: EdgeMetal, left: number): number {
  const u = EDGE[metal].uses, l = Math.floor(left)
  if (!(l > 0) || l >= u) return 0
  return Math.ceil(REPAIR_MAX * (u - l) / u)
}
export type Repair = { ok: true; tool: EdgedTool; inv: Inv; spent: number } | { ok: false; why: string }
/** Mend one kept edge (fitted or not) of `metal` to full, paying its own metal. Nothing left = it broke away: refit, not repair. */
export function repairEdge(t: EquippedTool | undefined, metal: EdgeMetal, inv: Inv): Repair {
  if (!t || !canTakeEdge(t)) return { ok: false, why: 'Only a Starwillow Pruner or Starwillow Spike takes an edge.' }
  const cur = adoptEdge((t as EdgedTool).edge), left = cur?.left[metal] ?? 0
  if (!cur || left <= 0) return { ok: false, why: `No ${EDGE[metal].name} edge to repair. Fit a new one.` }
  const cost = repairCost(metal, left)
  if (!cost) return { ok: false, why: `The ${EDGE[metal].name} edge is whole.` }
  const bag = countOf(inv, metal) >= cost ? take(inv, metal, cost) : null
  if (!bag) return { ok: false, why: `Needs ${cost} ${EDGE[metal].name}.` }
  return { ok: true, tool: { ...t, edge: { ...cur, left: { ...cur.left, [metal]: EDGE[metal].uses } } }, inv: bag, spent: cost }
}
export type RepairLine = { fam: EdgeFamily; metal: EdgeMetal; left: number; cost: number }
export type RepairPlan = { lines: RepairLine[]; total: Partial<Record<EdgeMetal, number>>; short: Partial<Record<EdgeMetal, number>> }
/** what REPAIR ALL would mend and cost, every worn kept edge on both tools; `short` = metal missing from the bag (empty = can pay) */
export function repairAllPlan(tools: EquippedTools, inv: Inv): RepairPlan {
  const lines: RepairLine[] = [], total: Partial<Record<EdgeMetal, number>> = {}, short: Partial<Record<EdgeMetal, number>> = {}
  for (const fam of Object.keys(EDGE_TOOLS) as EdgeFamily[]) {
    const t = tools[fam]
    if (!canTakeEdge(t)) continue
    const e = adoptEdge((t as EdgedTool).edge)
    for (const metal of EDGE_METALS) {
      const left = e?.left[metal] ?? 0, cost = repairCost(metal, left)
      if (cost) { lines.push({ fam, metal, left, cost }); total[metal] = (total[metal] ?? 0) + cost }
    }
  }
  for (const m of EDGE_METALS) { const need = total[m] ?? 0, have = countOf(inv, m); if (need > have) short[m] = need - have }
  return { lines, total, short }
}
/** the plan's cost in words, e.g. "2 Venium + 1 Eurleen" (placeholder, @lark) */
export const costText = (total: Partial<Record<EdgeMetal, number>>) => EDGE_METALS.filter(m => total[m]).map(m => `${total[m]} ${EDGE[m].name}`).join(' + ')
export type RepairAll = { ok: true; tools: EquippedTools; inv: Inv; total: Partial<Record<EdgeMetal, number>>; mended: number } | { ok: false; why: string }
/** REPAIR ALL, after the keeper saw repairAllPlan's total: every worn edge to full, the whole cost or nothing changes */
export function repairAll(tools: EquippedTools, inv: Inv): RepairAll {
  const plan = repairAllPlan(tools, inv)
  if (!plan.lines.length) return { ok: false, why: 'Nothing to repair.' }
  if (Object.keys(plan.short).length) return { ok: false, why: `Needs ${costText(plan.total)}.` }
  let bag = inv; const next: EquippedTools = { ...tools }
  for (const l of plan.lines) {
    const r = repairEdge(next[l.fam], l.metal, bag)
    if (!r.ok) return { ok: false, why: r.why }
    next[l.fam] = r.tool; bag = r.inv
  }
  return { ok: true, tools: next, inv: bag, total: plan.total, mended: plan.lines.length }
}
export const REPAIR_TEXT = {
  repaired: (m: EdgeMetal) => `${EDGE[m].name} edge repaired.`,
  all: (n: number, total: Partial<Record<EdgeMetal, number>>) => `${n} ${n === 1 ? 'edge' : 'edges'} repaired for ${costText(total)}.`,
}
export const isTopTool = (id: string) => !!TOOL_DEFS[id] && (Object.values(EDGE_TOOLS) as string[]).includes(id)
