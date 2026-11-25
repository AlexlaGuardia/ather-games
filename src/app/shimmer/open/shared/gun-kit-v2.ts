// M149 s1 (Alex 11-24): THE LOCKED FAMILY, modelled. The Backbone, Charred Rifle and Lance off the locked sheet (the private
// M150 family), and the three sights as their own parts on the flat top. PURE (no three): gun-kit-geo.ts builds the geometry.
// ⚠ OFF IN THE GAME: nothing a player draws reads this file; /shimmer/dev/gun-kit and the tuner preview it until Alex OKs the look.
//
// Look law: athernyx CANON/design-briefs/manabox-design.md (THE LOCKED LOOK + THE SIGIL CORE): cast dark iron and dull bronze, dead and
// unlit; a slotted shroud, a round chamber in a riveted bronze ring, a priming lever, one heat gauge, a flat clear top; the sigil core
// plugs in from below (a metal-capped crystal, grey: its letters come later from letter-glyphs.md, so the face is blank). No magazine,
// rail or port. The Charred Rifle is the Prototype: stamped plate, sealed strapped cell, scorched shroud, no core, nothing lit.
//
// ★ grip / fore are the shipped anchors of each gun's Slate, so a saved hand tune (offsets from them) still lands.
import { box, type Model, type Part, type PartColor } from './gun-kit'
import type { GunTune } from './fp-gun'

type V3 = Part['o']
type P2 = [number, number]
const cyl = (o: V3, d: number, len: number, c: PartColor, axis: 'x' | 'y' | 'z' = 'z', seg = 14, end?: number): Part => ({ o, s: [d, d, len], c, shape: 'cyl', axis, seg, end })
/** an outline extruded across the gun ([z, y] points, centred on x = o[0]) */
const slab = (pts: P2[], w: number, c: PartColor, x = 0, bevel = 0, hole?: P2[]): Part => ({ o: [x, 0, 0], s: [w, 0, 0], c, shape: 'poly', pts, bevel, hole })
/** an outline extruded along the gun ([x, y] points) */
const bar = (o: V3, pts: P2[], len: number, c: PartColor, bevel = 0, end?: number, hole?: P2[]): Part => ({ o, s: [len, 0, 0], c, shape: 'poly', axis: 'z', pts, bevel, end, hole })
const circle = (z: number, y: number, d: number, n = 20): P2[] => Array.from({ length: n }, (_, i): P2 => [z + Math.cos(i / n * 2 * Math.PI) * d / 2, y + Math.sin(i / n * 2 * Math.PI) * d / 2])
/** a rectangle with cut corners */
export const cut = (w: number, h: number, c: number, x = 0, y = 0): P2[] => [[-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c], [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]].map(([a, b]): P2 => [a + x, b + y])
const SIDES = [-1, 1] as const

/** the round chamber: a bronze ring of studs about a recessed (or domed) iron face, both sides. `w` = half the body's width there */
const chamber = (z: number, y: number, d: number, w: number, dome = false): Part[] => SIDES.flatMap(x => [
  slab(circle(z, y, d), 0.006, 'bronze', x * (w + 0.0025), 0.0012, circle(z, y, d * 0.7)),
  cyl([x * (w + (dome ? 0.005 : 0)), y, z], d * 0.68, dome ? 0.014 : 0.003, dome ? 'iron' : 'slot', 'x', 20, undefined),
  ...Array.from({ length: 12 }, (_, i) => cyl([x * (w + 0.006), y + Math.sin((i + 0.5) / 6 * Math.PI) * d * 0.425, z + Math.cos((i + 0.5) / 6 * Math.PI) * d * 0.425], 0.0055, 0.003, 'slot', 'x', 6)),
])
/** the heat gauge and the priming lever (the gun's left, where the eye is) */
const gauge = (z: number, y: number, w: number, c: PartColor = 'bronze', d = 0.034): Part[] => [
  slab(circle(z, y, d, 16), 0.006, c, -w - 0.002, 0.001, circle(z, y, d * 0.68, 16)), cyl([-w - 0.0005, y, z], d * 0.7, 0.002, 'slot', 'x', 16),
  { ...box([-w - 0.002, y + 0.002, z + 0.002], [0.001, 0.0022, 0.016], c), rot: 0.8 } ]
const lever = (z: number, y: number, w: number, c: PartColor = 'bronze'): Part[] => [cyl([-w - 0.004, y, z], 0.015, 0.01, c, 'x', 10), { ...box([-w - 0.007, y - 0.008, z + 0.013], [0.005, 0.009, 0.03], c), rot: 0.55 }]
/** the trigger and its guard: a bronze hoop under the receiver */
const trigger = (z: number, y: number, c: PartColor = 'bronze', d = 0.056): Part[] => [slab(circle(z, y, d, 16), 0.009, c, 0, 0, circle(z, y, d - 0.009, 16)), { ...box([0, y + 0.004, z + 0.002], [0.006, 0.034, 0.007], c), rot: 0.35 }]
/** THE SIGIL CORE, plugged in from below: a bronze collar, a six-sided grey crystal (blank: no letter is cut yet), a bronze tip */
const core = (z: number, top: number, k = 1): Part[] => [
  cyl([0, top - 0.005 * k, z], 0.052 * k, 0.01 * k, 'iron', 'y', 12), cyl([0, top - 0.018 * k, z], 0.058 * k, 0.018 * k, 'bronze', 'y', 12),
  cyl([0, top - 0.053 * k, z], 0.03 * k, 0.054 * k, 'core', 'y', 6, 0.048 * k), cyl([0, top - 0.09 * k, z], 0.013 * k, 0.022 * k, 'bronze', 'y', 10, 0.029 * k) ]
/** the slots of a fluted shroud, both sides, with a thin cast lip standing between them */
const slots = (z0: number, n: number, step: number, y: number, h: number, w: number): Part[] => Array.from({ length: n }, (_, i) => z0 + i * step).flatMap(z => SIDES.map(x =>
  slab(cut(step * 0.5, h, step * 0.2, z, y), 0.003, 'slot', x * (w + 0.0004))))
/** the incised channel down the receiver: two dry lines */
const channel = (z0: number, z1: number, y: number, w: number): Part[] => SIDES.flatMap(x => [0.005, -0.005].map(d => box([x * w, y + d, (z0 + z1) / 2], [0.003, 0.0034, z1 - z0], 'slot')))
const bore = (z: number, y: number, d: number): Part => cyl([0, y, z], d, 0.002, 'slot', 'z', 14)

export type V2GunId = 'backbone' | 'charred-rifle' | 'lance'
export interface V2Gun { id: V2GunId; name: string; parts: Part[]; grip: Model['grip']; fore: Model['fore']; railTop: number; seatZ: number; own: V2SightId; sights: V2SightId[]; hold?: Partial<GunTune> }
const GRIP: Model['grip'] = [0, -0.06, 0.1], FORE: Model['fore'] = [0, -0.06, -0.26]
// a gun nobody has tuned yet sits at the Backbone's size and hands here (preview only: it is under every baked and saved tune)
const HOLD: Partial<GunTune> = { S: 1.2, HIP_X: 0.145, HIP_Y: -0.175, HIP_Z: -0.355, HAND: 0.85, R_DX: 0.002, R_DY: 0.044, R_DZ: 0.08, R_PITCH: -1.12, R_ROLL: 0.8, L_DX: -0.012, L_DY: -0.032, L_DZ: -0.032, L_PITCH: 1.34, L_ROLL: -2.17 }

/** the family's receiver, shroud, grip and stock at an offset along the gun (`z`) */
const receiver = (z: number, len: number): Part => slab([[-0.161 + z, 0.05], [0.143 + z + len, 0.05], [0.157 + z + len, 0.03], [0.157 + z + len, -0.03], [0.11 + z + len, -0.052], [0, -0.056], [-0.02 + z, -0.066], [-0.076 + z, -0.066], [-0.158 + z, -0.046]], 0.048, 'iron', 0, 0.002)
const grip = (z: number, y: number): Part => slab([[0.045 + z, y], [0.1 + z, y], [0.142 + z, y - 0.098], [0.134 + z, y - 0.106], [0.092 + z, y - 0.112], [0.082 + z, y - 0.104]], 0.03, 'iron', 0, 0.003)
const stock = (z: number, butt: PartColor = 'bronze', body: PartColor = 'iron'): Part[] => [slab([[0.15 + z, 0.028], [0.35 + z, 0.037], [0.35 + z, -0.116], [0.33 + z, -0.114], [0.229 + z, -0.046], [0.15 + z, -0.034]], 0.032, body, 0, 0.004), slab([[0.349 + z, 0.041], [0.367 + z, 0.041], [0.367 + z, -0.121], [0.349 + z, -0.121]], 0.038, butt, 0, 0.002)]

export const V2_GUNS: Record<V2GunId, V2Gun> = {
  backbone: { id: 'backbone', name: 'Backbone', grip: GRIP, fore: FORE, railTop: 0.052, seatZ: -0.04, own: 'holo', sights: ['holo', 'prism'], parts: [
    receiver(0, 0), ...channel(-0.035, 0.13, 0.02, 0.026), ...chamber(-0.0965, -0.003, 0.09, 0.026), ...lever(-0.006, -0.018, 0.026), ...gauge(0.106, -0.018, 0.026),
    bar([0, 0.001, -0.259], cut(0.05, 0.08, 0.008), 0.2, 'iron', 0.002), ...slots(-0.333, 8, 0.0215, 0.001, 0.054, 0.027),
    cyl([0, 0, -0.415], 0.028, 0.115, 'iron'), cyl([0, 0, -0.478], 0.044, 0.04, 'bronze', 'z', 16), cyl([0, 0, -0.457], 0.034, 0.006, 'iron'), bore(-0.4985, 0, 0.026),
    ...core(-0.048, -0.064), ...trigger(0.026, -0.078), grip(0, -0.05), ...stock(0),
  ] },
  // the Prototype: mass-stamped plate, seams and rivets showing, a sealed cell strapped where the chamber would be, scorched, nothing lit
  'charred-rifle': { id: 'charred-rifle', name: 'Charred Rifle', grip: GRIP, fore: FORE, railTop: 0.052, seatZ: -0.02, own: 'ring', sights: ['ring'], hold: HOLD, parts: [
    slab([[-0.158, 0.05], [0.008, 0.05], [0.008, -0.05], [-0.146, -0.05], [-0.158, -0.037]], 0.048, 'stamp', 0, 0.001),
    slab([[0.0095, 0.049], [0.148, 0.049], [0.162, 0.03], [0.166, -0.03], [0.12, -0.048], [0.0095, -0.05]], 0.051, 'stamp', 0, 0.001),
    box([0, 0, 0.009], [0.044, 0.096, 0.006], 'slot'),                        // the seam between them
    box([0, 0.051, -0.03], [0.034, 0.002, 0.2], 'stamp'),                    // the folded top strip
    ...SIDES.map(x => bar([x * 0.022, -0.002, -0.07], cut(0.03, 0.1, 0.012), 0.118, 'cell', 0.005)),   // THE SEALED CELL
    ...[-0.104, -0.036].flatMap(z => [bar([0, -0.004, z], cut(0.084, 0.118, 0.012), 0.014, 'strap', 0), ...SIDES.map(x => cyl([x * 0.0425, -0.056, z], 0.01, 0.004, 'stamp', 'x', 8))]),
    ...[[-0.145, 0.038], [-0.145, -0.035], [0, 0.038], [0, -0.038], [0.022, 0.038], [0.022, -0.038], [0.09, 0.04], [0.09, -0.038], [0.145, 0.024], [0.145, -0.022]].flatMap(([z, y]) => SIDES.map(x => cyl([x * 0.0265, y, z], 0.009, 0.004, 'stamp', 'x', 8))),
    ...lever(0.04, 0.014, 0.024, 'stamp'), ...gauge(0.11, 0.002, 0.0255, 'stamp', 0.03),
    bar([0, 0.004, -0.256], cut(0.05, 0.074, 0.006), 0.2, 'soot', 0.001), ...SIDES.map(x => box([x * 0.026, 0.004, -0.256], [0.002, 0.002, 0.2], 'slot')),
    ...[0.022, -0.014].flatMap(y => [0, 1, 2, 3, 4, 5].flatMap(i => SIDES.map(x => cyl([x * 0.0265, y, -0.334 + i * 0.031], 0.017, 0.003, 'slot', 'x', 12)))),
    cyl([0, 0.003, -0.415], 0.026, 0.115, 'soot'), cyl([0, 0.003, -0.475], 0.036, 0.035, 'soot'), bore(-0.493, 0.003, 0.02),
    ...trigger(0.026, -0.074, 'strap'), { ...grip(0, -0.046), c: 'soot' }, ...stock(0, 'stamp', 'soot'),
  ] },
  lance: { id: 'lance', name: 'Lance', grip: [0, -0.07, 0.12], fore: [0, -0.06, -0.3], railTop: 0.052, seatZ: -0.02, own: 'prism', sights: ['prism', 'holo'], hold: HOLD, parts: [
    receiver(0.02, 0), ...channel(-0.015, 0.15, 0.024, 0.026), ...chamber(-0.0765, -0.002, 0.092, 0.026, true), ...lever(0.012, -0.018, 0.026), ...gauge(0.126, -0.018, 0.026),
    bar([0, 0.001, -0.239], cut(0.046, 0.07, 0.008), 0.2, 'iron', 0.002), ...slots(-0.313, 8, 0.0215, 0.001, 0.048, 0.025),
    cyl([0, 0, -0.5], 0.032, 0.33, 'iron'), ...[-0.43, -0.55].map(z => cyl([0, 0, z], 0.042, 0.02, 'bronze', 'z', 16)), cyl([0, 0, -0.655], 0.04, 0.04, 'iron'), cyl([0, 0, -0.7], 0.054, 0.05, 'bronze', 'z', 16), bore(-0.7255, 0, 0.03),
    ...core(-0.028, -0.064), ...trigger(0.046, -0.078), grip(0.02, -0.05), ...stock(0.02),
  ] },
}

// ── the sights: each its own part set, seat-relative (origin = the flat top at the seat); eye = the sight line above the top ──
export type V2SightId = 'holo' | 'prism' | 'ring'
export interface V2Sight { id: V2SightId; name: string; optic: 'reddot' | 'prism3'; eye: number; adsK: number; lens?: [number, number]; cut: 'dot' | 'cross'; parts: Part[] }
const HOLO = 0.045, PRISM = 0.047
const hair = (x: number, y: number, w: number, h: number, z: number): Part => ({ o: [x, y, z], s: [w, h, 0], c: 'etch', shape: 'plate' })
export const V2_SIGHTS: Record<V2SightId, V2Sight> = {
  // HOLO 1x: an open square window in a cast frame on a low base; the keeper's mark floats in the crystal
  holo: { id: 'holo', name: 'Holo (1x)', optic: 'reddot', eye: HOLO, adsK: 0.62, cut: 'dot', parts: [
    box([0, 0.003, 0.004], [0.034, 0.006, 0.05], 'iron'), bar([0, 0.012, 0], [[-0.023, -0.006], [0.023, -0.006], [0.03, 0.005], [-0.03, 0.005]], 0.026, 'bronze', 0.0008), box([0, 0.012, -0.024], [0.03, 0.012, 0.026], 'iron'),
    bar([0, HOLO, 0], cut(0.056, 0.056, 0.006), 0.012, 'iron', 0.0015, undefined, cut(0.046, 0.046, 0.005)),
    { o: [0, HOLO, -0.002], s: [0.046, 0.046, 0], c: 'glass', shape: 'plate' }, { o: [0, HOLO, -0.004], s: [0.02, 0.02, 0], c: 'dot', shape: 'disc' },
  ] },
  // PRISM 3x: a short tapered housing, the eyepiece toward the eye in a bronze bezel, hairlines etched in the crystal; aiming, the
  // zoomed picture is drawn INSIDE the eyepiece
  prism: { id: 'prism', name: 'Prism (3x)', optic: 'prism3', eye: PRISM, adsK: 0.48, lens: [0.05, 0.043], cut: 'cross', parts: [
    box([0, 0.003, -0.012], [0.04, 0.006, 0.04], 'bronze'), box([0, 0.013, -0.012], [0.026, 0.018, 0.03], 'iron'),
    bar([0, PRISM, -0.013], cut(0.063, 0.056, 0.013), 0.05, 'iron', 0.0012, 0.72), bar([0, PRISM, -0.041], cut(0.046, 0.042, 0.01), 0.008, 'bronze', 0.0008),
    { o: [0, PRISM, -0.0468], s: [0.036, 0.033, 0], c: 'lens', shape: 'plate', rot: Math.PI },
    bar([0, PRISM, 0.0135], cut(0.056, 0.049, 0.012), 0.005, 'bronze', 0.0008, undefined, cut(0.05, 0.043, 0.0105)),
    { o: [0, PRISM, 0.0138], s: [0, 0, 0], pts: cut(0.05, 0.043, 0.0105), c: 'lens', shape: 'plate' },
    { o: [0, PRISM, 0.0141], s: [0, 0, 0], pts: cut(0.05, 0.043, 0.0105), c: 'view', shape: 'plate' },
    ...SIDES.map(x => hair(x * 0.0155, PRISM, 0.012, 0.00028, 0.0144)), hair(0, PRISM - 0.0115, 0.00028, 0.011, 0.0144),
    ...[[0.0085, 0.0085], [0.012, 0.006], [0.015, 0.004]].map(([d, w]) => hair(0, PRISM - d, w, 0.00028, 0.0144)),
    { o: [0, PRISM, 0.0146], s: [0.011, 0.011, 0], c: 'dot', shape: 'disc' },
  ] },
  // the Charred Rifle's stamped ring: a flat punched ring on a strip with a crude stay, a cloudy crystal
  ring: { id: 'ring', name: 'Stamped ring (1x)', optic: 'reddot', eye: 0.052, adsK: 0.62, cut: 'cross', parts: [
    box([0, 0.004, 0.012], [0.05, 0.008, 0.056], 'stamp'), ...SIDES.map(x => cyl([x * 0.018, 0.009, 0.012], 0.007, 0.003, 'slot', 'y', 8)),
    bar([0, 0.018, 0], [[-0.016, -0.011], [0.016, -0.011], [0.011, 0.012], [-0.011, 0.012]], 0.006, 'stamp', 0.0005), { ...box([0, 0.015, 0.02], [0.006, 0.005, 0.042], 'stamp'), rot: 0.42 }, cyl([0, 0.01, 0.036], 0.011, 0.02, 'stamp', 'x', 10),
    bar([0, 0.052, 0], circle(0, 0, 0.058, 24), 0.006, 'stamp', 0.0006, undefined, circle(0, 0, 0.042, 24)), ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => cyl([Math.cos(i * Math.PI / 4) * 0.025, 0.052 + Math.sin(i * Math.PI / 4) * 0.025, 0.0035], 0.004, 0.002, 'slot', 'z', 6)),
    { o: [0, 0.052, -0.001], s: [0.043, 0, 0], c: 'glass', shape: 'disc' }, { o: [0, 0.052, -0.0015], s: [0.043, 0, 0], c: 'glass', shape: 'disc' }, { o: [0, 0.052, -0.002], s: [0.043, 0, 0], c: 'glass', shape: 'disc' },   // cloudy: three skins of crystal
    { o: [0, 0.052, 0.0005], s: [0.018, 0.018, 0], c: 'dot', shape: 'disc' },
  ] },
}

const cache = new Map<string, Model>()
/** a new body with a sight seated on its flat top, as a Model the rig draws. One object per pair: the rig keys geometry on it. */
export function v2Model(gunId: V2GunId, sightId: V2SightId): Model {
  const k = `${gunId}:${sightId}`, had = cache.get(k); if (had) return had
  const g = V2_GUNS[gunId], s = V2_SIGHTS[sightId]
  const seated = s.parts.map(p => ({ ...p, o: [p.o[0], p.o[1] + g.railTop, p.o[2] + g.seatZ] as V3 }))
  const m: Model = { parts: [...g.parts, ...seated], grip: g.grip, fore: g.fore, top: g.railTop, sightZ: g.seatZ, eye: g.railTop + s.eye, optic: s.optic, merge: true, adsK: s.adsK, lens: s.lens, cut: s.cut }
  cache.set(k, m); return m
}
