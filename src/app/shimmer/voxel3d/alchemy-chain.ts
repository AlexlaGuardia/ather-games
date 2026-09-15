// ── THE ALCHEMY CHAIN: a potion is made in STEPS, and the potion's own name says which ──────────
//
// Until 2026-09-14 a potion was one click at the cauldron: ingredients in, bottle out. Alex:
// *"break the process down into steps to make a potion.. like grinding up a powder, distilling,
// mixing, and brewing as different stations."* Canon had already said where the steps come from —
// the vessels brief (`design-briefs/shimmer-alchemy-vessels.md`, ruled 07-23) rules that **the
// craft-word IS the method**: a draught is *brewed plain*, a brew is *boiled in quantity*, an elixir
// is *distilled and refined*, a tincture is *an extract taken in drops*, an essence is
// *concentrated*, an infusion is *steeped pure*, a philter is *steeped for feeling*, a cordial is
// *aged*, a salve is *a paste*. So the stations are not four hoops every potion jumps through; they
// are the four verbs, and the last word of a potion's name decides its route through them.
//
// The shape, in full:
//   1. PREP — every ingredient is prepared by its KIND: a dry thing (crystal, shard, bark, scale,
//      shell, spore, grain) is GROUND to a powder; a wet thing (sap, fruit, bloom, fish) is
//      DISTILLED to an extract. Counts are preserved 1:1, so a recipe that wants five shards wants
//      five shard-powder.
//   2. FINISH — the craft-word names the station that turns the preps into the bottle:
//        cauldron (boiled): draught · brew · cordial · infusion
//        mixing vessel (no fire): tonic · salve · philter
//        still (refined): elixir · tincture · essence
//      An infusion is the flagship (canon: *"THE money maker"*) and earns the whole chain — its
//      preps are MIXED to a base first, and the base is brewed. Everything else goes preps → finish.
//
// So a Mana Draught (five shards) is grind → brew, two stations; a tier-1 potion must stay a short
// walk or the chain is friction rather than craft (the objection this design had to answer before
// it was allowed to exist). The infusions are four.
//
// ★ PURE. No world, no React, no inventory: this file says what the steps ARE and what each station
// lists; `alchemy-panel.tsx` spends and pays, `VoxelWorld.tsx` owns the blocks. The job record is
// the workshop's own `StationJob` (`voxel/workshop.ts`) so a still's run persists with the column
// the way a sawmill's does — but the recipes here are NOT `RECIPES` rows, on purpose: that table's
// law is *every recipe stays hand-makeable anywhere* (`recipes.ts`), and a potion cannot be boiled
// on your knee. Two tables, one job shape.
//
// THE WORDS ARE CANON'S. Shipped 09-14 under placeholders (grinder / mixing vessel) with an `[OPEN]`
// gap; RULED 2026-09-15 (athernyx b3a3979): Mortar (stone) · Still (glass on a fired-clay foot) · Bowl (fired
// clay, wide and shallow, cold) · Cauldron. Ids stay as the code key; `ALCHEMY_STATIONS[*].name` is
// the one place the word lives. Barred: quern (miller's word), alembic (Citadel copper), basin (a Wilds ground).
import { POTION_DEFS, type PotionDef } from '../engine/alchemy'
import { MAT } from '../voxel/depth'
import type { StationJob, Workshop } from '../voxel/workshop'

// ── the steps ───────────────────────────────────────────────────────────────────────────────────
export type AlchemyStep = 'grind' | 'distil' | 'mix' | 'brew' | 'bake'
export type AlchemyStationId = 'grinder' | 'still' | 'mixer' | 'cauldron' | 'oven'

export interface AlchemyStationDef {
  id: AlchemyStationId
  /** The word on the panel. ⚠ Placeholder until Magii rules it — see the header. */
  name: string
  /** The one step this station performs. `stationRecipes` lists only that step's rows. */
  step: AlchemyStep
  /** Milliseconds per run. Mine (Jin's) to tune; canon owns none of these numbers. */
  runMs: number
  /** Every material that IS this station — the cauldron has a lit twin while it runs. */
  materials: readonly number[]
  /**
   * ── ★ THE OVEN RIDES THIS TABLE, AND THE WORD SAYS WHICH TRADE IT IS (2026-09-15, Alex: "we need
   * to make sure all of our stations are interactable.. starting with the oven") ─────────────────
   * The oven shipped 09-13 as a lit block with no verb. What it needs is exactly what the chain
   * already has — a timed job on the column save, a panel, a salvage on break, chests beside it —
   * and none of what makes alchemy alchemy: no mana channelled, no alchemy level, no alchemy XP.
   * So it is a row here rather than a fourth job system, and `craft` is the flag the panel reads to
   * drop the alchemy line. Bread is canon's (Greg feeds Bonn *"fruits, bread, honey-like things"*,
   * spirit-tales-bible); what the Ather CALLS the oven is still TBD-canon (`depth.ts` › OVEN).
   */
  craft: 'alchemy' | 'cooking'
}

/** How long a run takes at each station. First guesses, 2026-09-14; Alex judges the feel. */
export const ALCHEMY_RUN_MS = {
  grind: 3_000,
  distil: 8_000,
  mix: 5_000,
  brew: 12_000,
  /** A cordial is AGED — the one word whose method is time. Brewed on the cauldron, slowly. */
  age: 30_000,
  /** A loaf. Slow on purpose: an oven is a thing you set going and come back to. */
  bake: 20_000,
} as const

export const ALCHEMY_STATIONS: Record<AlchemyStationId, AlchemyStationDef> = {
  grinder:  { id: 'grinder',  name: 'Mortar',         step: 'grind',  runMs: ALCHEMY_RUN_MS.grind,  materials: [MAT.GRINDER], craft: 'alchemy' },
  still:    { id: 'still',    name: 'Still',          step: 'distil', runMs: ALCHEMY_RUN_MS.distil, materials: [MAT.STILL], craft: 'alchemy' },
  mixer:    { id: 'mixer',    name: 'Bowl',           step: 'mix',    runMs: ALCHEMY_RUN_MS.mix,    materials: [MAT.MIXER], craft: 'alchemy' },
  cauldron: { id: 'cauldron', name: 'Cauldron',       step: 'brew',   runMs: ALCHEMY_RUN_MS.brew,   materials: [MAT.CAULDRON, MAT.CAULDRON_LIT], craft: 'alchemy' },
  oven:     { id: 'oven',     name: 'Oven',           step: 'bake',   runMs: ALCHEMY_RUN_MS.bake,   materials: [MAT.OVEN], craft: 'cooking' },
}

// ── the oven's own rows: hand-written, not derived — there is no potion table behind a loaf ──────
// Shimmerwheat because it is the tier-1 grain (`crops.ts`; atherwheat is the level-20 master crop).
// Three grain to a loaf is a first guess for the feel, same licence as every run time above.
// ⚠ Bread has no eater yet: nothing in voxel3d drinks a potion or eats a loaf (the `use` verb is
// unbuilt on this surface — `engine/potion-effects.ts` is play3d's). The oven is interactable and
// the loaf is real; what it DOES is the next piece, and it is the same piece the 17 potions wait on.
export const COOK_ROWS: readonly Omit<AlchemyRecipe, 'runMs'>[] = [
  { id: 'bake:bread', name: 'Bread', step: 'bake', station: 'oven',
    input: [{ itemId: 'shimmerwheat_grain', count: 3 }], output: { itemId: 'bread', count: 1 },
    mana: 0, xp: 0, minLevel: 1 },
]

const STATION_BY_MAT: ReadonlyMap<number, AlchemyStationId> = new Map(
  Object.values(ALCHEMY_STATIONS).flatMap(s => s.materials.map(m => [m, s.id] as const)),
)

/** Which alchemy station a placed block is, or null. The lit cauldron answers `cauldron`. */
export const alchemyStationOf = (material: number): AlchemyStationId | null => STATION_BY_MAT.get(material) ?? null

/** Every material that is an alchemy station, for the interact rule and the registry oracle. */
export const ALCHEMY_MATS: ReadonlySet<number> = new Set(STATION_BY_MAT.keys())

// ── the ingredients: dry is ground, wet is distilled ────────────────────────────────────────────
// A kind per ingredient id, not a rule over its name: `crystallized_sap` has *sap* in it and is a
// crystal, `glowroot_bulb` is a juicy root, and a fish is neither a plant nor a stone. The table is
// asserted complete against `POTION_DEFS` in `alchemy-chain.test.ts`, so a new potion with a new
// ingredient fails a test rather than silently getting no prep step.
export type IngredientKind = 'dry' | 'wet'
export const INGREDIENT_KIND: Readonly<Record<string, IngredientKind>> = {
  raw_mana_shard: 'dry', goldwood_bark: 'dry', shimmerscale: 'dry',
  violet_crystal: 'dry', water_crystal: 'dry', storm_crystal: 'dry', earth_crystal: 'dry', ather_crystal: 'dry',
  rootvine_coil: 'dry', stormgrass_blade: 'dry', pure_mana_core: 'dry', pearlshell: 'dry',
  starwillow_branch: 'dry', crystallized_sap: 'dry', dawnwood_plank: 'dry', crystal_rinn: 'dry',
  shimmerwheat_grain: 'dry', moonvine_leaf: 'dry', crystalcap_spore: 'dry',
  // ⚠ Two tier-1 calls made for the WALK, not the botany: a root bulb and a fruit are ground,
  // because harvest brew and shimmer salve are tier-1 potions and a third station on a
  // beginner's route is friction (§2 of the test holds tier 1 at two stations). A bulb is a
  // root and a salve is a paste, so both readings are honest; the test is what decided.
  glowroot_bulb: 'dry', sunfruit: 'dry',
  glowfin: 'wet', ribboneel: 'wet', amber_sap: 'wet', moonberry: 'wet',
  violetbloom_petal: 'wet', tidepetal_bloom: 'wet', starwillow_sap: 'wet', moonkoi: 'wet',
  sunpetal_bloom: 'wet', dreamroot_essence: 'wet',
}

/** The intermediate an ingredient becomes. A powder for a dry thing, an extract for a wet one. */
export const prepOf = (ingredientId: string): string =>
  INGREDIENT_KIND[ingredientId] === 'wet' ? `extract_${ingredientId}` : `powder_${ingredientId}`

export const prepStep = (ingredientId: string): AlchemyStep =>
  INGREDIENT_KIND[ingredientId] === 'wet' ? 'distil' : 'grind'

/** The mixed, unbrewed infusion — the one intermediate that is a potion-in-waiting. */
export const baseOf = (potionId: string): string => `base_${potionId}`

// ── the craft-word decides the finishing station ────────────────────────────────────────────────
// Read off the LAST WORD OF THE NAME, which is the word canon ruled on. Asserted total over
// `POTION_DEFS` in the test: a potion whose name ends in a word this table does not know has no
// route, and that must be red rather than "goes to the cauldron by default".
export type CraftWord = 'draught' | 'tonic' | 'brew' | 'elixir' | 'philter' | 'tincture' | 'essence' | 'infusion' | 'cordial' | 'salve'
export const FINISH_AT: Readonly<Record<CraftWord, AlchemyStationId>> = {
  draught: 'cauldron', brew: 'cauldron', cordial: 'cauldron', infusion: 'cauldron',
  tonic: 'mixer', salve: 'mixer', philter: 'mixer',
  elixir: 'still', tincture: 'still', essence: 'still',
}

export const craftWordOf = (def: PotionDef): CraftWord | null => {
  const last = def.name.trim().split(/\s+/).pop()?.toLowerCase() ?? ''
  return last in FINISH_AT ? (last as CraftWord) : null
}

// ── recipes, one table per station, DERIVED from the potion list ────────────────────────────────
export interface AlchemyRecipe {
  /** `grind:<ingredient>` · `distil:<ingredient>` · `mix:<potion>` · `finish:<potion>` */
  id: string
  name: string
  step: AlchemyStep
  station: AlchemyStationId
  input: { itemId: string; count: number }[]
  output: { itemId: string; count: number }
  /** Mana per run. Only a finishing run channels mana (the potion's own `manaCost`); prep is free. */
  mana: number
  /** Alchemy XP per run, paid when the bottle is TAKEN. Prep pays a sliver so the walk is not unpaid. */
  xp: number
  /** The keeper's alchemy level the row asks for. Prep inherits the lowest potion that wants it. */
  minLevel: number
  /** Milliseconds per run at this row — the station's, except a cordial ages. */
  runMs: number
}

function buildRecipes(): AlchemyRecipe[] {
  const rows: AlchemyRecipe[] = []
  const prepMin = new Map<string, number>()
  for (const def of Object.values(POTION_DEFS)) {
    for (const r of def.recipe) prepMin.set(r.itemId, Math.min(prepMin.get(r.itemId) ?? Infinity, def.minAlchemyLevel))
  }
  // Preps: one row per ingredient any potion uses, 1 → 1, at the station its kind names.
  for (const [ing, minLevel] of prepMin) {
    const step = prepStep(ing)
    const station = step === 'grind' ? 'grinder' : 'still'
    rows.push({
      id: `${step}:${ing}`, name: `${step === 'grind' ? 'Grind' : 'Distil'} ${label(ing)}`,
      step, station, input: [{ itemId: ing, count: 1 }], output: { itemId: prepOf(ing), count: 1 },
      mana: 0, xp: 1, minLevel, runMs: ALCHEMY_STATIONS[station].runMs,
    })
  }
  // Finishes (and the infusion's mix), one per potion, from the craft-word.
  for (const def of Object.values(POTION_DEFS)) {
    const word = craftWordOf(def)
    if (!word) continue                      // the test makes this loud; the runtime stays honest
    const preps = def.recipe.map(r => ({ itemId: prepOf(r.itemId), count: r.count }))
    const finishAt = FINISH_AT[word]
    if (word === 'infusion') {
      rows.push({
        id: `mix:${def.id}`, name: `Mix ${def.name} base`, step: 'mix', station: 'mixer',
        input: preps, output: { itemId: baseOf(def.id), count: 1 },
        mana: 0, xp: Math.round(def.xpGrant * 0.25), minLevel: def.minAlchemyLevel, runMs: ALCHEMY_STATIONS.mixer.runMs,
      })
      rows.push({
        id: `finish:${def.id}`, name: def.name, step: 'brew', station: 'cauldron',
        input: [{ itemId: baseOf(def.id), count: 1 }], output: { itemId: def.id, count: def.resultCount },
        mana: def.manaCost, xp: def.xpGrant, minLevel: def.minAlchemyLevel, runMs: ALCHEMY_STATIONS.cauldron.runMs,
      })
      continue
    }
    rows.push({
      id: `finish:${def.id}`, name: def.name, step: ALCHEMY_STATIONS[finishAt].step, station: finishAt,
      input: preps, output: { itemId: def.id, count: def.resultCount },
      mana: def.manaCost, xp: def.xpGrant, minLevel: def.minAlchemyLevel,
      runMs: word === 'cordial' ? ALCHEMY_RUN_MS.age : ALCHEMY_STATIONS[finishAt].runMs,
    })
  }
  for (const c of COOK_ROWS) rows.push({ ...c, runMs: ALCHEMY_STATIONS[c.station].runMs })
  return rows
}

const label = (id: string): string => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export const ALCHEMY_RECIPES: readonly AlchemyRecipe[] = buildRecipes()
const BY_ID = new Map(ALCHEMY_RECIPES.map(r => [r.id, r]))
export const alchemyRecipe = (id: string): AlchemyRecipe | undefined => BY_ID.get(id)

/** What one station lists, in canon's order (prep rows first, then potions by level). */
export function alchemyStationRecipes(station: AlchemyStationId): AlchemyRecipe[] {
  return ALCHEMY_RECIPES.filter(r => r.station === station)
    .sort((a, b) => Number(a.step !== prepStepOf(a)) - Number(b.step !== prepStepOf(b)) || a.minLevel - b.minLevel)
}
const prepStepOf = (r: AlchemyRecipe): AlchemyStep | null => r.id.startsWith('grind:') ? 'grind' : r.id.startsWith('distil:') ? 'distil' : null

/** Everything the oven turns out — so the world's item set knows a loaf exists. */
export const COOKED: readonly string[] = [...new Set(COOK_ROWS.map(r => r.output.itemId))]

/** Every intermediate the chain can produce — so the world's item set and labels know them. */
export const ALCHEMY_INTERMEDIATES: readonly string[] = [...new Set(
  ALCHEMY_RECIPES.map(r => r.output.itemId).filter(id => id.startsWith('powder_') || id.startsWith('extract_') || id.startsWith('base_')),
)]

/** A readable name for an intermediate; null for anything else (the caller keeps its own label). */
export function intermediateLabel(itemId: string): string | null {
  if (itemId.startsWith('powder_')) return `${label(itemId.slice(7))} Powder`
  if (itemId.startsWith('extract_')) return `${label(itemId.slice(8))} Extract`
  if (itemId.startsWith('base_')) return `${POTION_DEFS[itemId.slice(5)]?.name ?? label(itemId.slice(5))} Base`
  return null
}

/**
 * The whole route for one potion, for the panel's "how do I make this" line and the tests:
 * the stations in order, deduplicated (two dry ingredients are one trip to the grinder).
 */
export function routeOf(potionId: string): AlchemyStationId[] {
  const def = POTION_DEFS[potionId]
  const word = def ? craftWordOf(def) : null
  if (!def || !word) return []
  const out: AlchemyStationId[] = []
  const push = (s: AlchemyStationId) => { if (out[out.length - 1] !== s) out.push(s) }
  for (const r of def.recipe) push(prepStep(r.itemId) === 'grind' ? 'grinder' : 'still')
  if (word === 'infusion') push('mixer')
  push(FINISH_AT[word])
  return out
}

// ── the job, on the workshop's record ───────────────────────────────────────────────────────────
// Same shape as `voxel/workshop.ts` (`recipeId`, `runs`, `since`) so the column save carries it
// unchanged; these are that file's `loadJob` / `runsReady` / `collect` / `salvage` with THIS table's
// rows and per-row run times. Not shared code because the workshop's read `RECIPES`, and a job
// whose recipe id starts with `grind:` must never be handed to a reader that would answer "no such
// recipe" and drop the run.
export const ALCHEMY_MAX_RUNS = 16

export function alchemyRunsReady(job: StationJob, now: number): number {
  const r = BY_ID.get(job.recipeId)
  if (!r) return 0
  return Math.min(job.runs, Math.floor(Math.max(0, now - job.since) / r.runMs))
}

export function alchemyRunProgress(job: StationJob, now: number): number {
  const r = BY_ID.get(job.recipeId)
  if (!r || job.runs <= 0) return 0
  if (alchemyRunsReady(job, now) >= job.runs) return 1
  return (Math.max(0, now - job.since) % r.runMs) / r.runMs
}

/** Seconds until the next run lands, for the panel's countdown. 0 when one is already waiting. */
export function alchemySecondsToNext(job: StationJob, now: number): number {
  const r = BY_ID.get(job.recipeId)
  if (!r || job.runs <= 0 || alchemyRunsReady(job, now) > 0) return 0
  return Math.ceil((r.runMs - (Math.max(0, now - job.since) % r.runMs)) / 1000)
}

export const alchemyJobCost = (r: AlchemyRecipe, runs: number) => r.input.map(i => ({ itemId: i.itemId, count: i.count * runs }))

/** How many runs the keeper can afford from what they hold, capped. */
export function alchemyMaxRuns(r: AlchemyRecipe, have: (itemId: string) => number, manaAvailable: number): number {
  let n = ALCHEMY_MAX_RUNS
  for (const i of r.input) n = Math.min(n, Math.floor(have(i.itemId) / i.count))
  if (r.mana > 0) n = Math.min(n, Math.floor(manaAvailable / r.mana))
  return Math.max(0, n)
}

export function alchemyLoadJob(shop: Workshop, key: string, recipeId: string, runs: number, now: number): Workshop {
  if (!BY_ID.get(recipeId) || runs <= 0 || shop[key]) return shop
  return { ...shop, [key]: { recipeId, runs: Math.min(runs, ALCHEMY_MAX_RUNS), since: now } }
}

/**
 * Take the finished runs. Pays the output × runs ready and the XP for them; the remaining runs keep
 * their clock from the run that just landed, never from `now`, so a keeper who waits an extra
 * minute is not charged that minute again on the next run.
 */
export function alchemyCollect(shop: Workshop, key: string, now: number):
  { shop: Workshop; payout: { itemId: string; count: number } | null; xp: number; runsTaken: number } {
  const job = shop[key]
  const r = job ? BY_ID.get(job.recipeId) : undefined
  if (!job || !r) return { shop, payout: null, xp: 0, runsTaken: 0 }
  const ready = alchemyRunsReady(job, now)
  if (ready <= 0) return { shop, payout: null, xp: 0, runsTaken: 0 }
  const left = job.runs - ready
  const next: Workshop = { ...shop }
  if (left > 0) next[key] = { recipeId: job.recipeId, runs: left, since: job.since + ready * r.runMs }
  else delete next[key]
  return { shop: next, payout: { itemId: r.output.itemId, count: r.output.count * ready }, xp: r.xp * ready, runsTaken: ready }
}

/** Breaking the block: finished runs pay out, unfinished runs give their inputs back. Mana is not refunded. */
export function alchemySalvage(shop: Workshop, key: string, now: number):
  { shop: Workshop; drops: { itemId: string; count: number }[] } {
  const job = shop[key]
  const r = job ? BY_ID.get(job.recipeId) : undefined
  if (!job || !r) return { shop, drops: [] }
  const ready = alchemyRunsReady(job, now)
  const drops: { itemId: string; count: number }[] = []
  if (ready > 0) drops.push({ itemId: r.output.itemId, count: r.output.count * ready })
  const unfinished = job.runs - ready
  if (unfinished > 0) for (const c of alchemyJobCost(r, unfinished)) drops.push(c)
  const next: Workshop = { ...shop }
  delete next[key]
  return { shop: next, drops }
}

/** Is this alchemy job still running (has runs nobody has taken)? Drives the cauldron's lit twin. */
export const alchemyBusy = (job: StationJob | undefined): boolean => !!job && job.runs > 0
