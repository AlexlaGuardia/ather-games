// Day/Night cycle — the CLOCK. What the clock LOOKS like lives in world/atmosphere.tsx.
//
// ── Why this is derived from the wall clock, not ticked ──
// The old version carried `elapsed` in state, advanced it every tick and saved it. That means the
// world only moves while you are watching it, every client runs its own private time, and the value
// has to survive a save round-trip. Deriving from `Date.now()` instead gives four things for free:
//   • the world advances while the tab is closed — you come back to a different hour, as you should
//   • two people in a party are in the SAME hour, without syncing anything
//   • nothing to persist, nothing to drift, nothing to migrate
//   • `resetIndex()` falls straight out, which is what the spawner layer will key its world-reset on
// The cost is that time is global rather than per-save. For a shared garden that is the right trade:
// night should be night for everybody.
//
// ── The shape of the day ──
// 64 real minutes, and the number is not arbitrary: 2^6 means every subdivision a schedule might
// want (32/16/8/4 min) is a whole number of minutes. Progress 0 is MIDNIGHT, so midnight and noon
// land exactly on 0.0 and 0.5 — the two points the world-reset is planned to fire on.
//
// Canon (design-briefs/shimmer-garden-atmosphere.md, "Day / night arc", RULED 2026-07-21) fixes what
// day and night MEAN and how they read; it states explicitly that the MECHANISM — real-time vs slow
// vs toggle vs fixed — is Jin's build call. This file is that mechanism. It holds no colour.

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

// ★ THE CLOCK ARITHMETIC LIVES IN THE CORE — `voxel/clock.ts`. This file reads `window.location`
// for the `?hour=` pin, so it is host-side by construction and cannot be ported; the day's LENGTH
// and where dawn falls in it are world model, and the voxel core needs them to grow a sapling
// without depending upward (§ 6 rule 4). Imported back and re-exported here, so every existing
// caller is unchanged and there is still exactly one definition of each — which is the point of the
// warning that used to sit on these two lines and now sits on them over there.
import { CYCLE_MS, DAWN_START, DUSK_START, morningsBetween, nextMorning } from '../voxel/clock'
export { CYCLE_MS, morningsBetween, nextMorning }

/** Kept for the map editor, which rewrites this block textually (save-map/route.ts). */
export const RESPAWN_TRIGGERS = {
  forestry:    DAWN_START,
  prospecting: DUSK_START,
  rinning:     0,
} as const

// ── the time pin — `?hour=` and the dev console ─────────────────────────────
// Deriving the clock from wall time has one real cost: you cannot LOOK at dusk without waiting for
// dusk, which makes an eyeball pass on the gold⇄silver crossfade a 64-minute round trip. `?hour=19`
// pins the garden at that hour so a whole day can be judged in a minute. The URL param seeds it at
// module load; `setTimePin` (2026-08-08, the voxel3d dev console's `time` command) writes the SAME
// slot at runtime — one pin, every consumer of the clock (spawner resets included) inherits it for
// free rather than needing its own override. It still cannot leak into normal play: only the URL
// and an explicit console command reach it.
let pinnedHour: number | null = (() => {
  if (typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('hour')
  if (raw === null) return null
  const h = Number(raw)
  return Number.isFinite(h) ? ((h % 24) + 24) % 24 : null
})()

/** True when the clock is pinned — the HUD says so, so a pinned tab is never mistaken for a bug.
 *  A function now (was a const): the pin is runtime-writable since the console's `time` command. */
export const isTimePinned = (): boolean => pinnedHour !== null

/** Pin the clock to an hour (wraps into 0..24), or `null` to hand it back to wall time. */
export function setTimePin(hour: number | null): void {
  pinnedHour = hour === null ? null : ((hour % 24) + 24) % 24
}

/** Where we are in the day, 0..1, with 0 = midnight. */
export function dayProgress(nowMs: number = Date.now()): number {
  if (pinnedHour !== null) return pinnedHour / 24
  const m = nowMs % CYCLE_MS
  return (m < 0 ? m + CYCLE_MS : m) / CYCLE_MS
}

/**
 * Which world-reset window we are in. The planned spawner layer deals its board from
 * (worldSeed, resetIndex) so the layout is a pure function of the two — which is what makes it
 * survive a closed tab and stay identical for everyone standing in the same field.
 * `perDay` = how many resets a day holds (2 → midnight and noon).
 */
export function resetIndex(nowMs: number = Date.now(), perDay = 2): number {
  return Math.floor(nowMs / (CYCLE_MS / perDay))
}

/**
 * The phase is READ OFF the light curve rather than declared alongside it, so the HUD can never
 * claim dusk while the sky has already finished going dark. Rising vs falling is just which half of
 * the day we are in — the sun climbs from midnight to noon and falls from noon to midnight.
 */
export function getPhase(progress: number): DayPhase {
  const d = daylight(progress)
  if (d <= 0.02) return 'night'
  if (d >= 0.98) return 'day'
  return progress < 0.5 ? 'dawn' : 'dusk'
}

/** HH:MM on a 24h clock. Progress maps straight to the hour — no offset, so the readout and the
 *  sun agree by construction rather than by two constants being kept in step by hand. */
export function getDisplayTime(progress: number): string {
  const hour24 = progress * 24
  const h = Math.floor(hour24)
  const m = Math.floor((hour24 - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Sun elevation, -1 (deep night) .. +1 (noon). Drives both the light rig and the gold⇄silver mix,
 * so the crossfade and the sun's height can never disagree.
 * Peaks at noon (progress 0.5) and bottoms at midnight (0).
 */
export function sunElevation(progress: number): number {
  return -Math.cos(progress * Math.PI * 2)
}

/** Compass position of the sun on the unit circle: east at 06:00, west at 18:00. */
export function sunAzimuth(progress: number): number {
  return Math.sin(progress * Math.PI * 2)
}

/**
 * How much of the daylight look is in effect, 0 (full Moonwell hour) .. 1 (full honey-gold).
 * Canon calls dawn and dusk "the seams", so the band is deliberately soft and centred slightly
 * BELOW the horizon — the crossfade should read as a long handover, not a switch at sunrise.
 */
// The band is wide on purpose. A tight one put the whole gold→silver handover inside about an hour
// of game time (under three real minutes), which is not a seam, it is a light switch. At these
// numbers twilight runs roughly 04:45-07:25 and 16:35-19:15 — long enough to stand still and watch.
const TWILIGHT_LOW = 0.32   // daylight reaches 0 at this much sun BELOW the horizon
const TWILIGHT_HIGH = 0.36  // ...and 1 at this much above it

export function daylight(progress: number): number {
  const e = sunElevation(progress)
  const t = (e + TWILIGHT_LOW) / (TWILIGHT_LOW + TWILIGHT_HIGH)
  const c = t < 0 ? 0 : t > 1 ? 1 : t
  return c * c * (3 - 2 * c)      // smoothstep
}

/** The inverse: how far the garden has risen into its silver. Canon's night axis. */
export function silver(progress: number): number {
  return 1 - daylight(progress)
}

/** Real milliseconds until `phase` next begins. Scanned off the same curve everything else uses,
 *  rather than a second table of boundaries that could drift from it. */
export function msUntilPhase(phase: DayPhase, nowMs: number = Date.now()): number {
  const start = dayProgress(nowMs)
  const STEPS = 24 * 12          // 5-game-minute resolution; ample for scheduling
  for (let i = 1; i <= STEPS; i++) {
    const p = (start + i / STEPS) % 1
    if (getPhase(p) === phase && getPhase((start + (i - 1) / STEPS) % 1) !== phase) {
      return (i / STEPS) * CYCLE_MS
    }
  }
  return CYCLE_MS
}
