// M184 s2: the tool panel reads the game's own tables. Run: npx tsx src/app/shimmer/open/ather/tool-panel.test.ts
import { toolPanel, verdictOf, treeRows, crystalRows } from './tool-panel'
import { TOOL_DEFS } from '../../engine/tools'
import { TREE_DIAL, CRYSTAL_DIAL, HIGH_GEM_DIAL, manaNeed, gatherSecs, cycleBudget } from './gather-dials'
import { rungOf } from './focuses'
import { easeOf } from './rinsticks'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const eq = (id: string, uses?: number) => ({ toolId: id, usesRemaining: uses ?? TOOL_DEFS[id].durability, speedBonus: TOOL_DEFS[id].speedBonus, xpBonus: TOOL_DEFS[id].xpBonus })

// empty: nothing in hand, no rows, no numbers
for (const f of ['forestry', 'prospecting', 'rinning']) {
  const p = toolPanel({}, f)
  ok(!p.held && p.stage === -1 && p.name === null && p.rows.length === 0 && p.uses === null && p.ease === null, `empty ${f}: ${JSON.stringify(p)}`)
}
// worn: stage 0, never wears, the canon name, rung 1
const worn = toolPanel({ forestry: eq('worn_blade') }, 'forestry')
ok(worn.held && worn.stage === 0 && worn.name === 'Worn Pruner' && worn.uses === null && worn.durability === null && worn.rung === 1, `worn pruner ${JSON.stringify(worn).slice(0, 200)}`)
ok(worn.rows.map(r => r.name).join() === 'Goldwood,Shimmeroak,Starwillow,Dawnwood', `four trees (${worn.rows.map(r => r.name)})`)
// every number is the dial's own, for the rung the game uses (focuses.ts › rungOf)
for (const [id, fam] of [['worn_blade', 'forestry'], ['goldwood_blade', 'forestry'], ['shimmeroak_blade', 'forestry'], ['starwillow_blade', 'forestry']] as const) {
  const p = toolPanel({ [fam]: eq(id, 7) }, fam), r = rungOf(eq(id))
  ok(p.rung === r, `${id} rung ${p.rung} = ${r}`)
  const dials = Object.values(TREE_DIAL)
  p.rows.forEach((row, i) => {
    const d = dials[i]
    ok(row.mana === Math.round(manaNeed(d, r)) && row.secs === Math.round(gatherSecs(d, r)) && row.resetMin === d.respawnMs / 60000 && row.need === d.need, `${id} ${row.name} numbers ${JSON.stringify(row)}`)
  })
  if (!TOOL_DEFS[id].basic) ok(p.uses === 7 && p.durability === TOOL_DEFS[id].durability && p.xpMult === TOOL_DEFS[id].xpBonus, `${id} durability 7/${p.durability} xp ${p.xpMult}`)
}
// the worn pruner: Starwillow one rung low (slow, inside a cycle), Dawnwood two low = too weak
ok(worn.rows[0].verdict === 'ok' && worn.rows[1].verdict === 'ok' && worn.rows[2].verdict === 'slow' && worn.rows[3].verdict === 'weak', `worn verdicts ${worn.rows.map(r => r.verdict)}`)
ok(worn.rows[3].mana === 900 && worn.rows[2].mana === 300, `worn starwillow 300 / dawnwood 900 (${worn.rows[2].mana}/${worn.rows[3].mana})`)
// verdict = the mana against one cycle's budget
for (const d of [...Object.values(TREE_DIAL), ...CRYSTAL_DIAL.slice(1), HIGH_GEM_DIAL]) for (const r of [1, 2, 3, 4]) {
  const v = verdictOf(d, r), want = r >= d.need ? 'ok' : manaNeed(d, r) > cycleBudget(d) ? 'weak' : 'slow'
  ok(v === want, `verdict need ${d.need} rung ${r}: ${v} want ${want}`)
}
// the top tier is never too weak for anything
ok([...treeRows(3), ...crystalRows(4)].every(r => r.verdict === 'ok'), 'the top rung (pruner 3, spike 4) ok everywhere')
// the spike (M185 s1): one row per node kind, the four gems each their own; every number the dial of the kind's tier
const sp = toolPanel({ prospecting: eq('worn_spike') }, 'prospecting')
ok(sp.rows.map(r => r.name).join() === 'Raw Mana,Aqual,Dinloid,Fuli,Rhyloid,Pure Mana Core,Ather Crystal', `crystal rows ${sp.rows.map(r => r.name)}`)
const DIALS = [CRYSTAL_DIAL[1], CRYSTAL_DIAL[2], CRYSTAL_DIAL[2], HIGH_GEM_DIAL, HIGH_GEM_DIAL, CRYSTAL_DIAL[3], CRYSTAL_DIAL[4]]
sp.rows.forEach((row, i) => ok(row.mana === Math.round(manaNeed(DIALS[i], 1)) && row.resetMin === DIALS[i].respawnMs / 60000 && row.need === DIALS[i].need, `crystal ${row.name} ${JSON.stringify(row)}`))
ok(sp.rows.every(r => r.drops.startsWith('Blankstone 1-2')) && sp.rows[6].drops.endsWith('Dewl 5') && sp.rows[3].drops.includes('Fuli 1') && sp.rows[3].drops.endsWith('Dewl 2'), `crystal drops ${sp.rows.map(r => r.drops)}`)
ok(sp.rows[6].verdict === 'weak' && sp.rows[6].mana === 1400, `worn spike too weak for Ather (${sp.rows[6].verdict} ${sp.rows[6].mana})`)
// M185 s1 (Alex 11-26): the worn spike is the weakest (Aqual / Dinloid slow, Fuli / Rhyloid too weak); the Goldwood spike mines
// Aqual + Dinloid at their own mana and is slow on Fuli + Rhyloid; the Shimmeroak spike takes all four
const v = (id: string) => Object.fromEntries(toolPanel({ prospecting: eq(id) }, 'prospecting').rows.map(r => [r.name, r.verdict]))
const vw = v('worn_spike'), vg = v('goldwood_spike'), vs = v('shimmeroak_spike'), vt = v('starwillow_spike')
ok(vw.Aqual === 'slow' && vw.Dinloid === 'slow' && vw.Fuli === 'weak' && vw.Rhyloid === 'weak' && vw['Raw Mana'] === 'ok', `worn spike verdicts ${JSON.stringify(vw)}`)
ok(vg.Aqual === 'ok' && vg.Dinloid === 'ok' && vg.Fuli === 'slow' && vg.Rhyloid === 'slow', `goldwood spike verdicts ${JSON.stringify(vg)}`)
ok(['Aqual', 'Dinloid', 'Fuli', 'Rhyloid', 'Pure Mana Core'].every(k => vs[k] === 'ok') && vs['Ather Crystal'] !== 'ok', `shimmeroak spike verdicts ${JSON.stringify(vs)}`)
ok(Object.values(vt).every(x => x === 'ok'), `starwillow spike verdicts ${JSON.stringify(vt)}`)
const gm = (id: string, n: string) => toolPanel({ prospecting: eq(id) }, 'prospecting').rows.find(r => r.name === n)!
ok(gm('goldwood_spike', 'Aqual').secs < gm('worn_spike', 'Aqual').secs / 4 && gm('goldwood_spike', 'Fuli').secs > 4 * gm('shimmeroak_spike', 'Fuli').secs, 'Goldwood: Aqual fast (4x the worn), Fuli slow (4x the Shimmeroak)')
// the rinstick: no node rows, the ease its tier gives
const rin = toolPanel({ rinning: eq('glowfin_rinstick', 40) }, 'rinning')
ok(rin.rows.length === 0 && rin.ease === easeOf(eq('glowfin_rinstick')) && rin.ease === 1.3 && rin.uses === 40 && rin.stage === 2, `rinstick ${JSON.stringify(rin)}`)
// an unknown tool id reads as empty (toolDial)
ok(!toolPanel({ forestry: eq('worn_blade') && { toolId: 'nope', usesRemaining: 1, speedBonus: 1, xpBonus: 1 } }, 'forestry').held, 'unknown id = empty')

for (const f of fails) console.log('✗', f)
console.log(`tool-panel: ${pass} ok, ${fails.length} fail`)
process.exit(fails.length ? 1 : 0)
