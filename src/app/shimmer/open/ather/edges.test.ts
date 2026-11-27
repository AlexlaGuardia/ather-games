// Run: npx tsx src/app/shimmer/open/ather/edges.test.ts   (BETA M134 s1: the Smithy's edges + tips)
// fit sets the right effect per metal · wear ticks only the edge · a warning before 0 · at 0 the edge breaks away and the tool +
// tier stay · refit works · each metal keeps its own wear · save / reload keeps it · the dial ring = the metal's colour + wear.
import { TOOL_DEFS, type EquippedTool, type EquippedTools } from '../../engine/tools'
import { EDGE, FIT_METAL, warnAt, fitEdge, wearEdge, edgeOn, edgeLeft, edgeDial, adoptEdge, canTakeEdge, type EdgedTool } from './edges'
import { rungOf, bonusXp } from './focuses'
import { toolDial, METAL_RING } from '../../ui/tool-stage'
import { toolPanel } from './tool-panel'
import { TREE_DIAL, manaNeed, gatherSecs } from './gather-dials'
import { newInv, give, countOf, type Inv } from '../shared/inventory'
import { loadTools, saveTools, TOOLS_KEY } from './rinsticks'
import { ROOMS } from './rooms'
import { benchTabs } from './bench-tabs'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const eq = (id: string): EquippedTool => ({ toolId: id, usesRemaining: TOOL_DEFS[id].durability, xpBonus: TOOL_DEFS[id].xpBonus, speedBonus: TOOL_DEFS[id].speedBonus })
const bag = (v = 6, e = 6): Inv => give(give(newInv(0), 'venium', v).inv, 'eurleen', e).inv

// ── the Smithy is open and its bench has the Edges tab ──
ok(ROOMS.smith.open === true && benchTabs('smith').includes('edges'), 'the Smithy opens with an Edges tab')

// ── which tools take an edge ──
ok(canTakeEdge(eq('starwillow_blade')) && canTakeEdge(eq('starwillow_spike')), 'the top pruner + spike take an edge')
for (const id of ['worn_blade', 'goldwood_blade', 'shimmeroak_blade', 'worn_spike', 'shimmeroak_spike', 'moonkoi_rinstick'])
  ok(!canTakeEdge(eq(id)) && !fitEdge(eq(id), 'venium', bag()).ok, `${id} takes no edge`)

// ── fit: the effect per metal ──
for (const fam of ['starwillow_blade', 'starwillow_spike']) {
  const base = eq(fam), inv = bag()
  const v = fitEdge(base, 'venium', inv)
  ok(v.ok && v.spent === FIT_METAL && countOf(v.inv, 'venium') === 6 - FIT_METAL && countOf(inv, 'venium') === 6, `${fam}: Venium fit spends ${FIT_METAL}, input untouched`)
  if (!v.ok) continue
  ok(edgeOn(v.tool) === 'venium' && edgeLeft(v.tool, 'venium') === EDGE.venium.uses, `${fam}: Venium on, full`)
  ok(rungOf(v.tool) === rungOf(base) + 1, `${fam}: an edge = one rung more (${rungOf(base)} -> ${rungOf(v.tool)})`)
  const d = TREE_DIAL.dawnwood, dv = edgeDial(d, v.tool)
  ok(dv.drain === d.drain * EDGE.venium.speed && dv.mana === d.mana && EDGE.venium.speed > 1, `${fam}: Venium drains faster, same mana`)
  ok(gatherSecs(dv, 4) < gatherSecs(d, 4) && manaNeed(dv, 4) === manaNeed(d, 4), `${fam}: Venium is quicker at the same total`)
  ok(bonusXp(v.tool, 100) === Math.round(100 * EDGE.venium.xp) - 100 && EDGE.venium.xp > TOOL_DEFS[fam].xpBonus, `${fam}: Venium = the best XP`)
  const e = fitEdge(base, 'eurleen', inv)
  ok(e.ok && edgeOn(e.ok ? e.tool : undefined) === 'eurleen', `${fam}: Eurleen on`)
  if (!e.ok) continue
  const de = edgeDial(d, e.tool)
  ok(de.drain === d.drain && de.mana < d.mana && de.low[0] < d.low[0] && manaNeed(de, 4) < manaNeed(d, 4), `${fam}: Eurleen = a little less mana`)
  ok(EDGE.eurleen.uses > EDGE.venium.uses && EDGE.eurleen.mana < 1 && EDGE.eurleen.mana >= 0.8, 'Eurleen lasts longer, a LITTLE less mana')
  ok(bonusXp(e.tool, 100) === bonusXp(v.tool, 100), `${fam}: Eurleen = the same best XP`)
  ok(edgeDial(d, base) === d && bonusXp(base, 100) === Math.round(100 * TOOL_DEFS[fam].xpBonus) - 100, `${fam}: no edge = the tool's own dial + XP`)
  ok(!fitEdge(v.tool, 'venium', v.inv).ok, `${fam}: the same metal again is refused`)
}
ok(!fitEdge(eq('starwillow_blade'), 'venium', bag(FIT_METAL - 1)).ok, 'too little metal: refused')
// ★ the spike mirrors the pruner (our call): the same numbers; Tensacia's rung (4) for the pruner, the spike one over
ok(rungOf(fitEdge(eq('starwillow_blade'), 'venium', bag()).ok ? (fitEdge(eq('starwillow_blade'), 'venium', bag()) as { tool: EquippedTool }).tool : undefined) === 4, 'edged Starwillow Pruner = rung 4 (Tensacia)')

// ── wear ticks only the edge; warn before 0; break at 0 keeps the tool + tier ──
const f0 = fitEdge(eq('starwillow_blade'), 'venium', bag()); if (!f0.ok) throw new Error('fit')
let t: EdgedTool = f0.tool, events: string[] = [], warnedAt = -1
for (let i = 0; i < EDGE.venium.uses; i++) {
  const w = wearEdge(t); events.push(w.event); t = w.tool
  if (w.event === 'warn' && warnedAt < 0) warnedAt = w.left
  ok(t.toolId === 'starwillow_blade' && t.usesRemaining === TOOL_DEFS.starwillow_blade.durability, `use ${i + 1}: the tool itself never wears`)
}
ok(events.slice(0, EDGE.venium.uses - warnAt('venium') - 1).every(e => e === 'worn'), 'no warning early')
ok(warnedAt === warnAt('venium') && warnedAt > 0, `the warning comes before 0 (at ${warnedAt} left)`)
ok(events[EDGE.venium.uses - 1] === 'broke' && events.filter(e => e === 'broke').length === 1, 'it breaks at the last use, once')
ok(edgeOn(t) === null && edgeLeft(t, 'venium') === 0 && t.toolId === 'starwillow_blade' && rungOf(t) === rungOf(eq('starwillow_blade')), 'broken: the edge is GONE, the tool + its tier stay')
ok(toolDial({ forestry: t }, 'forestry').ringPct === null, 'broken: no ring on the dial')
ok(wearEdge(t).event === 'none' && wearEdge(eq('starwillow_blade')).event === 'none' && wearEdge(eq('goldwood_blade')).event === 'none', 'no edge: nothing wears')
// refit after the break: a new edge, full, costs metal again
const rf = fitEdge(t, 'venium', bag())
ok(rf.ok && rf.spent === FIT_METAL && edgeLeft(rf.tool, 'venium') === EDGE.venium.uses, 'refit after the break: a fresh edge, metal spent')

// ── each metal keeps its own wear ──
let k: EdgedTool = f0.tool
for (let i = 0; i < 5; i++) k = wearEdge(k).tool
const sw = fitEdge(k, 'eurleen', bag()); if (!sw.ok) throw new Error('swap')
ok(edgeOn(sw.tool) === 'eurleen' && edgeLeft(sw.tool, 'venium') === EDGE.venium.uses - 5, 'Eurleen on: the Venium edge keeps its 5 uses of wear')
let k2 = sw.tool; for (let i = 0; i < 3; i++) k2 = wearEdge(k2).tool
ok(edgeLeft(k2, 'eurleen') === EDGE.eurleen.uses - 3 && edgeLeft(k2, 'venium') === EDGE.venium.uses - 5, 'wearing Eurleen leaves Venium alone')
const back = fitEdge(k2, 'venium', newInv(0))
ok(back.ok && back.spent === 0 && edgeOn(back.tool) === 'venium' && edgeLeft(back.tool, 'venium') === EDGE.venium.uses - 5 && edgeLeft(back.tool, 'eurleen') === EDGE.eurleen.uses - 3, 'the kept Venium edge goes back on as it was, no metal spent')

// ── the dial ring: the metal's colour, the arc = wear left; the tool panel says it ──
const dv = toolDial({ forestry: back.ok ? back.tool : undefined }, 'forestry')
ok(dv.ringColor === METAL_RING.venium && Math.abs((dv.ringPct ?? -1) - (EDGE.venium.uses - 5) / EDGE.venium.uses) < 1e-9, `venium ring purple + arc ${dv.ringPct}`)
const de = toolDial({ prospecting: (fitEdge(eq('starwillow_spike'), 'eurleen', bag()) as { tool: EquippedTool }).tool }, 'prospecting')
ok(de.ringColor === METAL_RING.eurleen && de.ringPct === 1, 'eurleen ring gold, full')
ok(toolDial({ forestry: eq('starwillow_blade') }, 'forestry').ringPct === null, 'no edge: no ring')
const pn = toolPanel({ forestry: back.ok ? back.tool : undefined } as EquippedTools, 'forestry')
ok(pn.edge?.metal === 'venium' && pn.edge.left === EDGE.venium.uses - 5 && pn.xpMult === EDGE.venium.xp && pn.rung === 4, `panel: edge + XP + rung ${JSON.stringify(pn.edge)}`)

// ── save / reload ──
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (x: string) => mem.get(x) ?? null, setItem: (x: string, v: string) => { mem.set(x, v) }, removeItem: (x: string) => { mem.delete(x) }, clear: () => mem.clear(), key: () => null, length: 0 } as Storage
saveTools({ forestry: back.ok ? back.tool : undefined, prospecting: eq('starwillow_spike') })
const re = loadTools()
ok(edgeOn(re.forestry) === 'venium' && edgeLeft(re.forestry, 'venium') === EDGE.venium.uses - 5 && edgeLeft(re.forestry, 'eurleen') === EDGE.eurleen.uses - 3, `reload keeps the edge + each metal's wear ${mem.get(TOOLS_KEY)}`)
ok(!(re.prospecting as EdgedTool).edge, 'no edge saved: none loaded')
// junk in a save is cleaned
ok(adoptEdge({ on: 'gold', left: { venium: 999, gold: 3 } })?.left.venium === EDGE.venium.uses && adoptEdge({ on: 'gold', left: { venium: 999 } })?.on === null, 'junk metal dropped, uses capped')
ok(adoptEdge({ on: 'venium', left: {} }) === undefined && adoptEdge(null) === undefined && adoptEdge({ on: 'eurleen', left: { eurleen: -2 } }) === undefined, 'empty / negative = no edge')
mem.set(TOOLS_KEY, JSON.stringify({ forestry: { ...eq('goldwood_blade'), edge: { on: 'venium', left: { venium: 10 } } } }))
ok(edgeOn(loadTools().forestry) === null, 'an edge on a tool that cannot take one does nothing')

console.log(`edges: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
