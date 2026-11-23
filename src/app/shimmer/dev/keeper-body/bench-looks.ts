// THE BODY BENCH'S TRY-ON OPTIONS (BETA M116c, Alex 11-23: "Let's add it to the char dev tool for me to mess with later").
// The M116b option sheet (docs/looks/keeper-heads-2026-11-23/mouths-and-torso.png, protos heads.ts drawMouth + torso.ts)
// ported for the owner bench ONLY: 5 mouths (M1-M5) and 3 female (Curved) torso shapes (T1-T3), plus the live face sets.
// ★ BENCH ONLY: nothing in the game imports this file. A keeper in the game, the creator or the doll never sees these options;
//   buildKeeper is untouched except that it tags its Mouth-row meshes (userData.mouth) so the bench can swap them.
// The bench's choice per model is saved to data/keeper-bench.json (runtime, gitignored) by /shimmer/save-keeper-bench.
import * as THREE from 'three'
import { buildKeeper, type KeeperBody } from '../../open/shared/keeper-figure'
import { faceSet } from '../../open/shared/keeper-faces'
import { OPT, type Look } from '../../open/shared/keeper-look'
import { MODELS, type Proportions } from '../../open/shared/keeper-proportions'

/** index 0 = today (the look's own Mouth row); 1-5 = the sheet's mouths 1-5 */
export const BENCH_MOUTHS = ['Today', '1 Neutral line', '2 Slight smile', '3 Soft full lips', '4 Smirk', '5 Closed calm'] as const
type Prof = [number, number][]
export interface TorsoOpt { label: string; prof: Prof | null; dials: Partial<Proportions>; side?: { chest: number; hip: number; belly: number } }
/** index 0 = today's Curved lathe; 1-3 = the sheet's T1-T3 (numbers copied from torso.ts). Curved models only. */
export const BENCH_TORSOS: readonly TorsoOpt[] = [
  { label: 'Today', prof: null, dials: {} },
  { label: 'T1 Defined waist', prof: [[0, 0], [0.08, 0.03], [0.16, 0.15], [0.19, 0.3], [0.138, 0.52], [0.18, 0.7], [0.2, 0.86], [0.1, 1]], dials: { torsoL: 1.0 } },
  { label: 'T2 Tall slim', prof: [[0, 0], [0.06, 0.03], [0.12, 0.14], [0.16, 0.3], [0.132, 0.5], [0.18, 0.7], [0.215, 0.87], [0.1, 1]], dials: { torsoL: 1.08, torsoW: 0.92, handY: -0.03 } },
  { label: 'T3 Shaped mesh', prof: [[0, 0], [0.08, 0.03], [0.16, 0.15], [0.19, 0.3], [0.138, 0.52], [0.18, 0.7], [0.2, 0.86], [0.1, 1]], dials: { torsoL: 1.0 }, side: { chest: 0.24, hip: 0.16, belly: 0.12 } },
]

export interface BenchLook { face: number; mouth: number; torso: number }
export const DEFAULT_BENCH: BenchLook = { face: 0, mouth: 0, torso: 0 }
export const isCurved = (model: string) => model.endsWith('-curved')
const idx = (v: unknown, n: number) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : 0
/** one model's bench choice, clamped; a Broad model never has a torso option */
export function parseBench(model: string, raw: unknown): BenchLook {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { face: idx(o.face, OPT.face.length), mouth: idx(o.mouth, BENCH_MOUTHS.length), torso: isCurved(model) ? idx(o.torso, BENCH_TORSOS.length) : 0 }
}
export function parseBenchFile(raw: unknown): Record<string, BenchLook> {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(MODELS.map(m => [m, parseBench(m, o[m])]))
}
export const sameBench = (a: BenchLook, b: BenchLook) => a.face === b.face && a.mouth === b.mouth && a.torso === b.torso
export const isDefaultBench = (b: BenchLook) => sameBench(b, DEFAULT_BENCH)
/** the dials the bench builds with: the sliders, with a torso option's own dials laid over them */
export const benchDials = (p: Proportions, b: BenchLook): Proportions => ({ ...p, ...(BENCH_TORSOS[b.torso]?.dials ?? {}) })

// ── geometry (copied from the protos; cached) ──
const LATHES = new Map<number, THREE.BufferGeometry>()
export function torsoGeo(i: number): THREE.BufferGeometry | null {
  const o = BENCH_TORSOS[i]; if (!o?.prof) return null
  let g = LATHES.get(i)
  if (!g) {
    g = new THREE.LatheGeometry(o.prof.map(([r, y]) => new THREE.Vector2(r, y)), 24)
    if (o.side) {   // T3: bend the round lathe front / back (chest forward, flat belly, hips back)
      const pos = g.attributes.position, gs = (y: number, c: number, w: number) => Math.exp(-(((y - c) / w) ** 2))
      for (let k = 0; k < pos.count; k++) {
        const y = pos.getY(k), z = pos.getZ(k)
        pos.setZ(k, z * (z > 0 ? 1 + o.side.chest * gs(y, 0.64, 0.12) - o.side.belly * gs(y, 0.36, 0.1) : 1 + o.side.hip * gs(y, 0.24, 0.12)))
      }
      g.computeVertexNormals()
    }
    LATHES.set(i, g)
  }
  return g
}
interface Surf { jaw: number; chin: number }
function surf(H: number, f: Surf, x: number, y: number) {
  const rx = H * 0.5, ry = H * 0.55
  let yn = y / ry, fx = 1, fz = 1
  if (yn < 0) { yn = y / (ry * (1 + f.jaw * 0.1 + f.chin)); const t = -yn; fx = 1 - f.jaw * 0.42 * Math.pow(t, 1.4); fz = 1 - f.jaw * 0.22 * Math.pow(t, 1.4) }
  const xn = x / (rx * fx), zn = Math.sqrt(Math.max(0.02, 1 - xn * xn - yn * yn))
  return { z: zn * rx * fz, yaw: Math.atan2(xn, zn) * 0.9, pitch: -Math.atan2(yn, zn) * 0.5 }
}
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
export function drawBenchMouth(g: THREE.Object3D, m: number, H: number, f: Surf, skin: string, face: number) {
  const my = H * (MOUTH_Y[face] ?? MOUTH_Y[0]), mw = H * 0.1, LINE = '#4a2620'
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

/** The bench's keeper: buildKeeper with the face set, then the torso option's lathe and the bench mouth swapped in. */
export function benchKeeper(look: Look, p: Proportions, b: BenchLook): KeeperBody {
  const o: Look = { ...look, face: b.face }, k = buildKeeper(o, benchDials(p, b))
  const geo = look.torso === 1 ? torsoGeo(b.torso) : null
  if (geo) { const body = k.group.getObjectByName('body')!; for (const m of body.children.slice(0, 2) as THREE.Mesh[]) m.geometry = geo }
  if (b.mouth > 0) {
    const head = k.group.getObjectByName('head')!
    for (const c of head.children.filter(c => c.userData.mouth)) head.remove(c)
    const fs = faceSet(b.face), d = benchDials(p, b)
    drawBenchMouth(head, b.mouth, 0.5 * 1.15, fs ? { jaw: fs.jaw, chin: fs.chin } : { jaw: Math.round(d.jaw * 100) / 100, chin: 0 }, OPT.skin[o.skin], b.face)
  }
  return k
}
