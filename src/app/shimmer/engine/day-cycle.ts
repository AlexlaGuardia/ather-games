// Day/Night cycle engine
// 30-minute full day — Dawn(3m) Day(20m) Dusk(3m) Night(4m) → wraps
// Forestry respawns at dawn, Prospecting at dusk, Rinning at midnight

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'

// Full cycle = 30 real minutes (tuned for casual browser sessions)
const CYCLE_MS = 30 * 60 * 1000

// Phase boundaries as fraction of cycle (0-1)
const DAWN_START  = 0          // 0:00
const DAY_START   = 3 / 30     // 3:00  (10%)
const DUSK_START  = 23 / 30    // 23:00 (76.7%)
const NIGHT_START = 26 / 30    // 26:00 (86.7%)
const MIDNIGHT    = 28 / 30    // 28:00 (93.3%)

// Respawn trigger thresholds (fraction of cycle)
export const RESPAWN_TRIGGERS = {
  forestry:    DAWN_START,
  prospecting: DUSK_START,
  rinning:     MIDNIGHT,
} as const

export interface DayCycleState {
  elapsed: number        // ms into current cycle (0 to CYCLE_MS)
  prevProgress: number   // previous tick's progress (for crossing detection)
}

/** Create a fresh cycle starting at dawn */
export function createDayCycle(): DayCycleState {
  return { elapsed: 0, prevProgress: 0 }
}

/** Create cycle from save data */
export function dayCycleFromSave(elapsed: number): DayCycleState {
  const e = elapsed % CYCLE_MS
  return { elapsed: e, prevProgress: e / CYCLE_MS }
}

/** Get cycle progress as 0-1 float */
export function getCycleProgress(cycle: DayCycleState): number {
  return (cycle.elapsed % CYCLE_MS) / CYCLE_MS
}

/** Get current phase */
export function getPhase(cycle: DayCycleState): DayPhase {
  const p = getCycleProgress(cycle)
  if (p < DAY_START) return 'dawn'
  if (p < DUSK_START) return 'day'
  if (p < NIGHT_START) return 'dusk'
  return 'night'
}

/** Get progress within current phase (0-1) for smooth transitions */
export function getPhaseProgress(cycle: DayCycleState): number {
  const p = getCycleProgress(cycle)
  if (p < DAY_START) return p / DAY_START
  if (p < DUSK_START) return (p - DAY_START) / (DUSK_START - DAY_START)
  if (p < NIGHT_START) return (p - DUSK_START) / (NIGHT_START - DUSK_START)
  return (p - NIGHT_START) / (1 - NIGHT_START)
}

/** Get display time as HH:MM (24h cycle mapped to 45 min) */
export function getDisplayTime(cycle: DayCycleState): string {
  const p = getCycleProgress(cycle)
  // Map dawn=6:00, day=7:00, dusk=19:00, night=20:00, midnight=0:00
  const hour24 = ((p * 24) + 6) % 24
  const h = Math.floor(hour24)
  const m = Math.floor((hour24 - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

/**
 * Tick the cycle forward. Returns skill IDs that should respawn this tick
 * (when a respawn threshold was crossed).
 * Call once per game tick (15 TPS).
 */
export function tickDayCycle(cycle: DayCycleState, dtMs: number): string[] {
  const prev = getCycleProgress(cycle)
  cycle.elapsed = (cycle.elapsed + dtMs) % CYCLE_MS
  const curr = getCycleProgress(cycle)
  cycle.prevProgress = curr

  const triggered: string[] = []

  // Check each respawn trigger — did we cross it this tick?
  for (const [skillId, threshold] of Object.entries(RESPAWN_TRIGGERS)) {
    if (crossedThreshold(prev, curr, threshold)) {
      triggered.push(skillId)
    }
  }

  return triggered
}

/** Check if progress crossed a threshold (handles cycle wrap) */
function crossedThreshold(prev: number, curr: number, threshold: number): boolean {
  if (curr >= prev) {
    // Normal forward: prev < threshold <= curr
    return prev < threshold && curr >= threshold
  } else {
    // Wrapped around: check both sides of the wrap
    return prev < threshold || curr >= threshold
  }
}

// ============================================
// Ambient lighting (canvas overlay colors)
// ============================================

/** Get ambient overlay color + opacity for the current cycle position */
export function getAmbientOverlay(cycle: DayCycleState): { color: string; alpha: number } {
  const phase = getPhase(cycle)
  const pp = getPhaseProgress(cycle)

  switch (phase) {
    case 'dawn':
      // Warm orange fading out as sun rises
      return { color: '#ff9940', alpha: 0.18 * (1 - pp) }
    case 'day':
      // No tint
      return { color: '#000000', alpha: 0 }
    case 'dusk':
      // Purple/orange creeping in
      return { color: '#6030a0', alpha: 0.12 * pp }
    case 'night':
      // Deep blue, strongest at midnight (pp=0.5), slight ease
      const nightIntensity = pp < 0.5 ? pp * 2 : 2 - pp * 2
      return { color: '#101838', alpha: 0.25 + 0.1 * nightIntensity }
  }
}
