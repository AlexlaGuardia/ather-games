// M116b PROTO (not wired): female (Curved) torso options. The live body is buildKeeper() untouched; an option swaps the torso
// lathe (the same 'inverted egg' the game uses, EGG[1] = today's Curved) and, where the M103 dials reach, moves the dials.
// T3 also bends the lathe front/back (a lathe alone is round in plan, so it has no side profile).
import * as THREE from 'three'
import { buildKeeper } from '/root/ather-games/src/app/shimmer/open/shared/keeper-figure'
import type { Look } from '/root/ather-games/src/app/shimmer/open/shared/keeper-look'
import { proportionsFor, type Proportions } from '/root/ather-games/src/app/shimmer/open/shared/keeper-proportions'
import { UNIVERSAL, FACES, protoKeeper } from './heads'

type P = [number, number][]
export interface TorsoOpt { key: string; label: string; note: string; prof: P | null; dials: Partial<Proportions>; side?: { chest: number; hip: number; belly: number } }
const TODAY: P = [[0, 0], [0.16, 0.06], [0.2, 0.25], [0.17, 0.52], [0.19, 0.76], [0.18, 0.92], [0.09, 1]]
export const TORSOS: TorsoOpt[] = [
  { key: 'T0', label: 'TODAY  Curved', note: 'widest at the bottom, round belly: the child read', prof: null, dials: {} },
  { key: 'T1', label: 'T1  Defined waist', note: 'dials only + new lathe: hips and shoulders even, waist drawn in, tapers to the legs; torso length 0.88 -> 1.0',
    prof: [[0, 0], [0.08, 0.03], [0.16, 0.15], [0.19, 0.3], [0.138, 0.52], [0.18, 0.7], [0.2, 0.86], [0.1, 1]], dials: { torsoL: 1.0 } },
  { key: 'T2', label: 'T2  Tall slim', note: 'longer and narrower, shoulders wider than hips, slimmer waist; torso length 1.08, width 0.92, hands up',
    prof: [[0, 0], [0.06, 0.03], [0.12, 0.14], [0.16, 0.3], [0.132, 0.5], [0.18, 0.7], [0.215, 0.87], [0.1, 1]], dials: { torsoL: 1.08, torsoW: 0.92, handY: -0.03 } },
  { key: 'T3', label: 'T3  Shaped (mesh)', note: 'T1 plus a side profile: gentle chest forward, hips back, flat belly (a mesh change, not a dial)',
    prof: [[0, 0], [0.08, 0.03], [0.16, 0.15], [0.19, 0.3], [0.138, 0.52], [0.18, 0.7], [0.2, 0.86], [0.1, 1]], dials: { torsoL: 1.0 }, side: { chest: 0.24, hip: 0.16, belly: 0.12 } },
]
function lathe(o: TorsoOpt) {
  const g = new THREE.LatheGeometry(o.prof!.map(([r, y]) => new THREE.Vector2(r, y)), 24)
  if (o.side) {
    const pos = g.attributes.position, gs = (y: number, c: number, w: number) => Math.exp(-(((y - c) / w) ** 2))
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i), z = pos.getZ(i)
      const k = z > 0 ? 1 + o.side.chest * gs(y, 0.64, 0.12) - o.side.belly * gs(y, 0.36, 0.1) : 1 + o.side.hip * gs(y, 0.24, 0.12)
      pos.setZ(i, z * k)
    }
    g.computeVertexNormals()
  }
  return g
}
/** a keeper with torso option o (universal head + face A, so only the torso differs) */
export function torsoKeeper(look: Look, o: TorsoOpt): THREE.Group {
  if (!o.prof) return protoKeeper(look, FACES.A)
  const p = { ...proportionsFor(look), ...UNIVERSAL, jaw: FACES.A.jaw, ...o.dials }
  const k = protoKeeper(look, FACES.A, true, p)
  const body = k.getObjectByName('body')!, geo = lathe(o)
  for (const m of body.children.slice(0, 2) as THREE.Mesh[]) m.geometry = geo
  return k
}
export { buildKeeper }
