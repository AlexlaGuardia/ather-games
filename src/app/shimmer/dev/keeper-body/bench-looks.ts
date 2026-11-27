// THE BODY BENCH'S TRY-ON OPTIONS (BETA M116c, Alex 11-23: "Let's add it to the char dev tool for me to mess with later").
// The M116b option sheet (docs/looks/keeper-heads-2026-11-23/mouths-and-torso.png, protos heads.ts drawMouth + torso.ts)
// ported for the owner bench ONLY: 5 mouths (M1-M5) and 3 female (Curved) torso shapes (T1-T3), plus the live face sets.
// ★ BENCH ONLY: nothing in the game imports this file. A keeper in the game, the creator or the doll never sees these options;
//   buildKeeper is untouched except that it tags its Mouth-row meshes (userData.mouth) so the bench can swap them.
// The bench's choice per model is saved to data/keeper-bench.json (runtime, gitignored) by /shimmer/save-keeper-bench.
import * as THREE from 'three'
import { buildKeeper, type KeeperBody } from '../../open/shared/keeper-figure'
import { surf, type HeadShape } from '../../open/shared/keeper-faces'
import { CARTOON } from '../../open/shared/keeper-heads'
import { OPT, type Look } from '../../open/shared/keeper-look'
import { MODELS, type Proportions } from '../../open/shared/keeper-proportions'
import { TORSO_STARTS } from '../../open/shared/keeper-bodies'
import { BELT_FOR_TORSO } from '../../open/shared/keeper-look'

/** index 0 = today (the look's own Mouth row); 1-5 = the sheet's mouths 1-5 */
export const BENCH_MOUTHS = ['Today', '1 Neutral line', '2 Slight smile', '3 Soft full lips', '4 Smirk', '5 Closed calm'] as const
/** M216 s2b: the bench's Torso picker = the six LOCKED torso shapes (keeper-bodies.ts), which replace the M116b T1-T3
 *  try-on (Curved only). Picking one COPIES its starting dials onto the sliders (TORSO_STARTS); the build lays nothing over. */
export const BENCH_TORSOS = OPT.torso
/** M216 s2a: the cartoon heads' STARTING dials, copied onto the sliders when a head is picked, exactly like a torso option:
 *  the head itself bakes none of them (keeper-heads.ts), the sliders stay the only source. Index = Look.head (0 = Classic).
 *  M225 (Alex 11-27 "id like the head to follow classics shape with the 0 on the chin taper"): every cartoon head now
 *  starts on the CLASSIC head (chin taper 0, chin length 0 = the plain round head); only the mouth's start height differs
 *  by letter. The sheet's jaws (A oval, B V, C square, D heart; M216 s2a starts 0.12-0.8) are his to dial in himself. */
const CLASSIC_SHAPE = { jaw: 0, chin: 0 } as const
export const HEAD_STARTS: readonly Partial<Proportions>[] = [
  {},
  { ...CLASSIC_SHAPE, mouthLift: 0.012 }, { ...CLASSIC_SHAPE, mouthLift: 0.012 },
  { ...CLASSIC_SHAPE, mouthLift: 0 }, { ...CLASSIC_SHAPE, mouthLift: 0 },
  { ...CLASSIC_SHAPE, mouthLift: 0.012 }, { ...CLASSIC_SHAPE, mouthLift: 0.012 },
  { ...CLASSIC_SHAPE, mouthLift: -0.008 }, { ...CLASSIC_SHAPE, mouthLift: -0.008 },
]
export const pickHead = (p: Proportions, h: number): Proportions => ({ ...p, ...(HEAD_STARTS[h] ?? {}) })

/** M216 s2b: torso / scarf / belt = Look.torso / scarfStyle / belt (the locked body set) */
export interface BenchLook { face: number; mouth: number; torso: number; head: number; scarf: number; belt: number }
export const isCurved = (model: string) => model.endsWith('-curved')
/** a model's own starting pick: a Broad model wears A male (torso, scarf, belt), a Curved one A female */
export const defaultBench = (model: string): BenchLook => { const t = isCurved(model) ? 1 : 0; return { face: 0, mouth: 0, torso: t, head: 0, scarf: t, belt: BELT_FOR_TORSO[t] } }
export const DEFAULT_BENCH: BenchLook = defaultBench('medium-broad')
const idx = (v: unknown, n: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : 0
/** one model's bench choice, clamped; a missing / bad torso, scarf or belt takes the model's own (defaultBench). A file from
 *  before s2b (torso = a T1-T3 try-on, no scarf / belt) lands on the model's default body: the T options are retired. */
export function parseBench(model: string, raw: unknown): BenchLook {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, d = defaultBench(model)
  const s2b = o.scarf !== undefined || o.belt !== undefined
  const pick = (v: unknown, n: number, def: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : def
  return { face: idx(o.face, OPT.face.length), mouth: idx(o.mouth, BENCH_MOUTHS.length), torso: s2b ? pick(o.torso, OPT.torso.length, d.torso) : d.torso, head: idx(o.head, OPT.head.length),
    scarf: pick(o.scarf, OPT.scarfStyle.length, d.scarf), belt: pick(o.belt, OPT.belt.length, d.belt) }
}
export function parseBenchFile(raw: unknown): Record<string, BenchLook> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(MODELS.map(m => [m, parseBench(m, o[m])]))
}
export const sameBench = (a: BenchLook, b: BenchLook) => a.face === b.face && a.mouth === b.mouth && a.torso === b.torso && a.head === b.head && a.scarf === b.scarf && a.belt === b.belt
export const isDefaultBench = (b: BenchLook, model = 'medium-broad') => sameBench(b, defaultBench(model))
/** M216 one source: picking a torso option COPIES its starting dials onto the sliders (they stay the only source, and the
 *  owner moves them freely after); the build itself never lays anything over the sliders. Today (0) leaves them alone. */
export const pickTorso = (p: Proportions, t: number): Proportions => ({ ...p, ...(TORSO_STARTS[t] ?? {}) })

// ── geometry (copied from the protos; cached) ──
const STRIPS = new Map<string, THREE.BufferGeometry>()
function strip(w: number, th: number, arch: number) {
  const key = `${w}|${th}|${arch}`, hit = STRIPS.get(key); if (hit) return hit
  const sh = new THREE.Shape(), n = 10, pts: [number, number][] = []
  for (let i = 0; i <= n; i++) { const u = i / n; pts.push([(u - 0.5) * w, arch * w * (1 - (2 * u - 1) ** 2) * 0.5]) }
  const tw = (i: number) => th * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, (i / n) * 1.15)))
  pts.forEach(([x, y], i) => (i ? sh.lineTo(x, y + tw(i) * 0.5) : sh.moveTo(x, y + tw(i) * 0.5)))
  for (let i = n; i >= 0; i--) sh.lineTo(pts[i][0], pts[i][1] - tw(i) * 0.5)
  const g = new THREE.ShapeGeometry(sh); STRIPS.set(key, g); return g
}
const DISC = new THREE.CircleGeometry(1, 16), LIPS = new Map<number, THREE.BufferGeometry>()
const MATS = new Map<string, THREE.MeshBasicMaterial>()
const mat = (c: string) => { let m = MATS.get(c); if (!m) { m = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }); MATS.set(c, m) } return m }
const lipOf = (skin: string, k: number) => '#' + new THREE.Color(skin).lerp(new THREE.Color('#8a3a34'), k).getHexString()
/** mouth height per face (sheet FACES A-D mouthY); Classic sits where today's mouth does */
const MOUTH_Y = [-0.17, -0.2, -0.22, -0.21, -0.24]

/** Draw bench mouth `m` (1-5) on a head group centred at (0,0,0), head size H. Every mesh is tagged userData.mouth. */
export function drawBenchMouth(g: THREE.Object3D, m: number, H: number, f: HeadShape, skin: string, face: number, lift = 0, head = 0) {
  const my = H * (head > 0 ? CARTOON.mouthY : (MOUTH_Y[face] ?? MOUTH_Y[0])) + lift, mw = H * 0.1, LINE = '#4a2620'
  const decal = (geo: THREE.BufferGeometry, color: string, x: number, y: number, dz: number, rotZ = 0, sx = 1, sy = 1) => {
    const s = surf(H, f, x, y), me = new THREE.Mesh(geo, mat(color))
    me.position.set(x, y, s.z + H * dz); me.rotation.set(s.pitch, s.yaw, rotZ, 'YXZ'); me.scale.set(sx, sy, 1); me.userData.mouth = true; g.add(me)
  }
  if (m === 1) decal(strip(mw * 0.95, H * 0.017, -0.03), LINE, 0, my, 0.02)
  if (m === 2) { decal(strip(mw, H * 0.017, -0.22), LINE, 0, my, 0.02); for (const s of [-1, 1]) decal(strip(H * 0.022, H * 0.01, -0.5), LINE, s * mw * 0.55, my + H * 0.006, 0.02, s * 0.9) }
  if (m === 3) {   // a small closed mouth: an upper + fuller lower lip in a tint of the skin, an ink line between
    const up = new THREE.Shape(), w = mw * 0.55, h = H * 0.022
    up.moveTo(-w, 0); up.bezierCurveTo(-w * 0.6, h * 0.6, -w * 0.25, h * 1.1, 0, h * 0.7); up.bezierCurveTo(w * 0.25, h * 1.1, w * 0.6, h * 0.6, w, 0); up.lineTo(-w, 0)
    decal(LIPS.get(H) ?? (LIPS.set(H, new THREE.ShapeGeometry(up, 8)), LIPS.get(H)!), lipOf(skin, 0.45), 0, my, 0.018)
    decal(DISC, lipOf(skin, 0.35), 0, my - H * 0.016, 0.018, 0, w * 0.8, H * 0.017)
    decal(strip(w * 2.05, H * 0.011, -0.06), LINE, 0, my, 0.022)
  }
  if (m === 4) { decal(strip(mw * 0.9, H * 0.017, -0.12), LINE, H * 0.006, my, 0.02, 0.14); decal(strip(H * 0.026, H * 0.01, -0.5), LINE, mw * 0.5, my + H * 0.014, 0.02, 0.9) }
  if (m === 5) { decal(strip(mw * 0.7, H * 0.014, -0.1), LINE, 0, my, 0.02); decal(strip(mw * 0.42, H * 0.012, -0.25), lipOf(skin, 0.3), 0, my - H * 0.03, 0.018) }
}

/** The bench's keeper: buildKeeper with the face set / head / torso / scarf / belt picks, then the bench mouth swapped in. */
export function benchKeeper(look: Look, p: Proportions, b: BenchLook): KeeperBody {
  const o: Look = { ...look, face: b.face, head: b.head, torso: b.torso, scarfStyle: b.scarf, belt: b.belt }, k = buildKeeper(o, p)
  if (b.mouth > 0) {
    const head = k.group.getObjectByName('head')!
    for (const c of head.children.filter(c => c.userData.mouth)) head.remove(c)   // a cartoon head's 'mouth' group too
    const r = (v: number) => Math.round(v * 100) / 100   // the head geometry's own rounding, so the mouth sits on it
    drawBenchMouth(head, b.mouth, 0.5 * 1.15, { jaw: r(p.jaw), chin: r(p.chin) }, OPT.skin[o.skin], b.face, p.mouthLift, b.head)
  }
  return k
}
