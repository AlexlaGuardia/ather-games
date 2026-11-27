// M150 s4 (Alex 11-27: "start working on the new gun models and adding them to the gun bench so i can tune them later"): the BUILD
// DIALS of a new-family model (gun-kit-v2.ts). The tuner (/shimmer/dev/guns, New model) moves these and saves them to this browser;
// "Copy values" hands them to Jin to bake into the gun's data. PURE (no three). Off in the game: only the tuner's preview reads it.
//
// The dials, all offsets from the model as built (0 = as modelled; scale 1):
//   scale        the model's own size (the rig's "gun size" S stays the HOLD's: this one is the gun's)
//   grip y/z     the right glove's anchor on the grip (the hand tune's offsets ride on it)
//   fore z       the left glove's anchor under the shroud
//   muzzle y/z   where the round leaves (a marker on the bench; the game does not read it yet)
//   rail y, seat z   the flat top's height and where along it the sight sits
//   socket y/z   THE SIGIL CORE's spot (canon: one core per gun; the Prototype takes none, so it has no socket dials)
import type { Model, Part } from './gun-kit'
import { V2_GUNS, V2_SIGHTS, v2Model, isCorePart, type V2GunId, type V2SightId } from './gun-kit-v2'

export interface GunBuild { scale: number; gripY: number; gripZ: number; foreZ: number; muzzleY: number; muzzleZ: number; railY: number; seatZ: number; socketY: number; socketZ: number }
export type BuildKey = keyof GunBuild
export const BUILD_ZERO: GunBuild = { scale: 1, gripY: 0, gripZ: 0, foreZ: 0, muzzleY: 0, muzzleZ: 0, railY: 0, seatZ: 0, socketY: 0, socketZ: 0 }
export const BUILD_DIALS: { k: BuildKey; label: string; min: number; max: number; step: number; socket?: true }[] = [
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
/** does this gun take a sigil core at all (the Prototype does not) */
export const hasSocket = (id: V2GunId) => V2_GUNS[id].parts.some(isCorePart)
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
export function muzzleOf(id: V2GunId): [number, number] {
  const bores = V2_GUNS[id].parts.filter(p => p.shape === 'cyl' && (p.axis ?? 'z') === 'z' && p.c === 'slot')
  const b = bores.reduce((a, p) => (p.o[2] < a.o[2] ? p : a), bores[0])
  return [b.o[1], b.o[2] - b.s[2] / 2]
}
/** the socket as modelled: the top of the core's collar, [y, z] (null for the Prototype) */
export function socketOf(id: V2GunId): [number, number] | null {
  const c = V2_GUNS[id].parts.filter(isCorePart)
  return c.length ? [Math.max(...c.map(p => p.o[1] + p.s[2] / 2)), c[0].o[2]] : null
}

export type BuiltModel = Model & { muzzle: [number, number]; socket: [number, number] | null }
const k3 = (v: [number, number, number], k: number): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k]
const k2 = (pts: [number, number][] | undefined, k: number) => pts?.map(([a, b]): [number, number] => [a * k, b * k])
function scalePart(p: Part, k: number): Part {
  // a plate's / disc's flat axis is 0; poly outlines carry the shape; a cyl's `end` is a diameter, a poly's `end` is a ratio
  return { ...p, o: k3(p.o, k), s: k3(p.s, k), ...(p.pts ? { pts: k2(p.pts, k) } : {}), ...(p.hole ? { hole: k2(p.hole, k) } : {}),
    ...(p.bevel != null ? { bevel: p.bevel * k } : {}), ...(p.end != null && p.shape !== 'poly' ? { end: p.end * k } : {}) }
}

const cache = new Map<string, BuiltModel>()
/** the gun with its sight seated, moved by the build dials. Untouched dials = the very model the tuner shows today (v2Model). */
export function builtModel(id: V2GunId, sightId: V2SightId, build?: Partial<GunBuild> | null): BuiltModel {
  const b = cleanBuild(build), key = `${id}:${sightId}:${BUILD_DIALS.map(d => b[d.k]).join(',')}`, had = cache.get(key)
  if (had) return had
  const g = V2_GUNS[id], s = V2_SIGHTS[sightId], base = v2Model(id, sightId), mz = muzzleOf(id), so = socketOf(id)
  let m: BuiltModel
  if (isZero(b)) m = { ...base, muzzle: mz, socket: so }
  else {
    const k = b.scale, top = g.railTop + b.railY, seat = g.seatZ + b.seatZ
    const body = g.parts.map(p => (isCorePart(p) ? { ...p, o: [p.o[0], p.o[1] + b.socketY, p.o[2] + b.socketZ] as Part['o'] } : p))
    const seated = s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + top, p.o[2] + seat] as Part['o'] }))
    m = { ...base, parts: [...body, ...seated].map(p => (k === 1 ? p : scalePart(p, k))),
      grip: k3([g.grip[0], g.grip[1] + b.gripY, g.grip[2] + b.gripZ], k), fore: k3([g.fore[0], g.fore[1], g.fore[2] + b.foreZ], k),
      top: top * k, sightZ: seat * k, eye: (top + s.eye) * k, ...(base.lens ? { lens: [base.lens[0] * k, base.lens[1] * k] as [number, number] } : {}),
      muzzle: [(mz[0] + b.muzzleY) * k, (mz[1] + b.muzzleZ) * k], socket: so ? [(so[0] + b.socketY) * k, (so[1] + b.socketZ) * k] : null }
  }
  if (cache.size > 200) cache.clear()
  cache.set(key, m); return m
}

// ── saved on this browser (a dev tool's numbers, a DEVICE key: keeper-local.test DEVICE_KEYS) ──
export const GUN_BUILD_KEY = 'open:gun-build.v1'
export function loadBuilds(): Partial<Record<V2GunId, GunBuild>> {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(GUN_BUILD_KEY)
    const o = raw ? JSON.parse(raw) : null, out: Partial<Record<V2GunId, GunBuild>> = {}
    if (o && typeof o === 'object') for (const id of Object.keys(V2_GUNS) as V2GunId[]) if (o[id]) out[id] = cleanBuild(o[id])
    return out
  } catch { return {} }
}
export function saveBuild(id: V2GunId, b: Partial<GunBuild> | null): Partial<Record<V2GunId, GunBuild>> {
  const all = loadBuilds()
  if (b) all[id] = cleanBuild(b); else delete all[id]
  try { localStorage.setItem(GUN_BUILD_KEY, JSON.stringify(all)) } catch { /* private window: the dials still move, unsaved */ }
  return all
}
