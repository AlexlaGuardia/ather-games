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
import type { PlantedCrop } from '../engine/farming'
import type { Inventory } from '../engine/inventory'
import { countItem, removeItems } from '../engine/inventory'
import { bedKey, type PlantedBeds } from './planting'

/** The empty vessel — a hand recipe in `voxel/recipes.ts`. ⚠ The id is a save key; rename the label. */
export const JUG_ITEM = 'clay_jug'
/** The vessel, carrying. `count` is POURS LEFT — one fill is `JUG_POURS` of these, the last pour hands the empty jug back. */
export const JUG_WATER_ITEM = 'clay_jug_water'
/** Beds one fill waters. Eight beds is canon's cap at farming 10; two trips for a full plot. */
export const JUG_POURS = 4
/**
 * Puts items in the bag; returns how many did NOT fit. The host's `give` — passed in, like
 * `plantInBed`'s `drain`, because `engine/inventory.addItems` carries the 2D game's stack table
 * (it answers 1 for every id here) and this file must not learn which bag it is talking to.
 */
export type Give = (itemId: string, count: number) => number
/** How long a bed stays damp. A real day, per Alex's "daily". */
export const WATER_HOLD_MS = 24 * 60 * 60 * 1000
/** Growth speed while damp. 4/3 ⇒ growth TIME × 0.75 — canon's "reduces growth time by 25%". */
export const WATER_RATE = 4 / 3

/** Player-facing names for the two ids. The vessel's word is a canon gap; change it HERE when ruled. */
export function wateringLabel(itemId: string): string | null {
  if (itemId === JUG_ITEM) return 'Clay Jug'
  if (itemId === JUG_WATER_ITEM) return 'Jug of Water'
  return null
}

export interface Damp {
  /** When the bed dries. */
  until: number
  /** The integrator's cursor: growth bonus has been paid up to this instant. */
  creditedTo: number
}
/** Every damp bed, by `bedKey`. Independent of the crop map: an empty bed can be watered first. */
export type WateredBeds = Map<string, Damp>

/**
 * Why the pour will not happen, or `'ok'`. Typed, like every blocker in this tree — "the soil is
 * still damp" and "you have no water" are different things to do next.
 */
export type WaterRefusal = 'ok' | 'still-damp' | 'no-water'

export function waterBlocker(watered: WateredBeds, x: number, y: number, z: number, inv: Inventory, now: number): WaterRefusal {
  if (countItem(inv, JUG_WATER_ITEM) < 1) return 'no-water'
  const d = watered.get(bedKey(x, y, z))
  if (d && d.until > now) return 'still-damp'
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

/** "dries in 18h" / "dries in 40m" — for the refusal and the reticle. */
export function dampLeftLine(watered: WateredBeds, x: number, y: number, z: number, now: number): string {
  const d = watered.get(bedKey(x, y, z))
  if (!d || d.until <= now) return 'dry'
  const ms = d.until - now
  const h = Math.floor(ms / 3_600_000)
  return h >= 1 ? `dries in ${h}h` : `dries in ${Math.max(1, Math.ceil(ms / 60_000))}m`
}

/** Whether this bed is damp right now. */
export const isDamp = (watered: WateredBeds, x: number, y: number, z: number, now: number): boolean => {
  const d = watered.get(bedKey(x, y, z))
  return !!d && d.until > now
}

/** [0,1]: how much of the day is left on this bed. 0 when dry. The wet patch fades on it. */
export function dampFraction(d: Damp, now: number): number {
  return Math.max(0, Math.min(1, (d.until - now) / WATER_HOLD_MS))
}

/**
 * Pour. Returns false if anything refused — and then NOTHING left the keeper (ask first, spend
 * second, the rule `plantInBed` paid for). The last pour hands the empty jug back.
 *
 * ★ ASKED THROUGH `waterBlocker`, never re-deriving the conditions — the host asks it for the
 * sentence, this asks it for the verdict.
 */
export function waterBed(
  watered: WateredBeds, beds: PlantedBeds, x: number, y: number, z: number, inv: Inventory, now: number, give: Give,
): boolean {
  if (waterBlocker(watered, x, y, z, inv, now) !== 'ok') return false
  removeItems(inv, JUG_WATER_ITEM, 1)
  // The pour freed the slot the last of the water sat in, so the empty jug always fits.
  if (countItem(inv, JUG_WATER_ITEM) === 0) give(JUG_ITEM, 1)
  // ⚠ A re-water of a DRY bed whose entry the beat has not swept yet: pay what that old day still
  // owes FIRST (else its last unsettled seconds are lost), then start a fresh day from `now` — it
  // must not inherit the old cursor, or the crop would be paid for the dry gap between the two.
  const key = bedKey(x, y, z)
  const old = watered.get(key)
  if (old) settleOne(old, beds.get(key), now)
  watered.set(key, { until: now + WATER_HOLD_MS, creditedTo: now })
  return true
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
 * Pay the growth bonus earned since the last settle, and forget beds that have dried.
 *
 * Called on the host's planted beat (~1.5s) and ONCE ON LOAD, which is what makes a closed tab
 * honest: the damp window and the crop clock are both wall-time, so the interval the tab was shut
 * is settled the moment it opens, exactly as if the beat had been running. Returns how many crops
 * were credited, so a caller can be tested for it and the save can be marked dirty.
 *
 * ⚠ MUTATES `crop.plantedAt`. That is the whole mechanism (see the header), and it is why this
 * function is the ONLY writer of that field after `plantInBed` — a second writer would double-pay.
 */
export function settleWatering(watered: WateredBeds, beds: PlantedBeds, now: number): number {
  let credited = 0
  for (const [key, d] of watered) {
    if (settleOne(d, beds.get(key), now)) credited++
    if (now >= d.until) watered.delete(key)
  }
  return credited
}

/** One bed's share of `settleWatering`. True if a crop was credited. */
function settleOne(d: Damp, crop: PlantedCrop | undefined, now: number): boolean {
  const end = Math.min(now, d.until)
  let paid = false
  if (crop) {
    const start = Math.max(d.creditedTo, crop.plantedAt)
    const L = end - start
    if (L > 0) {
      crop.plantedAt -= L * (WATER_RATE - 1)
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
export interface DampSave { x: number; y: number; z: number; until: number; creditedTo: number }

export const wateringToSave = (watered: WateredBeds): DampSave[] => {
  const out: DampSave[] = []
  for (const [k, d] of watered) {
    const [x, y, z] = k.split(',').map(Number)
    out.push({ x, y, z, until: d.until, creditedTo: d.creditedTo })
  }
  return out
}

/** Absent and empty are the same thing — every save written before watering existed loads unchanged. */
export function wateringFromSave(saved: unknown): WateredBeds {
  const out: WateredBeds = new Map()
  if (!Array.isArray(saved)) return out
  for (const r of saved as Partial<DampSave>[]) {
    if (![r.x, r.y, r.z, r.until, r.creditedTo].every(v => typeof v === 'number' && Number.isFinite(v))) continue
    out.set(bedKey(r.x!, r.y!, r.z!), { until: r.until!, creditedTo: r.creditedTo! })
  }
  return out
}
