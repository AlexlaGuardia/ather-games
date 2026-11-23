'use client'
// KAEL'S SHIP REPAIR, the store (BETA M108 stage 1). Rules: ship-repair.ts (pure, tested). Saved per keeper (REPAIR_KEY in
// KEEPER_KEY_SPECS), so it rides keeper swaps and the cloud like the chain.
//   ★ getRepairCharged()  (M108 s3; was getRepairStage1) the destination-map gate reads THIS when the shell goes public (destination-map.ts › shipGateOpen)
// Checks READ window.__repair; they never write through it.
import { useSyncExternalStore } from 'react'
import { keeperKey } from '@/lib/keeper-local'
import { REPAIR_KEY, newRepair, parseRepair, type Repair } from './ship-repair'

let cur: Repair | null = null
const subs = new Set<() => void>()
const SERVER = newRepair()
function get(): Repair {
  if (typeof window === 'undefined') return SERVER
  if (!cur) { try { cur = parseRepair(JSON.parse(localStorage.getItem(keeperKey(REPAIR_KEY)) ?? 'null')) } catch { cur = newRepair() } installProbe() }
  return cur
}
export function putRepair(r: Repair) {
  if (r === cur) return
  cur = r; try { localStorage.setItem(keeperKey(REPAIR_KEY), JSON.stringify(r)) } catch { /* private window */ }
  subs.forEach(f => f())
}
export const getRepair = get
/** ★ STAGE 1 DONE: the cell housing is paid for and fitted */
export const getRepairStage1 = () => get().stage1
/** ★ M108 s3: the cells' FIRST CHARGE done: what the destination-map gate reads now */
export const getRepairCharged = () => get().charged
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const useRepair = () => useSyncExternalStore(subscribe, get, () => SERVER)
function installProbe() { (window as unknown as { __repair?: unknown }).__repair = { state: () => ({ ...get() }), stage1: () => get().stage1, charged: () => get().charged } }
