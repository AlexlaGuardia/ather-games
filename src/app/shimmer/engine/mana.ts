// Mana pool system — drain, regen, channeling state
// Canon: shimmer-skilling.md — All gathering is mana-powered
// Mana skill levels passively by spending mana (1 mana spent = 1 Mana XP)

const TICKS_PER_SEC = 15

// Mana pool/regen values for levels 1-10 (tuned for casual play)
const MANA_TABLE: { pool: number; regen: number }[] = [
  /* 0 (unused) */ { pool: 100, regen: 1.0 },
  /* 1 */  { pool: 100, regen: 1.0 },
  /* 2 */  { pool: 110, regen: 1.1 },
  /* 3 */  { pool: 120, regen: 1.2 },
  /* 4 */  { pool: 135, regen: 1.3 },
  /* 5 */  { pool: 150, regen: 1.5 },
  /* 6 */  { pool: 160, regen: 1.6 },
  /* 7 */  { pool: 175, regen: 1.8 },
  /* 8 */  { pool: 185, regen: 1.9 },
  /* 9 */  { pool: 192, regen: 1.9 },
  /* 10 */ { pool: 200, regen: 2.0 },
]

/** Get max pool size for a given Mana skill level. Canon: 100 at 1, 200 at 10, ~300 at 99. */
export function getMaxPool(manaLevel: number): number {
  if (manaLevel <= 10) return MANA_TABLE[Math.max(1, manaLevel)].pool
  // Post-10: diminishing returns, approaching ~300 at 99
  // 200 + 100 * (1 - e^(-(level-10)/35))
  return Math.floor(200 + 100 * (1 - Math.exp(-(manaLevel - 10) / 35)))
}

/** Get regen rate (mana per second) for a given Mana skill level. Canon: 1.0 at 1, 2.0 at 10, ~3.5 at 99. */
export function getRegenRate(manaLevel: number): number {
  if (manaLevel <= 10) return MANA_TABLE[Math.max(1, manaLevel)].regen
  // Post-10: diminishing returns, approaching ~3.5 at 99
  // 2.0 + 1.5 * (1 - e^(-(level-10)/35))
  return +(2.0 + 1.5 * (1 - Math.exp(-(manaLevel - 10) / 35))).toFixed(2)
}

/** Get extraction speed multiplier. Scales with mana milestones. */
export function getExtractionSpeed(manaLevel: number): number {
  if (manaLevel >= 9) return 1.3
  if (manaLevel >= 6) return 1.2
  if (manaLevel >= 3) return 1.1
  return 1.0
}

/** Mana perks unlocked at specific levels */
export type ManaPerk = 'faster_extraction' | 'dual_tend' | 'node_sense' | 'mana_pulse' | 'mana_surplus'

export function getUnlockedPerks(manaLevel: number): ManaPerk[] {
  const perks: ManaPerk[] = []
  if (manaLevel >= 3) perks.push('faster_extraction')
  if (manaLevel >= 5) perks.push('dual_tend')
  if (manaLevel >= 7) perks.push('node_sense')
  if (manaLevel >= 9) perks.push('mana_pulse')
  if (manaLevel >= 10) perks.push('mana_surplus')
  return perks
}

// ============================================
// Mana Pool State (lives in game loop)
// ============================================

export interface ManaPool {
  current: number        // current mana (float for smooth regen)
  channeling: boolean    // true while actively harvesting
  manaSpent: number      // accumulated mana spent this session (for Mana XP tracking)
}

/** Create a fresh mana pool at full capacity for the given Mana skill level */
export function createManaPool(manaLevel: number): ManaPool {
  return {
    current: getMaxPool(manaLevel),
    channeling: false,
    manaSpent: 0,
  }
}

/**
 * Try to drain mana. Returns true if enough mana was available.
 * Tracks total mana spent (every point = 1 Mana XP later).
 */
export function drainMana(pool: ManaPool, cost: number): boolean {
  if (pool.current < cost) return false
  pool.current -= cost
  pool.manaSpent += cost
  return true
}

/**
 * Regen mana each game tick. Call once per 15 TPS tick.
 * Optional regenBonus from beast perk (e.g. 0.15 = +15% regen).
 * Returns the amount regenerated (for UI feedback).
 */
export function regenManaTick(pool: ManaPool, manaLevel: number, regenBonus?: number): number {
  const max = getMaxPool(manaLevel)
  if (pool.current >= max) return 0

  const baseRegen = getRegenRate(manaLevel) / TICKS_PER_SEC
  const regenPerTick = baseRegen * (1 + (regenBonus ?? 0))
  const prev = pool.current
  pool.current = Math.min(max, pool.current + regenPerTick)
  return pool.current - prev
}

/**
 * Flush accumulated mana spent and return the total (for Mana XP).
 * Call this periodically (e.g., every second) to award Mana XP.
 */
export function flushManaSpent(pool: ManaPool): number {
  const spent = Math.floor(pool.manaSpent)
  pool.manaSpent -= spent
  return spent
}

// Save/load — only persist current amount + spent accumulator
export interface ManaSave {
  current: number
  manaSpent: number
}

export function manaToSave(pool: ManaPool): ManaSave {
  return { current: pool.current, manaSpent: pool.manaSpent }
}

export function manaFromSave(saved: ManaSave, manaLevel: number): ManaPool {
  const max = getMaxPool(manaLevel)
  return {
    current: Math.min(saved.current ?? max, max),
    channeling: false,
    manaSpent: saved.manaSpent ?? 0,
  }
}
