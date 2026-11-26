// Run: npx tsx src/app/shimmer/open/ather/m185-gems.test.ts
// BETA M185 s1 (RULED athernyx c73ab4e, Magii + Alex 11-26): the spike ladder is the pruner's (Goldwood > Shimmeroak > Starwillow
// Spike, shaft + raw mana shards at the carpenter), the four gems (Aqual water, Dinloid earth, Fuli mana, Rhyloid storm) replace
// the four element crystals, and an OLD SAVE loses nothing: its spike loads as the same tier, its crystals are the gems.
// The gem names are checked against the canon file itself (glossary + world/ather.md), never restated from memory.
import { readFileSync, existsSync } from 'node:fs'
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) }
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const main = async () => {
  const { TOOL_DEFS, LEGACY_TOOL_ID, currentToolId, toolsFromSave } = await import('../../engine/tools')
  const { loadTools } = await import('./rinsticks')
  const { FOCUSES, rungOf } = await import('./focuses')
  const P = await import('./prospecting')
  const { itemDef } = await import('../shared/inventory')
  const { KEEPSTONES } = await import('./furniture')

  // 1. the spike ladder: the ruled names, the pruner's woods, raw mana shards, tiers 1-3; the old three are gone
  const want = [['goldwood_spike', 'Goldwood Spike', 'goldwood_plank'], ['shimmeroak_spike', 'Shimmeroak Spike', 'shimmeroak_plank'], ['starwillow_spike', 'Starwillow Spike', 'starwillow_branch']] as const
  want.forEach(([id, name, wood], i) => {
    const d = TOOL_DEFS[id]
    ok(!!d && d.name === name && d.tier === i + 1 && d.skillId === 'prospecting' && d.recipe.some(c => c.itemId === wood) && d.recipe.some(c => c.itemId === 'raw_mana_shard'), `${id}: ${JSON.stringify(d)}`)
    // the shaft is the same wood the pruner of that tier is made from
    const pruner = Object.values(TOOL_DEFS).find(t => t.skillId === 'forestry' && t.tier === i + 1 && !t.basic)!
    ok(pruner.recipe[0].itemId === wood, `${id}: shaft wood ${wood} is not the ${pruner.name}'s`)
  })
  ok(FOCUSES.prospecting.join() === 'goldwood_spike,shimmeroak_spike,starwillow_spike', 'FOCUSES.prospecting')
  ok(!('mana_spike' in TOOL_DEFS) && !('crystal_spike' in TOOL_DEFS) && !('pure_spike' in TOOL_DEFS), 'an old spike is still in TOOL_DEFS')
  ok(!Object.values(TOOL_DEFS).some(t => /Mana Spike|Crystal Spike|Pure Spike/.test(t.name)), 'an old spike name is still shown')

  // 2. an OLD SAVE: each retired spike loads as the spike of its tier (the open world's loadTools and the engine's toolsFromSave)
  for (const [old, heir] of Object.entries(LEGACY_TOOL_ID)) {
    ok(currentToolId(old) === heir && !!TOOL_DEFS[heir], `legacy ${old} -> ${heir}`)
    mem.clear(); mem.set('open.tools.v1', JSON.stringify({ prospecting: { toolId: old, usesRemaining: 3, speedBonus: 0.9, xpBonus: 1.1 } }))
    const t = loadTools().prospecting
    ok(t?.toolId === heir && t.usesRemaining === TOOL_DEFS[heir].durability, `open loadTools: ${old} loaded as ${t?.toolId}`)
    const e = toolsFromSave({ equipped: { prospecting: { toolId: old, usesRemaining: 3 } } }).prospecting
    ok(e?.toolId === heir, `engine toolsFromSave: ${old} loaded as ${e?.toolId}`)
  }
  ok(currentToolId('goldwood_blade') === 'goldwood_blade', 'a live id is left alone')
  // the tier is kept: Mana -> 1, Crystal -> 2, Pure -> 3
  ok(['mana_spike', 'crystal_spike', 'pure_spike'].map(x => TOOL_DEFS[currentToolId(x)].tier).join() === '1,2,3', 'an old spike changed tier')
  ok(rungOf({ toolId: currentToolId('mana_spike'), usesRemaining: 1 }) === 2, 'an old Mana Spike is not the Goldwood rung')

  // 3. the gems: the four node kinds are named the ruled gems; the bag ids are the old ones (an old bag IS the gems)
  ok(P.CRYSTAL_NAME.water === 'Aqual' && P.CRYSTAL_NAME.earth === 'Dinloid' && P.CRYSTAL_NAME.violet === 'Fuli' && P.CRYSTAL_NAME.storm === 'Rhyloid', `node names ${JSON.stringify(P.CRYSTAL_NAME)}`)
  const bagName = { violet_crystal: 'Fuli', storm_crystal: 'Rhyloid', earth_crystal: 'Dinloid', water_crystal: 'Aqual' }
  for (const [id, n] of Object.entries(bagName)) ok(itemDef(id).name === n, `old bag item ${id} reads ${itemDef(id).name}, not ${n}`)
  for (const k of ['violet', 'storm', 'earth', 'water'] as const) ok(P.CRYSTAL_ITEM[k] === `${k}_crystal`, `${k}: the bag id moved (an old bag would lose it)`)
  ok(!Object.values(P.CRYSTAL_NAME).some(n => /Violet|Storm Crystal|Earth Crystal|Water Crystal/.test(n)), 'an old crystal name is still on a node')
  ok(!Object.values(KEEPSTONES).some(k => /Violet|Storm Keep|Earth Keep|Water Keep/.test(k.name)), 'an old crystal name is still on a Keepstone')
  // low gems first (Alex's pick): Aqual + Dinloid tier 2, Fuli + Rhyloid tier 3; the hidden one asks the higher grade
  ok(P.crystalDial('water').need === 2 && P.crystalDial('earth').need === 2 && P.crystalDial('violet').need === 3 && P.crystalDial('storm').need === 3 && P.crystalDial('egg').need === 3, 'needs: Aqual + Dinloid 2, Fuli + Rhyloid + hidden 3')
  // canon's grade stands: the four gems share the element row's XP, reset and dewls (Alex 11-25's dewls: 2)
  ok(['violet', 'storm', 'earth', 'water', 'egg'].every(k => P.TIER[k as 'violet'] === 2) && P.crystalDial('violet').respawnMs === P.crystalDial('water').respawnMs, `grade ${JSON.stringify(P.TIER)}`)
  // the egg still reveals one of the four, and a mined gem pays its own bag id
  const seen = new Set<string>()
  for (let i = 0; i < 4; i++) seen.add(P.minePlan('egg', (() => { let n = 0; return () => (n++ === 0 ? i / 4 + 0.01 : 0.99) })()).found)
  ok([...seen].sort().join() === 'earth,storm,violet,water', `egg reveals ${[...seen]}`)

  // 4. the names against canon itself (signed text, word for word)
  const canon = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '')
  const ather = canon('/root/athernyx/CANON/world/ather.md'), gloss = canon('/root/athernyx/CANON/glossary.md')
  if (ather) {
    for (const [gem, el] of [['Rhyloid', 'Storm'], ['Fuli', 'Mana'], ['Dinloid', 'Earth'], ['Aqual', 'Water']]) ok(new RegExp(`\\*\\*${gem}\\*\\* \\| ${el} \\|`).test(ather), `canon world/ather.md: ${gem} = ${el}`)
    ok(/Goldwood → Shimmeroak → Starwillow|Goldwood > Shimmeroak > Starwillow|Goldwood, Shimmeroak, Starwillow/.test(ather + gloss + canon('/root/athernyx/CANON/CANON_GAPS.md')), 'canon: the spike woods')
  } else console.log('(canon files not on this box: the canon asserts are skipped)')

  for (const f of fails) console.log('✗', f)
  console.log(`m185-gems: ${pass} ok, ${fails.length} fail`)
  process.exit(fails.length ? 1 : 0)
}
main()
