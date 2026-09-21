// Farming ② — daily watering. Carrying water from a pond to a bed, and what the bed does with it.
//
// ★ PURE. No react/three/DOM. `voxel3d/planting.ts` owns the crop in the bed; this file owns the
// WATER on the bed: which beds are damp, until when, and how much faster a crop grows for it.
//
// ── CANON (`game/shimmer-skilling.md` › Farming): ─────────────────────────────────────────────
//   *"Watering (carrying water from Ather ponds) reduces growth time by 25%."*
// Alex (GBOARD, 09-16): *"i'd like daily watering to be a thing but we'd have to work out a water
// source."* The three parts this file settles, and where each came from:
//   · THE SOURCE is a real body of water — a pond, a stream or a lake — never a dug puddle. The
//     host gates the fill on `rinSpotAt`, the same field query rinning uses, so "the trip to the
//     pond" is a trip. A keeper-dug pool beside the beds would make the carry free and the canon
//     line decorative.
//   · THE VESSEL is fired earth like the pot (`clay_pot`, subsoil ×3): no metal in the Ather. Its
//     NAME is a placeholder pending Magii — see `CANON_GAPS.md` › the water vessel — because the
//     word a keeper carries water in is world vocabulary, not a stat. The ids below are what the
//     save stores, so a ruling renames the LABEL (`wateringLabel`), never the id.
//   · "DAILY" is a real day: a watered bed stays damp for `WATER_HOLD_MS`, and every crop growing
//     in it during that window grows at `WATER_RATE`. Crops take 5–16 minutes and the day is 24h,
//     so in practice: water the beds once when you come out in the morning, sow all day.
//
// ── ★★ THE BONUS IS A RATE, NOT A LUMP, AND IT IS CREDITED BY SHIFTING `plantedAt` ─────────────
// The engine's growth clock is `(now − plantedAt) / growthDuration`, shared with play3d, and every
// reader (`getCropGrowthPhase`, `isCropReady`, the planted feed) trusts it. Rather than teach all
// of them about water, `settleWatering` runs on the host's beat and pays the bonus INTO that clock:
// over `L` ms of damp wall-time a crop earns `L × (WATER_RATE − 1)` ms of extra progress, applied
// as `plantedAt −= …`. A crop watered for its whole life matures at 1/WATER_RATE = 75% of nominal,
// which is canon's number; a crop that outlives the damp gets exactly the fraction it was damp for.
//
// ⚠ `creditedTo` IS THE INTEGRATOR'S CURSOR and it must advance even when the bed is EMPTY — else a
// seed sown at hour 20 of the window would be paid for hours 0–20 it was not in the ground. The
// per-crop start is `max(creditedTo, plantedAt)`, which is what makes that true.
//
// ── ★ FERTILIZER RIDES THE SAME INTEGRATOR (farming ②b, the same day) ─────────────────────────
// Canon: *"Fertilizer … Reduces crop growth time by 25%. Spread on farming plots. Stacks with
// watering."* — and canon's own open question (`shimmer-skilling.md:940`): *stack to 50%, or cap
// at 25%?* Numbers are build-side, and the answer here is MULTIPLICATIVE: two rates of 4/3 make
// 16/9, i.e. time × 0.5625 — a cared-for bed ripens in a bit over half the time, never half
// exactly, so neither boost is "the other one, again". Over an interval where both are active
// the extra beyond the two singles is `L × (16/9 − 1 − 1/3 − 1/3) = L/9`, which is the closed
// form `settleOne` pays: no piecewise walk, one cursor per bed for both windows.
import type { PlantedCrop } from '../engine/farming'
import type { Inventory } from '../engine/inventory'
import { countItem, removeItems } from '../engine/inventory'
import { bedKey, type PlantedBeds } from './planting'

/** The empty vessel — a hand recipe in `voxel/recipes.ts`. ⚠ The id is a save key; rename the label. */
export const JUG_ITEM = 'clay_jug'
/** The vessel, carrying. `count` is POURS LEFT — one fill is `JUG_POURS` of these, the last pour hands the empty jug back. */
export const JUG_WATER_ITEM = 'clay_jug_water'
/** The fertilizer — a PLOT-class brew off the cauldron chain (`engine/alchemy.ts › bed_brew`). One bottle feeds one bed for a day. */
export const FEED_ITEM = 'bed_brew'
/** Beds one fill waters. Eight beds is canon's cap at farming 10; two trips for a full plot. */
export const JUG_POURS = 4
/**
 * Puts items in the bag; returns how many did NOT fit. The host's `give` — passed in, like
 * `plantInBed`'s `drain`, because `engine/inventory.addItems` carries the 2D game's stack table
 * (it answers 1 for every id here) and this file must not learn which bag it is talking to.
 */
export type Give = (itemId: string, count: number) => number
/** How long a bed stays damp — and fed. A real day, per Alex's "daily". */
export const WATER_HOLD_MS = 24 * 60 * 60 * 1000
/** Growth speed while damp. 4/3 ⇒ growth TIME × 0.75 — canon's "reduces growth time by 25%". */
export const WATER_RATE = 4 / 3
/** Growth speed while fed. Canon gives fertilizer the same 25%; the two multiply (see the header). */
export const FEED_RATE = 4 / 3

/** Player-facing names for the two ids. The vessel's word is a canon gap; change it HERE when ruled. */
export function wateringLabel(itemId: string): string | null {
  if (itemId === JUG_ITEM) return 'Clay Jug'
  if (itemId === JUG_WATER_ITEM) return 'Jug of Water'
  return null
}

/** One bed's care. A window at 0 is "never" — both are wall-clock instants, so 0 is safely the past. */
export interface BedCare {
  /** When the bed dries. */
  wateredUntil: number
  /** When the feed is spent. */
  fedUntil: number
  /** The integrator's cursor: growth bonus has been paid up to this instant, for BOTH windows. */
  creditedTo: number
}
/** @deprecated the first cut's name — `BedCare` now. Kept so the host's imports read. */
export type Damp = BedCare
/** Every cared-for bed, by `bedKey`. Independent of the crop map: an empty bed can be watered first. */
export type WateredBeds = Map<string, BedCare>

/**
 * Why the pour will not happen, or `'ok'`. Typed, like every blocker in this tree — "the soil is
 * still damp" and "you have no water" are different things to do next.
 */
export type WaterRefusal = 'ok' | 'still-damp' | 'no-water'
export type FeedRefusal = 'ok' | 'still-fed' | 'no-brew'

export function waterBlocker(watered: WateredBeds, x: number, y: number, z: number, inv: Inventory, now: number): WaterRefusal {
  if (countItem(inv, JUG_WATER_ITEM) < 1) return 'no-water'
  if (isDamp(watered, x, y, z, now)) return 'still-damp'
  return 'ok'
}

export function feedBlocker(watered: WateredBeds, x: number, y: number, z: number, inv: Inventory, now: number): FeedRefusal {
  if (countItem(inv, FEED_ITEM) < 1) return 'no-brew'
  if (isFed(watered, x, y, z, now)) return 'still-fed'
  return 'ok'
}

/** One sentence per refusal, kept beside it so a new refusal cannot ship silent. */
export function waterRefusalLine(why: WaterRefusal, watered: WateredBeds, x: number, y: number, z: number, now: number): string {
  switch (why) {
    case 'ok': return ''
    case 'no-water': return 'nothing to pour — fill a jug at a pond'
    case 'still-damp': return `the soil is still damp — ${dampLeftLine(watered, x, y, z, now)}`
  }
}

export function feedRefusalLine(why: FeedRefusal, watered: WateredBeds, x: number, y: number, z: number, now: number): string {
  switch (why) {
    case 'ok': return ''
    case 'no-brew': return 'nothing to spread — a bed brew comes off the cauldron'
    case 'still-fed': return `the soil is still fed — ${fedLeftLine(watered, x, y, z, now)}`
  }
}

/** "dries in 18h" / "dries in 40m" — for the refusal and the reticle. */
export function dampLeftLine(watered: WateredBeds, x: number, y: number, z: number, now: number): string {
  return leftLine('dries', watered.get(bedKey(x, y, z))?.wateredUntil ?? 0, now, 'dry')
}
/** "spent in 18h" — the feed's twin. */
export function fedLeftLine(watered: WateredBeds, x: number, y: number, z: number, now: number): string {
  return leftLine('spent', watered.get(bedKey(x, y, z))?.fedUntil ?? 0, now, 'unfed')
}
function leftLine(verb: string, until: number, now: number, none: string): string {
  if (until <= now) return none
  const ms = until - now
  const h = Math.floor(ms / 3_600_000)
  return h >= 1 ? `${verb} in ${h}h` : `${verb} in ${Math.max(1, Math.ceil(ms / 60_000))}m`
}

/** Whether this bed is damp right now. */
export const isDamp = (watered: WateredBeds, x: number, y: number, z: number, now: number): boolean =>
  (watered.get(bedKey(x, y, z))?.wateredUntil ?? 0) > now
/** Whether this bed is fed right now. */
export const isFed = (watered: WateredBeds, x: number, y: number, z: number, now: number): boolean =>
  (watered.get(bedKey(x, y, z))?.fedUntil ?? 0) > now

/** [0,1]: how much of the day is left on this bed's water. 0 when dry. The wet patch fades on it. */
export const dampFraction = (d: BedCare, now: number): number => fraction(d.wateredUntil, now)
/** [0,1]: how much of the day is left on this bed's feed. */
export const fedFraction = (d: BedCare, now: number): number => fraction(d.fedUntil, now)
const fraction = (until: number, now: number): number => Math.max(0, Math.min(1, (until - now) / WATER_HOLD_MS))

/**
 * Pour. Returns false if anything refused — and then NOTHING left the keeper (ask first, spend
 * second, the rule `plantInBed` paid for). The last pour hands the empty jug back.
 *
 * ★ ASKED THROUGH `waterBlocker`, never re-deriving the conditions — the host asks it for the
 * sentence, this asks it for the verdict.
 */
/**
 * ── ★ A POUR SPREADS (2026-09-18, the day after beds learned to merge) ────────────────────────
 * One pour was one square. A 3×6 bed is eighteen squares, the jug is four pours: five trips to the
 * well for one rectangle, the morning after Alex built the well so the walk would be short. A pour
 * now dampens the aimed square AND every bed square touching it — the 3×3 splash a jug actually
 * makes — and the bed's own edge stops it: `sameBed` is the host's word on which neighbours are
 * this bed (a garden bed of the same wood, `bed-rim.ts`'s merge rule), so water never crosses to
 * the lawn or to a stranger's timber. Squares already damp are skipped, not refused: the REFUSAL
 * stays on the aimed square alone ("aim at a dry one"), which keeps the rule sayable.
 * The canon number (−25%, one day) is untouched; how far a jug splashes is the build's.
 */
export const WATER_SPREAD = 1
export type SameBed = (x: number, y: number, z: number) => boolean

/** Every square a pour at (x,y,z) reaches: the aimed one first, then its same-bed neighbours. Pure. */
export function pourSquares(x: number, y: number, z: number, sameBed: SameBed): { x: number; y: number; z: number }[] {
  const out = [{ x, y, z }]
  for (let dz = -WATER_SPREAD; dz <= WATER_SPREAD; dz++) for (let dx = -WATER_SPREAD; dx <= WATER_SPREAD; dx++) {
    if (dx === 0 && dz === 0) continue
    if (sameBed(x + dx, y, z + dz)) out.push({ x: x + dx, y, z: z + dz })
  }
  return out
}

/**
 * Pour on a bed. Returns the number of squares that took water (0 = refused, see `waterBlocker`).
 * `sameBed` decides the spread; the default — no neighbours — is the one-square pour, which is
 * what every caller that has no world to read (the oracle) still gets.
 */
export function waterBed(
  watered: WateredBeds, beds: PlantedBeds, x: number, y: number, z: number, inv: Inventory, now: number, give: Give,
  sameBed: SameBed = () => false,
): number {
  if (waterBlocker(watered, x, y, z, inv, now) !== 'ok') return 0
  removeItems(inv, JUG_WATER_ITEM, 1)
  // The pour freed the slot the last of the water sat in, so the empty jug always fits.
  if (countItem(inv, JUG_WATER_ITEM) === 0) give(JUG_ITEM, 1)
  let n = 0
  for (const q of pourSquares(x, y, z, sameBed)) {
    // A neighbour still damp keeps its window; only the aimed square was promised dry.
    if (n > 0 && isDamp(watered, q.x, q.y, q.z, now)) continue
    open(watered, beds, q.x, q.y, q.z, now).wateredUntil = now + WATER_HOLD_MS
    n++
  }
  return n
}

/**
 * Spread the brew. The pour's twin in every way since 09-21: one bottle reaches the aimed square
 * AND its same-bed neighbours (`pourSquares`, the same 3×3, the same edge), neighbours already fed
 * are skipped not refused, and the count comes back for the toast. It shipped 09-17 as one bottle
 * per square while the pour was one square too; when the pour learned to spread (09-18) the brew
 * did not, and a keeper fed a 3×6 with eighteen bottles the morning a jug did it in two pours.
 * Canon: *"Spread on farming plots. Stacks with watering."* — SPREAD is canon's own verb.
 * Returns the number of squares fed (0 = refused, see `feedBlocker`).
 */
export function feedBed(
  watered: WateredBeds, beds: PlantedBeds, x: number, y: number, z: number, inv: Inventory, now: number,
  sameBed: SameBed = () => false,
): number {
  if (feedBlocker(watered, x, y, z, inv, now) !== 'ok') return 0
  removeItems(inv, FEED_ITEM, 1)
  let n = 0
  for (const q of pourSquares(x, y, z, sameBed)) {
    if (n > 0 && isFed(watered, q.x, q.y, q.z, now)) continue
    open(watered, beds, q.x, q.y, q.z, now).fedUntil = now + WATER_HOLD_MS
    n++
  }
  return n
}

/**
 * The bed's care record, ready to take a new window from `now`.
 * ⚠ AN EXISTING RECORD IS SETTLED FIRST — a dry bed the beat has not swept yet still owes its last
 * unsettled seconds (else they are lost), and the cursor must then move to `now` so the dry gap
 * between the old window and the new one is never paid. The OTHER window survives untouched: a
 * bed watered at dawn and fed at noon keeps its water.
 */
function open(watered: WateredBeds, beds: PlantedBeds, x: number, y: number, z: number, now: number): BedCare {
  const key = bedKey(x, y, z)
  let d = watered.get(key)
  if (d) settleOne(d, beds.get(key), now)
  else { d = { wateredUntil: 0, fedUntil: 0, creditedTo: now }; watered.set(key, d) }
  d.creditedTo = now
  return d
}

/**
 * Fill the jug at water. The host has already decided the water is a real pond (`rinSpotAt`).
 * Returns the pours now carried from THIS fill — 0 means no empty jug was in the bag and nothing
 * was spent. A full bag can take fewer than `JUG_POURS` (a jug from a stack of two frees no slot);
 * if it takes none the jug is handed back, so a fill never costs a jug for nothing.
 */
export function fillJug(inv: Inventory, give: Give): number {
  if (countItem(inv, JUG_ITEM) < 1) return 0
  removeItems(inv, JUG_ITEM, 1)
  const got = JUG_POURS - give(JUG_WATER_ITEM, JUG_POURS)
  if (got === 0) give(JUG_ITEM, 1)
  return got
}

/**
 * Pay the growth bonus earned since the last settle, and forget beds whose windows have both
 * closed.
 *
 * Called on the host's planted beat (~1.5s) and ONCE ON LOAD, which is what makes a closed tab
 * honest: the windows and the crop clock are all wall-time, so the interval the tab was shut is
 * settled the moment it opens, exactly as if the beat had been running. Returns how many crops
 * were credited, so a caller can be tested for it and the save can be marked dirty.
 *
 * ⚠ MUTATES `crop.plantedAt`. That is the whole mechanism (see the header), and it is why this
 * function is the ONLY writer of that field after `plantInBed` — a second writer would double-pay.
 */
export function settleWatering(watered: WateredBeds, beds: PlantedBeds, now: number): number {
  let credited = 0
  for (const [key, d] of watered) {
    if (settleOne(d, beds.get(key), now)) credited++
    if (now >= d.wateredUntil && now >= d.fedUntil) watered.delete(key)
  }
  return credited
}

/** One bed's share of `settleWatering`. True if a crop was credited. The closed form is in the header. */
function settleOne(d: BedCare, crop: PlantedCrop | undefined, now: number): boolean {
  const end = Math.min(now, Math.max(d.wateredUntil, d.fedUntil))
  let paid = false
  if (crop) {
    const start = Math.max(d.creditedTo, crop.plantedAt)
    const span = (until: number) => Math.max(0, Math.min(end, until) - start)
    const Lw = span(d.wateredUntil), Lf = span(d.fedUntil), Lb = span(Math.min(d.wateredUntil, d.fedUntil))
    const bonus = Lw * (WATER_RATE - 1) + Lf * (FEED_RATE - 1) + Lb * (WATER_RATE * FEED_RATE - WATER_RATE - FEED_RATE + 1)
    if (bonus > 0) {
      crop.plantedAt -= bonus
      paid = true
    }
  }
  if (end > d.creditedTo) d.creditedTo = end
  return paid
}

/** The bed itself is gone (broken, or its crop cleared with it). */
export const clearDamp = (watered: WateredBeds, x: number, y: number, z: number): boolean =>
  watered.delete(bedKey(x, y, z))

// ── serialisation ────────────────────────────────────────────────────────────────────────────
export interface CareSave { x: number; y: number; z: number; wateredUntil: number; fedUntil: number; creditedTo: number }

export const wateringToSave = (watered: WateredBeds): CareSave[] => {
  const out: CareSave[] = []
  for (const [k, d] of watered) {
    const [x, y, z] = k.split(',').map(Number)
    out.push({ x, y, z, wateredUntil: d.wateredUntil, fedUntil: d.fedUntil, creditedTo: d.creditedTo })
  }
  return out
}

/**
 * Absent and empty are the same thing — every save written before watering existed loads unchanged.
 * A row from the morning's first cut (`until` alone) reads as its water window; nothing else was
 * ever written in that shape.
 */
export function wateringFromSave(saved: unknown): WateredBeds {
  const out: WateredBeds = new Map()
  if (!Array.isArray(saved)) return out
  for (const r of saved as Partial<CareSave & { until: number }>[]) {
    const wateredUntil = r.wateredUntil ?? r.until ?? 0
    const fedUntil = r.fedUntil ?? 0
    if (![r.x, r.y, r.z, wateredUntil, fedUntil, r.creditedTo].every(v => typeof v === 'number' && Number.isFinite(v))) continue
    out.set(bedKey(r.x!, r.y!, r.z!), { wateredUntil, fedUntil, creditedTo: r.creditedTo! })
  }
  return out
}
