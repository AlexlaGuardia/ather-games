'use client'
// The Passage market, drawn (cavern.ts is the plan). Floor, domed roof and walls come off the 0.75 m mask, lit by the
// lanterns BAKED into the vertex colours: MeshBasic, so the sun (which never reaches in here) lights nothing. The props
// are placeholder geometry in the town's register: a gem table reads as a gem table, nothing more is claimed.

import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { CAVE_CELL, type Cavern, type CaveProp } from './cavern'
import { TUNNEL_WALK, type Region } from './region'

const ROCK = new THREE.Color('#9a7f63'), FLOOR = new THREE.Color('#8a7356'), WARM = new THREE.Color('#ffcf8a')
const GEM_COLS = ['#7fe3ff', '#ff8fb8', '#b3ff8a', '#ffd86b', '#c9a2ff']

function lit(out: THREE.Color, base: THREE.Color, l: number) {
  // warm light: the lit stone shifts toward lantern-gold as well as brightening
  out.copy(base).multiplyScalar(0.35 + l * 0.75).lerp(WARM, Math.min(0.35, l * 0.22))
  return out
}

function caveGeometry(c: Cavern, inBore: (x: number, z: number) => boolean) {
  const pos: number[] = [], col: number[] = []
  const { nx, nz, x0, z0, mask, roof, y } = c
  const cc = new THREE.Color()
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < nx && j < nz ? j * nx + i : -1)
  const m = (i: number, j: number) => { const k = at(i, j); return k >= 0 && mask[k] === 1 }
  // roof height at a cell CORNER: the mean of the carved cells around it (a smooth dome, no stair-steps)
  const corner = (i: number, j: number) => {
    let s = 0, n = 0
    for (const [a, b] of [[i - 1, j - 1], [i, j - 1], [i - 1, j], [i, j]]) { const k = at(a, b); if (k >= 0 && mask[k]) { s += roof[k]; n++ } }
    return n ? s / n : 4.2
  }
  const X = (i: number) => x0 + i * CAVE_CELL, Z = (j: number) => z0 + j * CAVE_CELL
  const vert = (x: number, yy: number, z: number, base: THREE.Color) => { pos.push(x, yy, z); lit(cc, base, c.lightAt(x, yy, z)); col.push(cc.r, cc.g, cc.b) }
  const quad = (a: number[], b: number[], d: number[], e: number[], base: THREE.Color) => {
    for (const p of [a, b, d, a, d, e]) vert(p[0], p[1], p[2], base)
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    if (!m(i, j)) continue
    const xa = X(i), xb = X(i + 1), za = Z(j), zb = Z(j + 1)
    const open = inBore((xa + xb) / 2, (za + zb) / 2)            // the walkway in front of the door: the bore draws it
    if (!open) quad([xa, y + 0.01, za], [xb, y + 0.01, za], [xb, y + 0.01, zb], [xa, y + 0.01, zb], FLOOR)
    const h00 = corner(i, j), h10 = corner(i + 1, j), h11 = corner(i + 1, j + 1), h01 = corner(i, j + 1)
    if (!open) quad([xa, y + h00, za], [xa, y + h01, zb], [xb, y + h11, zb], [xb, y + h10, za], ROCK)
    // walls on every edge that faces uncarved rock (never on one that faces the bore: that is the door)
    const edge = (di: number, dj: number, a: number[], b: number[], ha: number, hb: number) => {
      if (m(i + di, j + dj)) return
      const nxp = (xa + xb) / 2 + di * CAVE_CELL, nzp = (za + zb) / 2 + dj * CAVE_CELL
      if (inBore(nxp, nzp) || open) return
      quad([a[0], y, a[1]], [b[0], y, b[1]], [b[0], y + hb, b[1]], [a[0], y + ha, a[1]], ROCK)
    }
    edge(0, -1, [xa, za], [xb, za], h00, h10)
    edge(0, 1, [xb, zb], [xa, zb], h11, h01)
    edge(-1, 0, [xa, zb], [xa, za], h01, h00)
    edge(1, 0, [xb, za], [xb, zb], h10, h11)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeBoundingSphere()
  return g
}

/** Props as instanced boxes per kind: each kind is a list of (offset, size, colour) parts in the prop's own frame. */
type Part = { o: [number, number, number]; s: [number, number, number]; col: string; glow?: boolean }
const PARTS: Record<CaveProp['kind'], Part[]> = {
  stall: [
    { o: [0, 0.45, 0], s: [2.4, 0.9, 1.1], col: '#7a5636' },
    { o: [-1.1, 1.25, -0.45], s: [0.1, 2.5, 0.1], col: '#5d4128' }, { o: [1.1, 1.25, -0.45], s: [0.1, 2.5, 0.1], col: '#5d4128' },
    { o: [0, 2.55, -0.1], s: [2.7, 0.08, 1.6], col: '#b5533c' },
    { o: [-0.6, 1.0, 0.1], s: [0.5, 0.2, 0.4], col: '#d9c49a' }, { o: [0.5, 1.0, 0], s: [0.6, 0.25, 0.5], col: '#a3b07a' },
  ],
  gems: [
    { o: [0, 0.4, 0], s: [1.8, 0.8, 1.0], col: '#6b4a30' }, { o: [0, 0.82, 0], s: [1.9, 0.04, 1.1], col: '#3d2b4f' },
    { o: [-0.55, 0.92, -0.2], s: [0.16, 0.16, 0.16], col: GEM_COLS[0], glow: true }, { o: [-0.15, 0.92, 0.2], s: [0.14, 0.14, 0.14], col: GEM_COLS[1], glow: true },
    { o: [0.25, 0.92, -0.15], s: [0.16, 0.16, 0.16], col: GEM_COLS[2], glow: true }, { o: [0.6, 0.92, 0.2], s: [0.14, 0.14, 0.14], col: GEM_COLS[3], glow: true },
    { o: [0.1, 0.92, 0.05], s: [0.12, 0.12, 0.12], col: GEM_COLS[4], glow: true },
  ],
  scrolls: [
    { o: [0, 1.1, 0], s: [1.6, 2.2, 0.5], col: '#5d4128' },
    { o: [0, 0.6, 0.05], s: [1.4, 0.3, 0.42], col: '#e8dcbc' }, { o: [0, 1.2, 0.05], s: [1.4, 0.3, 0.42], col: '#e2d2ab' }, { o: [0, 1.8, 0.05], s: [1.4, 0.3, 0.42], col: '#ecdfc4' },
  ],
  vessels: [
    { o: [0, 0.45, 0], s: [2.0, 0.9, 1.0], col: '#7a5636' },
    { o: [-0.5, 1.0, 0], s: [0.3, 0.2, 0.3], col: '#c9a86b' }, { o: [0.1, 1.0, 0.1], s: [0.4, 0.12, 0.4], col: '#8fd6c4', glow: true }, { o: [0.6, 1.0, -0.1], s: [0.3, 0.2, 0.3], col: '#c9a86b' },
  ],
  mat: [{ o: [0, 0.03, 0], s: [1.6, 0.06, 1.6], col: '#8c3b3b' }, { o: [0, 0.2, -0.6], s: [0.5, 0.3, 0.3], col: '#c9a86b' }],
  cabinet: [
    { o: [0, 0.95, 0], s: [0.9, 1.9, 0.8], col: '#2d2440' },
    { o: [0, 1.35, 0.41], s: [0.66, 0.5, 0.02], col: '#7fe3ff', glow: true }, { o: [0, 0.95, 0.42], s: [0.7, 0.08, 0.2], col: '#ff8fb8', glow: true },
  ],
  wagon: [
    { o: [0, 1.0, 0], s: [2.2, 1.0, 4.2], col: '#7a5636' }, { o: [0, 2.2, 0], s: [2.4, 1.4, 4.0], col: '#d9c9a3' },
    { o: [-1.15, 0.5, 1.4], s: [0.15, 1.0, 1.0], col: '#4a3422' }, { o: [1.15, 0.5, 1.4], s: [0.15, 1.0, 1.0], col: '#4a3422' },
    { o: [-1.15, 0.5, -1.4], s: [0.15, 1.0, 1.0], col: '#4a3422' }, { o: [1.15, 0.5, -1.4], s: [0.15, 1.0, 1.0], col: '#4a3422' },
  ],
  pen: [
    { o: [0, 0.5, -1.5], s: [3, 0.1, 0.1], col: '#6b4f33' }, { o: [0, 0.5, 1.5], s: [3, 0.1, 0.1], col: '#6b4f33' },
    { o: [-1.5, 0.5, 0], s: [0.1, 0.1, 3], col: '#6b4f33' }, { o: [1.5, 0.5, 0], s: [0.1, 0.1, 3], col: '#6b4f33' },
    { o: [0, 0.15, 0], s: [2.6, 0.3, 2.6], col: '#c9b26a' },
  ],
  lantern: [{ o: [0, 0, 0], s: [0.32, 0.42, 0.32], col: '#ffcf8a', glow: true }],
  grate: [
    { o: [-0.9, 1.4, 0], s: [0.12, 2.8, 0.12], col: '#3a3a3a' }, { o: [-0.3, 1.4, 0], s: [0.12, 2.8, 0.12], col: '#3a3a3a' },
    { o: [0.3, 1.4, 0], s: [0.12, 2.8, 0.12], col: '#3a3a3a' }, { o: [0.9, 1.4, 0], s: [0.12, 2.8, 0.12], col: '#3a3a3a' },
    { o: [0, 2.2, 0], s: [2.2, 0.12, 0.12], col: '#3a3a3a' }, { o: [0, 0.8, 0], s: [2.2, 0.12, 0.12], col: '#3a3a3a' },
  ],
  bollard: [{ o: [0, 0.5, 0], s: [0.35, 1.0, 0.35], col: '#8f8a80' }, { o: [0, 1.02, 0], s: [0.4, 0.06, 0.4], col: '#ffcf8a', glow: true }],
}

export function CavernView({ cave, R }: { cave: Cavern; R: Region }) {
  const built = useMemo(() => {
    // inside the bore's lining (its walkway in front of the door included) the bore draws the floor and roof
    const hw = cave.tunnel.width / 2 + TUNNEL_WALK
    const inBore = (x: number, z: number) => { const t = R.tunnelAt(x, z); return !!t && Math.abs(t.off) < hw }
    const geo = caveGeometry(cave, inBore)
    // props: one merged geometry, vertex colours baked (glow parts unlit-bright, the rest lantern-lit)
    const pos: number[] = [], col: number[] = []
    const cc = new THREE.Color(), box = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), bp = box.getAttribute('position')
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler()
    for (const p of cave.props) {
      const lift = p.kind === 'lantern' ? (cave.lanterns.find(l => Math.hypot(l[0] - p.x, l[2] - p.z) < 0.01)?.[1] ?? cave.y + 3) - cave.y : 0
      for (const part of PARTS[p.kind]) {
        q.setFromEuler(e.set(0, p.yaw, 0))
        const off = new THREE.Vector3(...part.o).applyQuaternion(q)
        m.compose(v.set(p.x + off.x, cave.y + lift + off.y, p.z + off.z), q, sc.set(...part.s))
        const base = new THREE.Color(part.col)
        for (let k = 0; k < bp.count; k++) {
          const w = new THREE.Vector3(bp.getX(k), bp.getY(k), bp.getZ(k)).applyMatrix4(m)
          pos.push(w.x, w.y, w.z)
          if (part.glow) cc.copy(base).multiplyScalar(1.15)
          else cc.copy(base).multiplyScalar(0.35 + cave.lightAt(w.x, w.y, w.z) * 0.8).lerp(WARM, 0.08)
          col.push(cc.r, cc.g, cc.b)
        }
      }
    }
    box.dispose()
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    pg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    pg.computeBoundingSphere()
    return { geo, pg }
  }, [cave, R])
  useEffect(() => () => { built.geo.dispose(); built.pg.dispose() }, [built])
  return (
    <>
      <mesh geometry={built.geo}><meshBasicMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      <mesh geometry={built.pg}><meshBasicMaterial vertexColors /></mesh>
    </>
  )
}
