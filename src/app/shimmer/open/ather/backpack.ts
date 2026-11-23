// THE BACKPACK (BETA M20, Alex 11-18 playtest): a keeper the Hollows drag under drops what they CARRIED where they fell.
// Walk back and touch it inside PACK_LIFE_MS and everything comes back; later, it is gone. The clock is hidden on purpose
// (no timer, no pin): the keeper only knows "go back soon".
//
// BUILD (Jin): "carried" = the bag + hotbar (inventory.ts). Weapons, tools, vessels and Marks are not bag items (guns and
// tools left the bag 11-15/11-18: they are equipment, loadout.ts / engine/tools.ts), so they stay on the keeper by
// construction; a gun|tool stack an old bag still holds stays too. One pack at a time: falling again before you reclaim
// leaves a new pack and the old one is gone. Wall clock (Date.now) so a reload keeps both the pack and its age.
// Pure; the store + look live in death-pack.tsx. Saved per keeper (open.pack.v1, KEEPER_KEY_SPECS).

import { give, itemDef, SLOTS, type Inv, type Stack } from '../shared/inventory'
import { KAEL_INVITE, KAEL_PAGE } from '../shared/opening-chain'
import { CELL_HOUSING } from '../shared/ship-repair'

export const PACK_LIFE_MS = 5 * 60 * 1000
/** feet within this of the pack = touched (a keeper walking over it, not a precise click) */
export const PACK_REACH = 1.8
export const PACK_KEY = 'open.pack.v1'

export interface Pack { v: 1; x: number; y: number; z: number; at: number; items: Stack[] }

// Kael's invite stays on the keeper too (BETA M73): it starts the opening chain, and Morel's ping speaks of it as in the pack
const kept = (s: Stack) => { const k = itemDef(s.id).kind; return k === 'gun' || k === 'tool' || s.id === KAEL_INVITE || s.id === KAEL_PAGE || s.id === CELL_HOUSING }

/** The fall: what stays on the keeper (inv) and the pack left at (x, y, z). Null pack when there was nothing to carry. */
export function dropPack(inv: Inv, x: number, y: number, z: number, now: number): { inv: Inv; pack: Pack | null } {
  const items: Stack[] = []
  const slots = inv.slots.map(s => { if (!s || kept(s)) return s ? { ...s } : null; items.push({ ...s }); return null })
  const out: Inv = { ...inv, v: 1, slots }
  return { inv: out, pack: items.length ? { v: 1, x, y, z, at: now, items } : null }
}

export const expired = (p: Pack, now: number) => now - p.at > PACK_LIFE_MS
export const near = (p: Pack, x: number, z: number) => Math.hypot(x - p.x, z - p.z) <= PACK_REACH

/** The touch: every stack back into the bag (topping up, then empty slots). What does not fit stays in the pack
 *  (pack null = emptied). An expired pack gives nothing and is gone. */
export function reclaim(inv: Inv, p: Pack, now: number): { inv: Inv; pack: Pack | null; got: number } {
  if (expired(p, now)) return { inv, pack: null, got: 0 }
  let out = inv, got = 0
  const left: Stack[] = []
  for (const s of p.items) {
    const r = give(out, s.id, s.n); out = r.inv; got += s.n - r.left
    if (r.left > 0) left.push({ id: s.id, n: r.left })
  }
  return { inv: out, pack: left.length ? { ...p, items: left } : null, got }
}

/** A saved pack, or null for anything that is not one (or has run out). */
export function parsePack(raw: unknown, now: number): Pack | null {
  const p = raw as Pack | null
  if (!p || p.v !== 1 || ![p.x, p.y, p.z, p.at].every(Number.isFinite) || !Array.isArray(p.items)) return null
  const items = p.items.filter(s => s && typeof s.id === 'string' && Number.isFinite(s.n) && s.n > 0).slice(0, SLOTS)
  if (!items.length || expired(p, now)) return null
  return { ...p, items }
}
