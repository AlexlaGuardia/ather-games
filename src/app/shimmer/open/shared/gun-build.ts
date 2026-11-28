// M150 s4 (Alex 11-27: "start working on the new gun models and adding them to the gun bench so i can tune them later"): the BUILD
// DIALS of a new-family model (gun-kit-v2.ts). The tuner (/shimmer/dev/guns, New model) moves these and saves them to this browser;
// "Copy values" hands them to Jin to bake into the gun's data. PURE (no three). Off in the game: only the tuner's preview reads it.
// M150 s5 (Alex 11-27: "all guns in the bench have sliders to not only tune the fire rate but the dimensions of the gun too"): the
// DIMENSION dials (length, barrel, stock, height, width) and two more bench guns: the DB2 Twins (M152, the pair) and the M9 Grinder.
//
// The dials, all offsets from the model as built (0 = as modelled; scale and the dimension dials 1):
//   scale        the model's own size (the rig's "gun size" S stays the HOLD's: this one is the gun's)
//   grip y/z     the right glove's anchor on the grip (the hand tune's offsets ride on it)
//   fore z       the left glove's anchor under the shroud
//   muzzle y/z   where the round leaves (a marker on the bench; the game does not read it yet)
//   rail y, seat z   the flat top's height and where along it the sight sits
//   socket y/z   THE SIGIL CORE's spot (canon: one core per gun; the Prototype takes none, so it has no socket dials)
//   length       the whole gun along its bore (x)
//   barrel       everything ahead of the receiver's front (shroud, barrel, muzzle) stretched (x)
//   stock        everything behind the receiver's back stretched (x); a gun with no stock has no stock dial
//   height / width   the body's cross-section (x); the sight keeps its own size and rides the rail
import type { Model, Part } from './gun-kit'
import { V2_GUNS, V2_SIGHTS, GRINDER_KIT, v2Model, isCorePart, type V2Gun, type V2GunId, type V2SightId } from './gun-kit-v2'
import { TWINS, TW_BARRELS, TW_CORE } from './gun-kit-twins'

export interface GunBuild { scale: number; gripY: number; gripZ: number; foreZ: number; muzzleY: number; muzzleZ: number; railY: number; seatZ: number; socketY: number; socketZ: number
  length: number; barrel: number; stock: number; height: number; width: number }
export type BuildKey = keyof GunBuild
export const BUILD_ZERO: GunBuild = { scale: 1, gripY: 0, gripZ: 0, foreZ: 0, muzzleY: 0, muzzleZ: 0, railY: 0, seatZ: 0, socketY: 0, socketZ: 0,
  length: 1, barrel: 1, stock: 1, height: 1, width: 1 }
export const BUILD_DIALS: { k: BuildKey; label: string; min: number; max: number; step: number; socket?: true; stock?: true; dim?: true }[] = [
  { k: 'length', label: 'overall length', min: 0.7, max: 1.4, step: 0.01, dim: true },
  { k: 'barrel', label: 'barrel length', min: 0.5, max: 1.8, step: 0.01, dim: true },
  { k: 'stock', label: 'stock length', min: 0.4, max: 1.6, step: 0.01, dim: true, stock: true },
  { k: 'height', label: 'body height', min: 0.7, max: 1.4, step: 0.01, dim: true },
  { k: 'width', label: 'body width', min: 0.7, max: 1.5, step: 0.01, dim: true },
  { k: 'scale', label: 'model scale', min: 0.6, max: 1.6, step: 0.01 },
  { k: 'gripY', label: 'grip y', min: -0.06, max: 0.06, step: 0.002 },
  { k: 'gripZ', label: 'grip z', min: -0.08, max: 0.08, step: 0.002 },
  { k: 'foreZ', label: 'fore z', min: -0.15, max: 0.15, step: 0.002 },
  { k: 'muzzleY', label: 'muzzle y', min: -0.05, max: 0.05, step: 0.001 },
  { k: 'muzzleZ', label: 'muzzle z', min: -0.1, max: 0.1, step: 0.002 },
  { k: 'railY', label: 'rail y', min: -0.03, max: 0.03, step: 0.001 },
  { k: 'seatZ', label: 'sight seat z', min: -0.15, max: 0.15, step: 0.002 },
  { k: 'socketY', label: 'socket y', min: -0.04, max: 0.04, step: 0.001, socket: true },
  { k: 'socketZ', label: 'socket z', min: -0.12, max: 0.12, step: 0.002, socket: true },
]

// ── the bench's guns: the family (V2_GUNS) + the bench-only M9 Grinder + the Twins (one model holding the PAIR) ──
export type BenchKitId = V2GunId | 'grinder' | 'twins'
export interface BenchKit extends Omit<V2Gun, 'id' | 'own'> {
  id: BenchKitId
  /** the sight it comes with; null = none (the Twins: no sights, M152) */
  own: V2SightId | null
  /** z where the barrel region starts (the receiver's front) and the stock region (its back; null = no stock) */
  barrelZ: number; stockZ: number | null
  /** the sigil core's parts (they move as one piece) and the socket as modelled, [y, z] (null = no core) */
  core: Set<Part>; socket: [number, number] | null
  /** a sightless gun's eye line */
  eye?: number
}
const coreSocket = (parts: Part[]): [number, number] | null => {
  const c = parts.filter(isCorePart)
  return c.length ? [Math.max(...c.map(p => p.o[1] + p.s[2] / 2)), c[0].o[2]] : null
}
const fam = (g: Omit<V2Gun, 'id'> & { id: V2GunId | 'grinder' }, barrelZ: number, stockZ: number | null): BenchKit =>
  ({ ...g, barrelZ, stockZ, core: new Set(g.parts.filter(isCorePart)), socket: coreSocket(g.parts) })
// the Twins: the RIGHT gun at the grip, the LEFT gun TWINS.gap to its left, as the pair is held (two guns in one model on the bench)
const twinsKit = (): BenchKit => {
  const shift = (p: Part): Part => ({ ...p, o: [p.o[0] - TWINS.gap, p.o[1], p.o[2]] })
  const leftParts = TWINS.left.parts.map(shift), leftCore = new Set(TWINS.left.core.map(p => leftParts[TWINS.left.parts.indexOf(p)]))
  return { id: 'twins', name: 'DB2 Twins', parts: [...TWINS.right.parts, ...leftParts], grip: TWINS.right.grip, fore: TWINS.right.fore, railTop: 0.032, seatZ: -0.1,
    own: null, sights: [], barrelZ: -0.072, stockZ: null, core: new Set([...TWINS.right.core, ...leftCore]), socket: [TW_CORE.top, TW_CORE.z], eye: TW_BARRELS.top + 0.003 }
}
export const BENCH_KITS: Record<BenchKitId, BenchKit> = {
  backbone: fam(V2_GUNS.backbone, -0.161, 0.15), 'charred-rifle': fam(V2_GUNS['charred-rifle'], -0.158, 0.15), lance: fam(V2_GUNS.lance, -0.141, 0.17),
  spitter: fam(V2_GUNS.spitter, -0.17, 0.095), repeater: fam(V2_GUNS.repeater, -0.095, null), roar: fam(V2_GUNS.roar, -0.14, 0.11),
  grinder: fam(GRINDER_KIT, -0.161, 0.15), twins: twinsKit(),
}
export const isBenchKit = (id: string): id is BenchKitId => id in BENCH_KITS
/** the guns that live ONLY on the bench (no player holds them) */
export const BENCH_ONLY: BenchKitId[] = ['grinder', 'twins']

/** does this gun take a sigil core at all (the Prototype does not) */
export const hasSocket = (id: BenchKitId) => BENCH_KITS[id].core.size > 0
/** does this gun have a stock to stretch (the Repeater and the Twins do not) */
export const hasStock = (id: BenchKitId) => BENCH_KITS[id].stockZ !== null
const clampDial = (k: BuildKey, v: unknown): number => {
  const d = BUILD_DIALS.find(x => x.k === k)!, n = typeof v === 'number' && Number.isFinite(v) ? v : BUILD_ZERO[k]
  return Math.max(d.min, Math.min(d.max, n))
}
/** a saved (or pasted) build, every dial present and in range */
export function cleanBuild(b: Partial<Record<BuildKey, unknown>> | null | undefined): GunBuild {
  const out = { ...BUILD_ZERO }
  for (const d of BUILD_DIALS) out[d.k] = clampDial(d.k, b?.[d.k])
  return out
}
const isZero = (b: GunBuild) => BUILD_DIALS.every(d => b[d.k] === BUILD_ZERO[d.k])

/** the muzzle as modelled: the bore's face (the most forward 'slot' disc along z), [y, z] */
export function muzzleOf(id: BenchKitId): [number, number] {
  const bores = BENCH_KITS[id].parts.filter(p => p.shape === 'cyl' && (p.axis ?? 'z') === 'z' && p.c === 'slot')
  const b = bores.reduce((a, p) => (p.o[2] < a.o[2] ? p : a), bores[0])
  return [b.o[1], b.o[2] - b.s[2] / 2]
}
/** the socket as modelled: the top of the core's collar, [y, z] (null for the Prototype) */
export const socketOf = (id: BenchKitId): [number, number] | null => BENCH_KITS[id].socket

// ── the dimension dials ──
export interface Dims { length: number; barrel: number; stock: number; height: number; width: number }
/** a point's z under the dimension dials: the barrel region and the stock region stretch about the receiver's ends, then the whole length */
export function dimZ(kit: Pick<BenchKit, 'barrelZ' | 'stockZ'>, d: Dims, z: number): number {
  const B = kit.barrelZ, S = kit.stockZ
  const r = z < B ? B + (z - B) * d.barrel : S !== null && z > S ? S + (z - S) * d.stock : z
  return r * d.length
}
/** one part under the dimension dials (its z extent mapped end to end, its cross-section by height / width) */
export function dimPart(kit: Pick<BenchKit, 'barrelZ' | 'stockZ'>, d: Dims, p: Part): Part {
  const Z = (z: number) => dimZ(kit, d, z), w = d.width, h = d.height
  const span = (c: number, len: number): [number, number] => { const a = Z(c - len / 2), b = Z(c + len / 2); return [(a + b) / 2, b - a] }
  if (p.shape === 'poly' && p.axis === 'z') {   // a bar: outline across (x, y), extruded along z, centred on o
    const [cz, len] = span(p.o[2], p.s[0])
    return { ...p, o: [p.o[0] * w, p.o[1] * h, cz], s: [len, p.s[1], p.s[2]], pts: p.pts!.map(([x, y]): [number, number] => [x * w, y * h]),
      ...(p.hole ? { hole: p.hole.map(([x, y]): [number, number] => [x * w, y * h]) } : {}) }
  }
  if (p.shape === 'poly') {   // a slab: outline along the gun (z, y), its depth across x
    const oz = p.o[2]   // a moved slab (a core half on its socket) carries its z in o: fold it into the outline before mapping
    return { ...p, o: [p.o[0] * w, p.o[1] * h, 0], s: [p.s[0] * w, p.s[1], p.s[2]], pts: p.pts!.map(([z, y]): [number, number] => [Z(z + oz), y * h]),
      ...(p.hole ? { hole: p.hole.map(([z, y]): [number, number] => [Z(z + oz), y * h]) } : {}) }
  }
  if (p.shape === 'cyl' || p.shape === 'tube') {
    const ax = p.axis ?? 'z', dk = ax === 'z' ? (w + h) / 2 : ax === 'x' ? h : w
    const [cz, len] = ax === 'z' ? span(p.o[2], p.s[2]) : [Z(p.o[2]), p.s[2] * (ax === 'x' ? w : h)]
    return { ...p, o: [p.o[0] * w, p.o[1] * h, cz], s: [p.s[0] * dk, p.s[1] * dk, len], ...(p.end != null ? { end: p.end * dk } : {}) }
  }
  const [cz, len] = p.shape === 'plate' || p.shape === 'disc' ? [Z(p.o[2]), p.s[2]] : span(p.o[2], p.s[2])
  return { ...p, o: [p.o[0] * w, p.o[1] * h, cz], s: [p.s[0] * w, p.s[1] * h, len] }
}

export type BuiltModel = Model & { muzzle: [number, number]; socket: [number, number] | null }
const k3 = (v: [number, number, number], k: number): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k]
const k2 = (pts: [number, number][] | undefined, k: number) => pts?.map(([a, b]): [number, number] => [a * k, b * k])
function scalePart(p: Part, k: number): Part {
  // a plate's / disc's flat axis is 0; poly outlines carry the shape; a cyl's `end` is a diameter, a poly's `end` is a ratio
  return { ...p, o: k3(p.o, k), s: k3(p.s, k), ...(p.pts ? { pts: k2(p.pts, k) } : {}), ...(p.hole ? { hole: k2(p.hole, k) } : {}),
    ...(p.bevel != null ? { bevel: p.bevel * k } : {}), ...(p.end != null && p.shape !== 'poly' ? { end: p.end * k } : {}) }
}

/** a bench-only gun's model with nobody's dials (the family's is v2Model itself) */
const bases = new Map<string, Model>()
function baseModel(id: BenchKitId, sightId: V2SightId | null): Model {
  if (id in V2_GUNS && sightId) return v2Model(id as V2GunId, sightId)
  const key = `${id}:${sightId}`, had = bases.get(key); if (had) return had
  const g = BENCH_KITS[id], s = sightId ? V2_SIGHTS[sightId] : null
  const seated = s ? s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + g.railTop, p.o[2] + g.seatZ] as Part['o'] })) : []
  const m: Model = { parts: [...g.parts, ...seated], grip: g.grip, fore: g.fore, top: g.railTop, sightZ: g.seatZ, eye: s ? g.railTop + s.eye : g.eye, merge: true,
    ...(s ? { optic: s.optic, adsK: s.adsK, lens: s.lens, cut: s.cut } : {}) }
  bases.set(key, m); return m
}
/** the sight this gun is drawn with: the one asked for if it takes it, else its own (null = sightless) */
export const sightFor = (id: BenchKitId, pick: V2SightId | null): V2SightId | null => { const k = BENCH_KITS[id]; return pick && k.sights.includes(pick) ? pick : k.own }

const cache = new Map<string, BuiltModel>()
/** the gun with its sight seated, moved by the build dials. Untouched dials = the very model the tuner shows today (v2Model). */
export function builtModel(id: BenchKitId, sightId: V2SightId | null, build?: Partial<GunBuild> | null): BuiltModel {
  const b = cleanBuild(build), key = `${id}:${sightId}:${BUILD_DIALS.map(d => b[d.k]).join(',')}`, had = cache.get(key)
  if (had) return had
  const g = BENCH_KITS[id], s = sightId ? V2_SIGHTS[sightId] : null, base = baseModel(id, sightId), mz = muzzleOf(id), so = socketOf(id)
  let m: BuiltModel
  if (isZero(b)) m = { ...base, muzzle: mz, socket: so }
  else {
    const k = b.scale, d: Dims = b, Z = (z: number) => dimZ(g, d, z)
    const dimmed = d.length !== 1 || d.barrel !== 1 || d.stock !== 1 || d.height !== 1 || d.width !== 1
    const top = (g.railTop + b.railY) * d.height, seat = Z(g.seatZ + b.seatZ)
    const body = g.parts.map(p => (g.core.has(p) ? { ...p, o: [p.o[0], p.o[1] + b.socketY, p.o[2] + b.socketZ] as Part['o'] } : p)).map(p => (dimmed ? dimPart(g, d, p) : p))
    const seated = s ? s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + top, p.o[2] + seat] as Part['o'] })) : []
    const eye = s ? top + s.eye : (g.eye ?? base.eye ?? 0) * d.height
    m = { ...base, parts: [...body, ...seated].map(p => (k === 1 ? p : scalePart(p, k))),
      grip: k3([g.grip[0] * d.width, (g.grip[1] + b.gripY) * d.height, Z(g.grip[2] + b.gripZ)], k), fore: k3([g.fore[0] * d.width, g.fore[1] * d.height, Z(g.fore[2] + b.foreZ)], k),
      top: top * k, sightZ: seat * k, eye: eye * k, ...(base.lens ? { lens: [base.lens[0] * k, base.lens[1] * k] as [number, number] } : {}),
      muzzle: [(mz[0] * d.height + b.muzzleY) * k, (Z(mz[1]) + b.muzzleZ) * k], socket: so ? [(so[0] + b.socketY) * d.height * k, Z(so[1] + b.socketZ) * k] : null }
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, m); return m
}

// ── saved on this browser (a dev tool's numbers, a DEVICE key: keeper-local.test DEVICE_KEYS) ──
export const GUN_BUILD_KEY = 'open:gun-build.v1'
export function loadBuilds(): Partial<Record<BenchKitId, GunBuild>> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(GUN_BUILD_KEY)
    const o = raw ? JSON.parse(raw) : null, out: Partial<Record<BenchKitId, GunBuild>> = {}
    if (o && typeof o === 'object') for (const id of Object.keys(BENCH_KITS) as BenchKitId[]) if (o[id]) out[id] = cleanBuild(o[id])
    return out
  } catch { return {} }
}
export function saveBuild(id: BenchKitId, b: Partial<GunBuild> | null): Partial<Record<BenchKitId, GunBuild>> {
  const all = loadBuilds()
  if (b) all[id] = cleanBuild(b); else delete all[id]
  try { localStorage.setItem(GUN_BUILD_KEY, JSON.stringify(all)) } catch { /* private window: the dials still move, unsaved */ }
  return all
}
