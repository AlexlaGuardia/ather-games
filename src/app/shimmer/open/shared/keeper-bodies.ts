// THE KEEPER'S BODY VARIETY (BETA M216 s2b, Alex 11-26 "this is for custom character customization.. it's more about the
// variety"; locked sheet athernyx 4772412 assets/concept-1672/keeper-body-cartoon/bodies-LOCKED.png + NOTES.md): the six
// torso shapes (A-C x male / female), the six scarves (male = thick wrap with a short side knot, female = long tails; every
// scarf offered to either) and the five belts (each with a seed pouch on the right hip + a tool loop on the left).
// Hands + feet unchanged (floating limbs stay). Heads = keeper-heads.ts.
// ★ ONE SOURCE PER PROPORTION (Alex 11-26, M216 s1): a torso / scarf / belt brings SHAPE only.
//   - a torso profile is a UNIT outline (its widest point is exactly 1, its height runs 0..1): TORSO_R sizes every torso
//     once, and the Torso width / length / depth dials size it from there;
//   - a scarf / belt is words + a side (-1 / 0 / 1): every length, thickness and place lives ONCE in SCARF / BELT below,
//     times the Scarf / Belt dials, and the belt rides at the Belt height dial on whatever torso it is on.
//   A torso's own proportions (the sheet's B male is broader) are STARTING values copied onto the sliders when picked on the
//   bench (TORSO_STARTS, like HEAD_STARTS), never laid over them. keeper-one-source.test.ts is the guard.
// Labels (OPT.torso / scarfStyle / belt in keeper-look.ts): placeholders for @lark.
import * as THREE from 'three'
import type { Proportions } from './keeper-proportions'

/** [radius, height] in a unit box: widest point exactly 1, bottom 0, top 1. Index = Look.torso (even = male). */
export const TORSO_SHAPES: readonly { tag: string; prof: readonly (readonly [number, number])[] }[] = [
  { tag: 'A-M', prof: [[0, 0], [0.62, 0.04], [0.72, 0.2], [0.84, 0.5], [1, 0.78], [0.86, 0.93], [0.42, 1]] },              // straight V taper
  { tag: 'A-F', prof: [[0, 0], [0.85, 0.05], [1, 0.2], [0.76, 0.45], [0.95, 0.72], [0.9, 0.9], [0.45, 1]] },               // soft hourglass
  { tag: 'B-M', prof: [[0, 0], [0.82, 0.04], [0.88, 0.2], [0.92, 0.5], [1, 0.8], [0.97, 0.93], [0.52, 1]] },               // square, straight
  { tag: 'B-F', prof: [[0, 0], [0.85, 0.05], [1, 0.2], [0.86, 0.45], [0.95, 0.72], [0.93, 0.9], [0.47, 1]] },              // straighter soft waist
  { tag: 'C-M', prof: [[0, 0], [0.52, 0.04], [0.6, 0.2], [0.56, 0.38], [0.92, 0.66], [1, 0.82], [0.52, 1]] },              // barrel chest, narrow waist
  { tag: 'C-F', prof: [[0, 0], [0.86, 0.05], [1, 0.2], [0.6, 0.45], [0.92, 0.7], [0.86, 0.88], [0.41, 1]] },               // strongest hourglass
]
/** the ONE torso size every shape shares (m, before the Torso width dial); the old Broad egg was 0.24, Curved 0.2 */
export const TORSO_R = 0.22

/** bench only: a torso's STARTING dials, copied onto the sliders when it is picked (the sheet's B male is the broad one,
 *  C the tall barrel / long hourglass). Index = Look.torso. */
export const TORSO_STARTS: readonly Partial<Proportions>[] = [
  {}, {}, { torsoW: 1.06, torsoD: 1.05 }, { torsoL: 1.04 }, { torsoW: 1.04, torsoL: 1.06 }, { torsoW: 0.96, torsoL: 1.04 },
]

export type Side = -1 | 0 | 1
/** a scarf: wrap kind, the knot's side (his / her left = +1, right = -1, 0 = front centre) and its tails. NO numbers but the side. */
export interface ScarfStyle { tag: string; wrap: 'thick' | 'thin' | 'cowl'; knot: Side; tails: readonly { kind: 'stub' | 'tail' | 'long'; from: 'knot' | 'back' }[] }
export const SCARF_STYLES: readonly ScarfStyle[] = [
  { tag: 'A-M', wrap: 'thick', knot: 1, tails: [{ kind: 'stub', from: 'knot' }, { kind: 'stub', from: 'knot' }] },
  { tag: 'A-F', wrap: 'thin', knot: 1, tails: [{ kind: 'tail', from: 'knot' }, { kind: 'long', from: 'back' }] },
  { tag: 'B-M', wrap: 'thick', knot: -1, tails: [{ kind: 'stub', from: 'knot' }] },
  { tag: 'B-F', wrap: 'cowl', knot: 0, tails: [{ kind: 'tail', from: 'back' }, { kind: 'long', from: 'back' }] },
  { tag: 'C-M', wrap: 'cowl', knot: 1, tails: [{ kind: 'stub', from: 'knot' }] },
  { tag: 'C-F', wrap: 'thin', knot: -1, tails: [{ kind: 'tail', from: 'knot' }, { kind: 'long', from: 'knot' }] },
]
/** a belt: buckle kind, strap kind and whether it sags (to HER RIGHT hip, BELT.sagSide, the sheet's side, on every belt). */
export interface BeltStyle { tag: string; buckle: 'square' | 'ring' | 'tied' | 'oval' | 'round'; strap: 'one' | 'wide' | 'two'; sag: 0 | 1 }
export const BELT_STYLES: readonly BeltStyle[] = [
  { tag: 'level', buckle: 'square', strap: 'one', sag: 0 },
  { tag: 'ring', buckle: 'ring', strap: 'wide', sag: 0 },
  { tag: 'tied', buckle: 'tied', strap: 'one', sag: 1 },
  { tag: 'sag', buckle: 'oval', strap: 'one', sag: 1 },
  { tag: 'sag-two', buckle: 'round', strap: 'two', sag: 1 },
]

/** ★ every scarf size and place, ONCE (m, before the Scarf dial; R = the ring's radius at Torso width 1). */
export const SCARF = { ring: 0.17, drop: 0.03, rise: 0.16, thick: 0.45, thin: 0.3, cowl: 0.55, knot: 0.055, knotAt: 0.85,
  stub: 0.13, tail: 0.36, long: 0.5, tailW: 0.08, tailT: 0.032, backZ: 1.05, backX: 0.05 } as const
/** ★ every belt size and place, ONCE (m, before the Belt dial; `at` = the hip line as a share of the torso's height). */
export const BELT = { at: 0.24, over: 1.07, strap: 0.032, wide: 1.6, tube: 0.12, gap: 0.055, sag: 0.16, sagTwo: 1.7, sagSide: -1,
  buckle: 0.034, pouch: [0.06, 0.07, 0.035], pouchAt: 1.25, loop: 0.024, loopAt: 1.25, hang: 0.05 } as const

const GEOS = new Map<string, THREE.BufferGeometry>()
const cached = (k: string, f: () => THREE.BufferGeometry) => { let g = GEOS.get(k); if (!g) { g = f(); GEOS.set(k, g) } return g }
/** a torso shape's lathe (unit outline x TORSO_R; the mesh's scale = the dials) */
export const torsoGeo = (i: number) => cached(`torso${i}`, () => new THREE.LatheGeometry((TORSO_SHAPES[i] ?? TORSO_SHAPES[0]).prof.map(([r, y]) => new THREE.Vector2(r * TORSO_R, y)), 24))
/** the unit outline's radius at height share y (0..1), for a part that rides the torso's surface (the belt) */
export function torsoRadius(i: number, y: number) {
  const pr = (TORSO_SHAPES[i] ?? TORSO_SHAPES[0]).prof, t = Math.min(1, Math.max(0, y))
  for (let k = 1; k < pr.length; k++) if (t <= pr[k][1]) { const [r0, y0] = pr[k - 1], [r1, y1] = pr[k]; return r0 + (r1 - r0) * ((t - y0) / (y1 - y0 || 1)) }
  return pr[pr.length - 1][0]
}
const ring = (tube: number) => cached(`ring${tube}`, () => new THREE.TorusGeometry(1, tube, 10, 24))

type Put = (g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: [number, number, number], scale: [number, number, number], rot?: [number, number, number] | null) => unknown
const SPH = new THREE.SphereGeometry(1, 14, 10), BOX = new THREE.BoxGeometry(1, 1, 1)

/** the scarf, into the body group: ring at the torso's top, the knot on its side, the tails. Sized by tw (torso width) x sf. */
export function drawScarf(body: THREE.Object3D, put: Put, i: number, color: string, topY: number, tw: number, sf: number) {
  const st = SCARF_STYLES[i] ?? SCARF_STYLES[0], R = SCARF.ring * tw * sf, y = topY - SCARF.drop
  put(body, ring(st.wrap === 'thin' ? SCARF.thin : SCARF.thick), color, [0, y, 0], [R, R, SCARF.rise * sf], [Math.PI / 2, 0, 0])
  if (st.wrap === 'cowl') put(body, ring(SCARF.thin), color, [0, y + SCARF.rise * sf * 0.45, 0], [R * SCARF.knotAt, R * SCARF.knotAt, SCARF.rise * sf * 0.8], [Math.PI / 2, 0, 0])
  const a = st.knot * 0.9, kx = Math.sin(a) * R * 1.2, kz = Math.cos(a) * R * 1.2, ky = y - SCARF.rise * sf * 0.3
  put(body, SPH, color, [kx, ky, kz], [SCARF.knot * sf, SCARF.knot * sf, SCARF.knot * sf * 0.8])
  let nb = 0, nk = 0
  for (const t of st.tails) {
    const len = SCARF[t.kind] * sf
    if (t.from === 'knot') {   // hangs from the knot, fanned a little outward per tail
      const fan = (nk++ - (st.tails.filter(u => u.from === 'knot').length - 1) / 2) * 0.35 + st.knot * 0.15
      put(body, BOX, color, [kx + Math.sin(fan) * len * 0.5, ky - len * 0.5, kz + SCARF.tailT * sf], [SCARF.tailW * sf, len, SCARF.tailT * sf], [0.1, 0, fan])
    } else {                   // trails down the back, side by side
      const x = (nb++ ? 1 : -1) * SCARF.backX * tw * sf
      put(body, BOX, color, [x, y - len * 0.5, -R * SCARF.backZ], [SCARF.tailW * sf, len, SCARF.tailT * sf], [-0.12, 0, x > 0 ? 0.06 : -0.06])
    }
  }
}

/** the belt, into the body group: a ring on the torso's surface at the Belt height dial, the buckle at the front, the seed
 *  pouch on the right hip, the tool loop on the left; a sagging belt tilts down to her right. */
export function drawBelt(body: THREE.Object3D, put: Put, torso: number, i: number, color: string, base: number, TB: number, xs: number, zs: number, p: Proportions) {
  const st = BELT_STYLES[i] ?? BELT_STYLES[0], bs = p.belt, yShare = BELT.at + p.beltY / TB
  const u = torsoRadius(torso, yShare) * TORSO_R, xr = u * xs * BELT.over, zr = u * zs * BELT.over
  const grp = new THREE.Group(); grp.name = 'belt'; grp.position.set(0, base + TB * BELT.at + p.beltY, 0)
  grp.rotation.z = st.sag ? -BELT.sagSide * BELT.sag : 0; body.add(grp)
  const h = BELT.strap * bs * (st.strap === 'wide' ? BELT.wide : 1), metal = '#d9a441', pouch = '#' + new THREE.Color(color).lerp(new THREE.Color('#c9a06a'), 0.55).getHexString()
  put(grp, ring(BELT.tube), color, [0, 0, 0], [xr, zr, h * 2.4], [Math.PI / 2, 0, 0])
  if (st.strap === 'two') {   // a second strap below, sagging further
    const g2 = new THREE.Group(); g2.position.set(0, -BELT.gap * bs, 0); g2.rotation.z = -BELT.sagSide * BELT.sag * (BELT.sagTwo - 1); grp.add(g2)
    put(g2, ring(BELT.tube), color, [0, 0, 0], [xr, zr, h * 2], [Math.PI / 2, 0, 0])
  }
  const fz = zr * (1 + BELT.tube) + 0.004, b = BELT.buckle * bs
  if (st.buckle === 'square') put(grp, BOX, metal, [0, 0, fz], [b * 1.5, b * 1.3, b * 0.35])
  else if (st.buckle === 'tied') { put(grp, SPH, color, [b * 1.2, 0, fz], [b * 0.8, b * 0.8, b * 0.6]); put(grp, BOX, color, [b * 1.6, -b * 1.6, fz], [b * 0.7, b * 2.6, b * 0.3], [0, 0, 0.25]) }
  else put(grp, ring(0.28), metal, [0, 0, fz], [b * (st.buckle === 'oval' ? 1.3 : 1), b, b * 0.6])
  const [pw, ph, pd] = BELT.pouch, pa = BELT.sagSide * BELT.pouchAt, la = -BELT.sagSide * BELT.loopAt, hang = BELT.hang * bs
  put(grp, BOX, pouch, [Math.sin(pa) * xr * 1.02, -hang, Math.cos(pa) * zr * 1.02], [pw * bs, ph * bs, pd * bs], [0, pa, 0])
  put(grp, ring(0.3), color, [Math.sin(la) * xr * 1.02, -hang * 0.8, Math.cos(la) * zr * 1.02], [BELT.loop * bs, BELT.loop * bs * 1.4, BELT.loop * bs], [0, la + Math.PI / 2, 0])
}
