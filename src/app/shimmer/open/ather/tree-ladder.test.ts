// Run: npx tsx src/app/shimmer/open/ather/tree-ladder.test.ts   (BETA M135 s1: the tree ladder + Tensacia)
// Worn tools: Goldwood + Shimmeroak · L1 Goldwood pruner = the same trees, more XP · L2 Shimmeroak -> Starwillow · L3 Starwillow ->
// Dawnwood · L4 a Smithy edge on the Starwillow -> Tensacia. GATE = M136 (mana per second): one rung short is SLOW (inside one
// cycle's pool + regen), never a hard wall. Tensacia (RULED athernyx 4d65536): its logs saw into planks, its fruit is the Greenscale
// (signed 98e7f1c); no zone grows it, Alex places it (the Wilds kit takes `node:tensacia`).
import { readFileSync } from 'node:fs'
import { TOOL_DEFS, type EquippedTool } from '../../engine/tools'
import { rungOf, bonusXp } from './focuses'
import { fitEdge } from './edges'
import { TREE_DIAL, manaNeed, cycleBudget } from './gather-dials'
import { TREE_KINDS, TREE_NAME, TREE_XP, SAPLING_CHANCE, GREENSCALE, GREENSCALE_CHANCE, prunePlan, logItem, treeFor, crownOf, type TreeKind, type Zone } from './forestry'
import { verdictOf } from './tool-panel'
import { itemDef, newInv, give, OPEN_ITEMS, ITEM_GROUP } from '../shared/inventory'
import { REFINE } from './furniture'
import { LOOK } from './wilds-scene'
import { paletteOf, placeableOn, SCENERY_BY, wildsPublishedProps } from './scenery'
import { gladeNodes } from './glade-nodes'
let pass = 0, fail = 0
const ok = (c: unknown, m: string) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const eq = (id: string): EquippedTool => ({ toolId: id, usesRemaining: TOOL_DEFS[id].durability, xpBonus: TOOL_DEFS[id].xpBonus, speedBonus: TOOL_DEFS[id].speedBonus })
const edged = (() => { const r = fitEdge(eq('starwillow_blade'), 'venium', give(newInv(0), 'venium', 6).inv); if (!r.ok) throw new Error('fitEdge refused'); return (r as { tool: EquippedTool }).tool })()

// ── 1. the ladder table: each tier's tool OPENS its tree (rung >= need = the node's own mana), and the next tree up is one short ──
const LADDER: [string, EquippedTool, TreeKind[]][] = [
  ['Worn Pruner', eq('worn_blade'), ['goldwood', 'shimmeroak']],
  ['Goldwood Pruner (L1)', eq('goldwood_blade'), ['goldwood', 'shimmeroak']],
  ['Shimmeroak Pruner (L2)', eq('shimmeroak_blade'), ['goldwood', 'shimmeroak', 'starwillow']],
  ['Starwillow Pruner (L3)', eq('starwillow_blade'), ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood']],
  ['Starwillow Pruner + Smithy edge (L4)', edged, ['goldwood', 'shimmeroak', 'starwillow', 'dawnwood', 'tensacia']],
]
for (const [name, tool, opens] of LADDER) {
  const r = rungOf(tool)
  for (const k of TREE_KINDS) {
    const open = r >= TREE_DIAL[k].need
    ok(open === opens.includes(k), `${name} (rung ${r}) ${opens.includes(k) ? 'opens' : 'does not open'} ${TREE_NAME[k]} (need ${TREE_DIAL[k].need})`)
  }
}
// L1 = the same trees as worn, more XP (skippable)
ok(rungOf(eq('goldwood_blade')) === rungOf(eq('worn_blade')) && bonusXp(eq('goldwood_blade'), 100) > bonusXp(eq('worn_blade'), 100), 'L1 Goldwood pruner: same rung as worn, more XP')
// ── 2. Tensacia NEEDS an edge: the bare Starwillow is one rung short = SLOW (300 mana, inside one cycle), never a wall; two short = weak ──
const T = TREE_DIAL.tensacia
ok(T.need === 4 && T.drain === 12 && T.mana === 42, `Tensacia's dial = M136's agreed 12/s 42 mana, need 4 (${JSON.stringify(T)})`)
ok(rungOf(eq('starwillow_blade')) === 3 && rungOf(edged) === 4, 'an edge lifts the Starwillow Pruner from rung 3 to Tensacia\'s 4')
ok(manaNeed(T, 3) === 300 && verdictOf(T, 3) === 'slow' && manaNeed(T, 3) < cycleBudget(T), 'bare Starwillow on Tensacia: 300 mana, slow, finishable on one cycle (no hard wall)')
ok(verdictOf(T, 2) === 'weak' && manaNeed(T, 2) > cycleBudget(T), 'two rungs short (Shimmeroak) on Tensacia: past one cycle = too weak')
ok(manaNeed(T, 4) === 42 && verdictOf(T, 4) === 'ok', 'edged Starwillow on Tensacia: its own 42 mana')
for (const k of TREE_KINDS) ok(TREE_DIAL[k].low[1] > cycleBudget(TREE_DIAL[k]), `${k}: two low is past one cycle (${TREE_DIAL[k].low[1]} > ${cycleBudget(TREE_DIAL[k]).toFixed(0)})`)
// the ladder climbs: each tree dearer + quicker-draining + longer reset + more XP than the one below
for (let i = 1; i < TREE_KINDS.length; i++) {
  const a = TREE_DIAL[TREE_KINDS[i - 1]], b = TREE_DIAL[TREE_KINDS[i]]
  ok(b.need >= a.need && b.mana > a.mana && b.drain > a.drain && b.respawnMs > a.respawnMs && TREE_XP[TREE_KINDS[i]] > TREE_XP[TREE_KINDS[i - 1]], `${TREE_KINDS[i]} sits above ${TREE_KINDS[i - 1]} on every dial`)
}

// ── 3. Greenscale drops (sometimes), with Tensacia logs; no Tensacia sapling; no other tree drops it ──
const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length] }
let withG = 0, logs = 0, sap = 0
for (let i = 0; i < 4000; i++) { const d = prunePlan('tensacia'); if (d.some(x => x.id === GREENSCALE)) withG++; if (d.some(x => x.id === logItem('tensacia') && x.n >= 2 && x.n <= 4)) logs++; if (d.some(x => x.id.endsWith('_sapling'))) sap++ }
ok(logs === 4000, `every Tensacia prune pays 2-4 Tensacia logs (${logs}/4000)`)
ok(Math.abs(withG / 4000 - GREENSCALE_CHANCE) < 0.04 && GREENSCALE_CHANCE > 0 && GREENSCALE_CHANCE < 1, `Greenscale SOMETIMES (${(withG / 40).toFixed(1)}% vs ${GREENSCALE_CHANCE * 100}%)`)
ok(sap === 0 && SAPLING_CHANCE.tensacia === 0, 'no Tensacia sapling (canon names none)')
ok(prunePlan('tensacia', seq(0.5, 0)).some(x => x.id === GREENSCALE) && !prunePlan('tensacia', seq(0.5, 0.99)).some(x => x.id === GREENSCALE), 'the fruit roll decides it (low roll = fruit, high = none)')
for (const k of TREE_KINDS) if (k !== 'tensacia') { let g = 0; for (let i = 0; i < 500; i++) if (prunePlan(k).some(x => x.id === GREENSCALE)) g++; ok(g === 0, `${k} never drops a Greenscale`) }

// ── 4. items registered + icons on disk; the log saws into planks at the bench ──
for (const id of ['tensacia_log', 'tensacia_plank', GREENSCALE]) {
  const d = OPEN_ITEMS[id]
  ok(!!d && itemDef(id).name !== id && ITEM_GROUP[id] === 'forestry', `${id} is a bag item (${d?.name})`)
  ok(!!d?.icon && readFileSync(`public${d.icon}`, 'utf8').includes('<svg'), `${id} has its icon (${d?.icon})`)
  ok(!/\bcone\b/i.test(`${d?.name} ${d?.blurb}`), `${id}: never "cone" on screen (canon law, batch 11-24f)`)
}
ok(OPEN_ITEMS.tensacia_log.name === 'Tensacia Log' && OPEN_ITEMS.tensacia_plank.name === 'Tensacia Plank' && OPEN_ITEMS[GREENSCALE].name === 'Greenscale', 'names = canon (Tensacia, Greenscale)')
const glossary = readFileSync('/root/athernyx/CANON/glossary.md', 'utf8')
ok(/\*\*Tensacia\*\*/.test(glossary) && /\*\*Greenscale\*\*/.test(glossary), 'both names stand in the canon glossary')
ok(REFINE.some(j => j.in[0].id === 'tensacia_log' && j.out.id === 'tensacia_plank' && j.out.n === 2), 'a Tensacia log saws into 2 planks')

// ── 5. the look + placement: its own look (emerald trunk, heavy), no zone grows it, the Wilds kit takes it, a placed one is a tree ──
ok(LOOK.tensacia.shape === 'spire' && LOOK.tensacia.trunkW >= 1.5 && LOOK.tensacia.trunk !== LOOK.dawnwood.trunk, 'Tensacia: its own spire silhouette on a heavy emerald trunk')
const c = crownOf({ y: 0, tall: 10, r: 3, kind: 'tensacia' }), d = crownOf({ y: 0, tall: 10, r: 3, kind: 'goldwood' })
ok(c.trunkH > d.trunkH && c.cy + c.hh > d.cy + d.hh, 'Tensacia stands taller than a Goldwood (heft, not dainty)')
const zones: Zone[] = ['meadows', 'thicket', 'springs', 'trails', 'arid', 'caverns']
let grown = 0; for (const z of zones) for (const b of [1, 2, 3]) for (const cv of [0, 0.6]) for (const r of [0, 0.5, 0.99]) if (treeFor(z, b, cv, r)?.kind === 'tensacia') grown++
ok(grown === 0, 'no zone grows Tensacia (Alex places its coves)')
ok(placeableOn('wilds', 'node:tensacia') && paletteOf('wilds').some(s => s.k === 'node:tensacia' && s.label === 'Tensacia node') && SCENERY_BY.get('node:tensacia')?.group === 'Nodes', 'the Wilds kit (Place mode) has the Tensacia node')
ok(!placeableOn('wilds', 'node:goldwood') && !placeableOn('wilds', 'node:raw'), 'the other nodes stay Glade-only')
const placed = wildsPublishedProps([{ id: 'n1', k: 'node:tensacia', x: 10, z: 20, q: 0, s: 1, w: 2 }, { id: 'n2', k: 'node:goldwood', x: 0, z: 0, q: 0, s: 1 }])
const W = gladeNodes(placed, () => 3)
ok(W.trees.length === 1 && W.trees[0].kind === 'tensacia' && W.trees[0].waitMs === 2 * 3_600_000 && W.trees[0].y === 3, `a published Wilds Tensacia is a gatherable tree with the piece's own wait (${JSON.stringify(W.trees[0])})`)
ok(W.treesNear(10, 20, 5).length === 1, 'and the aim finds it')

console.log(`tree-ladder: ${pass}/${fail}`)
if (fail) process.exit(1)
