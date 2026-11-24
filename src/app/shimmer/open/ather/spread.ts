// THE SPREAD'S LEDGER: which infected nodes the keeper has cleared. The world starts fully infested (Alex 11-14); a champion
// down makes its node clean; a section the grey takes again leaves `clean`. WHICH sections turn, and when, is spread-map.ts's
// rule (M121, Alex 11-24: chance per section per game day, capped). It replaced the two uncapped 11-14 rolls that lived here
// (neighbour creep every 3 days, well-up every 5), which Alex had put in to feel before any brakes.
//
// ★ PURE. The page keeps the state in localStorage via load/save below.

import { type WildsNode } from './nodes'
import { gardenKey } from '@/lib/keeper-local'

export interface SpreadState { v: 2; epoch: number; at: number; clean: string[] }

export const freshSpread = (now: number): SpreadState => ({ v: 2, epoch: now, at: now, clean: [] })

/** The keeper killed a node's champion at time t: that node is clean. */
export const clearAt = (s: SpreadState, id: string, t: number): SpreadState => ({ ...s, at: Math.max(s.at, t), clean: [...new Set([...s.clean, id])].sort() })

export const infectedIds = (s: SpreadState, nodes: WildsNode[]) => nodes.filter(n => !s.clean.includes(n.id)).map(n => n.id)

const KEY = 'ather.nodes.v2', SKEW = 'ather.nodes.skew'
/** this keeper's garden has a spread ledger saved (M121: no ledger and no map = a fresh save) */
export function hasSpread(): boolean { try { return localStorage.getItem(gardenKey(KEY)) !== null } catch { return false } }
export function loadSpread(now: number): SpreadState {
  try { const v = JSON.parse(localStorage.getItem(gardenKey(KEY)) ?? 'null'); if (v?.v === 2 && Array.isArray(v.clean)) return v } catch { /* private window */ }
  return freshSpread(now)
}
export function saveSpread(s: SpreadState) { try { localStorage.setItem(gardenKey(KEY), JSON.stringify(s)) } catch { /* private window */ } }
/** Tuning only (`?tune=1`): extra ms added to the clock, so ] can skip game days. 0 in normal play. */
export function loadSkew(): number { try { return Number(localStorage.getItem(gardenKey(SKEW))) || 0 } catch { return 0 } }
export function saveSkew(ms: number) { try { localStorage.setItem(gardenKey(SKEW), String(ms)) } catch { /* private window */ } }
