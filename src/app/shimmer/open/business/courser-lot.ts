// WHOLE COURSERS at the COURSER LOTS (BETA M14, Alex 11-18 via ask #4: "4 imitation makes, each 1-2 models", one lot per make,
// each on the map; each model a distinct drive feel on the Darter's system, bought for Marks, owned, picked in the G garage).
// Make + model names RULED 11-18 (Magii + Alex, athernyx 3846c94); lots keep a plain trade name, "courser lot".
// Pure. The look is a code-built blockout (darter-view.tsx DarterModel `look`); Alex models the real ones later.
import { DARTER_STOCK, type CourserSpec } from '../courser'
import type { Ledger } from '../trade'

export type MakeId = 'ashcombe' | 'grimbold' | 'spindle' | 'vantorre'
/** a KIND is the body (darter / hauler / scrambler / skitter, canon); a model is a make's courser of a kind */
export type CourserKind = 'darter' | 'hauler' | 'scrambler' | 'skitter'
export interface Make { id: MakeId; name: string; feel: string; town: string }
/** RULED 11-18 (athernyx 3846c94, world/transportation.md › The makes). One courser lot per make, in four towns spread over the
 *  map; the everyday maker where a keeper arrives (Rune Hold), the exotic one in the Citadel. Placement is Jin's. */
export const MAKES: Record<MakeId, Make> = {
  ashcombe: { id: 'ashcombe', name: 'Ashcombe', feel: 'the dependable everyday maker', town: 'rune-hold' },
  grimbold: { id: 'grimbold', name: 'Grimbold', feel: 'the rugged off-roader', town: 'ashfeld' },
  spindle: { id: 'spindle', name: 'Spindle', feel: 'the nimble bike maker', town: 'veradyn' },
  vantorre: { id: 'vantorre', name: 'Vantorre', feel: 'exotic, loud, fast', town: 'citadel' },
}
export const makeOfTown = (town: string): Make | undefined => Object.values(MAKES).find(m => m.town === town)

/** a blockout's kind, proportions + paint (DarterModel draws the kind's silhouette, scaled, in these colours) */
export interface CourserLook { kind: CourserKind; body: string; cabin: string; len: number; wide: number; tall: number }
export interface CourserModel { id: string; make: MakeId; name: string; kind: CourserKind; feel: string; price: number; crates: number; spec: CourserSpec; look: CourserLook }

export const DARTER_ID = 'darter'
export const DARTER_LOOK: CourserLook = { kind: 'darter', body: '#2c5a86', cabin: '#1b2c44', len: 1, wide: 1, tall: 1 }
/** the starting Darter: every keeper's from the start, the default; its numbers are the yardstick the others read against */
export const DARTER_MODEL: CourserModel = { id: DARTER_ID, make: 'ashcombe', name: 'Darter', kind: 'darter', feel: 'the courser you started with', price: 0, crates: 6, spec: DARTER_STOCK, look: DARTER_LOOK }

// Feel per model, against the starting Darter (0-60 5.5 s, 112 mph, brake 100 ft, traction 7, grip 1, handling 1, 6 crates).
// Prices sit against the part ladder (4k / 20k / 90k): a whole courser is a bigger buy than a part tier; no deed gate.
export const MODELS: readonly CourserModel[] = [
  { id: 'dray', make: 'ashcombe', name: 'Ashcombe Dray', kind: 'hauler', feel: 'slow and steady, carries the most', price: 12_000, crates: 10,
    spec: { zeroTo60: 7.4, topMph: 92, brake60ft: 118, traction: 6, grip: 1.05, handling: 0.8 }, look: { kind: 'hauler', body: '#7a5a34', cabin: '#3b2c1c', len: 1.12, wide: 1.06, tall: 1.25 } },
  { id: 'tally', make: 'ashcombe', name: 'Ashcombe Tally', kind: 'darter', feel: 'a better Darter all round', price: 18_000, crates: 8,
    spec: { zeroTo60: 5.1, topMph: 118, brake60ft: 95, traction: 7.5, grip: 1.05, handling: 1.05 }, look: { kind: 'darter', body: '#3f7a52', cabin: '#1d3326', len: 1.02, wide: 1, tall: 1 } },
  { id: 'scree', make: 'grimbold', name: 'Grimbold Scree', kind: 'scrambler', feel: 'short and tough, grips anything', price: 30_000, crates: 6,
    spec: { zeroTo60: 5.6, topMph: 104, brake60ft: 90, traction: 8.5, grip: 1.3, handling: 1.15 }, look: { kind: 'scrambler', body: '#6b6f3a', cabin: '#2b2d18', len: 0.9, wide: 1.04, tall: 1.15 } },
  { id: 'outrider', make: 'grimbold', name: 'Grimbold Outrider', kind: 'scrambler', feel: 'long-range, steady over rough ground', price: 42_000, crates: 8,
    spec: { zeroTo60: 5.9, topMph: 116, brake60ft: 96, traction: 8, grip: 1.2, handling: 1 }, look: { kind: 'scrambler', body: '#8a6a3c', cabin: '#2b2416', len: 1.1, wide: 1.06, tall: 1.18 } },
  { id: 'flick', make: 'spindle', name: 'Spindle Flick', kind: 'skitter', feel: 'cheap and quick, room for little', price: 9_000, crates: 2,
    spec: { zeroTo60: 4.8, topMph: 108, brake60ft: 88, traction: 7, grip: 1, handling: 1.35 }, look: { kind: 'skitter', body: '#d9a43a', cabin: '#2a2010', len: 1, wide: 1, tall: 1 } },
  { id: 'gyre', make: 'spindle', name: 'Spindle Gyre', kind: 'skitter', feel: 'the sport bike, fast and light', price: 38_000, crates: 2,
    spec: { zeroTo60: 3.9, topMph: 138, brake60ft: 84, traction: 8, grip: 1.05, handling: 1.4 }, look: { kind: 'skitter', body: '#3a7fd9', cabin: '#10202f', len: 1.08, wide: 1, tall: 0.95 } },
  { id: 'sabre', make: 'vantorre', name: 'Vantorre Sabre', kind: 'darter', feel: 'the halo coupe: loud, the fastest thing on a road', price: 180_000, crates: 4,
    spec: { zeroTo60: 3.4, topMph: 152, brake60ft: 82, traction: 8.5, grip: 1.2, handling: 1.2 }, look: { kind: 'darter', body: '#a3333a', cabin: '#2a1214', len: 1.1, wide: 1.06, tall: 0.82 } },
]
export const modelById = (id: string | null | undefined): CourserModel => MODELS.find(m => m.id === id) ?? DARTER_MODEL
export const modelsOfMake = (make: MakeId) => MODELS.filter(m => m.make === make)

/** the keeper's coursers: owned model ids (the Darter always) + the one they drive */
export interface Fleet { v: 1; owned: string[]; active: string }
export const newFleet = (): Fleet => ({ v: 1, owned: [DARTER_ID], active: DARTER_ID })

export interface CourserBuy { ok: boolean; why?: string; fleet: Fleet; ledger: Ledger }
export function buyCourser(fleet: Fleet, ledger: Ledger, id: string): CourserBuy {
  const m = MODELS.find(x => x.id === id)
  if (!m) return { ok: false, why: 'Not sold here.', fleet, ledger }
  if (fleet.owned.includes(id)) return { ok: false, why: 'Already yours.', fleet, ledger }
  if (ledger.marks < m.price) return { ok: false, why: `It costs ${m.price.toLocaleString()} Marks. You have ${Math.floor(ledger.marks).toLocaleString()}.`, fleet, ledger }
  return { ok: true, fleet: { ...fleet, owned: [...fleet.owned, id] }, ledger: { ...ledger, marks: ledger.marks - m.price } }
}
/** drive another owned courser (the G garage). Unowned or unknown: refused, nothing changes. */
export function pickCourser(fleet: Fleet, id: string): Fleet | null {
  return fleet.owned.includes(id) && (id === DARTER_ID || MODELS.some(m => m.id === id)) ? { ...fleet, active: id } : null
}
