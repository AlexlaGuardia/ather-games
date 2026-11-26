// THE TOOL PANEL (BETA M184 s2, Alex 11-25): click / tap a tool dial and it says what the tool in hand does. Pure: every
// number is read from the tables the game itself gathers with, nothing is restated here.
//   the tool: TOOL_DEFS (engine/tools.ts) via toolDial (ui/tool-stage.ts): name, stage, durability, xpBonus
//   the nodes: gather-dials.ts (TREE_DIAL / CRYSTAL_DIAL): a node's mana with this focus's RUNG (focuses.ts › rungOf),
//     the seconds (manaNeed / drain), the reset; the drops: forestry.ts › prunePlan, prospecting.ts › minePlan, dewl.ts
//   TOO WEAK = the mana this focus needs is more than one cycle can give on a full bar and regen alone (cycleBudget): the
//     node resets before a keeper on regen could finish it. One rung low but inside the budget = SLOW (dearer, still doable).
//   the rinstick: rinsticks.ts › easeOf (no nodes; it works the water).
import { TOOL_DEFS, type EquippedTools } from '../../engine/tools'
import { toolDial } from '../../ui/tool-stage'
import { TREE_DIAL, manaNeed, gatherSecs, cycleBudget, type GatherDial } from './gather-dials'
import { rungOf } from './focuses'
import { easeOf } from './rinsticks'
import { TREE_KINDS, TREE_NAME, SAPLING_CHANCE, MAST_CHANCE, logItem, saplingItem } from './forestry'
import { CRYSTAL_KINDS, CRYSTAL_NAME, TIER, BLANKSTONE, CRYSTAL_ITEM, crystalDial } from './prospecting'
import { DEWL, DEWLS_BY_TIER } from './dewl'
import { itemDef } from '../shared/inventory'

export type Verdict = 'ok' | 'slow' | 'weak'
export type NodeRow = { name: string; need: number; mana: number; secs: number; resetMin: number; drops: string; verdict: Verdict }
export type ToolPanel = {
  family: string
  held: boolean
  name: string | null
  /** -1 empty, 0 worn, 1..3 crafted */
  stage: number
  /** null = the worn tool (never wears) or empty */
  uses: number | null
  durability: number | null
  xpMult: number
  rung: number
  /** rinstick only */
  ease: number | null
  rows: NodeRow[]
}

const nm = (id: string) => itemDef(id).name
const pct = (p: number) => `${Math.round(p * 100)}%`
export function verdictOf(d: GatherDial, rung: number): Verdict {
  if (rung >= d.need) return 'ok'
  return manaNeed(d, rung) > cycleBudget(d) ? 'weak' : 'slow'
}
const row = (name: string, d: GatherDial, rung: number, drops: string): NodeRow => ({
  name, need: d.need, mana: Math.round(manaNeed(d, rung)), secs: Math.round(gatherSecs(d, rung)), resetMin: Math.round(d.respawnMs / 60_000), drops, verdict: verdictOf(d, rung),
})

export function treeRows(rung: number): NodeRow[] {
  return TREE_KINDS.map(k => row(TREE_NAME[k], TREE_DIAL[k], rung,
    `${nm(logItem(k))} 2-4 · ${nm(saplingItem(k))} ${pct(SAPLING_CHANCE[k])} · ${nm('mast')} ${pct(MAST_CHANCE)}`))
}
export function crystalRows(rung: number): NodeRow[] {
  // M185 s1: one row per node kind, so the four gems (Aqual, Dinloid, Fuli, Rhyloid) each have their own line, in ladder order;
  // the hidden one is left out (it is found, not listed)
  // (lowest grade first within a need: Aqual before Dinloid, Fuli before Rhyloid, canon world/ather.md › THE FOUR GRADES)
  const ORDER = ['raw', 'water', 'earth', 'violet', 'storm', 'pure', 'ather'] as const
  const kinds = (CRYSTAL_KINDS.filter(k => k !== 'egg') as Exclude<typeof CRYSTAL_KINDS[number], 'egg'>[])
    .sort((a, b) => crystalDial(a).need - crystalDial(b).need || ORDER.indexOf(a) - ORDER.indexOf(b))
  return kinds.map(k => {
    const tier = TIER[k]
    return row(CRYSTAL_NAME[k], crystalDial(k), rung, `${nm(BLANKSTONE)} 1-2 · ${nm(CRYSTAL_ITEM[k])} ${k === 'raw' ? '1-3' : '1'} · ${nm(DEWL)} ${DEWLS_BY_TIER[tier]}`)
  })
}

export function toolPanel(tools: EquippedTools, family: string): ToolPanel {
  const d = toolDial(tools, family)
  const t = (tools as Record<string, { toolId: string; usesRemaining: number; xpBonus?: number } | undefined>)[family]
  const def = d.held && d.toolId ? TOOL_DEFS[d.toolId] : undefined
  const eqp = d.held ? t : undefined
  const rung = rungOf(eqp as never)
  const rows = !d.held ? [] : family === 'forestry' ? treeRows(rung) : family === 'prospecting' ? crystalRows(rung) : []
  return {
    family, held: d.held, name: d.name, stage: d.stage,
    uses: def && !def.basic ? t!.usesRemaining : null, durability: def && !def.basic ? def.durability : null,
    xpMult: def?.xpBonus ?? 1, rung, ease: family === 'rinning' && d.held ? easeOf(eqp as never) : null, rows,
  }
}
