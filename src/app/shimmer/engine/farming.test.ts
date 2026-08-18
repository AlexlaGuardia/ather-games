// Farming — the element herbs and the crop round-trip
// run: npx tsx src/app/shimmer/engine/farming.test.ts
//
// This oracle exists for the half `npm run canon` deliberately does not read. The canon gate checks
// the claims about the WORLD (the four herbs exist, each carries the element canon rules). Every
// assert below is build-vs-build wiring — the joins that decide whether a herb canon has blessed is
// actually plantable, harvestable, and holds an item a brew can later ask for.
//
// Each of those joins fails silently. A cropId that does not resolve, a harvestItemId that is not
// the crop's own yield, a seed with no ItemDef: nothing throws, the herb simply never turns into
// anything, and the element behind it quietly stops leading anywhere.
import {
  CROP_DEFS, CROP_IDS, ELEMENT_HERBS, elementForHerbItem,
  canPlantCrop, plantCrop, harvestCrop, cropForSeed, getVisibleCrops,
} from './farming'
import { ITEMS, ITEM_FRAME_MAP, ITEM_ICONS } from '../sprites/items'
import { GE_BUY_CURATED } from '../play3d/ui'
import { createInventory, countItem, addItems } from './inventory'
import { createSkillSet } from './skills'
import { createManaPool } from './mana'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }

const ELEMENTS = ['mana', 'storm', 'earth', 'water'] as const
const itemIds = new Set(ITEMS.map(i => i.id))
const herbs = ELEMENTS.map(e => ({ element: e, ...ELEMENT_HERBS[e] }))

// ── the four elements are all present and distinct ─────────────────────────────
// A missing element is not a missing crop, it is ten canon second forms that cannot be reached.
chk('every element has a herb', herbs.every(h => !!h.cropId))
chk('no two elements share a herb', new Set(herbs.map(h => h.cropId)).size === 4)

for (const h of herbs) {
  const def = CROP_DEFS[h.cropId]
  chk(`${h.element}: cropId resolves`, !!def, h.cropId)
  if (!def) continue

  // The harvest item must be what the crop ACTUALLY drops. If these drift apart the herb still
  // grows and still pays out — into an item no infusion recipe will ever look for.
  chk(`${h.element}: harvestItemId is the crop's own yield`,
    def.yields.some(y => y.itemId === h.harvestItemId), `${h.harvestItemId} vs ${def.yields.map(y => y.itemId).join()}`)

  chk(`${h.element}: seed has an ItemDef`, itemIds.has(def.seedItemId), def.seedItemId)
  chk(`${h.element}: harvest has an ItemDef`, itemIds.has(h.harvestItemId), h.harvestItemId)
  chk(`${h.element}: seed plants this crop`, cropForSeed(def.seedItemId) === def.id)
  chk(`${h.element}: seed is on the shop shelf`, GE_BUY_CURATED.includes(def.seedItemId), def.seedItemId)
  chk(`${h.element}: harvest has an icon`, !!ITEM_ICONS[h.harvestItemId] && !!ITEM_FRAME_MAP[h.harvestItemId])
  chk(`${h.element}: seed has an icon`, !!ITEM_ICONS[def.seedItemId] && !!ITEM_FRAME_MAP[def.seedItemId])
  chk(`${h.element}: reverse lookup`, elementForHerbItem(h.harvestItemId) === h.element)
}

chk('an ordinary crop carries no element', elementForHerbItem('shimmerwheat_grain') === null)

// ── the four are peers ─────────────────────────────────────────────────────────
// Not a style preference. A cheaper herb is a cheaper element, and the element decides which of a
// spirit's four canon second forms it grows into — a farming dial reaching into forty ruled forms.
{
  const defs = herbs.map(h => CROP_DEFS[h.cropId])
  const same = <T,>(f: (d: typeof defs[0]) => T) => new Set(defs.map(f)).size === 1
  chk('same farming level', same(d => d.minFarmingLevel))
  chk('same mana cost', same(d => d.manaCost))
  chk('same yield count', same(d => d.yields[0].count))
  chk('all tier 2 (canon places them in tier 2)', defs.every(d => d.tier === 2))
  // Growth time is the one number canon prints AND Jin owns, and Rootvine is the ruled outlier
  // ("anchors deep. Heavy to harvest."). Pinned as the shape it is, not as a magnitude.
  chk('rootvine is the slow one', CROP_DEFS['rootvine'].growthMs > CROP_DEFS['tidepetal'].growthMs)
}

// ── plant → harvest round trip, at the gate and just under it ──────────────────
{
  const def = CROP_DEFS[ELEMENT_HERBS.storm.cropId]
  const inv = createInventory()
  addItems(inv, def.seedItemId, 2)
  const skills = createSkillSet()
  const mana = createManaPool()

  skills.farming.level = def.minFarmingLevel - 1
  chk('one level short cannot plant', !canPlantCrop(def.id, inv, skills.farming.level, mana))
  chk('one level short really refuses', plantCrop(def.id, inv, skills, mana, 0, 0, 'home') === null)
  chk('a refused planting keeps the seed', countItem(inv, def.seedItemId) === 2)

  skills.farming.level = def.minFarmingLevel
  chk('at the gate it plants', canPlantCrop(def.id, inv, skills.farming.level, mana))
  const crop = plantCrop(def.id, inv, skills, mana, 0, 0, 'home')
  chk('planting returns a crop', !!crop)
  chk('planting spends one seed', countItem(inv, def.seedItemId) === 1)

  if (crop) {
    const res = harvestCrop(crop, inv, skills)
    chk('harvest pays the herb', res.items.some(i => i.itemId === ELEMENT_HERBS.storm.harvestItemId))
    // One canon infusion recipe costs herb x2, so one harvest is one infusion's worth.
    chk('harvest covers one infusion', countItem(inv, ELEMENT_HERBS.storm.harvestItemId) >= 2)
    chk('harvest grants xp', res.xpGained > 0)
    chk('an element herb blooms no spirit', res.bloomed === undefined)
  }
}

// ── the herbs are reachable from the planting menu ─────────────────────────────
{
  const lvl = CROP_DEFS[ELEMENT_HERBS.mana.cropId].minFarmingLevel
  const visible = getVisibleCrops(lvl).map(d => d.id)
  chk('all four herbs are offered at their level', herbs.every(h => visible.includes(h.cropId)))
  chk('the herbs are in CROP_IDS', herbs.every(h => CROP_IDS.includes(h.cropId)))
}

// ── the Mana Seed still blooms ─────────────────────────────────────────────────
// Guarding the field the Farming editor's save route used to delete: `bloomsSpirit` is the whole
// payout of Greg's gift, and without it the opening of the game becomes a crop that yields nothing.
chk('the mana seed still blooms a spirit', CROP_DEFS['manabloom'].bloomsSpirit === true)

console.log(`farming: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
