// M113 s1 (Alex 11-23: "what grows in planters.. maybe the saplings from the wild can be used as decor"): THE PLANTER BOX
// GROWS A SAPLING. E at a `planter_box` lists every sapling the keeper holds on the plot (bag + the garden bank every chest
// opens onto), one tap plants it, and it grows in visible stages over GAME DAYS (the M106 clock, nodes.ts › GAME_DAY_MS).
// Decor only: no yield, nothing to harvest. Only items that already exist (shared/inventory.ts, every *_sapling) go in; Mana
// Seeds stay Spirit-Planter-only (the box keeps its pointer line for them).
// A box's sapling travels with the box: a pickup (piece-lift.ts › liftPiece, E 'Pick up' and the third melee hit) moves it under
// CARRIED + the old piece id, sapling + planting time intact; the next Planter Box set down takes the oldest carried one.
//
// ★ PURE but for the guarded localStorage load/save (a garden key, GARDEN_KEY_SPECS).
import { gardenKey } from '@/lib/keeper-local'
import { GAME_DAY_MS } from './nodes'
import { OPEN_ITEMS, countOf, take, type Inv } from '../shared/inventory'
import { bankCount, bankTake, type Bank } from './garden-bank'

/** The furniture id of the decor box. */
export const PLANTER_BOX = 'planter_box'
/** Every sapling item in the game (read from the item table, none added here). */
export const SAPLING_IDS: readonly string[] = Object.keys(OPEN_ITEMS).filter(id => id.endsWith('_sapling'))
export const isSapling = (id: string) => SAPLING_IDS.includes(id)

/** Stages a potted sapling shows: 0 = just planted ... SAPLING_STAGES - 1 = fully grown. Dial. */
export const SAPLING_STAGES = 4
/** Game days per stage (so fully grown after (SAPLING_STAGES - 1) * STAGE_DAYS game days). Dial. */
export const STAGE_DAYS = 1
export const STAGE_MS = STAGE_DAYS * GAME_DAY_MS

export type BoxPlant = { sapling: string; at: number }
export type Boxes = Readonly<Record<string, BoxPlant>>

/** Which stage the sapling is at now (0-based, capped at the last). */
export const stageOf = (b: BoxPlant, now: number) => Math.max(0, Math.min(SAPLING_STAGES - 1, Math.floor((now - b.at) / STAGE_MS)))
/** When the next stage comes (null = fully grown). */
export const nextStageAt = (b: BoxPlant, now: number) => { const s = stageOf(b, now); return s >= SAPLING_STAGES - 1 ? null : b.at + (s + 1) * STAGE_MS }

/** Plant `sapling` in box `pieceId`. Null = the box already holds one, or it is not a sapling. */
export function plantBox(boxes: Boxes, pieceId: string, sapling: string, now: number): Boxes | null {
  if (boxes[pieceId] || !isSapling(sapling)) return null
  return { ...boxes, [pieceId]: { sapling, at: now } }
}

/** Every sapling on the plot, grouped: how many in the bag, how many in the bank. */
export function saplingsOnPlot(inv: Inv, bank: Bank): { id: string; bag: number; bank: number }[] {
  return SAPLING_IDS.map(id => ({ id, bag: countOf(inv, id), bank: bankCount(bank, id) })).filter(s => s.bag + s.bank > 0)
}
/** Take one sapling: from the bag first, else from the bank. Null = none anywhere. */
export function takeSapling(inv: Inv, bank: Bank, id: string): { inv: Inv; bank: Bank; from: 'bag' | 'bank' } | null {
  const i = take(inv, id, 1)
  if (i) return { inv: i, bank, from: 'bag' }
  const b = bankTake(bank, id, 1)
  return b ? { inv, bank: b, from: 'bank' } : null
}

// ── a sapling travels with its box ────────────────────────────────────────────────────────────────────────────────
export const CARRIED = 'carried:'
export const isCarried = (key: string) => key.startsWith(CARRIED)
/** Picking box `pieceId` up: an empty box changes nothing; a planted one's sapling rides along under CARRIED + id. */
export function carryBox(boxes: Boxes, pieceId: string): Boxes {
  const b = boxes[pieceId]
  if (!b) return boxes
  const { [pieceId]: _gone, ...rest } = boxes
  return { ...rest, [CARRIED + pieceId]: b }
}
/** A Planter Box just set down at `pieceId`: it takes the oldest carried sapling (unchanged). None carried = unchanged. */
export function settleBox(boxes: Boxes, pieceId: string): Boxes {
  if (boxes[pieceId]) return boxes
  const c = Object.entries(boxes).filter(([k]) => isCarried(k)).sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1))[0]
  if (!c) return boxes
  const { [c[0]]: _gone, ...rest } = boxes
  return { ...rest, [pieceId]: c[1] }
}

// ── save: garden-tied, registered in GARDEN_KEY_SPECS ─────────────────────────────────────────────────────────────
export const BOX_KEY = 'ather.planterBox.v1'
export function parseBoxes(v: unknown): Boxes {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, BoxPlant> = {}
  for (const [k, b] of Object.entries(v as Record<string, Partial<BoxPlant>>)) if (b && typeof b.sapling === 'string' && isSapling(b.sapling) && typeof b.at === 'number') out[k] = { sapling: b.sapling, at: b.at }
  return out
}
export function loadBoxes(): Boxes {
  try { return parseBoxes(JSON.parse(localStorage.getItem(gardenKey(BOX_KEY)) ?? 'null')) } catch { return {} }
}
export function saveBoxes(b: Boxes): void {
  try { localStorage.setItem(gardenKey(BOX_KEY), JSON.stringify(b)) } catch { /* private window */ }
}
