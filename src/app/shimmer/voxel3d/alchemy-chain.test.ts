// The alchemy chain: the potion's craft-word decides its route through four stations.
// Run: npx tsx src/app/shimmer/voxel3d/alchemy-chain.test.ts
//
// Three families of guard. (1) TOTALITY — every potion has a route and every ingredient a kind, so
// a new potion cannot silently get "no prep, straight to the cauldron". (2) THE SHAPE — tier 1 is a
// short walk, the infusion earns the whole chain, the word goes where canon's method says.
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
  ALCHEMY_STATIONS, ALCHEMY_MATS, ALCHEMY_RECIPES, ALCHEMY_INTERMEDIATES, INGREDIENT_KIND, FINISH_AT,
  alchemyStationOf, craftWordOf, routeOf, prepOf, alchemyStationRecipes, alchemyRecipe, intermediateLabel,
  alchemyRunsReady, alchemyRunProgress, alchemyLoadJob, alchemyCollect, alchemySalvage, alchemyMaxRuns, alchemyBusy,
  ALCHEMY_MAX_RUNS,
} from './alchemy-chain'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── §1 totality ─────────────────────────────────────────────────────────────────────────────────
for (const def of Object.values(POTION_DEFS)) {
  const word = craftWordOf(def)
  ok(word !== null, `§1 ★★ ${def.id}: its name ends in a craft-word canon ruled on (${def.name})`)
  for (const r of def.recipe) ok(r.itemId in INGREDIENT_KIND, `§1 ★★ ${def.id}: ingredient ${r.itemId} has a kind (dry/wet) — else it gets no prep step`)
  ok(routeOf(def.id).length >= 2, `§1 ${def.id}: a route of at least a prep and a finish (${routeOf(def.id).join('→')})`)
  ok(!!alchemyRecipe(`finish:${def.id}`), `§1 ${def.id}: has a finishing row`)
}
ok(Object.keys(FINISH_AT).length === 10, '§1 the ten craft-words of the vessels brief all route somewhere')

// ── §2 the shape ────────────────────────────────────────────────────────────────────────────────
ok(routeOf('mana_draught').join('→') === 'grinder→cauldron', `§2 ★★ the tier-1 draught is TWO stations — grind, brew (${routeOf('mana_draught').join('→')})`)
ok(routeOf('shard_tonic').join('→') === 'grinder→mixer', `§2 ★ a tonic never sees fire — grind, mix (${routeOf('shard_tonic').join('→')})`)
ok(routeOf('mana_infusion').join('→') === 'grinder→still→mixer→cauldron',
  `§2 ★★★ the infusion earns the whole chain — grind the crystal, distil the herb, mix the base, brew (${routeOf('mana_infusion').join('→')})`)
ok(routeOf('crystal_elixir').at(-1) === 'still', '§2 an elixir is "distilled and refined" — it finishes at the still')
ok(routeOf('dawn_cordial').at(-1) === 'cauldron' && alchemyRecipe('finish:dawn_cordial')!.runMs > ALCHEMY_STATIONS.cauldron.runMs,
  '§2 ★ a cordial is AGED — brewed on the cauldron, slower than any brew')
for (const def of Object.values(POTION_DEFS)) {
  if (def.tier === 1) ok(routeOf(def.id).length <= 2, `§2 ★★ tier 1 stays a short walk: ${def.id} = ${routeOf(def.id).length} stations`)
}
ok(prepOf('raw_mana_shard') === 'powder_raw_mana_shard' && prepOf('amber_sap') === 'extract_amber_sap', '§2 dry → powder, wet → extract')
ok(prepOf('crystallized_sap') === 'powder_crystallized_sap', '§2 ★ crystallized sap is a CRYSTAL (kind, not name) — the table beats a regex')
{
  const fin = alchemyRecipe('finish:mana_draught')!
  ok(fin.input.length === 1 && fin.input[0].itemId === 'powder_raw_mana_shard' && fin.input[0].count === 5,
    '§2 counts are preserved 1:1 — five shards want five shard-powder')
  ok(fin.mana === POTION_DEFS.mana_draught.manaCost && fin.xp === POTION_DEFS.mana_draught.xpGrant, '§2 the finishing run carries the potion\'s own mana and XP')
  ok(alchemyRecipe('grind:raw_mana_shard')!.mana === 0, '§2 prep channels no mana')
  const mix = alchemyRecipe('mix:mana_infusion')!, brew = alchemyRecipe('finish:mana_infusion')!
  ok(mix.output.itemId === 'base_mana_infusion' && brew.input[0].itemId === 'base_mana_infusion', '§2 the infusion\'s mix feeds its brew through the base')
}
ok(ALCHEMY_INTERMEDIATES.every(id => intermediateLabel(id) !== null), '§2 every intermediate has a readable name')
ok(intermediateLabel('powder_raw_mana_shard') === 'Raw Mana Shard Powder' && intermediateLabel('base_mana_infusion') === 'Mana Infusion Base', '§2 the names read')
ok(intermediateLabel('cauldron') === null, '§2 and nothing else is claimed')
for (const id of Object.keys(ALCHEMY_STATIONS) as (keyof typeof ALCHEMY_STATIONS)[]) {
  const rows = alchemyStationRecipes(id)
  ok(rows.length > 0 && rows.every(r => r.station === id), `§2 ${id} lists only its own rows (${rows.length})`)
}
ok(alchemyStationRecipes('grinder').every(r => r.step === 'grind'), '§2 the grinder only grinds')

// ── §3 the world ────────────────────────────────────────────────────────────────────────────────
for (const st of Object.values(ALCHEMY_STATIONS)) {
  for (const m of st.materials) {
    ok(!!blockDef(m), `§3 ${st.id}: material ${m} is in the registry`)
    ok(TILE_MATERIALS.includes(m), `§3 ★ ${st.id}: material ${m} has tile art (else it renders as an ore seam)`)
    ok(alchemyStationOf(m) === st.id, `§3 ${st.id}: material ${m} answers to its station`)
    ok(rightClickIntent(m, 'cauldron', false) === 'work', `§3 ★★ ${st.id}: aiming at material ${m} OPENS it (intent 'work')`)
  }
}
ok(ALCHEMY_MATS.size === 5, `§3 five materials across four stations — the cauldron has its lit twin (${ALCHEMY_MATS.size})`)
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
  const rec = alchemyRecipe('grind:raw_mana_shard')!
  const t0 = 1_000_000
  const shop = alchemyLoadJob({}, 'k', rec.id, 5, t0)
  ok(!!shop.k && shop.k.runs === 5, '§4 a job loads')
  ok(alchemyLoadJob(shop, 'k', rec.id, 3, t0) === shop, '§4 a busy slot refuses a second job')
  ok(alchemyLoadJob({}, 'k', 'nope:x', 3, t0).k === undefined, '§4 an unknown recipe loads nothing')
  ok(alchemyLoadJob({}, 'k', rec.id, 99, t0).k!.runs === ALCHEMY_MAX_RUNS, `§4 runs cap at ${ALCHEMY_MAX_RUNS}`)
  ok(alchemyRunsReady(shop.k, t0) === 0 && alchemyRunsReady(shop.k, t0 + rec.runMs * 2 + 10) === 2, '§4 runs land on the clock')
  ok(alchemyRunProgress(shop.k, t0 + rec.runMs / 2) > 0.45 && alchemyRunProgress(shop.k, t0 + rec.runMs / 2) < 0.55, '§4 progress is the CURRENT run')
  const c = alchemyCollect(shop, 'k', t0 + rec.runMs * 2 + 10)
  ok(c.payout?.itemId === 'powder_raw_mana_shard' && c.payout.count === 2 && c.xp === rec.xp * 2 && c.runsTaken === 2, '§4 take pays the ready runs and their XP')
  ok(c.shop.k!.runs === 3 && c.shop.k!.since === t0 + rec.runMs * 2, '§4 ★ the rest keep their clock from the run that landed, not from now')
  ok(alchemyBusy(c.shop.k), '§4 still busy with runs left')
  const done = alchemyCollect(c.shop, 'k', t0 + rec.runMs * 10)
  ok(done.shop.k === undefined && done.payout!.count === 3 && !alchemyBusy(done.shop.k), '§4 the last take clears the slot — the cauldron goes dark here')
  const s = alchemySalvage(shop, 'k', t0 + rec.runMs + 5)
  ok(s.shop.k === undefined && s.drops.some(d => d.itemId === 'powder_raw_mana_shard' && d.count === 1) && s.drops.some(d => d.itemId === 'raw_mana_shard' && d.count === 4),
    `§4 ★ salvage pays the finished run and returns the unfinished inputs (${JSON.stringify(s.drops)})`)
  const fin = alchemyRecipe('finish:mana_draught')!
  ok(alchemyMaxRuns(fin, () => 50, 12) === 2, `§4 ★ a finishing row is capped by MANA too (12 mana / ${fin.mana} per run = 2)`)
  ok(alchemyMaxRuns(fin, (id) => id === 'powder_raw_mana_shard' ? 7 : 0, 999) === 1, '§4 and by the inputs')
}

if (fails.length) {
  console.error(`❌ alchemy-chain: ${fails.length} failed (${pass} passed)`)
  for (const f of fails) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ alchemy-chain: ${pass} passed`)
