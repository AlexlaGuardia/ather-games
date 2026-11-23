// ── KAEL'S SHIP, REPAIR STAGE 1: THE CELL HOUSING (BETA M108) ─────────────────────────────────────────────────────────────
// Canon (athernyx CANON_GAPS › "Repairing Kael's ship" (a), RULED-AFK b44556e, Alex-confirmed 9b4dfe8): after M73's SHIP-REPAIR
// FLAG (opening-chain-store.ts › getShipRepairFlag), Kael's ledger names stage 1 = the cell housing, made to order at Hollis's
// manatech shop in Rune Hold for Marks. Veyra points, the shop builds. The wreck is not a parts source. A side quest gives the
// last part before the first trip (NOT built here), so the whole loop stays OWNER-ONLY behind ?ship=gate, like the map.
//
// Steps:  (flag off)  Hollis has nothing for the keeper: the ambient bark, no order
//      -> open        the flag is set: the ledger's open line + "Take Kael's page..." ; Hollis plays Unit 3 shop:first
//      -> quoted      shop:quote fired (the price shown): the entry becomes "Earn the Marks..." ; the order stands
//      -> made        paid in full (no credit): the shop builds the housing and hands it over (bag item CELL_HOUSING)
//      -> stage1      M108 s2: E at Franky in the yard with the housing = the keeper fits it (canon: "the shop builds, the keeper
//                     fits it at the yard"), the item is used up, STAGE 1 DONE (the destination-map gate's read)
//      -> charged     M108 s3 (Magii [RULED] 83b6870, ather-rework §7⅞): the fitted housing leaves the cells EMPTY; Kael's ledger
//                     turns to its next line; the keeper trades with a DIGGER Moglin in the Ather (canon trades table: Goldwood
//                     Plank in, Raw Mana Shard out; ather/digger-trade.ts) and E at Franky with FIRST_CHARGE_SHARDS of them =
//                     the cells' FIRST CHARGE. ★ The destination-map gate reads `charged` now (was stage1).
// Old records already stage1 (s1 paid = fitted in one step) stay done; parseRepair reads them as made too. A stage1 record
// from before s3 is fitted but NOT charged (canon: the fit leaves the cells empty), so it now needs the charge.
// PURE (no React, no storage): the store is ship-repair-store.ts. Lines: hollis-lines.ts (SIGNED).

export const REPAIR_KEY = 'open.repair.v1'

/** ★ THE DIALS (Jin's build call; canon leaves prices to the build). "It won't be cheap": above the dearest gun (4,500). */
export const CELL_HOUSING_PRICE = 6000
/** M108 s2: the housing the shop hands over, a bag item until it is fitted (inventory.ts › giveHousing; kept on a fall) */
export const CELL_HOUSING = 'cell_housing'
export const GIFT_CELL_HOUSING = 'cell_housing_made'
/** a rare material the keeper must bring with the Marks (canon: SOME orders). Stage 1 needs none; set a bag id to require one. */
export const CELL_HOUSING_MATERIAL: string | null = null
/** M108 s3: the cells' first charge (Jin's dial, hub 11-23): Raw Mana Shards spent at Franky */
export const RAW_SHARD = 'raw_mana_shard'
export const FIRST_CHARGE_SHARDS = 3

export interface Repair { v: 1; quoted: boolean; made: boolean; stage1: boolean; /** M108 s3: the cells' first charge */ charged: boolean }
export const newRepair = (): Repair => ({ v: 1, quoted: false, made: false, stage1: false, charged: false })
export function parseRepair(raw: unknown): Repair {
  const r = raw as Repair | null
  if (!r || r.v !== 1) return newRepair()
  const charged = r.charged === true && r.stage1 === true
  const stage1 = r.stage1 === true
  return { v: 1, quoted: r.quoted === true || stage1, made: r.made === true || stage1, stage1, charged }
}

export type RepairStep = 'off' | 'open' | 'quoted' | 'made' | 'stage1' | 'charged'
export const repairStep = (flag: boolean, r: Repair): RepairStep => (r.charged ? 'charged' : r.stage1 ? 'stage1' : r.made ? 'made' : !flag ? 'off' : r.quoted ? 'quoted' : 'open')

/** the quote fired (shop:quote): only while the order is open */
export const onQuote = (flag: boolean, r: Repair): Repair => (repairStep(flag, r) === 'open' ? { ...r, quoted: true } : r)

/** Pay for the housing. Refused (nothing changes) unless the order is quoted and the purse holds the whole price. */
export function payHousing(flag: boolean, r: Repair, marks: number): { ok: true; repair: Repair; marks: number } | { ok: false; why: 'no-order' | 'short' } {
  if (repairStep(flag, r) !== 'quoted') return { ok: false, why: 'no-order' }
  if (!(marks >= CELL_HOUSING_PRICE)) return { ok: false, why: 'short' }
  return { ok: true, repair: { ...r, made: true }, marks: marks - CELL_HOUSING_PRICE }
}

/** M108 s2: fit the housing at the yard. Refused (null) unless it was made and is not fitted yet. */
export const fitHousing = (r: Repair): Repair | null => (r.made && !r.stage1 ? { ...r, stage1: true } : null)

/** M108 s3: charge the cells at the yard. Refused (null) unless fitted, not charged yet, and the keeper carries the shards. */
export const chargeCells = (r: Repair, shards: number): Repair | null => (r.stage1 && !r.charged && shards >= FIRST_CHARGE_SHARDS ? { ...r, charged: true } : null)

/** What E at Franky does (owner + ?ship=gate): open the map, fit the housing, charge the cells, or say she is not ready
 *  (`notReady` / `empty`). `override` = ?ship=open. s3: the map opens only once the cells are charged. */
export type ShipBoard = 'map' | 'fit' | 'charge' | 'not-ready' | 'empty'
export const shipBoard = (r: Repair, override = false, shards = 0): ShipBoard =>
  (r.charged || override ? 'map' : r.stage1 ? (shards >= FIRST_CHARGE_SHARDS ? 'charge' : 'empty') : r.made ? 'fit' : 'not-ready')

/** The player-facing labels. ★ SIGNED rows (Alex 11-23, athernyx CANON/game/shimmer-lines-batch-2026-11-23b.md › B, MAIN,
 *  word for word; business/signed-lines-m108b.test.ts diffs them against the canon file): price, pay, leave, made, fitPrompt,
 *  notReady, fitEntry, bagFull (+ the item's name and blurb in inventory.ts). The rest are still FUNCTIONAL placeholders
 *  the batch does not cover (for @lark): next, fitted, chargePrompt, charged, empty, chargeEntryReady. */
export const fmtMarks = (n: number) => `${n.toLocaleString('en-US')} Marks`
export const LABEL = {
  price: `Cell housing · ${fmtMarks(CELL_HOUSING_PRICE)}`,
  pay: `Pay ${fmtMarks(CELL_HOUSING_PRICE)}`,
  next: '…',
  leave: 'Leave',
  made: 'A cell housing · in your bag',
  fitted: 'Cell housing fitted · repair stage 1 done',
  fitPrompt: 'E · Fit the cell housing',
  notReady: "Franky can't fly yet · the cell housing is not fitted",
  fitEntry: "Fit the cell housing at Kael's yard.",
  bagFull: 'Your bag is full. Make room for the cell housing.',
  // M108 s3 (functional, for @lark)
  chargePrompt: 'E · Charge the cells',
  charged: 'Cells charged · first charge done',
  empty: `The ship is not ready to fly · the cells are empty (${FIRST_CHARGE_SHARDS} Raw Mana Shards)`,
  chargeEntry: 'Trade a Digger Moglin for Raw Mana Shards.',   // ★ SIGNED (batch 11-23b › C, the keeper's entry)
  chargeEntryReady: "Charge the cells at Kael's yard.",
} as const
/** M108 s3: Kael's ledger once the housing is fitted. ★ SIGNED (batch 11-23b › C MAIN, the open line trimmed to the seed by
 *  Alex): the struck housing line's margin, the next open line and its margin. */
export const LEDGER_FITTED_MARGIN = 'Fits. Huh.'
export const LEDGER_CHARGE_LINE = 'Cells want filling. Ather mana, raw.'
export const LEDGER_CHARGE_MARGIN = 'Empty cells. Should have checked first.'
