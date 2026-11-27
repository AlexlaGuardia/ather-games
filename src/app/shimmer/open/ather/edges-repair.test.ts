// Run: npx tsx src/app/shimmer/open/ather/edges-repair.test.ts   (BETA M134 s2: repair, repair all, swaps, buying metal)
// buy metal adds metal + spends Marks · repair cost scales with wear, never a new edge's price · nothing to repair at 0 · REPAIR ALL's
// total is known (and nothing charged) before it is paid, then charged whole or not at all · a swap keeps both edges' wear.
import { TOOL_DEFS, type EquippedTool, type EquippedTools } from '../../engine/tools'
import { EDGE, EDGE_METALS, FIT_METAL, REPAIR_MAX, fitEdge, wearEdge, edgeOn, edgeLeft, repairCost, repairEdge, repairAllPlan, repairAll, costText, type EdgedTool, type EdgeMetal } from './edges'
import { newInv, give, countOf, type Inv } from '../shared/inventory'
import { buyLot, supplierKind } from '../business/suppliers'
import { NEW_LEDGER } from '../trade'
import { loadTools, saveTools } from './rinsticks'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const eq = (id: string): EquippedTool => ({ toolId: id, usesRemaining: TOOL_DEFS[id].durability, xpBonus: TOOL_DEFS[id].xpBonus, speedBonus: TOOL_DEFS[id].speedBonus })
const bag = (v = 6, e = 6): Inv => give(give(newInv(0), 'venium', v).inv, 'eurleen', e).inv
const withEdge = (id: string, left: Partial<Record<EdgeMetal, number>>, on: EdgeMetal | null): EdgedTool => ({ ...eq(id), edge: { on, left } })
const wearN = (t: EquippedTool, n: number) => { for (let i = 0; i < n; i++) t = wearEdge(t).tool; return t }

// ── 1. buy metal at the Nyx supplier: metal in the bag, Marks out ──
for (const m of EDGE_METALS) {
  const lot = supplierKind('trade-co')?.lots.find(l => l.id === m)
  ok(!!lot && lot.n >= FIT_METAL, `${m}: sold in bulk at the Trading Co. supplier (a lot covers at least one edge)`)
  if (!lot) continue
  const r = buyLot(NEW_LEDGER, newInv(0), 'trade-co', m)
  ok(r.ok && countOf(r.inv, m) === lot.n && r.ledger.marks === NEW_LEDGER.marks - lot.price, `${m}: buying adds ${lot.n} and spends ${lot.price} Marks`)
  ok(lot.price <= NEW_LEDGER.marks, `${m}: a new keeper's purse covers one lot (early-mid)`)
  const poor = buyLot({ ...NEW_LEDGER, marks: lot.price - 1 }, newInv(0), 'trade-co', m)
  ok(!poor.ok, `${m}: no sale a Mark short`)
}

// ── 2. the repair cost formula ──
for (const m of EDGE_METALS) {
  const u = EDGE[m].uses
  ok(repairCost(m, u) === 0, `${m}: a whole edge costs nothing`)
  ok(repairCost(m, 0) === 0 && repairCost(m, -3) === 0, `${m}: a broken edge (0) is not repairable`)
  ok(repairCost(m, u - 1) === 1, `${m}: one use worn = 1 metal`)
  ok(repairCost(m, 1) === REPAIR_MAX && REPAIR_MAX < FIT_METAL, `${m}: nearly broken = REPAIR_MAX (${REPAIR_MAX}), under a new edge's ${FIT_METAL}`)
  let mono = true
  for (let l = 1; l < u; l++) { const c = repairCost(m, l); if (c !== Math.ceil(REPAIR_MAX * (u - l) / u) || c < repairCost(m, l + 1)) mono = false }
  ok(mono, `${m}: cost = ceil(REPAIR_MAX x worn share), more wear never cheaper`)
}

// ── 3. repair one edge; nothing at 0 ──
const vw = wearN(fitEdge(eq('starwillow_blade'), 'venium', bag()).ok ? (fitEdge(eq('starwillow_blade'), 'venium', bag()) as { tool: EdgedTool }).tool : eq('starwillow_blade'), 20)
ok(edgeLeft(vw, 'venium') === EDGE.venium.uses - 20, 'worn 20 uses')
const r1 = repairEdge(vw, 'venium', bag(2, 0))
ok(r1.ok && r1.spent === repairCost('venium', 10) && edgeLeft(r1.tool, 'venium') === EDGE.venium.uses && countOf(r1.inv, 'venium') === 2 - r1.spent && edgeOn(r1.tool) === 'venium', `repair: back to full for ${repairCost('venium', 10)} Venium, still fitted`)
ok(!repairEdge(vw, 'venium', bag(0, 6)).ok, 'repair: refused without the metal (and Eurleen does not stand in)')
const broke = wearN(withEdge('starwillow_blade', { venium: 2 }, 'venium'), 2)
ok(edgeOn(broke) === null && edgeLeft(broke, 'venium') === 0, 'worn to 0: broke away')
const r0 = repairEdge(broke, 'venium', bag())
ok(!r0.ok && /Fit a new one/.test(r0.why), 'repair at 0: nothing to repair, refit')
ok(!repairEdge(withEdge('starwillow_blade', { venium: EDGE.venium.uses }, 'venium'), 'venium', bag()).ok, 'repair: a whole edge refuses (no metal spent)')
ok(!repairEdge(eq('goldwood_blade'), 'venium', bag()).ok, 'repair: a tool that takes no edge refuses')
// a kept edge that is OFF the tool can be mended too
const off = repairEdge(withEdge('starwillow_spike', { venium: 25, eurleen: 10 }, 'venium'), 'eurleen', bag())
ok(off.ok && edgeLeft(off.tool, 'eurleen') === EDGE.eurleen.uses && edgeOn(off.tool) === 'venium' && edgeLeft(off.tool, 'venium') === 25, 'repair: a kept (unfitted) edge mends; the fitted one untouched')

// ── 4. REPAIR ALL: the total first, then the charge ──
const tools: EquippedTools = {
  forestry: withEdge('starwillow_blade', { venium: 10, eurleen: 49 }, 'venium'),
  prospecting: withEdge('starwillow_spike', { eurleen: 5 }, 'eurleen'),
}
const inv0 = bag(6, 6), invSnap = JSON.stringify(inv0), toolSnap = JSON.stringify(tools)
const plan = repairAllPlan(tools, inv0)
const want = { venium: repairCost('venium', 10), eurleen: repairCost('eurleen', 49) + repairCost('eurleen', 5) }
ok(plan.lines.length === 3 && plan.total.venium === want.venium && plan.total.eurleen === want.eurleen && !Object.keys(plan.short).length, `plan: 3 worn edges, total ${JSON.stringify(plan.total)}`)
ok(JSON.stringify(inv0) === invSnap && JSON.stringify(tools) === toolSnap, 'plan: showing the total charges nothing and changes no tool')
ok(costText(plan.total) === `${want.venium} Venium + ${want.eurleen} Eurleen`, `plan in words: ${costText(plan.total)}`)
const all = repairAll(tools, inv0)
ok(all.ok && all.mended === 3 && countOf(all.inv, 'venium') === 6 - want.venium && countOf(all.inv, 'eurleen') === 6 - want.eurleen, 'repair all: charges exactly the shown total')
ok(all.ok && edgeLeft(all.tools.forestry, 'venium') === EDGE.venium.uses && edgeLeft(all.tools.forestry, 'eurleen') === EDGE.eurleen.uses && edgeLeft(all.tools.prospecting, 'eurleen') === EDGE.eurleen.uses, 'repair all: every edge full')
ok(all.ok && edgeOn(all.tools.forestry) === 'venium' && edgeOn(all.tools.prospecting) === 'eurleen', 'repair all: the fitted metals stay fitted')
const shortBag = bag(6, want.eurleen - 1), sp = repairAllPlan(tools, shortBag)
ok(sp.short.eurleen === 1 && !sp.short.venium, `plan: short by 1 Eurleen shown ${JSON.stringify(sp.short)}`)
const sa = repairAll(tools, shortBag)
ok(!sa.ok, 'repair all: refused when the bag cannot pay the whole total (no part repair)')
ok(!repairAll({ forestry: withEdge('starwillow_blade', { venium: EDGE.venium.uses }, 'venium') }, bag()).ok, 'repair all: nothing worn = nothing to repair')
ok(repairAllPlan({ forestry: broke }, bag()).lines.length === 0, 'repair all: a broken edge (0) is not in the plan')

// ── 5. SWAPS: the other metal fits (kept wear or a new edge for FIT_METAL); the removed edge keeps its wear ──
let inv = bag(6, 6), t: EquippedTool = eq('starwillow_blade')
const f1 = fitEdge(t, 'venium', inv); ok(f1.ok && f1.spent === FIT_METAL, 'swap: first Venium edge = new, 3 spent')
if (f1.ok) { t = wearN(f1.tool, 5); inv = f1.inv }
const f2 = fitEdge(t, 'eurleen', inv)
ok(f2.ok && f2.spent === FIT_METAL && edgeOn(f2.tool) === 'eurleen' && edgeLeft(f2.tool, 'venium') === EDGE.venium.uses - 5, 'swap to Eurleen: a new edge for 3, the Venium edge kept at its wear')
if (f2.ok) { t = wearN(f2.tool, 3); inv = f2.inv }
const f3 = fitEdge(t, 'venium', inv)
ok(f3.ok && f3.spent === 0 && edgeOn(f3.tool) === 'venium' && edgeLeft(f3.tool, 'venium') === EDGE.venium.uses - 5 && edgeLeft(f3.tool, 'eurleen') === EDGE.eurleen.uses - 3, 'swap back to Venium: its kept edge for free, both wears kept')
ok(f3.ok && countOf(f3.inv, 'venium') === 3 && countOf(f3.inv, 'eurleen') === 3, 'swaps: metal spent only for the two new edges')
// reload keeps both
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = { getItem: (x: string) => mem.get(x) ?? null, setItem: (x: string, v: string) => { mem.set(x, v) }, removeItem: (x: string) => { mem.delete(x) }, clear: () => mem.clear(), key: () => null, length: 0 } as Storage
if (f3.ok) saveTools({ forestry: f3.tool })
const re = loadTools().forestry
ok(edgeOn(re) === 'venium' && edgeLeft(re, 'venium') === EDGE.venium.uses - 5 && edgeLeft(re, 'eurleen') === EDGE.eurleen.uses - 3, 'reload keeps the swap + both wears')

console.log(`edges-repair: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
