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
// ★★ SUPERSEDED 2026-09-16 — the shape above was the 09-14 chain. The ruling of 09-16 (see THE
// ROAD below) makes every potion's step-list its own and the cauldron always last; the prep-by-kind
// and word-picks-the-finish rules are gone. The header is kept because the stations and the job
// shape it describes are unchanged.
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
export type AlchemyStep = 'grind' | 'distil' | 'mix' | 'brew' | 'bake' | 'roast'
export type AlchemyStationId = 'grinder' | 'still' | 'mixer' | 'cauldron' | 'oven' | 'hearth'

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
  /** A rinn on a spit, a root in the coals. Quicker than a loaf — you stand at a hearth. */
  roast: 12_000,
} as const

export const ALCHEMY_STATIONS: Record<AlchemyStationId, AlchemyStationDef> = {
  grinder:  { id: 'grinder',  name: 'Mortar',         step: 'grind',  runMs: ALCHEMY_RUN_MS.grind,  materials: [MAT.GRINDER], craft: 'alchemy' },
  still:    { id: 'still',    name: 'Still',          step: 'distil', runMs: ALCHEMY_RUN_MS.distil, materials: [MAT.STILL], craft: 'alchemy' },
  mixer:    { id: 'mixer',    name: 'Bowl',           step: 'mix',    runMs: ALCHEMY_RUN_MS.mix,    materials: [MAT.MIXER], craft: 'alchemy' },
  cauldron: { id: 'cauldron', name: 'Cauldron',       step: 'brew',   runMs: ALCHEMY_RUN_MS.brew,   materials: [MAT.CAULDRON, MAT.CAULDRON_LIT], craft: 'alchemy' },
  oven:     { id: 'oven',     name: 'Oven',           step: 'bake',   runMs: ALCHEMY_RUN_MS.bake,   materials: [MAT.OVEN], craft: 'cooking' },
  hearth:   { id: 'hearth',   name: 'Hearth',         step: 'roast',  runMs: ALCHEMY_RUN_MS.roast,  materials: [MAT.HEARTH], craft: 'cooking' },
}

// ── the oven's own rows: hand-written, not derived — there is no potion table behind a loaf ──────
// Shimmerwheat because it is the tier-1 grain (`crops.ts`; atherwheat is the level-20 master crop).
// Three grain to a loaf is a first guess for the feel, same licence as every run time above.
// ⚠ Bread has no eater yet: nothing in voxel3d drinks a potion or eats a loaf (the `use` verb is
// unbuilt on this surface — `engine/potion-effects.ts` is play3d's). The oven is interactable and
// the loaf is real; what it DOES is the next piece, and it is the same piece the 17 potions wait on.
// ★ THE HEARTH ROASTS (RULED 2026-09-15, athernyx 99e6e29): three fires, three verbs — cauldron boils,
// oven bakes, hearth roasts. *1 rinn → 1 roast rinn* spends a use canon wrote at the skill's birth
// (Shimmerscale's row: "basic food") and nothing ever cashed; the tier-1 rinn is the tier-1 row.
// Glowfin / Moonkoi are SPIRIT food and stay raw — never a roast row. Roasted Glowroot is the ruling's
// own optional second row. Heal / time / look are mine.
export const COOK_ROWS: readonly Omit<AlchemyRecipe, 'runMs'>[] = [
  { id: 'bake:bread', name: 'Bread', step: 'bake', station: 'oven',
    input: [{ itemId: 'shimmerwheat_grain', count: 3 }], output: { itemId: 'bread', count: 1 },
    mana: 0, xp: 0, minLevel: 1 },
  { id: 'roast:shimmerscale', name: 'Roast Rinn', step: 'roast', station: 'hearth',
    input: [{ itemId: 'shimmerscale', count: 1 }], output: { itemId: 'roast_rinn', count: 1 },
    mana: 0, xp: 0, minLevel: 1 },
  { id: 'roast:glowroot', name: 'Roasted Glowroot', step: 'roast', station: 'hearth',
    input: [{ itemId: 'glowroot_bulb', count: 1 }], output: { itemId: 'roasted_glowroot', count: 1 },
    mana: 0, xp: 0, minLevel: 1 },
]

const STATION_BY_MAT: ReadonlyMap<number, AlchemyStationId> = new Map(
  Object.values(ALCHEMY_STATIONS).flatMap(s => s.materials.map(m => [m, s.id] as const)),
)

/** Which alchemy station a placed block is, or null. The lit cauldron answers `cauldron`. */
export const alchemyStationOf = (material: number): AlchemyStationId | null => STATION_BY_MAT.get(material) ?? null

/** Every material that is an alchemy station, for the interact rule and the registry oracle. */
export const ALCHEMY_MATS: ReadonlySet<number> = new Set(STATION_BY_MAT.keys())

// ── THE ROAD: every potion has its own step-list, and the cauldron is always last ────────────────
// RULED 2026-09-16 (athernyx fc63a33, `game/alchemy.md` › THE BREWING'S PARTS). The 09-14 chain
// prepped each INGREDIENT by its kind (dry → mortar, wet → still) and let the craft-word pick the
// finishing station — tonics finished cold in the bowl, elixirs in the still. Alex refused the box:
// *"some potions have a step list like mixing and then still, and the cauldron should always go
// last, with the potion pour wrapping it up… I don't want to box any of this up as some potions can
// be simpler than others."* So:
//   · **the craft-word names the VESSEL** (what is poured, what the shelf reads) — never the road;
//   · **each potion has its OWN road**: mortar / still / bowl in any order and count, or none;
//   · **the cauldron is ALWAYS the last station** — heat is what finishes, even a salve is worked
//     in the bowl and then finished warm;
//   · **the POUR wraps it** — the liquid leaves the cauldron into its vessel and takes its word;
//     the pour is the reward moment (`brewing.ts` pays the hands there).
// The road is a road for the BATCH, not per ingredient: step 1 takes the raw ingredients and turns
// out one working stage (`stage_<potion>_1`), every later step turns the stage 1 → 1, and the
// cauldron takes the last stage plus the potion's mana. That is what lets a brewing count hands —
// one stage, one step, one pair of hands.
//
// ⚖ THE ROADS BELOW ARE JIN'S DESIGN, as the ruling says. The defaults read the craft-word for a
// sensible shape (a draught is the simplest thing: cauldron, pour); `ROADS` overrides per potion.
// ⚠ The old per-ingredient intermediates (`powder_*`, `extract_*`, `base_*`) still label, so a
// save holding them keeps readable items; nothing makes them any more.
export type RoadStep = Extract<AlchemyStep, 'grind' | 'distil' | 'mix'>
export const ROAD_STATION: Readonly<Record<RoadStep, AlchemyStationId>> = { grind: 'grinder', distil: 'still', mix: 'mixer' }

export type CraftWord = 'draught' | 'tonic' | 'brew' | 'elixir' | 'philter' | 'tincture' | 'essence' | 'infusion' | 'cordial' | 'salve'
export const CRAFT_WORDS: readonly CraftWord[] = ['draught', 'tonic', 'brew', 'elixir', 'philter', 'tincture', 'essence', 'infusion', 'cordial', 'salve']

export const craftWordOf = (def: PotionDef): CraftWord | null => {
  const last = def.name.trim().split(/\s+/).pop()?.toLowerCase() ?? ''
  return (CRAFT_WORDS as readonly string[]).includes(last) ? (last as CraftWord) : null
}

/**
 * The default road for a craft-word — the shape the word suggests, before the cauldron:
 *   draught   nothing              the simplest potion: cauldron, pour
 *   brew      mortar               boiled in quantity — coarse-ground, then the pot
 *   tonic     mortar → bowl        a fast dose: ground fine, mixed cold, then warmed
 *   salve     bowl                 worked in the bowl, finished warm (the ruling's own example)
 *   philter   still → bowl         steeped for feeling: the extract, then the mixing
 *   elixir    mortar → still       distilled and refined
 *   tincture  still                an extract taken in drops
 *   essence   still → still        concentrated — distilled twice
 *   infusion  mortar → still → bowl the flagship earns the whole chain
 *   cordial   bowl                 aged: mixed, then the slow pot (`ALCHEMY_RUN_MS.age`)
 */
export const DEFAULT_ROAD: Readonly<Record<CraftWord, readonly RoadStep[]>> = {
  draught: [], brew: ['grind'], tonic: ['grind', 'mix'], salve: ['mix'], philter: ['distil', 'mix'],
  elixir: ['grind', 'distil'], tincture: ['distil'], essence: ['distil', 'distil'],
  infusion: ['grind', 'distil', 'mix'], cordial: ['mix'],
}

/** Per-potion roads that differ from their word's default. The place a potion gets its own character. */
export const ROADS: Readonly<Record<string, readonly RoadStep[]>> = {
  // Shard Tonic is a tier-1 mana dose: one station before the pot keeps a beginner's walk short.
  shard_tonic: ['grind'],
  // Moonvine's leaf is steeped, not ground — a fleetfoot dose that starts at the still.
  moonvine_tonic: ['distil', 'mix'],
  // Dreamroot's essence is already an extract: it is mixed with the ground crystals, then refined.
  dreamroot_elixir: ['grind', 'mix', 'distil'],
}

/** The steps before the cauldron, for one potion. */
export function roadOf(potionId: string): readonly RoadStep[] {
  const def = POTION_DEFS[potionId]
  const word = def ? craftWordOf(def) : null
  if (!def || !word) return []
  return ROADS[potionId] ?? DEFAULT_ROAD[word]
}

/** The working batch after step `k` (1-based) of a potion's road. */
export const stageOf = (potionId: string, k: number): string => `stage_${potionId}_${k}`

const STEP_PAST: Readonly<Record<RoadStep, string>> = { grind: 'ground', distil: 'distilled', mix: 'mixed' }

// ── what a keeper drinks for: SPIRIT · HAND · PLOT (ruled 09-16, the vessels brief's own words) ──
export type PotionJob = 'spirit' | 'hand' | 'plot'
export const JOB_OF_WORD: Readonly<Record<CraftWord, PotionJob>> = {
  infusion: 'spirit', philter: 'spirit',
  tonic: 'hand', draught: 'hand', elixir: 'hand', tincture: 'hand', essence: 'hand', cordial: 'hand',
  brew: 'plot', salve: 'plot',
}
export const JOB_LINE: Readonly<Record<PotionJob, string>> = {
  spirit: 'for the spirit — the bond, a second form',
  hand: 'for the hand — taken on the job',
  plot: 'for the plot — ground and tools',
}
export function jobOf(potionId: string): PotionJob | null {
  const def = POTION_DEFS[potionId]
  const word = def ? craftWordOf(def) : null
  return word ? JOB_OF_WORD[word] : null
}

// ── recipes, one table per station, DERIVED from the potion list and its roads ─────────────────
export interface AlchemyRecipe {
  /** `road:<potion>:<k>` · `finish:<potion>` · the cook rows' own ids */
  id: string
  name: string
  step: AlchemyStep
  station: AlchemyStationId
  input: { itemId: string; count: number }[]
  output: { itemId: string; count: number }
  /** Mana per run. Only the finishing run channels mana (the potion's own `manaCost`); the road is free. */
  mana: number
  /** Alchemy XP per run, paid when the run is TAKEN — to the hand that did it (`brewing.ts`). */
  xp: number
  /** The keeper's alchemy level the row asks for. Every step of a road asks the potion's. */
  minLevel: number
  /** Milliseconds per run at this row — the station's, except a cordial ages in the pot. */
  runMs: number
  /** The potion this row is a step of; the cook rows have none. */
  potionId?: string
}

function buildRecipes(): AlchemyRecipe[] {
  const rows: AlchemyRecipe[] = []
  for (const def of Object.values(POTION_DEFS)) {
    const word = craftWordOf(def)
    if (!word) continue                      // the test makes this loud; the runtime stays honest
    const road = roadOf(def.id)
    const raw = def.recipe.map(r => ({ itemId: r.itemId, count: r.count }))
    // Each road step pays a slice of the potion's XP, so a hand that only ground is still paid; the
    // pour pays the rest. Slices are equal and the finish takes the remainder.
    const slice = road.length ? Math.max(1, Math.round(def.xpGrant * 0.15)) : 0
    road.forEach((step, i) => {
      const k = i + 1
      const station = ROAD_STATION[step]
      rows.push({
        id: `road:${def.id}:${k}`, name: `${def.name} — ${STEP_PAST[step]}`, step, station,
        input: k === 1 ? raw : [{ itemId: stageOf(def.id, k - 1), count: 1 }],
        output: { itemId: stageOf(def.id, k), count: 1 },
        mana: 0, xp: slice, minLevel: def.minAlchemyLevel, runMs: ALCHEMY_STATIONS[station].runMs, potionId: def.id,
      })
    })
    rows.push({
      id: `finish:${def.id}`, name: def.name, step: 'brew', station: 'cauldron',
      input: road.length ? [{ itemId: stageOf(def.id, road.length), count: 1 }] : raw,
      output: { itemId: def.id, count: def.resultCount },
      mana: def.manaCost, xp: Math.max(1, def.xpGrant - slice * road.length), minLevel: def.minAlchemyLevel,
      runMs: word === 'cordial' ? ALCHEMY_RUN_MS.age : ALCHEMY_STATIONS.cauldron.runMs, potionId: def.id,
    })
  }
  for (const c of COOK_ROWS) rows.push({ ...c, runMs: ALCHEMY_STATIONS[c.station].runMs })
  return rows
}

const label = (id: string): string => id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

export const ALCHEMY_RECIPES: readonly AlchemyRecipe[] = buildRecipes()
const BY_ID = new Map(ALCHEMY_RECIPES.map(r => [r.id, r]))
export const alchemyRecipe = (id: string): AlchemyRecipe | undefined => BY_ID.get(id)

/** What one station lists: by level, then by the potion's road order. */
export function alchemyStationRecipes(station: AlchemyStationId): AlchemyRecipe[] {
  return ALCHEMY_RECIPES.filter(r => r.station === station).sort((a, b) => a.minLevel - b.minLevel || a.id.localeCompare(b.id))
}

/** Everything the oven turns out — so the world's item set knows a loaf exists. */
export const COOKED: readonly string[] = [...new Set(COOK_ROWS.map(r => r.output.itemId))]

/** Every intermediate the chain can produce — so the world's item set and labels know them. */
export const ALCHEMY_INTERMEDIATES: readonly string[] = [...new Set(
  ALCHEMY_RECIPES.map(r => r.output.itemId).filter(id => id.startsWith('stage_')),
)]

/** A readable name for an intermediate; null for anything else (the caller keeps its own label). */
export function intermediateLabel(itemId: string): string | null {
  const m = /^stage_(.+)_(\d+)$/.exec(itemId)
  if (m) {
    const def = POTION_DEFS[m[1]]
    const step = roadOf(m[1])[Number(m[2]) - 1]
    return `${def?.name ?? label(m[1])} — ${step ? STEP_PAST[step] : 'working'}`
  }
  // The 09-14 chain's intermediates: nothing makes them now, but a save may still hold them.
  if (itemId.startsWith('powder_')) return `${label(itemId.slice(7))} Powder`
  if (itemId.startsWith('extract_')) return `${label(itemId.slice(8))} Extract`
  if (itemId.startsWith('base_')) return `${POTION_DEFS[itemId.slice(5)]?.name ?? label(itemId.slice(5))} Base`
  return null
}

/**
 * The whole route for one potion, for the panel's "how do I make this" line and the tests:
 * the road's stations in order, then the cauldron — always — and the pour is implicit.
 */
export function routeOf(potionId: string): AlchemyStationId[] {
  const def = POTION_DEFS[potionId]
  if (!def || !craftWordOf(def)) return []
  return [...roadOf(potionId).map(s => ROAD_STATION[s]), 'cauldron']
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
