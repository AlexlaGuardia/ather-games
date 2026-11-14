// THE TWO-WORLD TRADE, v1 (ECONOMY.md). Pure: the page, the board and the tests compute the same economy.
//
// Canon this stands on: the Ather Trading Co. (Benji's) posts the work; Marks are the one coin; goods cross at
// the gate-landings (Rune Hold's square is one) and coursers never do; the Co. never trades spirits.
// RULED 2026-11-14 (Magii + Alex; CANON_GAPS › the two-world trade, game/economy.md): BENJI himself runs the Co.
// in 1672 (ageless, Ather-exposure), met at Lingston, Wend at the counter · METAL CROSSES as honest import (coin,
// and the prospecting tools that cut crystal; coursers and the gun still stay at the gate) · the mortal goods'
// CATEGORIES are canon (Spine ore + stone, Frontier timber, southern grain, coastal sea Rinn + salt, ruin salvage,
// station mana cells) · two signature goods authored, ALEX TO SIGN OR SWAP: Havensteel, Veradyn blackwood ·
// GOLD is prospectable (the Mint strikes coin; it does not own the ore).
//
// v1 loop: take a contract at a town's board → drive to the pickup → it loads when you stop there → drive to the
// drop → it pays Marks + a DEED when you stop there. Deeds unlock the garage's higher tiers (the canon "earn"
// lane); Marks buy them (the "buy" lane). Sea Rinn spoils: deliver it fast or it pays less.

import type { Slot, Tier } from './courser-build'

export type GoodId = 'crystal' | 'sap' | 'cord' | 'ore' | 'timber' | 'grain' | 'searinn' | 'gold' | 'havensteel' | 'blackwood'
export interface Good {
  id: GoodId; name: string; side: 'ather' | 'mortal'
  crate: number            // cargo space per unit (timber is bulky)
  rate: number             // Marks per unit per km delivered
  spoils?: number          // seconds until it is worth half (perishables only)
}
export const GOODS: Record<GoodId, Good> = {
  // the Ather's own matter (canon names, world/ather.md + game/shimmer-skilling.md), arriving through the landing
  crystal: { id: 'crystal', name: 'Manalic crystal', side: 'ather', crate: 1, rate: 22 },
  sap: { id: 'sap', name: 'Sap', side: 'ather', crate: 1, rate: 12 },
  cord: { id: 'cord', name: 'Cord', side: 'ather', crate: 1, rate: 10 },
  // the waking continent's goods: canon categories (game/economy.md)
  ore: { id: 'ore', name: 'Ore', side: 'mortal', crate: 2, rate: 16 },
  timber: { id: 'timber', name: 'Timber', side: 'mortal', crate: 3, rate: 18 },
  grain: { id: 'grain', name: 'Grain', side: 'mortal', crate: 1, rate: 8 },
  searinn: { id: 'searinn', name: 'Sea Rinn', side: 'mortal', crate: 1, rate: 15, spoils: 150 },
  gold: { id: 'gold', name: 'Raw gold', side: 'mortal', crate: 1, rate: 40 },
  // the two signature goods (authored by Magii 11-14, ALEX TO SIGN OR SWAP the names): not sourced in the corridor
  havensteel: { id: 'havensteel', name: 'Havensteel', side: 'mortal', crate: 1, rate: 34 },
  blackwood: { id: 'blackwood', name: 'Veradyn blackwood', side: 'mortal', crate: 3, rate: 30 },
}

export interface Contract {
  id: string; good: GoodId; qty: number
  from: string; to: string            // place ids
  km: number                          // road distance, for the pay
  pay: number                         // Marks at delivery (before any spoilage)
  deeds: number
}
export interface Ledger {
  marks: number; deeds: number
  active: (Contract & { loaded: boolean; loadedAt: number }) | null
  owned: Record<Slot, Tier>           // highest tier owned per slot (owning III means II and I too)
}
export const NEW_LEDGER: Ledger = { marks: 60, deeds: 0, active: null, owned: { core: 0, trim: 0, rune: 0 } }

/** What a courser can carry, in crates. The Hauler (later) carries far more: that is its reason to exist. */
export const CAPACITY = { darter: 6 } as const

// ── the garage's prices and the deeds each tier asks ──
export const TIER_PRICE: Record<Exclude<Tier, 0>, number> = { 1: 150, 2: 420, 3: 950 }
export const TIER_DEEDS: Record<Exclude<Tier, 0>, number> = { 1: 0, 2: 3, 3: 8 }

/** Where each good is to be had in a region (v1 placement, build; follows the town, not canon). */
export interface Supply { place: string; goods: GoodId[] }

/** A small seeded RNG so a board is the same for the same seed. */
function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216 }
}

/** The Co.'s board at a town: up to 3 contracts that START here, to other towns. `km(a, b)` is road distance. */
export function postBoard(at: string, supply: Supply[], towns: string[], km: (a: string, b: string) => number, seed: number, capacity: number): Contract[] {
  const here = supply.find(s => s.place === at)
  if (!here) return []
  const r = rng(seed * 7919 + at.length * 131 + at.charCodeAt(0))
  const out: Contract[] = []
  const dests = towns.filter(t => t !== at && Number.isFinite(km(at, t)) && km(at, t) > 0.2)
  for (let n = 0; n < 3 && dests.length; n++) {
    const good = GOODS[here.goods[Math.floor(r() * here.goods.length)]]
    const to = dests[Math.floor(r() * dests.length)]
    const d = km(at, to)
    const qty = Math.max(1, Math.floor(capacity / good.crate * (0.5 + r() * 0.5)))
    out.push({ id: `${at}>${to}:${good.id}:${seed}:${n}`, good: good.id, qty, from: at, to, km: +d.toFixed(2),
      pay: Math.round(good.rate * qty * Math.max(0.5, d) + 10), deeds: 1 })
  }
  return out
}

export function crates(c: Pick<Contract, 'good' | 'qty'>) { return GOODS[c.good].crate * c.qty }

/** Take a contract: one at a time, and only if it fits. */
export function accept(l: Ledger, c: Contract, capacity: number): { ok: boolean; why?: string; ledger: Ledger } {
  if (l.active) return { ok: false, why: 'Finish the contract you hold first.', ledger: l }
  if (crates(c) > capacity) return { ok: false, why: `Needs ${crates(c)} crates; this courser carries ${capacity}.`, ledger: l }
  return { ok: true, ledger: { ...l, active: { ...c, loaded: false, loadedAt: 0 } } }
}

/** Arriving at a place (stopped there): load at the pickup, deliver at the drop. `now` in seconds. */
export function arrive(l: Ledger, place: string, now: number): { ledger: Ledger; event: null | { kind: 'loaded' } | { kind: 'paid'; marks: number; deeds: number; spoiled: number } } {
  const a = l.active
  if (!a) return { ledger: l, event: null }
  if (!a.loaded && place === a.from) return { ledger: { ...l, active: { ...a, loaded: true, loadedAt: now } }, event: { kind: 'loaded' } }
  if (a.loaded && place === a.to) {
    const g = GOODS[a.good]
    // perishables: worth half after `spoils` seconds on the road, never below a quarter
    const spoiled = g.spoils ? Math.max(0.25, Math.pow(0.5, (now - a.loadedAt) / g.spoils)) : 1
    const marks = Math.round(a.pay * spoiled)
    return { ledger: { ...l, marks: l.marks + marks, deeds: l.deeds + a.deeds, active: null }, event: { kind: 'paid', marks, deeds: a.deeds, spoiled: 1 - spoiled } }
  }
  return { ledger: l, event: null }
}

export function abandon(l: Ledger): Ledger { return { ...l, active: null } }

/** Can this tier be bought now? Owned already, or enough deeds and Marks. */
export function canBuy(l: Ledger, slot: Slot, t: Tier): { ok: boolean; why?: string } {
  if (t === 0 || l.owned[slot] >= t) return { ok: true }
  if (t > l.owned[slot] + 1) return { ok: false, why: 'Buy the tier below first.' }
  const tt = t as Exclude<Tier, 0>
  if (l.deeds < TIER_DEEDS[tt]) return { ok: false, why: `Needs ${TIER_DEEDS[tt]} deeds for the Co. (you have ${l.deeds}).` }
  if (l.marks < TIER_PRICE[tt]) return { ok: false, why: `Costs ${TIER_PRICE[tt]} Marks (you have ${l.marks}).` }
  return { ok: true }
}

export function buy(l: Ledger, slot: Slot, t: Tier): { ok: boolean; why?: string; ledger: Ledger } {
  if (t === 0 || l.owned[slot] >= t) return { ok: true, ledger: l }
  const c = canBuy(l, slot, t)
  if (!c.ok) return { ok: false, why: c.why, ledger: l }
  return { ok: true, ledger: { ...l, marks: l.marks - TIER_PRICE[t as Exclude<Tier, 0>], owned: { ...l.owned, [slot]: t } } }
}
