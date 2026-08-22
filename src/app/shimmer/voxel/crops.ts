// The crop roster — what a crop IS, and which herb carries which element.
//
// ★ PURE, AND IN THE CORE ON PURPOSE. No react/three/DOM, no browser globals, no imports that
// escape the folder (VOXEL-WORLD-MODEL.md § 6 rule 4). This is DATA: the ten crops, their tiers,
// seeds, growth and yields, plus the canon element-herb mapping.
//
// ── ★★ WHY THE TABLE IS CORE AND THE BEHAVIOUR IS NOT ──────────────────────────────────────────
// `engine/farming.ts` still owns everything you DO with a crop — plantCrop, harvestCrop, the
// inventory and skill transactions — because those need Inventory, SkillSet and ManaPool, which are
// host-side. It imports these tables back and re-exports them, so every existing caller is
// unchanged and there is exactly ONE definition of each.
//
// The reason for the split is not tidiness, it is a question with an answer: PORT THE VOXEL CORE TO
// RUST AND ASK WHETHER A GRASS TUFT STILL DROPS A CROP SEED. It does — that is the front door's seed
// supply (`meadow-seed.ts`, ruled 2026-08-22), and `registry.ts` builds the grass drop tables at
// module load. So the core genuinely needs the roster, and `meadow-seed.ts` reaching UP into the
// engine for it was the last of nine port-boundary violations rather than a special case.
//
// ⚠ THE MAP EDITOR REWRITES `CROP_DEFS` IN THIS FILE BY REGEX (`save-map/route.ts`), so the block's
// SHAPE is load-bearing: `export const CROP_DEFS: Record<string, CropDef> = {` ... `\n}`. Do not
// reformat that declaration line or the closing brace. `save-map/targets.test.ts` re-checks that the
// pattern still matches, because a rewrite that matches nothing used to answer 200 and write nothing.

/**
 * The four elements an herb can carry.
 *
 * ⚠ DECLARED HERE RATHER THAN IMPORTED, AND `farming.ts` PINS IT TO CANON'S `Element`. The core may
 * not import `../spirits/spirit`, but the property that matters — that `ELEMENT_HERBS` cannot compile
 * with an element missing — must not be lost in the move. So the union lives here and farming.ts
 * carries a compile-time assertion that it is exactly `Exclude<Element, 'base'>`. If canon gains a
 * fifth element, that assertion fails there and this table fails here; neither can drift alone.
 */
export type HerbElement = 'mana' | 'storm' | 'earth' | 'water'

export interface CropDef {
  id: string
  name: string
  tier: 1 | 2 | 3 | 4
  minFarmingLevel: number
  manaCost: number
  plantXp: number         // small XP on planting
  xpGrant: number         // main XP on harvest
  growthMs: number        // growth duration in ms
  seedItemId: string      // crop seed item ID
  yields: { itemId: string; count: number; chance: number }[]
  yieldBonusPerLevel: number  // extra yield % per level above min (0.02 = 2%)
  /**
   * This crop blooms a SPIRIT rather than items. Only the Mana Seed does.
   *
   * A flag rather than a separate system because everything else about it is farming: it is planted
   * in a pot, it takes time, it is tended, it is read off `plantedCrops`. Only the payout differs,
   * so only the payout branches.
   */
  bloomsSpirit?: boolean
}

/** The seed item Greg gifts, and the id of what it grows. */
export const MANA_SEED_ITEM = 'mana_seed'
export const MANA_BLOOM_CROP = 'manabloom'

export const CROP_DEFS: Record<string, CropDef> = {
  // ── The Mana Seed — the start of the whole game ────────────────────────────────────────────
  // "A Mana Seed. It rode the wind in from far off, the way they all do. Plant it, tend it, and
  // something will choose to grow." (Greg, CANON/game/shimmer-quests-mainmap.md)
  //
  // manaCost 0 and minFarmingLevel 1 deliberately: this is a GIFT to someone who has never played,
  // and a first spirit gated behind a resource they do not have yet would strand them at the exact
  // moment the game is supposed to open up. It costs patience, nothing else.
  manabloom: {
    id: MANA_BLOOM_CROP, name: 'Mana Seed', tier: 1,
    minFarmingLevel: 1, manaCost: 0, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: MANA_SEED_ITEM, yieldBonusPerLevel: 0,
    yields: [],            // it pays out a spirit, not items — see `bloomsSpirit`
    bloomsSpirit: true,
  },

  // Tier 1 — Beginner
  shimmerwheat: {
    id: 'shimmerwheat', name: 'Shimmerwheat', tier: 1,
    minFarmingLevel: 1, manaCost: 3, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: 'seed_shimmerwheat', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'shimmerwheat_grain', count: 2, chance: 1.0 }],
  },
  glowroot: {
    id: 'glowroot', name: 'Glowroot', tier: 1,
    minFarmingLevel: 1, manaCost: 3, plantXp: 5, xpGrant: 20, growthMs: 5 * 60 * 1000,
    seedItemId: 'seed_glowroot', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'glowroot_bulb', count: 2, chance: 1.0 }],
  },
  sunpetal: {
    id: 'sunpetal', name: 'Sunpetal', tier: 1,
    minFarmingLevel: 3, manaCost: 4, plantXp: 8, xpGrant: 28, growthMs: 7 * 60 * 1000,
    seedItemId: 'seed_sunpetal', yieldBonusPerLevel: 0.02,
    yields: [{ itemId: 'sunpetal_bloom', count: 1, chance: 1.0 }],
  },

  // Tier 2 — Intermediate
  moonvine: {
    id: 'moonvine', name: 'Moonvine', tier: 2,
    minFarmingLevel: 5, manaCost: 5, plantXp: 12, xpGrant: 40, growthMs: 12 * 60 * 1000,
    seedItemId: 'seed_moonvine', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'moonvine_leaf', count: 2, chance: 1.0 }],
  },
  crystalcap: {
    id: 'crystalcap', name: 'Crystalcap', tier: 2,
    minFarmingLevel: 7, manaCost: 6, plantXp: 15, xpGrant: 50, growthMs: 14 * 60 * 1000,
    seedItemId: 'seed_crystalcap', yieldBonusPerLevel: 0.03,
    yields: [
      { itemId: 'crystalcap_spore', count: 1, chance: 1.0 },
      { itemId: 'pure_mana_core', count: 1, chance: 0.1 },
    ],
  },
  starbean: {
    id: 'starbean', name: 'Starbean', tier: 2,
    minFarmingLevel: 8, manaCost: 5, plantXp: 14, xpGrant: 45, growthMs: 15 * 60 * 1000,
    seedItemId: 'seed_starbean', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'starbean_pod', count: 2, chance: 1.0 }],
  },

  // ── The four element herbs — the ingredient half of the infusion economy ──────────────────
  // CANON (`CANON/game/alchemy.md`, ruled 2026-07-30 · `game/shimmer-skilling.md` › Tier 2):
  // Violetbloom (Mana) · Stormgrass (Storm) · Rootvine (Earth) · Tidepetal (Water) feed the four
  // Infusions, and the Infusions are the ONLY road to an evolved form. Canon owns that these four
  // exist, which element each carries, and their growth times (20/20/25/20 min — Rootvine "anchors
  // deep. Heavy to harvest."). Level gates, mana cost, XP and yield counts are Jin's.
  //
  // ⚠ ALL FOUR SHARE ONE LEVEL, MANA COST AND YIELD ON PURPOSE. The four elements are peers: a
  // keeper who can reach Storm can reach Water on the same day. Make one herb cheaper and you have
  // silently ruled that its element is the default evolution path for every spirit in the game —
  // a balance dial reaching through into forty canon second forms.
  //
  // yields 2 because one canon Infusion recipe costs herb ×2 — one harvest, one infusion.
  violetbloom: {
    id: 'violetbloom', name: 'Violetbloom', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 13 * 60 * 1000,
    seedItemId: 'seed_violetbloom', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'violetbloom_petal', count: 2, chance: 1.0 }],
  },
  stormgrass: {
    id: 'stormgrass', name: 'Stormgrass', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 13 * 60 * 1000,
    seedItemId: 'seed_stormgrass', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'stormgrass_blade', count: 2, chance: 1.0 }],
  },
  rootvine: {
    id: 'rootvine', name: 'Rootvine', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 60, growthMs: 16 * 60 * 1000,
    seedItemId: 'seed_rootvine', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'rootvine_coil', count: 2, chance: 1.0 }],
  },
  tidepetal: {
    id: 'tidepetal', name: 'Tidepetal', tier: 2,
    minFarmingLevel: 6, manaCost: 6, plantXp: 14, xpGrant: 55, growthMs: 13 * 60 * 1000,
    seedItemId: 'seed_tidepetal', yieldBonusPerLevel: 0.03,
    yields: [{ itemId: 'tidepetal_bloom', count: 2, chance: 1.0 }],
  },

  // Tier 3 — Advanced
  dreamroot: {
    id: 'dreamroot', name: 'Dreamroot', tier: 3,
    minFarmingLevel: 12, manaCost: 8, plantXp: 22, xpGrant: 80, growthMs: 24 * 60 * 1000,
    seedItemId: 'seed_dreamroot', yieldBonusPerLevel: 0.04,
    yields: [{ itemId: 'dreamroot_essence', count: 1, chance: 1.0 }],
  },
  shimmerbloom: {
    id: 'shimmerbloom', name: 'Shimmerbloom', tier: 3,
    minFarmingLevel: 15, manaCost: 10, plantXp: 28, xpGrant: 100, growthMs: 28 * 60 * 1000,
    seedItemId: 'seed_shimmerbloom', yieldBonusPerLevel: 0.04,
    yields: [
      { itemId: 'shimmerbloom_petal', count: 1, chance: 1.0 },
      { itemId: 'shimmer_dust', count: 1, chance: 0.15 },
    ],
  },

  // Tier 4 — Master
  atherwheat: {
    id: 'atherwheat', name: 'Atherwheat', tier: 4,
    minFarmingLevel: 20, manaCost: 12, plantXp: 35, xpGrant: 150, growthMs: 42 * 60 * 1000,
    seedItemId: 'seed_atherwheat', yieldBonusPerLevel: 0.05,
    yields: [
      { itemId: 'atherwheat_grain', count: 1, chance: 1.0 },
      { itemId: 'ather_crystal', count: 1, chance: 0.05 },
    ],
  },
  dawncap: {
    id: 'dawncap', name: 'Dawncap', tier: 4,
    minFarmingLevel: 25, manaCost: 14, plantXp: 40, xpGrant: 200, growthMs: 50 * 60 * 1000,
    seedItemId: 'seed_dawncap', yieldBonusPerLevel: 0.05,
    yields: [
      { itemId: 'dawncap_spore', count: 2, chance: 1.0 },
      { itemId: 'crystallized_sap', count: 1, chance: 0.1 },
    ],
  },
}

export const CROP_IDS = Object.keys(CROP_DEFS)

/**
 * Which herb carries which element — the canon half of the infusion economy.
 *
 * ⚠ THIS LIVES OUTSIDE `CROP_DEFS` DELIBERATELY, AND THE REASON IS A LIVE TRAP. The Farming
 * editor's save route (`save-map/route.ts`) does not patch `CROP_DEFS`; it REBUILDS the whole block
 * from a fixed list of fields. Any field it does not serialize is deleted the next time somebody
 * saves a tuning change — silently, in a file nobody re-reads. A canon mapping must not sit in a
 * block a tuning editor rewrites.
 *
 * Keyed by element rather than by crop so the type system enforces what the gate also checks:
 * `Record<Exclude<Element, 'base'>, ...>` cannot compile with an element missing, and a missing
 * element is the failure that matters — it makes ten canon second forms unreachable while
 * everything still runs.
 */
export const ELEMENT_HERBS: Record<HerbElement, { cropId: string; harvestItemId: string }> = {
  mana:  { cropId: 'violetbloom', harvestItemId: 'violetbloom_petal' },
  storm: { cropId: 'stormgrass',  harvestItemId: 'stormgrass_blade' },
  earth: { cropId: 'rootvine',    harvestItemId: 'rootvine_coil' },
  water: { cropId: 'tidepetal',   harvestItemId: 'tidepetal_bloom' },
}
