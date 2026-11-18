// THE FARM ROOM'S STATE AND ITS MOVES (Alex 11-18). The model is farming.ts (pure: beds, grades, composter); this file is
// the glue between that model, the room's own store (rooms.ts) and the bag: planting from either, harvest landing in the
// store with overflow into the composter, feeding the composter from the bag, the one-time starter packet, the save.
//
// ★ ONE FARM PER GARDEN: the Farm is one room (canPlace refuses a second), so the save is one Farm, 6 beds + the composter
//   charge, plus a flag that the starter seeds were handed out (once per garden, never again).
// ★ NO WATERING here: the water tap does not exist in the open world yet (mana-tech.md: no natural water in the fold), so
//   water() stays unused and beds grow at base time, the composter speeds them.
// ★ NOTHING IS EVER LOST: a harvest that fits neither the store nor the composter is REFUSED (the bed stays ready), never
//   dropped. Feeding the composter takes only what it eats; the rest stays in the bag.
//
// PURE but for the guarded load/save. Time and randomness are injected.
import { gardenKey } from '@/lib/keeper-local'
import { newFarm, plant, harvest, compost, isArmed, growMs, parseGraded, seedId, CROPS, GRADES, DOSE_COST, CHARGE_CAP, COMPOST_PER_ITEM, type Farm, type Bed, type CropId, type Item } from './farming'
import { putIn } from './garden-bank'
import { roomStore, ROOM_STORE_SLOTS, type Works } from './rooms'
import { take, type Inv } from '../shared/inventory'

export const BEDS = 6
export interface FarmSave { v: 1; farm: Farm; starter: boolean }
export const freshFarmSave = (): FarmSave => ({ v: 1, farm: newFarm(BEDS), starter: false })
/** The one packet every garden's first Farm comes with: tier-1, grade D. Higher tiers have no source yet (harvest returns the
 *  seeds you plant again; that is the only loop), so nothing above tier 1 is ever granted. */
export const STARTER: readonly Item[] = [{ id: seedId('goldleaf'), n: 3 }, { id: seedId('ather_wheat'), n: 3 }, { id: seedId('dewdrop_vine'), n: 2 }]

/** Doses banked in the composter (each armed harvest spends one). */
export const dosesOf = (farm: Farm) => Math.floor(farm.charge / DOSE_COST)
export { DOSE_COST, CHARGE_CAP, isArmed }

const storeOf = (w: Works, roomId: string) => { const r = w.rooms.find(x => x.id === roomId); return r ? roomStore(r) : null }
const withStore = (w: Works, roomId: string, stacks: { id: string; n: number }[]): Works => ({ ...w, rooms: w.rooms.map(r => (r.id === roomId ? { ...r, store: stacks } : r)) })

/** Seeds you can plant right now: the room's store and the bag together, per id. */
export function seedsReach(w: Works, roomId: string, inv: Inv): { id: string; n: number }[] {
  const out = new Map<string, number>()
  for (const s of storeOf(w, roomId)?.stacks ?? []) if (parseGraded(s.id)?.kind === 'seed') out.set(s.id, (out.get(s.id) ?? 0) + s.n)
  for (const s of inv.slots) if (s && parseGraded(s.id)?.kind === 'seed') out.set(s.id, (out.get(s.id) ?? 0) + s.n)
  return [...out].map(([id, n]) => ({ id, n })).sort((a, b) => a.id.localeCompare(b.id))
}

export type Moved = { ok: true; sv: FarmSave; works: Works; inv: Inv; say?: string } | { ok: false; why: string }

/** Plant a seed on an empty bed: from the room's store first, else the bag. */
export function plantAt(sv: FarmSave, w: Works, inv: Inv, roomId: string, bed: number, seed: string, now: number): Moved {
  const p = plant(sv.farm, bed, seed, now)
  if (!p.ok) return { ok: false, why: p.why === 'bed taken' ? 'That bed is already planted.' : 'You cannot plant that.' }
  const store = storeOf(w, roomId)
  if (!store) return { ok: false, why: 'No farm here.' }
  const k = store.stacks.findIndex(s => s.id === seed)
  if (k >= 0) {
    const stacks = store.stacks.flatMap((s, i) => (i !== k ? [s] : s.n > 1 ? [{ ...s, n: s.n - 1 }] : []))
    return { ok: true, sv: { ...sv, farm: p.farm }, works: withStore(w, roomId, stacks), inv }
  }
  const bag = take(inv, seed, 1)
  if (!bag) return { ok: false, why: 'You have no such seed.' }
  return { ok: true, sv: { ...sv, farm: p.farm }, works: w, inv: bag }
}

/** Harvest a ready bed. Crops and the seeds that come back go into the room's store; what does not fit goes to the composter;
 *  if the composter is full too, the harvest is refused (the bed stays ready). */
export function harvestAt(sv: FarmSave, w: Works, roomId: string, bed: number, now: number, rand: () => number): { ok: true; sv: FarmSave; works: Works; say: string } | { ok: false; why: string } {
  const h = harvest(sv.farm, bed, now, rand)
  if (!h.ok) return { ok: false, why: h.why === 'not ready' ? 'Not ready yet.' : 'Nothing to harvest.' }
  let store = storeOf(w, roomId); if (!store) return { ok: false, why: 'No farm here.' }
  const overflow: Item[] = []
  for (const it of [...h.crops, ...h.seeds]) { const p = putIn(store, ROOM_STORE_SLOTS, it.id, it.n); store = p.bank; if (p.left > 0) overflow.push({ id: it.id, n: p.left }) }
  const c = compost(h.farm, overflow)
  if (c.refused.length) return { ok: false, why: 'The store and the composter are both full. Take something out of the store first.' }
  const fed = overflow.reduce((a, o) => a + o.n, 0)
  const crop = h.crops[0]
  const say = `${crop.n} ${crop.id.split(':')[1].replace(/_/g, ' ')} harvested${h.spentDose ? ' · the composter spent a dose' : ''}${fed ? ` · ${fed} went into the composter` : ''}`
  return { ok: true, sv: { ...sv, farm: c.farm }, works: withStore(w, roomId, store.stacks), say }
}

/** Put n of the bag slot's item into the composter (any item). It eats up to its cap; the rest stays in the bag. */
export function feedAt(sv: FarmSave, inv: Inv, at: number, n: number): { sv: FarmSave; inv: Inv; fed: number } {
  const s = inv.slots[at]
  if (!s) return { sv, inv, fed: 0 }
  const want = Math.max(0, Math.min(Math.floor(n), s.n))
  const c = compost(sv.farm, [{ id: s.id, n: want }])
  const fed = want - c.refused.reduce((a, r) => a + r.n, 0)
  if (!fed) return { sv, inv, fed: 0 }
  const slots = inv.slots.map((x, i) => (i !== at ? x : s.n - fed > 0 ? { id: s.id, n: s.n - fed } : null))
  return { sv: { ...sv, farm: c.farm }, inv: { ...inv, slots }, fed }
}
/** The most the composter would still eat. */
export const roomLeft = (farm: Farm) => Math.max(0, Math.floor((CHARGE_CAP - farm.charge) / COMPOST_PER_ITEM))

/** The first Farm of a garden comes with the starter packet, in its store. Once: the flag lives in the save. */
export function grantStarter(sv: FarmSave, w: Works, roomId: string): { sv: FarmSave; works: Works; given: boolean } {
  if (sv.starter) return { sv, works: w, given: false }
  let store = storeOf(w, roomId); if (!store) return { sv, works: w, given: false }
  for (const it of STARTER) store = putIn(store, ROOM_STORE_SLOTS, it.id, it.n).bank
  return { sv: { ...sv, starter: true }, works: withStore(w, roomId, store.stacks), given: true }
}

/** What the bed is doing, for the panel and the 3D: ms left to ready, 0 when ready. */
export const msLeft = (bed: Bed, farm: Farm, now: number): number => {
  return Math.max(0, bed.plantedAt + growMs(bed, isArmed(farm)) - now)
}

// ── save: garden-tied (the garden is shared across a roster), registered in GARDEN_KEY_SPECS ─────────────────
export const FARM_KEY = 'open.farm.v1'
const okBed = (b: unknown): b is Bed => !!b && typeof b === 'object' && (b as Bed).crop in CROPS && GRADES.includes((b as Bed).grade) && Number.isFinite((b as Bed).plantedAt)
export function adoptFarm(raw: unknown): FarmSave {
  const v = raw as Partial<FarmSave> | null, f = v?.farm
  if (v?.v !== 1 || !f || !Array.isArray(f.beds)) return freshFarmSave()
  const beds = Array.from({ length: BEDS }, (_, i) => (okBed(f.beds![i]) ? { crop: f.beds![i]!.crop as CropId, grade: f.beds![i]!.grade, plantedAt: f.beds![i]!.plantedAt, watered: !!f.beds![i]!.watered } : null))
  const charge = Number.isFinite(f.charge) ? Math.max(0, Math.min(CHARGE_CAP, Math.floor(f.charge as number))) : 0
  return { v: 1, farm: { beds, charge }, starter: v.starter === true }
}
export function loadFarmSave(): FarmSave {
  try { return adoptFarm(JSON.parse(localStorage.getItem(gardenKey(FARM_KEY)) ?? 'null')) } catch { return freshFarmSave() }
}
export function saveFarmSave(sv: FarmSave) { try { localStorage.setItem(gardenKey(FARM_KEY), JSON.stringify(sv)) } catch { /* private window */ } }
