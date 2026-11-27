// M152 s1: THE DB2 TWINS modelled in the locked family (gun-kit-v2.ts, Alex 11-24). A matched pair of sawn-off double-barrel
// sidearms (canon game/weapons.md › DB2 Twins: sidearm, akimbo, two point-blank barrels, long reload, sockets 1-2; RULED
// CANON_GAPS › The DB2 Twins: one sigil core in two halves, one rune in each gun = a 2-rune word). PURE (no three).
// ⚠ OFF IN THE GAME: nothing a player draws reads this file; /shimmer/dev/gun-kit?twins=<view> previews it until Alex OKs the look.
//
// Look law: athernyx CANON/design-briefs/manabox-design.md: cast dark iron and dull bronze, dead and unlit; a short slotted shroud
// over the two barrels (heat, not cartridges: no break hinge, no shells, no ejector), the family's round chamber in a bronze ring,
// a priming lever and a heat gauge on the OUTER side, a bronze trigger hoop, a bird's-head grip. No sights (M152). The core:
// each gun carries HALF of the pair's one core, plugged in from below, its split face flush with the gun's INNER side, so the two
// halves face each other when the pair is held. A rune face is cut on each half's visible (outer) face: LEFT = rune 1 (fires
// first, the birth-rune match), RIGHT = rune 2. The faces are blank in the model; the letter is drawn per letter-glyphs.md.
import type { Model, Part, PartColor } from './gun-kit'
import { cut } from './gun-kit-v2'

type V3 = Part['o']
type P2 = [number, number]
const box = (o: V3, s: Part['s'], c: PartColor): Part => ({ o, s, c })
const cyl = (o: V3, d: number, len: number, c: PartColor, axis: 'x' | 'y' | 'z' = 'z', seg = 14): Part => ({ o, s: [d, d, len], c, shape: 'cyl', axis, seg })
const slab = (pts: P2[], w: number, c: PartColor, x = 0, bevel = 0, hole?: P2[]): Part => ({ o: [x, 0, 0], s: [w, 0, 0], c, shape: 'poly', pts, bevel, hole })
const bar = (o: V3, pts: P2[], len: number, c: PartColor, bevel = 0): Part => ({ o, s: [len, 0, 0], c, shape: 'poly', axis: 'z', pts, bevel })
const circle = (z: number, y: number, d: number, n = 20): P2[] => Array.from({ length: n }, (_, i): P2 => [z + Math.cos(i / n * 2 * Math.PI) * d / 2, y + Math.sin(i / n * 2 * Math.PI) * d / 2])

export type TwinSide = 'left' | 'right'
export interface RuneSlot { rune: 1 | 2; o: V3; size: [number, number]; normal: V3 }
export interface TwinGun { side: TwinSide; rune: 1 | 2; parts: Part[]; core: Part[]; runeSlot: RuneSlot; grip: Model['grip']; fore: Model['fore'] }

/** half the receiver's width (two barrels side by side) */
export const TW_HALF = 0.027
/** the barrels: two, side by side */
export const TW_BARRELS = { n: 2, d: 0.026, x: 0.0135, y: 0.006, z0: -0.07, z1: -0.232 }
/** the core half: its split face at the inner side, centre z, top y (under the receiver) */
export const TW_CORE = { z: -0.026, top: -0.036, w: 0.022, h: 0.05, l: 0.034 }

/** one gun of the pair. `inward` = +1 when the other gun is on this gun's +x (the LEFT gun), -1 for the right */
function twin(side: TwinSide): TwinGun {
  const inward = side === 'left' ? 1 : -1, out = -inward, W = TW_HALF, B = TW_BARRELS, C = TW_CORE
  const parts: Part[] = [
    // the short receiver, cast
    slab([[-0.072, 0.032], [0.05, 0.032], [0.072, 0.012], [0.072, -0.022], [0.042, -0.036], [-0.072, -0.036]], 2 * W, 'iron', 0, 0.002),
    // the incised channel, both sides
    ...[-1, 1].flatMap(x => [0.005, -0.005].map(d => box([x * W, 0.017 + d, -0.012], [0.003, 0.0034, 0.1], 'slot'))),
    // the family's round chamber in its studded bronze ring, both sides
    ...[-1, 1].flatMap(x => [
      slab(circle(-0.036, -0.006, 0.046), 0.006, 'bronze', x * (W + 0.0025), 0.0012, circle(-0.036, -0.006, 0.032)),
      cyl([x * W, -0.006, -0.036], 0.031, 0.003, 'slot', 'x', 20),
      ...Array.from({ length: 8 }, (_, i) => cyl([x * (W + 0.006), -0.006 + Math.sin((i + 0.5) / 4 * Math.PI) * 0.0195, -0.036 + Math.cos((i + 0.5) / 4 * Math.PI) * 0.0195], 0.0048, 0.003, 'slot', 'x', 6)),
    ]),
    // the priming lever and the heat gauge, OUTER side only (the side the hand's thumb is not on)
    cyl([out * (W + 0.004), -0.02, 0.022], 0.013, 0.01, 'bronze', 'x', 10), { ...box([out * (W + 0.007), -0.026, 0.033], [0.005, 0.008, 0.024], 'bronze'), rot: 0.55 },
    slab(circle(0.03, 0.012, 0.026, 16), 0.006, 'bronze', out * (W + 0.002), 0.001, circle(0.03, 0.012, 0.018, 16)), cyl([out * (W + 0.0005), 0.012, 0.03], 0.018, 0.002, 'slot', 'x', 16),
    // THE TWO BARRELS, side by side, and the rib between them on top
    ...[-1, 1].map(x => cyl([x * B.x, B.y, (B.z0 + B.z1) / 2], B.d, B.z0 - B.z1, 'iron')),
    box([0, B.y + B.d / 2 + 0.001, -0.17], [0.006, 0.004, 0.09], 'iron'),
    // the short slotted shroud over both (heat: the family's largest feature after the barrel)
    bar([0, B.y, -0.115], cut(2 * W + 0.004, 0.042, 0.008), 0.09, 'iron', 0.002),
    ...[0, 1, 2, 3].flatMap(i => [-1, 1].map(x => slab(cut(0.0105, 0.026, 0.0042, -0.148 + i * 0.0215, B.y), 0.003, 'slot', x * (W + 0.0024)))),
    // the sawn end: a scorched ring, the bronze muzzle band, two bores
    bar([0, B.y, -0.206], cut(2 * W + 0.002, 0.034, 0.008), 0.008, 'soot', 0.001),
    bar([0, B.y, -0.222], cut(2 * W + 0.01, 0.038, 0.009), 0.02, 'bronze', 0.0015),
    ...[-1, 1].map(x => cyl([x * B.x, B.y, B.z1 - 0.0015], 0.02, 0.002, 'slot', 'z', 14)),
    // the bronze trigger hoop
    slab(circle(0.046, -0.058, 0.044, 16), 0.008, 'bronze', 0, 0, circle(0.046, -0.058, 0.035, 16)), { ...box([0, -0.05, 0.047], [0.006, 0.026, 0.006], 'bronze'), rot: 0.35 },
    // the bird's-head grip and its bronze cap
    slab([[0.04, -0.034], [0.072, -0.024], [0.114, -0.11], [0.106, -0.122], [0.072, -0.126], [0.062, -0.112]], 0.032, 'iron', 0, 0.003),
    slab([[0.066, -0.118], [0.108, -0.116], [0.106, -0.134], [0.068, -0.136]], 0.036, 'bronze', 0, 0.002),
  ]
  // HALF THE CORE, from below: a bronze collar, the grey crystal (split face flush with the inner side), a bronze tip
  const cx = inward * (W - C.w / 2)
  const core: Part[] = [
    slab(cut(C.l + 0.012, 0.012, 0.003, C.z, C.top - 0.006), C.w + 0.002, 'bronze', inward * (W - (C.w + 0.002) / 2), 0.001),
    slab(cut(C.l, C.h, 0.009, C.z, C.top - 0.012 - C.h / 2), C.w, 'core', cx, 0),
    slab(cut(C.l * 0.6, 0.012, 0.004, C.z, C.top - 0.018 - C.h), C.w * 0.8, 'bronze', inward * (W - C.w * 0.4), 0.001),
  ]
  // the rune face: a shallow cut on the crystal's outer face (blank; the letter is drawn on it per letter-glyphs.md)
  const fx = cx + out * (C.w / 2 + 0.0004), fy = C.top - 0.012 - C.h / 2
  const runeSlot: RuneSlot = { rune: side === 'left' ? 1 : 2, o: [fx, fy, C.z], size: [C.l * 0.72, C.h * 0.62], normal: [out, 0, 0] }
  core.push(box([fx, fy, C.z], [0.0008, runeSlot.size[1], runeSlot.size[0]], 'etch'))
  return { side, rune: runeSlot.rune, parts: [...parts, ...core], core, runeSlot, grip: [0, -0.07, 0.085], fore: [0, -0.07, 0.085] }
}

/** the pair. `gap` = how far apart (centre to centre) they are drawn as a pair on the bench */
export const TWINS: { left: TwinGun; right: TwinGun; gap: number } = { left: twin('left'), right: twin('right'), gap: 0.075 }

const cache = new Map<TwinSide, Model>()
/** one gun of the pair as a Model the bench draws (no sight: eye = the rib line) */
export function twinsModel(side: TwinSide): Model {
  const had = cache.get(side); if (had) return had
  const g = TWINS[side]
  const m: Model = { parts: g.parts, grip: g.grip, fore: g.fore, top: 0.032, sightZ: -0.1, eye: TW_BARRELS.y + TW_BARRELS.d / 2 + 0.003, merge: true }
  cache.set(side, m); return m
}
