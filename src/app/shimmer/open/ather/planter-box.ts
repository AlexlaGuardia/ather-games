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
import { MOONBERRY } from './cooking'

/** The furniture id of the decor box (the PLAIN style; every box placed before M242 is this one). */
export const PLANTER_BOX = 'planter_box'
// ── M242 s1 (Alex 11-27, BETA M242): Planter Boxes come in STYLES. Each style is its own furniture piece (furniture.ts), so the
//    STYLE PICK is the carpentry bench (one job per style) and a style survives the bag the way any piece does. Code-built looks
//    (workshop.tsx PieceBody). Not in s1: grade ladder / S-grade odds, bonsai, Exchange listing (they wait on Alex's cut).
/** Every Planter Box style, the plain one first. */
export const PLANTER_STYLES: readonly string[] = [PLANTER_BOX, 'planter_box_banded', 'planter_box_carved', 'planter_tub_round']
export const isPlanterBox = (item: string) => PLANTER_STYLES.includes(item)
/** EXP a box earns per harvest (a pick of its bush). Dial; the grade ladder that spends it is M242 s2+. */
export const BOX_EXP_PER_HARVEST = 1
/** The box's own EXP (0 for a box saved before M242). */
export const expOf = (b: Pick<BoxPlant, 'exp'> | undefined) => b?.exp ?? 0
/** M242 LOCK: the plant a box is locked to (null = empty, free to take any pottable). Once planted it stays that plant: lifting
 *  carries it, setting down brings it back, and plantBox refuses anything into a box that holds one. */
export const lockedTo = (boxes: Boxes, pieceId: string): string | null => boxes[pieceId]?.sapling ?? null
/** The box's tag on its prompt + panel: '<plant> box · EXP n' (plain functional label, @lark). `name` = the item's name. */
export const boxTag = (b: BoxPlant, name: string) => `${name} box · EXP ${expOf(b)}`
/** Every sapling item in the game (read from the item table, none added here). */
export const SAPLING_IDS: readonly string[] = Object.keys(OPEN_ITEMS).filter(id => id.endsWith('_sapling'))
export const isSapling = (id: string) => SAPLING_IDS.includes(id)
// ── M241 (Alex 11-27, BETA M241 s3): a picked MOONBERRY can go in the box too and grows a moonberry BUSH that keeps giving
//    berries (pick in the box's card, then it regrows). The box still lifts like any piece and the bush rides along (carryBox).
//    Not the farm beds (crops), not the spirit planters (Mana Seeds).
/** What the box takes: every sapling, plus a Moonberry (grows a bush). */
export const POTTABLE_IDS: readonly string[] = [...SAPLING_IDS, MOONBERRY]
export const isPottable = (id: string) => POTTABLE_IDS.includes(id)
export const isBush = (b: Pick<BoxPlant, 'sapling'>) => b.sapling === MOONBERRY
/** Berries a ripe bush gives per pick, and how long it takes to bear again after a pick (dials, Jin's; feel: Alex). */
export const BUSH_BERRIES = 2
export const BUSH_REGROW_MS = GAME_DAY_MS / 2
/** When the potted plant is fully grown (the last stage). */
export const grownAt = (b: BoxPlant) => b.at + (SAPLING_STAGES - 1) * STAGE_MS
/** A bush bears once grown, then again BUSH_REGROW_MS after each pick. False for a sapling (decor only, never bears). */
export function ripe(b: BoxPlant, now: number): boolean {
  if (!isBush(b) || now < grownAt(b)) return false
  return b.picked === undefined || now >= b.picked + BUSH_REGROW_MS
}
/** When a bush bears next (null = a sapling, or ripe now). */
export function ripeAt(b: BoxPlant, now: number): number | null {
  if (!isBush(b) || ripe(b, now)) return null
  return Math.max(grownAt(b), b.picked === undefined ? 0 : b.picked + BUSH_REGROW_MS)
}
/** Pick the berries off box `pieceId`. Null = no bush there or not ripe. */
export function pickBox(boxes: Boxes, pieceId: string, now: number): { boxes: Boxes; give: { id: string; n: number } } | null {
  const b = boxes[pieceId]
  if (!b || !ripe(b, now)) return null
  return { boxes: { ...boxes, [pieceId]: { ...b, picked: now, exp: expOf(b) + BOX_EXP_PER_HARVEST } }, give: { id: MOONBERRY, n: BUSH_BERRIES } }   // M242: a harvest = box EXP
}

/** Stages a potted sapling shows: 0 = just planted ... SAPLING_STAGES - 1 = fully grown. Dial. */
export const SAPLING_STAGES = 4
/** Game days per stage (so fully grown after (SAPLING_STAGES - 1) * STAGE_DAYS game days). Dial. */
export const STAGE_DAYS = 1
export const STAGE_MS = STAGE_DAYS * GAME_DAY_MS

/** `sapling` = the item planted (a *_sapling, or MOONBERRY for a bush); `picked` (M241) = when a bush was last picked;
 *  `exp` (M242) = the box's own EXP; `box` (M242) = the box's style (its furniture id) while CARRIED, so it only settles back
 *  into a box of that style (absent = the plain PLANTER_BOX, every pre-M242 save). */
export type BoxPlant = { sapling: string; at: number; picked?: number; exp?: number; box?: string }
export type Boxes = Readonly<Record<string, BoxPlant>>

/** Which stage the sapling is at now (0-based, capped at the last). */
export const stageOf = (b: BoxPlant, now: number) => Math.max(0, Math.min(SAPLING_STAGES - 1, Math.floor((now - b.at) / STAGE_MS)))
/** When the next stage comes (null = fully grown). */
export const nextStageAt = (b: BoxPlant, now: number) => { const s = stageOf(b, now); return s >= SAPLING_STAGES - 1 ? null : b.at + (s + 1) * STAGE_MS }

/** Plant `sapling` in box `pieceId`. Null = the box is LOCKED to a plant already (M242: any plant, the same one too), or it
 *  is not pottable. */
export function plantBox(boxes: Boxes, pieceId: string, sapling: string, now: number): Boxes | null {
  if (lockedTo(boxes, pieceId) !== null || isCarried(pieceId) || !isPottable(sapling)) return null
  return { ...boxes, [pieceId]: { sapling, at: now } }
}

/** Every sapling on the plot, grouped: how many in the bag, how many in the bank. */
export function saplingsOnPlot(inv: Inv, bank: Bank): { id: string; bag: number; bank: number }[] {
  return POTTABLE_IDS.map(id => ({ id, bag: countOf(inv, id), bank: bankCount(bank, id) })).filter(s => s.bag + s.bank > 0)
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
/** Picking box `pieceId` (style `item`) up: an empty box changes nothing; a planted one's plant, stage + EXP ride along under
 *  CARRIED + id, stamped with the box's style (M242). */
export function carryBox(boxes: Boxes, pieceId: string, item: string = PLANTER_BOX): Boxes {
  const b = boxes[pieceId]
  if (!b) return boxes
  const { [pieceId]: _gone, ...rest } = boxes
  return { ...rest, [CARRIED + pieceId]: { ...b, box: item } }
}
const styleOf = (b: BoxPlant) => b.box ?? PLANTER_BOX
/** A Planter Box of style `item` just set down at `pieceId`: it takes the oldest carried plant OF THAT STYLE (plant, stage,
 *  picks + EXP unchanged; the carry stamp dropped). None carried = unchanged. */
export function settleBox(boxes: Boxes, pieceId: string, item: string = PLANTER_BOX): Boxes {
  if (boxes[pieceId]) return boxes
  const c = Object.entries(boxes).filter(([k, b]) => isCarried(k) && styleOf(b) === item).sort((a, b) => a[1].at - b[1].at || (a[0] < b[0] ? -1 : 1))[0]
  if (!c) return boxes
  const { [c[0]]: _gone, ...rest } = boxes
  const { box: _style, ...plant } = c[1]
  return { ...rest, [pieceId]: plant }
}

// ── save: garden-tied, registered in GARDEN_KEY_SPECS ─────────────────────────────────────────────────────────────
export const BOX_KEY = 'ather.planterBox.v1'
export function parseBoxes(v: unknown): Boxes {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return {}
  const out: Record<string, BoxPlant> = {}
  for (const [k, b] of Object.entries(v as Record<string, Partial<BoxPlant>>)) if (b && typeof b.sapling === 'string' && isPottable(b.sapling) && typeof b.at === 'number') out[k] = {
    sapling: b.sapling, at: b.at, ...(typeof b.picked === 'number' ? { picked: b.picked } : {}),
    ...(typeof b.exp === 'number' && Number.isFinite(b.exp) && b.exp > 0 ? { exp: Math.floor(b.exp) } : {}),   // M242
    ...(isCarried(k) && typeof b.box === 'string' && isPlanterBox(b.box) ? { box: b.box } : {}) }
  return out
}
export function loadBoxes(): Boxes {
  try { return parseBoxes(JSON.parse(localStorage.getItem(gardenKey(BOX_KEY)) ?? 'null')) } catch { return {} }
}
export function saveBoxes(b: Boxes): void {
  try { localStorage.setItem(gardenKey(BOX_KEY), JSON.stringify(b)) } catch { /* private window */ }
}
