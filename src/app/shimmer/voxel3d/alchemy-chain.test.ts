// The alchemy chain: every potion has its own ROAD across mortar / still / bowl, and the cauldron is
// always last (RULED 2026-09-16, `game/alchemy.md` › THE BREWING'S PARTS).
// Run: npx tsx src/app/shimmer/voxel3d/alchemy-chain.test.ts
//
// Three families of guard. (1) TOTALITY — every potion has a craft-word, a road and a finishing row,
// and every road ends at the cauldron. (2) THE SHAPE — the road is the batch's (stage feeds stage),
// tier 1 is a short walk, the infusion earns the whole chain, the words class SPIRIT/HAND/PLOT.
// (3) THE WORLD — the four blocks are registered, painted and openable, the lit cauldron is a
// state not an item, and the job maths pays what it says.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { POTION_DEFS } from '../engine/alchemy'
import { MAT } from '../voxel/depth'
import { blockDef, materialForItem } from '../voxel/registry'
import { recipeDef } from '../voxel/recipes'
import { TILE_MATERIALS } from './tex/tiles'
import { rightClickIntent } from './interact'
import {
  ALCHEMY_STATIONS, ALCHEMY_MATS, ALCHEMY_RECIPES, ALCHEMY_INTERMEDIATES, CRAFT_WORDS, DEFAULT_ROAD, ROADS,
  alchemyStationOf, craftWordOf, routeOf, roadOf, stageOf, jobOf, alchemyStationRecipes, alchemyRecipe, intermediateLabel,
  alchemyRunsReady, alchemyRunProgress, alchemyLoadJob, alchemyCollect, alchemySalvage, alchemyMaxRuns, alchemyBusy,
  ALCHEMY_MAX_RUNS, COOK_ROWS, COOKED,
} from './alchemy-chain'
import { WORLD_ITEMS } from './obtainable'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 totality ─────────────────────────────────────────────────────────────────────────────────
for (const def of Object.values(POTION_DEFS)) {
  const word = craftWordOf(def)
  ok(word !== null, `§1 ★★ ${def.id}: its name ends in a craft-word canon ruled on (${def.name})`)
  ok(routeOf(def.id).at(-1) === 'cauldron', `§1 ★★★ ${def.id}: the cauldron is ALWAYS the last station (${routeOf(def.id).join('→')})`)
  ok(routeOf(def.id).filter(s => s === 'cauldron').length === 1, `§1 ${def.id}: exactly one cauldron, at the end`)
  ok(!!alchemyRecipe(`finish:${def.id}`), `§1 ${def.id}: has a finishing row`)
  ok(jobOf(def.id) !== null, `§1 ${def.id}: is for the spirit, the hand or the plot`)
  // The road is a chain: step k's input is step k-1's output, the finish takes the last stage.
  const road = roadOf(def.id)
  road.forEach((_, i) => {
    const r = alchemyRecipe(`road:${def.id}:${i + 1}`)!
    ok(!!r, `§1 ${def.id}: road step ${i + 1} exists`)
    if (i > 0) ok(r.input.length === 1 && r.input[0].itemId === stageOf(def.id, i), `§1 ${def.id}: step ${i + 1} takes stage ${i}`)
    else ok(r.input.every((x, j) => x.itemId === def.recipe[j].itemId && x.count === def.recipe[j].count), `§1 ${def.id}: step 1 takes the raw ingredients, counts kept`)
  })
  const fin = alchemyRecipe(`finish:${def.id}`)!
  if (road.length) ok(fin.input.length === 1 && fin.input[0].itemId === stageOf(def.id, road.length), `§1 ${def.id}: the cauldron takes the last stage`)
  else ok(fin.input.length === def.recipe.length, `§1 ${def.id}: no road — the cauldron takes the raw ingredients`)
  ok(fin.mana === def.manaCost, `§1 ${def.id}: only the finish channels mana`)
  ok(road.every((_, i) => alchemyRecipe(`road:${def.id}:${i + 1}`)!.mana === 0), `§1 ${def.id}: the road is free of mana`)
  const xp = road.reduce((n, _, i) => n + alchemyRecipe(`road:${def.id}:${i + 1}`)!.xp, 0) + fin.xp
  ok(xp === def.xpGrant, `§1 ${def.id}: the road's XP and the pour's XP sum to the potion's (${xp} vs ${def.xpGrant})`)
}
ok(CRAFT_WORDS.length === 10 && CRAFT_WORDS.every(w => w in DEFAULT_ROAD), '§1 the ten craft-words of the vessels brief each have a default road')
ok(Object.keys(ROADS).every(id => id in POTION_DEFS), '§1 every per-potion road names a real potion')

// ── §2 the shape ────────────────────────────────────────────────────────────────────────────────
ok(routeOf('mana_draught').join('→') === 'cauldron', `§2 ★★ the simplest potion is cauldron, pour (${routeOf('mana_draught').join('→')})`)
ok(routeOf('shard_tonic').join('→') === 'grinder→cauldron', `§2 a tier-1 tonic is one station and the pot (${routeOf('shard_tonic').join('→')})`)
ok(routeOf('shimmer_salve').join('→') === 'mixer→cauldron', `§2 ★ a salve is WORKED in the bowl and finished warm — the ruling's own example (${routeOf('shimmer_salve').join('→')})`)
ok(routeOf('mana_infusion').join('→') === 'grinder→still→mixer→cauldron',
  `§2 ★★★ the infusion earns the whole chain (${routeOf('mana_infusion').join('→')})`)
ok(routeOf('crystal_elixir').join('→') === 'grinder→still→cauldron', '§2 an elixir is distilled and refined, then finished in the pot')
ok(routeOf('deep_essence').filter(s => s === 'still').length === 2, '§2 an essence is concentrated — the still twice')
ok(routeOf('dreamroot_elixir').join('→') === 'grinder→mixer→still→cauldron', '§2 a per-potion road can put the bowl before the still — the word does not fix the order')
ok(routeOf('dawn_cordial').at(-1) === 'cauldron' && alchemyRecipe('finish:dawn_cordial')!.runMs > ALCHEMY_STATIONS.cauldron.runMs,
  '§2 ★ a cordial is AGED — brewed on the cauldron, slower than any brew')
for (const def of Object.values(POTION_DEFS)) {
  if (def.tier === 1) ok(routeOf(def.id).length <= 2, `§2 ★★ tier 1 stays a short walk: ${def.id} = ${routeOf(def.id).length} stations`)
}
ok(jobOf('mana_infusion') === 'spirit' && jobOf('bond_philter') === 'spirit', '§2 infusions and philters are for the SPIRIT')
ok(jobOf('shard_tonic') === 'hand' && jobOf('moonvine_tonic') === 'hand' && jobOf('glowfin_brew') === 'hand', '§2 tonics are for the HAND (Glowfin is a fishing dose: a tonic, not a brew)')
ok(jobOf('harvest_brew') === 'plot' && jobOf('shimmer_salve') === 'plot', '§2 brews and salves are for the PLOT')
ok(ALCHEMY_INTERMEDIATES.every(id => intermediateLabel(id) !== null), '§2 every stage has a readable name')
ok(intermediateLabel('stage_mana_infusion_1') === 'Mana Infusion — ground' && intermediateLabel('stage_mana_infusion_3') === 'Mana Infusion — mixed', '§2 the names read')
ok(intermediateLabel('powder_raw_mana_shard') === 'Raw Mana Shard Powder' && intermediateLabel('base_mana_infusion') === 'Mana Infusion Base', '§2 the 09-14 intermediates in old saves still read')
ok(intermediateLabel('cauldron') === null, '§2 and nothing else is claimed')
for (const id of Object.keys(ALCHEMY_STATIONS) as (keyof typeof ALCHEMY_STATIONS)[]) {
  const rows = alchemyStationRecipes(id)
  ok(rows.length > 0 && rows.every(r => r.station === id), `§2 ${id} lists only its own rows (${rows.length})`)
}
ok(alchemyStationRecipes('grinder').every(r => r.step === 'grind'), '§2 the mortar only grinds')
ok(alchemyStationRecipes('cauldron').filter(r => r.potionId).length === Object.keys(POTION_DEFS).length, '§2 the cauldron lists every potion — every road ends there')

// ── §3 the world ────────────────────────────────────────────────────────────────────────────────
for (const st of Object.values(ALCHEMY_STATIONS)) {
  for (const m of st.materials) {
    ok(!!blockDef(m), `§3 ${st.id}: material ${m} is in the registry`)
    ok(TILE_MATERIALS.includes(m), `§3 ★ ${st.id}: material ${m} has tile art (else it renders as an ore seam)`)
    ok(alchemyStationOf(m) === st.id, `§3 ${st.id}: material ${m} answers to its station`)
    ok(rightClickIntent(m, 'cauldron', false) === 'work', `§3 ★★ ${st.id}: aiming at material ${m} OPENS it (intent 'work')`)
  }
}
ok(ALCHEMY_MATS.size === 7, `§3 seven materials across six stations — the cauldron has its lit twin; the oven and the hearth joined 09-15 (${ALCHEMY_MATS.size})`)
{
  const lit = blockDef(MAT.CAULDRON_LIT)!
  ok(lit.placeable === false, '§3 ★★ the lit cauldron is a STATE, never placed')
  ok(lit.drops[0]?.itemId === 'cauldron', '§3 ★ and breaking it hands back the cauldron you made')
  ok((lit.emit ?? 0) > 0 && (lit.emit ?? 0) < (blockDef(MAT.HEARTH)!.emit ?? 0), `§3 ★ it lights the room, under the hearth (${lit.emit} vs ${blockDef(MAT.HEARTH)!.emit})`)
  ok(!blockDef(MAT.CAULDRON)!.emit, '§3 the idle cauldron emits nothing — dark water promises no brew')
  ok(materialForItem('cauldron') === MAT.CAULDRON, '§3 the cauldron item still places the IDLE block')
}
for (const id of ['grinder', 'still', 'mixer']) {
  ok(!!recipeDef(id) && recipeDef(id)!.output.itemId === id, `§3 ${id} can be crafted`)
  ok(materialForItem(id) !== undefined && blockDef(materialForItem(id)!)!.placeable === true, `§3 ${id} places as its block`)
  ok(recipeDef(id)!.input.every(i => i.itemId !== 'cauldron'), `§3 ${id} does not cost a cauldron`)
}
// The station panel's mount branches on the id, and the console can conjure an intermediate.
{
  const here = new URL('.', import.meta.url).pathname
  const host = readFileSync(join(here, 'VoxelWorld.tsx'), 'utf8')
  ok(host.includes('openStation.kind in ALCHEMY_STATIONS && (') && host.includes('<AlchemyPanel'), '§3 ★★ the host mounts AlchemyPanel for an alchemy kind')
  ok(host.includes("stationOf(potMat) ?? alchemyStationOf(potMat)"), '§3 ★★ the work branch resolves an alchemy station — else the click is dead')
  ok(/alchemyStationOf\(prevMat\) !== alchemyStationOf\(mat\)/.test(host), '§3 ★★ the lit swap keeps the job (same station, different material)')
  ok(host.includes('alchemySalvage(shop, stationKey(hit.x, hit.y, hit.z), Date.now())'), '§3 ★ breaking a station mid-run salvages it')
  const con = readFileSync(join(here, 'console.ts'), 'utf8')
  ok(con.includes('...ALCHEMY_INTERMEDIATES'), '§3 /give knows the intermediates')
}

// ── §4 the job maths ────────────────────────────────────────────────────────────────────────────
{
  const rec = alchemyRecipe('road:shard_tonic:1')!   // grind 3 shards + 2 bark → stage 1
  const t0 = 1_000_000
  const shop = alchemyLoadJob({}, 'k', rec.id, 5, t0)
  ok(!!shop.k && shop.k.runs === 5, '§4 a job loads')
  ok(alchemyLoadJob(shop, 'k', rec.id, 3, t0) === shop, '§4 a busy slot refuses a second job')
  ok(alchemyLoadJob({}, 'k', 'nope:x', 3, t0).k === undefined, '§4 an unknown recipe loads nothing')
  ok(alchemyLoadJob({}, 'k', rec.id, 99, t0).k!.runs === ALCHEMY_MAX_RUNS, `§4 runs cap at ${ALCHEMY_MAX_RUNS}`)
  ok(alchemyRunsReady(shop.k, t0) === 0 && alchemyRunsReady(shop.k, t0 + rec.runMs * 2 + 10) === 2, '§4 runs land on the clock')
  ok(alchemyRunProgress(shop.k, t0 + rec.runMs / 2) > 0.45 && alchemyRunProgress(shop.k, t0 + rec.runMs / 2) < 0.55, '§4 progress is the CURRENT run')
  const c = alchemyCollect(shop, 'k', t0 + rec.runMs * 2 + 10)
  ok(c.payout?.itemId === 'stage_shard_tonic_1' && c.payout.count === 2 && c.xp === rec.xp * 2 && c.runsTaken === 2, '§4 take pays the ready runs and their XP')
  ok(c.shop.k!.runs === 3 && c.shop.k!.since === t0 + rec.runMs * 2, '§4 ★ the rest keep their clock from the run that landed, not from now')
  ok(alchemyBusy(c.shop.k), '§4 still busy with runs left')
  const done = alchemyCollect(c.shop, 'k', t0 + rec.runMs * 10)
  ok(done.shop.k === undefined && done.payout!.count === 3 && !alchemyBusy(done.shop.k), '§4 the last take clears the slot — the cauldron goes dark here')
  const s = alchemySalvage(shop, 'k', t0 + rec.runMs + 5)
  ok(s.shop.k === undefined && s.drops.some(d => d.itemId === 'stage_shard_tonic_1' && d.count === 1) && s.drops.some(d => d.itemId === 'raw_mana_shard' && d.count === 12),
    `§4 ★ salvage pays the finished run and returns the unfinished inputs (${JSON.stringify(s.drops)})`)
  const fin = alchemyRecipe('finish:mana_draught')!
  ok(alchemyMaxRuns(fin, () => 50, 12) === 2, `§4 ★ a finishing row is capped by MANA too (12 mana / ${fin.mana} per run = 2)`)
  ok(alchemyMaxRuns(fin, (id) => id === 'raw_mana_shard' ? 7 : id === 'glow_moss' ? 9 : 0, 999) === 1, '§4 and by the inputs (7 shards at 4 a run = 1; the moss is plentiful)')
}

// ── §5 the oven — a cooking station on the chain's machinery (2026-09-15) ───────────────────────
// Alex: "we need to make sure all of our stations are interactable.. starting with the oven". The
// oven shipped 09-13 as a lit block with no verb; it now rides this table as `craft: 'cooking'`.
{
  const oven = ALCHEMY_STATIONS.oven
  const hearth = ALCHEMY_STATIONS.hearth
  ok(oven.craft === 'cooking' && hearth.craft === 'cooking' && Object.values(ALCHEMY_STATIONS).filter(s => s.craft === 'cooking').length === 2,
    '§5 the oven and the hearth are the two cooking stations; every other station is alchemy')
  ok(Object.values(ALCHEMY_STATIONS).every(s => s.craft === 'alchemy' || s.craft === 'cooking'), '§5 every station names its trade')
  ok(alchemyStationOf(MAT.OVEN) === 'oven', '§5 MAT.OVEN answers to the oven')
  ok(rightClickIntent(MAT.OVEN, 'cauldron', false) === 'work', '§5 ★★ aiming at the oven OPENS it')
  const rows = alchemyStationRecipes('oven')
  const roasts = alchemyStationRecipes('hearth')
  ok(rows.length + roasts.length === COOK_ROWS.length && rows.length >= 1 && roasts.length >= 1, `§5 the oven and hearth list exactly the cooking rows between them (${rows.length} + ${roasts.length})`)
  ok([...rows, ...roasts].every(r => (r.step === 'bake' || r.step === 'roast') && r.mana === 0 && r.xp === 0 && r.minLevel <= 1),
    '§5 ★ a cooking row channels no mana, pays no alchemy XP and has no level gate')
  ok(ALCHEMY_RECIPES.filter(r => r.station !== 'oven' && r.station !== 'hearth').every(r => r.step !== 'bake' && r.step !== 'roast'), '§5 no bake or roast row sits on an alchemy station')
  ok(rows.every(r => r.runMs === oven.runMs) && roasts.every(r => r.runMs === hearth.runMs), '§5 a bake runs at the oven\'s time, a roast at the hearth\'s')
  // The hearth ROASTS (ruled 09-15): three fires, three verbs; the keeper's dish, never the spirits'.
  ok(alchemyStationOf(MAT.HEARTH) === 'hearth' && rightClickIntent(MAT.HEARTH, 'cauldron', false) === 'work', '§5 ★★ aiming at the hearth OPENS it')
  ok(roasts.every(r => r.step === 'roast') && rows.every(r => r.step === 'bake'), '§5 the oven bakes, the hearth roasts — the word is the method')
  const rr = alchemyRecipe('roast:shimmerscale')
  ok(!!rr && rr.input.length === 1 && rr.input[0].itemId === 'shimmerscale' && rr.input[0].count === 1 && rr.output.itemId === 'roast_rinn' && rr.output.count === 1,
    '§5 1 rinn → 1 roast rinn, and the tier-1 rinn is Shimmerscale (its row said "basic food")')
  ok(!ALCHEMY_RECIPES.some(r => r.input.some(i => i.itemId === 'glowfin' || i.itemId === 'moonkoi') && r.step === 'roast'), '§5 ★ Glowfin and Moonkoi are spirit food and are never roasted')
  ok(!!alchemyRecipe('roast:glowroot') && alchemyRecipe('roast:glowroot')!.output.itemId === 'roasted_glowroot', '§5 roasted Glowroot is the ruling\'s own second row')
  ok(roasts.every(r => r.input.every(i => WORLD_ITEMS.has(i.itemId))), '§5 ★ every roast input is something the world puts in your hands')
  const bread = alchemyRecipe('bake:bread')
  ok(!!bread && bread.station === 'oven' && bread.output.itemId === 'bread', '§5 bread is baked at the oven')
  ok(!!bread && bread.input.every(i => WORLD_ITEMS.has(i.itemId)), `§5 ★ every loaf input is something the world puts in your hands (${bread?.input.map(i => i.itemId).join(', ')})`)
  ok(COOKED.includes('bread') && COOKED.every(id => !ALCHEMY_INTERMEDIATES.includes(id)), '§5 the loaf is COOKED, never an intermediate')
  ok(intermediateLabel('bread') === null, '§5 and it keeps its own name')
  // The panel drops the alchemy line for a cooking station — a textual guard on the one place it renders.
  const panel = readFileSync(join(__dirname, 'alchemy-panel.tsx'), 'utf8')
  ok(panel.includes("def.craft === 'cooking'") && panel.includes("cooking ? 'the fire is always lit'"), '§5 ★ the panel reads `craft` and hides the alchemy line on the oven')
  ok(panel.includes('xp > 0 ? addSkillXP'), '§5 ★ take pays alchemy XP only when there is any — a loaf never touches the skill')
}

if (fails.length) {
  console.error(`❌ alchemy-chain: ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ alchemy-chain: ${pass} passed`)
