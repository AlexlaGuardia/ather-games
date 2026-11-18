// THE WATER TAP AND ITS TANKS (canon RULED 11-15, world/mana-tech.md › The water tap; build: play / Jin, 11-18).
// Canon: mortal mana-tech BOUGHT ON ATHERNYX and installed in the fold. It sips mana over time and turns it into water,
// held in tanks; the keeper adds tanks for more storage. The fold holds no natural water, so this is the ONLY water in the
// garden (Magii's guard on the Farm: the beds' water is the tap's).
// Build's (canon leaves these to us): fill rate, tank sizes, price, where sold, the look.
//   · Both are plot PIECES (ather/furniture.ts): bought at Rune Hold's Smithy, set and picked up like the lantern.
//   · The tap sips the FOLD'S ambient mana, never the keeper's pool: it fills on its own, the keeper pays only Marks
//     (Magii confirmed 11-18, athernyx 2bfa6b2: Alex's words were 'sips mana over time').
//   · Every tap set on the plot fills; every tap carries one tank's worth in its own body; each Water Tank adds TANK_HOLD.
//   · A bed takes ONE water (farming.ts › water: 0.75 of the growth time, canon).
// ★ NOTHING IS LOST QUIETLY: picking up a tank clamps the stored water to what is left; the panel says so before you do.
//
// PURE but for the guarded load/save. Time is injected.
import { gardenKey } from '@/lib/keeper-local'

export const TAP = 'water_tap'
export const TANK = 'water_tank'
/** water per tank (the tap's own body holds one tank's worth). 6 = one full set of beds. */
export const TANK_HOLD = 6
/** one tap makes one water every FILL_MS (two taps, twice as fast). A full set of 6 beds every 9 minutes per tap: the
 *  shortest canon crop (Goldleaf, 5 min) outruns one tap, so a second tap or a wait is a real choice. */
export const FILL_MS = 90_000

/** What stands on the plot that matters to water. */
export interface Plumbing { taps: number; tanks: number }
export const plumbingOf = (pieces: readonly { item: string }[]): Plumbing => ({
  taps: pieces.filter(p => p.item === TAP).length,
  tanks: pieces.filter(p => p.item === TANK).length,
})
/** How much the tanks hold. No tap = nothing holds water (a tank alone is an empty barrel). */
export const capacityOf = (pl: Plumbing) => (pl.taps > 0 ? TANK_HOLD * (pl.taps + pl.tanks) : 0)

/** The saved level: `n` water as of time `at` (fractions kept, so a fill never loses its partial progress), plus the taps
 *  that stood then. ★ Fill since `at` runs at the SMALLER of the taps then and now: the save cannot know when between the two a
 *  tap was set, so a tap set today never fills for the hours before it existed (re-settle on every change, see settle). */
export interface WaterSave { v: 1; n: number; at: number; taps: number }
export const freshWater = (now: number): WaterSave => ({ v: 1, n: 0, at: now, taps: 0 })

/** Water in the tanks right now. */
export function levelOf(sv: WaterSave, pl: Plumbing, now: number): number {
  const cap = capacityOf(pl)
  if (cap <= 0) return 0
  const made = Math.min(sv.taps, pl.taps) * Math.max(0, now - sv.at) / FILL_MS
  return Math.min(cap, Math.max(0, sv.n) + made)
}
/** Whole water you can draw now (what the panel shows). */
export const wholeOf = (sv: WaterSave, pl: Plumbing, now: number) => Math.floor(levelOf(sv, pl, now) + 1e-9)
/** ms until the next whole water (null = full, or nothing fills). */
export function msToNext(sv: WaterSave, pl: Plumbing, now: number): number | null {
  const cap = capacityOf(pl), lv = levelOf(sv, pl, now), taps = Math.min(sv.taps, pl.taps)
  if (taps <= 0 || lv >= cap) return null
  const frac = lv - Math.floor(lv + 1e-9)
  return Math.ceil((1 - frac) * FILL_MS / taps - 1e-6)
}
/** Fold the time in: the level as of now, re-based (do this whenever the plumbing changes, so a pickup clamps once). */
export const settle = (sv: WaterSave, pl: Plumbing, now: number): WaterSave => ({ v: 1, n: levelOf(sv, pl, now), at: now, taps: pl.taps })
/** True when the save last saw different taps (the store re-settles then). */
export const stale = (sv: WaterSave, pl: Plumbing) => sv.taps !== pl.taps

export type Drawn = { ok: true; sv: WaterSave } | { ok: false; why: string }
/** Take n water out of the tanks. */
export function draw(sv: WaterSave, pl: Plumbing, now: number, n = 1): Drawn {
  if (pl.taps <= 0) return { ok: false, why: 'No water here. A water tap from the Nyx side fills tanks in the fold.' }
  const lv = levelOf(sv, pl, now)
  if (lv + 1e-9 < n) return { ok: false, why: 'The tanks are dry. The tap is still filling them.' }
  return { ok: true, sv: { v: 1, n: lv - n, at: now, taps: pl.taps } }
}

/** What picking up one piece would pour away (0 for anything that is not a tap or a tank, or when it all still fits). */
export function spillIfRemoved(sv: WaterSave, pl: Plumbing, item: string, now: number): number {
  if (item !== TAP && item !== TANK) return 0
  const after: Plumbing = item === TAP ? { ...pl, taps: pl.taps - 1 } : { ...pl, tanks: pl.tanks - 1 }
  return Math.max(0, Math.floor(levelOf(sv, pl, now) + 1e-9) - Math.floor(capacityOf(after)))
}

// ── save: garden-tied, registered in GARDEN_KEY_SPECS ─────────────────────────────────────────────────────────
export const WATER_KEY = 'open.water.v1'
export function adoptWater(raw: unknown, now: number): WaterSave {
  const v = raw as Partial<WaterSave> | null
  if (v?.v !== 1 || !Number.isFinite(v.n) || !Number.isFinite(v.at)) return freshWater(now)
  const taps = Number.isFinite(v.taps) ? Math.max(0, Math.floor(v.taps as number)) : 0
  return { v: 1, n: Math.max(0, v.n as number), at: Math.min(now, v.at as number), taps }
}
export function loadWater(now: number): WaterSave {
  try { return adoptWater(JSON.parse(localStorage.getItem(gardenKey(WATER_KEY)) ?? 'null'), now) } catch { return freshWater(now) }
}
export function saveWater(sv: WaterSave) { try { localStorage.setItem(gardenKey(WATER_KEY), JSON.stringify(sv)) } catch { /* private window */ } }
