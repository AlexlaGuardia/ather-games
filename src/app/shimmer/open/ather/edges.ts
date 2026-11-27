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
// s2 (not here): REPAIR + REPAIR ALL (cost first), metal SWAPS that spend metal, buying metal in bulk on the Nyx side.
import { TOOL_DEFS, type EquippedTool } from '../../engine/tools'
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
export const isTopTool = (id: string) => !!TOOL_DEFS[id] && (Object.values(EDGE_TOOLS) as string[]).includes(id)
