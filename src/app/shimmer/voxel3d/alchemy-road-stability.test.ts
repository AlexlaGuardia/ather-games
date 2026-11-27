// A display rename must never move a road. Run: npx tsx src/app/shimmer/voxel3d/alchemy-road-stability.test.ts
//
// M234 s1 (1a24f662) renamed potions "display names only", but the voxel road was parsed from the
// name's last word, so Mana Draught -> Mana Elixir walked the first potion grinder -> still -> cauldron
// (was: cauldron, pour) and Starlight Tincture -> Starlight Tonic swapped its still for grinder + bowl.
// §1 pins every potion's road + job to what it was BEFORE that rename (read from 1a24f662^).
// §2 renames every potion to every craft-word and proves road, job and pot time do not move.
import { POTION_DEFS } from '../engine/alchemy'
import { roadOf, jobOf, ROAD_CLASS, CRAFT_WORDS, type RoadStep, type PotionJob } from './alchemy-chain'
import { brewMs, type Brewing } from './brewing'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// The roads as they stood at 1a24f662^ (the pre-rename tree), for every potion that still exists.
const PRE_M234: Readonly<Record<string, [readonly RoadStep[], PotionJob]>> = {
  mana_draught: [[], 'hand'],
  shard_tonic: [['grind'], 'hand'],
  shimmer_salve: [['mix'], 'plot'],
  glowfin_brew: [['grind', 'mix'], 'hand'],
  crystal_elixir: [['grind', 'distil'], 'hand'],
  mana_infusion: [['grind', 'distil', 'mix'], 'spirit'],
  storm_infusion: [['grind', 'distil', 'mix'], 'spirit'],
  earth_infusion: [['grind', 'distil', 'mix'], 'spirit'],
  potent_earth_infusion: [['grind', 'distil', 'mix'], 'spirit'],
  water_infusion: [['grind', 'distil', 'mix'], 'spirit'],
  starlight_tincture: [['distil'], 'hand'],
  deep_essence: [['distil', 'distil'], 'hand'],
  ather_infusion: [['grind', 'mix'], 'hand'],
  dawn_cordial: [['mix'], 'hand'],
  harvest_brew: [['grind'], 'plot'],
  bed_brew: [['grind'], 'plot'],
  moonvine_tonic: [['distil', 'mix'], 'hand'],
  dreamroot_elixir: [['grind', 'mix', 'distil'], 'hand'],
}

// ── §1 every renamed potion keeps its pre-rename road and job ──────────────────────────────────────
ok(roadOf('mana_draught').length === 0, `§1 ★★ Mana Elixir (mana_draught) is still cauldron, pour (road ${JSON.stringify(roadOf('mana_draught'))})`)
ok(JSON.stringify(roadOf('starlight_tincture')) === '["distil"]', `§1 ★ Starlight Tonic keeps its still (road ${JSON.stringify(roadOf('starlight_tincture'))})`)
for (const id of Object.keys(POTION_DEFS)) {
  const pre = PRE_M234[id]
  ok(!!pre, `§1 ${id}: has a pinned pre-M234 road here (a new potion: add its row)`)
  ok(id in ROAD_CLASS, `§1 ${id}: has a ROAD_CLASS row, so its road is keyed by id, not by name`)
  if (!pre) continue
  ok(JSON.stringify(roadOf(id)) === JSON.stringify(pre[0]), `§1 ${id}: road ${JSON.stringify(roadOf(id))} = pre-rename ${JSON.stringify(pre[0])}`)
  ok(jobOf(id) === pre[1], `§1 ${id}: job ${jobOf(id)} = pre-rename ${pre[1]}`)
}

// ── §2 renaming to ANY craft-word moves nothing ───────────────────────────────────────────────────
const brewing = (potionId: string) => ({ potionId }) as unknown as Brewing
for (const id of Object.keys(POTION_DEFS)) {
  const def = POTION_DEFS[id]
  const name = def.name
  const road = JSON.stringify(roadOf(id)), job = jobOf(id), ms = brewMs(brewing(id))
  for (const w of CRAFT_WORDS) {
    def.name = `Renamed ${w[0].toUpperCase()}${w.slice(1)}`
    ok(JSON.stringify(roadOf(id)) === road, `§2 ${id} renamed "${def.name}": road stays ${road} (got ${JSON.stringify(roadOf(id))})`)
    ok(jobOf(id) === job, `§2 ${id} renamed "${def.name}": job stays ${job}`)
    ok(brewMs(brewing(id)) === ms, `§2 ${id} renamed "${def.name}": pot time stays ${ms}`)
  }
  def.name = name
}

if (fails.length) {
  console.error(`❌ alchemy-road-stability: ${fails.length} failed (${pass} passed)`)
  for (const f of fails.slice(0, 30)) console.error('  - ' + f)
  process.exit(1)
}
console.log(`✅ alchemy-road-stability: ${pass} passed`)
