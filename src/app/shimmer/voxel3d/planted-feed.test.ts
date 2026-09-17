// The planted feed's oracle. Run: npx tsx src/app/shimmer/voxel3d/planted-feed.test.ts
//
// ★ WHAT THIS GUARDS. The feed is a JOIN between three tables that nothing else joins: the crop
// roster (`crops.ts`), the wild materials (`flora.ts`), and the renderer's tints. A crop added to
// the roster without a look here does not error — it plants, grows, harvests, and draws NOTHING,
// which is the exact 26-day silence this file exists to end. So the first block walks every bed
// crop and demands a look, by name.
import {
  plantedLook, plantedStage, plantedSpots, plantedSignature, bedVariant,
  BED_CROP_IDS, STAGE_GROW, STAGE_RIPE, SEED_CROP_LOOK, HERB_MAT_OF_CROP, WILD_MAT_OF_CROP,
} from './planted-feed'
import { CROP_DEFS, CROP_IDS, MANA_BLOOM_CROP, ELEMENT_HERBS } from '../voxel/crops'
import { CROP_ID_OF_MAT } from '../voxel/flora'
import { MATERIAL_COLOR } from './attrs'
import type { PlantedCrop } from '../engine/farming'
import { bedKey, type PlantedBeds } from './planting'

let pass = 0
const fails: string[] = []
function ok(cond: boolean, label: string) { if (cond) pass++; else fails.push(label) }

// ── 1. ★★★ every bed crop has a look, and the pot's does not ─────────────────────────────────
{
  for (const id of BED_CROP_IDS) {
    const look = plantedLook(id)
    ok(look !== null, `★★★ ${id} can be planted in a bed and would draw NOTHING — no look`)
    if (!look) continue
    if (look.mat) {
      ok(MATERIAL_COLOR[look.mat] !== undefined,
        `${id}'s material ${look.mat} has no MATERIAL_COLOR — its body would tint to the fallback`)
    } else {
      ok(look.body !== undefined && look.head !== undefined,
        `${id} has no material AND no explicit tints — half a look`)
    }
  }
  ok(plantedLook(MANA_BLOOM_CROP) === null, 'the mana seed is the POT\'s and must not draw in a bed')
  ok(plantedLook('not_a_crop') === null, 'an unknown crop id draws nothing rather than a default')
  ok(BED_CROP_IDS.length === CROP_IDS.length - 1, `bed crops = roster minus the one pot crop (${BED_CROP_IDS.length})`)
  // The two derived tables reach every wild crop and every herb: the join has no hole.
  ok(Object.keys(WILD_MAT_OF_CROP).length === Object.keys(CROP_ID_OF_MAT).length, 'WILD_MAT_OF_CROP is CROP_ID_OF_MAT inverted, whole')
  for (const { cropId } of Object.values(ELEMENT_HERBS))
    ok(HERB_MAT_OF_CROP[cropId] !== undefined, `element herb ${cropId} has no material row — it would fall through to a crop look`)
  // Every crop that is neither wild nor a herb must be in the explicit table, and nothing else is.
  const seedOnly = BED_CROP_IDS.filter(id => !(id in WILD_MAT_OF_CROP) && !(id in HERB_MAT_OF_CROP))
  ok(seedOnly.every(id => id in SEED_CROP_LOOK) && Object.keys(SEED_CROP_LOOK).every(id => seedOnly.includes(id)),
    `SEED_CROP_LOOK is exactly the mat-less crops — got ${seedOnly.join(',')} vs ${Object.keys(SEED_CROP_LOOK).join(',')}`)
  // Pools: herbs draw as herbs, everything else as a crop.
  for (const { cropId } of Object.values(ELEMENT_HERBS)) ok(plantedLook(cropId)!.pool === 'herb', `${cropId} draws in the herb pool`)
  ok(plantedLook('atherwheat')!.pool === 'crop', 'atherwheat draws in the crop pool')
}

// ── 2. ★★ the stages: monotonic, ripe is the head not the height, and ripe ≠ engine phase 3 ──
{
  ok(STAGE_GROW[0] < STAGE_GROW[1] && STAGE_GROW[1] < STAGE_GROW[2] && STAGE_GROW[2] < STAGE_GROW[3],
    'growth is monotonic across the four growing stages')
  ok(STAGE_GROW[3] === STAGE_GROW[4], 'ripe is the grown crop\'s height — ripeness adds the head, not size')
  ok(STAGE_GROW[0] > 0 && STAGE_GROW[0] < 0.25, 'the mound is a nub — visible, not a plant')

  const mk = (progress: number, dur = 600_000): PlantedCrop => ({
    id: 'bed-0,0,0', cropId: 'atherwheat', tileX: 0, tileY: 0, zoneId: 'bed:0',
    plantedAt: Date.now() - progress * dur, growthDuration: dur,
  })
  ok(plantedStage(mk(0)) === 0, 'just planted = mound')
  ok(plantedStage(mk(0.3)) === 1, '30% = sprout')
  ok(plantedStage(mk(0.6)) === 2, '60% = growing')
  // ★★ THE QUARTER THE ENGINE CALLS "3" AND THE PANEL CALLS "not ready". Drawing the head here
  // sends a keeper to a bed that refuses them. This is the reason there are five stages.
  ok(plantedStage(mk(0.9)) === 3, '90% = grown, NOT ripe — engine phase 3 is not readiness')
  ok(plantedStage(mk(1.0)) === STAGE_RIPE, '100% = ripe')
  ok(plantedStage(mk(3.0)) === STAGE_RIPE, 'long past ready stays ripe')
}

// ── 3. the spots: the key is the address, the turn is the position, the signature is the picture ─
{
  const beds: PlantedBeds = new Map()
  const crop = (id: string, x: number, y: number, z: number, progress: number): PlantedCrop => ({
    id: `bed-${x},${y},${z}`, cropId: id, tileX: x, tileY: z, zoneId: `bed:${y}`,
    plantedAt: Date.now() - progress * 600_000, growthDuration: 600_000,
  })
  beds.set(bedKey(3, 12, -7), crop('glowroot', 3, 12, -7, 0.1))
  beds.set(bedKey(4, 12, -7), crop('violetbloom', 4, 12, -7, 1.2))
  const spots = plantedSpots(beds)
  ok(spots.length === 2, 'one spot per bed')
  const a = spots.find(s => s.x === 3)!, b = spots.find(s => s.x === 4)!
  ok(a.y === 12 && a.z === -7 && a.cropId === 'glowroot' && a.stage === 0, 'the bed key parses to the cell, negative z included')
  ok(b.stage === STAGE_RIPE, 'the ripe herb is ripe')
  ok(a.variant !== b.variant && a.variant >= 0 && a.variant < 1, 'neighbouring beds turn differently, in [0,1)')
  ok(bedVariant(3, 12, -7) === a.variant, 'the turn is position-pure: same bed, same turn')

  const sig1 = plantedSignature(spots)
  ok(sig1 === plantedSignature([...spots].reverse()), 'the signature is order-independent')
  ok(sig1 !== plantedSignature([{ ...a, stage: 1 }, b]), 'a stage crossing moves the signature')
  ok(sig1 !== plantedSignature([b]), 'a harvest (a bed emptied) moves the signature')
  ok(plantedSignature([]) === '', 'no beds, empty signature')

  // A malformed key is skipped, not thrown — the save is the only writer but a bad row must
  // not take the whole feed down with it.
  beds.set('garbage', crop('atherwheat', 0, 0, 0, 0))
  ok(plantedSpots(beds).length === 2, 'a malformed key is skipped')
}

// ── 4. the seed-only tints are real colours, and none collides with a wild crop's body ────────
{
  const bodies = new Set(Object.keys(WILD_MAT_OF_CROP).map(id => MATERIAL_COLOR[WILD_MAT_OF_CROP[id]]))
  for (const [id, t] of Object.entries(SEED_CROP_LOOK)) {
    ok(t.body >= 0 && t.body <= 0xffffff && t.head >= 0 && t.head <= 0xffffff, `${id} tints are 24-bit`)
    ok(!bodies.has(t.body), `${id}'s body colour is not a wild crop's exact body — two crops one colour`)
    ok(CROP_DEFS[id] !== undefined, `${id} is a real crop`)
  }
}

console.log(`planted feed: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length === 0) console.log('✅ a seed in a bed is a plant you can see')
process.exit(fails.length === 0 ? 0 : 1)
