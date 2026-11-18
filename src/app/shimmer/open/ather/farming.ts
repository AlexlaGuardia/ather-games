// FARMING IN THE FARM ROOM (Alex 11-18). Canon: game/shimmer-skilling.md › Skill 1: Farming. A bed is planted with a SEED,
// grows through canon's 4 phases over REAL time (0 planted, 1 sprout 25%, 2 growing 50%, 3 ready 100%) and is harvested when
// ready. Crop names, tiers and growth times below ARE canon's table; watering cuts the time by 25% (canon).
//
// GRADES D < C < B < A < S (D default). A seed has a grade and THE CROP'S GRADE IS ITS SEED'S GRADE. Graded things are separate
// stacks: `seed:<crop>:<grade>` and `crop:<crop>:<grade>`. baseOf() gives the crop id for any grade so recipes match any grade.
//
// THE COMPOSTER eats any item (any id, any count) and the farm's overflow (harvest that did not fit the farm's own store; the
// caller passes those leftovers to compost()). Each item eaten is COMPOST_PER_ITEM points; one dose costs DOSE_COST; charge is
// capped at CHARGE_CAP. ARMED = charge >= DOSE_COST. A harvest from an armed farm spends one dose.
// While ARMED: beds grow ARMED_GROWTH_MULT of the time (stacks with watering's 0.75), a harvest yields ARMED_YIELD_BONUS more
// crops, and each returned seed has SEED_UPGRADE_RATE to come back one grade higher (S stays S, never skips a grade).
//
// ARMED-NESS AND A GROWING BED: evaluated LIVE, not snapshotted. phaseOf(bed, now, armed) and harvest() both read the farm's
// armed state at the moment they are asked, so a composter armed mid-growth speeds that bed up and one that runs dry slows it
// back (the simplest reading: the bed stores no composter state, so nothing can go stale). Harvest decides armed once, up front,
// and that single answer drives the ready check, the yield, the seed upgrades and the dose.
//
// ★ PURE: no react, no three, no localStorage, no Math.random. Time is injected (ms), randomness is injected (rand: () => number).

export type Grade = 'D' | 'C' | 'B' | 'A' | 'S'
export const GRADES: readonly Grade[] = Object.freeze(['D', 'C', 'B', 'A', 'S'] as Grade[])
export const DEFAULT_GRADE: Grade = 'D'

const MIN = 60_000
export type CropId = 'goldleaf' | 'ather_wheat' | 'dewdrop_vine' | 'violetbloom' | 'stormgrass' | 'rootvine' | 'tidepetal' | 'starbloom' | 'heartleaf' | 'ather_lily'
export interface Crop { id: CropId; name: string; tier: 1 | 2 | 3 | 4; growMs: number }
const C = (id: CropId, name: string, tier: 1 | 2 | 3 | 4, min: number): Crop => Object.freeze({ id, name, tier, growMs: min * MIN })
/** Canon's resource tables, exactly (growth time per tier row). */
export const CROPS: Readonly<Record<CropId, Crop>> = Object.freeze({
  goldleaf: C('goldleaf', 'Goldleaf', 1, 5), ather_wheat: C('ather_wheat', 'Ather Wheat', 1, 8), dewdrop_vine: C('dewdrop_vine', 'Dewdrop Vine', 1, 10),
  violetbloom: C('violetbloom', 'Violetbloom', 2, 20), stormgrass: C('stormgrass', 'Stormgrass', 2, 20), rootvine: C('rootvine', 'Rootvine', 2, 25), tidepetal: C('tidepetal', 'Tidepetal', 2, 20),
  starbloom: C('starbloom', 'Starbloom', 3, 45), heartleaf: C('heartleaf', 'Heartleaf', 3, 60),
  ather_lily: C('ather_lily', 'Ather Lily', 4, 120),
})

// ── tunables ───────────────────────────────────────────────────────────────────────────────────────────────────
export const WATER_MULT = 0.75            // canon: watering reduces growth time by 25%
export const ARMED_GROWTH_MULT = 0.85     // a fed composter is a small nudge, so it stacks with watering without trivialising it (0.64 together)
export const ARMED_YIELD_BONUS = 1        // +1 crop per harvest: whole crops, no fractions to round
export const SEEDS_BACK = 2               // one seed to replant, one spare to grow or trade
export const SEED_UPGRADE_RATE = 0.9      // per seed, independent: mostly better, but a batch is never guaranteed
export const COMPOST_PER_ITEM = 1         // every item is worth the same: the composter does not judge
export const DOSE_COST = 10               // ten items buy one armed harvest
export const CHARGE_CAP = 50              // five doses banked: a cap keeps it a rhythm, not a hoard
export const PHASE_AT: readonly number[] = Object.freeze([0, 0.25, 0.5, 1]) // canon's 4 phases

// ── ids ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const seedId = (crop: CropId, grade: Grade = DEFAULT_GRADE) => `seed:${crop}:${grade}`
export const cropId = (crop: CropId, grade: Grade = DEFAULT_GRADE) => `crop:${crop}:${grade}`
export function parseGraded(id: string): { kind: 'seed' | 'crop'; crop: CropId; grade: Grade } | null {
  if (typeof id !== 'string') return null
  const p = id.split(':')
  if (p.length !== 3 || (p[0] !== 'seed' && p[0] !== 'crop')) return null
  if (!Object.prototype.hasOwnProperty.call(CROPS, p[1]) || !GRADES.includes(p[2] as Grade)) return null
  return { kind: p[0], crop: p[1] as CropId, grade: p[2] as Grade }
}
/** The crop id behind a graded seed/crop id, whatever its grade (null for anything else). */
export const baseOf = (id: string): CropId | null => parseGraded(id)?.crop ?? null
const upGrade = (g: Grade): Grade => GRADES[Math.min(GRADES.indexOf(g) + 1, GRADES.length - 1)]

// ── the farm ───────────────────────────────────────────────────────────────────────────────────────────────────
export interface Bed { crop: CropId; grade: Grade; plantedAt: number; watered: boolean }
export interface Farm { beds: (Bed | null)[]; charge: number }
export type Refused = { ok: false; why: string }
export type Item = { id: string; n: number }

export const newFarm = (beds: number): Farm => ({ beds: Array.from({ length: Math.max(0, Math.floor(beds)) }, () => null), charge: 0 })
export const isArmed = (farm: Farm) => farm.charge >= DOSE_COST

const inRange = (farm: Farm, i: number) => Number.isInteger(i) && i >= 0 && i < farm.beds.length
const withBed = (farm: Farm, i: number, b: Bed | null): Farm => ({ ...farm, beds: farm.beds.map((x, j) => (j === i ? b : x)) })

/** Total growth time of a bed right now (watering and an armed composter multiply). */
export const growMs = (bed: Bed, armed: boolean) => CROPS[bed.crop].growMs * (bed.watered ? WATER_MULT : 1) * (armed ? ARMED_GROWTH_MULT : 1)

/** Canon's phase 0..3 at `now`. */
export function phaseOf(bed: Bed, now: number, armed: boolean): 0 | 1 | 2 | 3 {
  const f = (now - bed.plantedAt) / growMs(bed, armed)
  return f >= PHASE_AT[3] ? 3 : f >= PHASE_AT[2] ? 2 : f >= PHASE_AT[1] ? 1 : 0
}

export function plant(farm: Farm, bedIndex: number, seed: string, now: number): { ok: true; farm: Farm } | Refused {
  if (!inRange(farm, bedIndex)) return { ok: false, why: 'no such bed' }
  const s = parseGraded(seed)
  if (!s || s.kind !== 'seed') return { ok: false, why: 'not a seed' }
  if (farm.beds[bedIndex]) return { ok: false, why: 'bed taken' }
  return { ok: true, farm: withBed(farm, bedIndex, { crop: s.crop, grade: s.grade, plantedAt: now, watered: false }) }
}

export function water(farm: Farm, bedIndex: number, now: number): { ok: true; farm: Farm } | Refused {
  if (!inRange(farm, bedIndex)) return { ok: false, why: 'no such bed' }
  const b = farm.beds[bedIndex]
  if (!b) return { ok: false, why: 'bed is empty' }
  if (b.watered) return { ok: false, why: 'already watered' }
  if (phaseOf(b, now, isArmed(farm)) === 3) return { ok: false, why: 'already ready' }
  return { ok: true, farm: withBed(farm, bedIndex, { ...b, watered: true }) }
}

export function harvest(farm: Farm, bedIndex: number, now: number, rand: () => number):
  { ok: true; farm: Farm; crops: Item[]; seeds: Item[]; spentDose: boolean } | Refused {
  if (!inRange(farm, bedIndex)) return { ok: false, why: 'no such bed' }
  const b = farm.beds[bedIndex]
  if (!b) return { ok: false, why: 'bed is empty' }
  const armed = isArmed(farm)
  if (phaseOf(b, now, armed) < 3) return { ok: false, why: 'not ready' }
  const seeds: Item[] = []
  for (let k = 0; k < SEEDS_BACK; k++) {
    const g = armed && rand() < SEED_UPGRADE_RATE ? upGrade(b.grade) : b.grade
    const id = seedId(b.crop, g), row = seeds.find(s => s.id === id)
    if (row) row.n++; else seeds.push({ id, n: 1 })
  }
  const next = withBed(farm, bedIndex, null)
  return {
    ok: true,
    farm: armed ? { ...next, charge: farm.charge - DOSE_COST } : next,
    crops: [{ id: cropId(b.crop, b.grade), n: 1 + (armed ? ARMED_YIELD_BONUS : 0) }],
    seeds,
    spentDose: armed,
  }
}

/** Feed the composter any items (and the farm's overflow). Charge stops at CHARGE_CAP; what did not fit comes back as `refused`. */
export function compost(farm: Farm, items: Item[]): { farm: Farm; refused: Item[] } {
  let charge = farm.charge
  const refused: Item[] = []
  for (const it of items) {
    const n = Math.max(0, Math.floor(it.n))
    const room = Math.max(0, Math.floor((CHARGE_CAP - charge) / COMPOST_PER_ITEM))
    const eat = Math.min(n, room)
    charge += eat * COMPOST_PER_ITEM
    if (n - eat > 0) refused.push({ id: it.id, n: n - eat })
  }
  return { farm: { ...farm, charge }, refused }
}
