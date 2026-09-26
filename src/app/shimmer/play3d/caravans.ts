// caravans.ts — THE CARAVANS PARKED ON THE PASSAGE'S FAR ROAD: who is in today, this week, this month.
//
// ★ PURE over `nowMs`. Every keeper sees the same caravans on the same day, because the roster is a
// function of the calendar and nothing else — nothing to sync, nothing to store.
//
// Alex (2026-09-26): *"caravans that are parked with the merchant of the day stalls that cycle weekly
// and monthly with a few stores."* Canon already has the shape: the Passage's traders take *"rotating
// spots. One leaves, another takes their place. No permanent claims"* (`world/rune-hold.md`), and the
// tunnel runs through the mountain to the other side, which is the road a caravan comes in on.
//
// ── ★ THE REAL CALENDAR, NOT THE WORLD'S WEEK — and why both clocks stand ─────────────────────────
// The resident shelves keep canon's five-day week (merchants E'xday, teachers Coomday; one world day is
// 64 real minutes). A caravan is the reason to come back DAILY, and a daily visitor on a 64-minute day
// lands on a random weekday, so the caravans turn on the keeper's real day instead. They are not the
// E'xday merchants and never sell what canon gives those merchants (gems), so the two clocks never
// decide the same shelf.
//
// ── WHAT A CARAVAN MAY CARRY (canon's lines, which make the list short on purpose) ───────────────
//   ⛔ seeds and gathered goods (09-22: *nobody gathers for you*) · ⛔ gems off E'xday · ⛔ a teacher off
//   Coomday · ⛔ ultimates, ever. ✅ Knowledge Scrolls (the bought road, any day) · ✅ second-hand vessels
//   (the rack, sleepers and all, 09-05). The next goods are COSMETICS, which need their own catalogue.
//   The MONTHLY wagon is the stray-keeper's, shuttered until CANON_GAPS [OPEN] 09-25 rules on adoption.
//
// ── JIN'S NUMBERS ──
//   · the day turns at 09:00 UTC (05:00 on the US east coast), the week on Monday, the month on the 1st
//   · the merchant of the day alternates peddler (scrolls) / broker (vessels); the week's caravan is a
//     long-hauler carrying both, a deeper rack than either

import type { ShelfKey } from './passage-hall'

export const RESET_HOUR_UTC = 9
const HOUR = 3_600_000
const DAY = 24 * HOUR

/** Real days since the epoch, turning at the reset hour. */
export const dayIndex = (nowMs: number) => Math.floor((nowMs - RESET_HOUR_UTC * HOUR) / DAY)
/** Real weeks, turning on Monday (day 0, 1970-01-01, was a Thursday). */
export const weekIndex = (nowMs: number) => Math.floor((dayIndex(nowMs) + 3) / 7)
/** Real months, turning on the 1st. */
export function monthIndex(nowMs: number): number {
  const d = new Date(nowMs - RESET_HOUR_UTC * HOUR)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

export type CaravanSlot = 'daily' | 'weekly' | 'monthly'
export type CaravanKind = 'peddler' | 'broker' | 'long-hauler' | 'strays'

export interface CaravanStock {
  rackSeed: number; rackCycle: number; rackSize: number
  vesselSeed: number; vesselCycle: number; vesselSize: number
}

export interface Caravan {
  slot: CaravanSlot
  kind: CaravanKind
  /** a role, never a person (naming a Passage character is Magii's) */
  name: string
  /** false = parked and shuttered: nobody at the flap */
  open: boolean
  shelves: ShelfKey[]
  stock: CaravanStock
  /** ms until this caravan pulls out and the next one takes its spot */
  leavesInMs: number
}

const NAMES: Record<CaravanKind, string> = {
  peddler: 'a scroll peddler',
  broker: 'a vessel broker',
  'long-hauler': 'the long-haul caravan',
  strays: "the stray-keeper's wagon",
}

function endOf(slot: CaravanSlot, nowMs: number): number {
  if (slot === 'daily') return (dayIndex(nowMs) + 1) * DAY + RESET_HOUR_UTC * HOUR
  if (slot === 'weekly') return ((weekIndex(nowMs) + 1) * 7 - 3) * DAY + RESET_HOUR_UTC * HOUR
  const m = monthIndex(nowMs) + 1
  return Date.UTC(Math.floor(m / 12), m % 12, 1) + RESET_HOUR_UTC * HOUR
}

export function caravanFor(slot: CaravanSlot, nowMs: number): Caravan {
  const leavesInMs = Math.max(0, endOf(slot, nowMs) - nowMs)
  if (slot === 'daily') {
    const day = dayIndex(nowMs)
    const kind: CaravanKind = day % 2 === 0 ? 'peddler' : 'broker'
    return {
      slot, kind, name: NAMES[kind], open: true, leavesInMs,
      shelves: kind === 'peddler' ? ['rack'] : ['secondhand'],
      stock: { rackSeed: 701, rackCycle: day, rackSize: 5, vesselSeed: 703, vesselCycle: day, vesselSize: 4 },
    }
  }
  if (slot === 'weekly') {
    const week = weekIndex(nowMs)
    return {
      slot, kind: 'long-hauler', name: NAMES['long-hauler'], open: true, leavesInMs,
      shelves: ['rack', 'secondhand'],
      stock: { rackSeed: 709, rackCycle: week, rackSize: 7, vesselSeed: 719, vesselCycle: week, vesselSize: 6 },
    }
  }
  // The stray-keeper parks every month and stays shuttered until canon rules on adoption.
  const month = monthIndex(nowMs)
  return {
    slot, kind: 'strays', name: NAMES.strays, open: false, leavesInMs, shelves: [],
    stock: { rackSeed: 0, rackCycle: month, rackSize: 0, vesselSeed: 0, vesselCycle: month, vesselSize: 0 },
  }
}

export const CARAVAN_SLOTS: readonly CaravanSlot[] = ['daily', 'weekly', 'monthly']

/** "leaves in 5h" / "leaves in 3 days" */
export function leavesIn(ms: number): string {
  const h = ms / HOUR
  if (h < 1) return `leaves in ${Math.max(1, Math.round(ms / 60000))}m`
  if (h < 36) return `leaves in ${Math.round(h)}h`
  return `leaves in ${Math.round(h / 24)} days`
}
