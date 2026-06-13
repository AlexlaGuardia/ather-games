// Shared host state — the commander's ledger, mana, and exp.
// Read/written by both the Crucible page and the Starforge.

import { HostState } from './types'

export const HOST_KEY = 'nolmir.host.v2'

export function loadHost(): HostState {
  try {
    const raw = localStorage.getItem(HOST_KEY)
    if (raw) {
      const h = JSON.parse(raw) as HostState
      h.marks = h.marks ?? 0
      return h
    }
  } catch {}
  return { mana: 0, exp: 0, marks: 0, ledger: [] }
}

export function spendMarks(h: HostState, amount: number): HostState | null {
  if ((h.marks ?? 0) < amount) return null
  const next = { ...h, marks: (h.marks ?? 0) - amount }
  saveHost(next)
  return next
}

// ---- host level — exp IS the host, and the host grows slowly ----
// Permanent, warp-proof (it's the commander, not the node). Levels unlock
// STRUCTURE: more pieces per floor now; deeper floors and lesser-guard
// squads later. The trinity stays three — locked canon.

export function hostLevelCost(level: number): number {
  return Math.round(1500 * Math.pow(level, 1.9))
}

export function hostLevelFor(exp: number): number {
  let lv = 0
  while (exp >= hostLevelCost(lv + 1)) lv++
  return lv
}

export function hostProgress(exp: number): { level: number; next: number } {
  const level = hostLevelFor(exp)
  return { level, next: hostLevelCost(level + 1) }
}

// ---- per-creature guard levels (slice 4b) ----
// A guard levels from USE, not coin — the retention spine shared across modes.
// Faster + cheaper than the host curve: a creature should climb within a
// session. Cumulative xp to REACH a level; level 1 is the floor (0 xp).
export function guardXpForLevel(level: number): number {
  return level <= 1 ? 0 : Math.round(50 * Math.pow(level - 1, 1.7))
}

export function guardLevelForXp(xp: number): number {
  let lv = 1
  while (xp >= guardXpForLevel(lv + 1)) lv++
  return lv
}

// progress within the current level — for the xp bar
export function guardProgress(xp: number): { level: number; into: number; span: number; next: number } {
  const level = guardLevelForXp(xp)
  const base = guardXpForLevel(level)
  const next = guardXpForLevel(level + 1)
  return { level, into: xp - base, span: Math.max(1, next - base), next }
}

// xp a fielded guard earns from a hold — deeper + deadlier breaches pay more
export function guardXpGain(waves: number, tier: number): number {
  return Math.round((waves + 1) * Math.max(1, tier) * 2)
}

// layout piece allowance per floor — the structural unlock that exists today
export function pieceCaps(level: number): { guard: number; spike: number; watcher: number } {
  return { guard: 4 + 2 * level, spike: 6 + 2 * level, watcher: 2 + level }
}

// what the ladder is climbing toward (systems land in later phases)
export const HOST_UNLOCKS: { level: number; what: string }[] = [
  { level: 3, what: 'a third floor — the works between arena and hall' },
  { level: 5, what: 'lesser-guard squads beneath the trinity' },
]

export function saveHost(h: HostState) {
  try {
    localStorage.setItem(HOST_KEY, JSON.stringify(h))
  } catch {}
}

export function spendMana(h: HostState, amount: number): HostState | null {
  if (h.mana < amount) return null
  const next = { ...h, mana: h.mana - amount }
  saveHost(next)
  return next
}
