'use client'
// GARDEN CLUSTERS, DRAWN (Alex 11-15, his sketch + "modeled after the meadows biome with hills dividing them"). What
// cluster.ts / meadow.ts say is ground, made visible: the meadow in the Wilds' meadow palette (flat-shaded, biome
// tints, hills lighter toward their tops), dirt paths from every gate corner meeting in the shared square, a scatter
// of trees thickest on the ridges, the cluster's underside, and each mate's island turned so its corner faces the
// square (their squares held, the rest under their mist; read-only). Nothing here is a canon look (CANON_GAPS:
// clusters [OPEN]); placeholder forms, neutral, in the Ather's own palette.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PlotIsland } from './plot-scene'
import { MIDDLE_Y, type Frame } from './cluster'
import { MEADOW_CELL, type Meadow } from './meadow'
import { P } from './palette'
import { GROUND, pushLayer, useGroundMaterial } from './ground-look'
import { groundMat, groundOrder } from '../shared/ground-layers'
import { liftGeometry } from './glade-layer'
type Lift = (x: number, z: number) => number

const DIRT = new THREE.Color('#d9c79a'), DIRT_HI = new THREE.Color('#e6d6ad'), SQUARE = new THREE.Color('#b4d78c')

function meadowGeometry(m: Meadow): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], lay: number[] = [], C = MEADOW_CELL, n = m.n, cn = n - 1
  const c = new THREE.Color(), under = new THREE.Color(P.under)
  const v = (a: number, b: number) => [m.x0 + a * C, m.h[b * n + a], m.z0 + b * C] as const
  const isLand = (a: number, b: number) => a >= 0 && b >= 0 && a < cn && b < cn && m.land[b * cn + a] === 1
  for (let b = 0; b < cn; b++) for (let a = 0; a < cn; a++) {
    const k = b * cn + a
    if (!m.land[k]) continue
    const p00 = v(a, b), p10 = v(a + 1, b), p01 = v(a, b + 1), p11 = v(a + 1, b + 1)
    const y = (p00[1] + p10[1] + p01[1] + p11[1]) / 4
    for (const [t, tri] of ([[0, [p00, p11, p10]], [1, [p00, p01, p11]]] as const)) {
      const nse = ((a * 7 + b * 13 + t * 5) % 11) / 11
      if (m.kind[k] === 1) c.copy(DIRT).lerp(DIRT_HI, nse * 0.5)
      else if (m.kind[k] === 2) c.copy(SQUARE).lerp(P.grassHi, nse * 0.3)
      // BETA M52: an OPEN SPOT, mown and level where a mate's garden will land: lighter, even grass with a faint mow stripe
      else if (m.kind[k] === 3) c.copy(P.grass).lerp(P.grassHi, 0.45 + ((a + b) % 4 < 2 ? 0.08 : 0) + nse * 0.05)
      else c.copy(P.grass).lerp(P.grassHi, Math.min(1, Math.max(0, (y - 3) / 12)) * 0.8 + nse * 0.15).lerp(P.gold, ((a * 3 + b) % 17) / 17 * 0.14)
      for (const p of tri) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b) }
      // the tile: the path's dirt, and stone where a hillside is too steep to hold turf
      const e1x = tri[1][0] - tri[0][0], e1y = tri[1][1] - tri[0][1], e1z = tri[1][2] - tri[0][2], e2x = tri[2][0] - tri[0][0], e2y = tri[2][1] - tri[0][1], e2z = tri[2][2] - tri[0][2]
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x, up = Math.abs(ny) / (Math.hypot(nx, ny, nz) || 1)
      pushLayer(lay, m.kind[k] === 1 ? GROUND.path : up < 0.8 ? GROUND.stone : GROUND.grass, 3)
    }
    // the cluster's own edge: a skirt down into the cloud (only where the meadow meets the void, not an island)
    const edges: [number, number, readonly [number, number, number], readonly [number, number, number]][] = [
      [0, -1, p00, p10], [1, 0, p10, p11], [0, 1, p11, p01], [-1, 0, p01, p00],
    ]
    for (const [da, db, e0, e1] of edges) {
      const na = a + da, nb = b + db
      if (isLand(na, nb) || (na >= 0 && nb >= 0 && na < cn && nb < cn && m.island[nb * cn + na])) continue
      const quad = [e0, e1, [e1[0], e1[1] - 5, e1[2]], e0, [e1[0], e1[1] - 5, e1[2]], [e0[0], e0[1] - 5, e0[2]]] as const
      for (const p of quad) { pos.push(p[0], p[1], p[2]); col.push(under.r, under.g, under.b) }
      pushLayer(lay, GROUND.soil, 6)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aLayer', new THREE.Float32BufferAttribute(lay, 1))
  g.computeVertexNormals()
  return g
}

const CROWNS = { meadowCrowns: true }   // M160: the drawn-tree probe (moonwell-quest.tsx)
function MeadowTrees({ m, lift }: { m: Meadow; lift?: Lift | null }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!trunk.current || !crown.current) return   // no trees → rendered null → no refs
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    m.trees.forEach((t, k) => {
      const ty = t.y + (lift ? lift(t.x, t.z) : 0)
      p.set(t.x, ty + 1.4, t.z); s.set(1, 2.8, 1); trunk.current!.setMatrixAt(k, mtx.compose(p, q, s))
      p.set(t.x, ty + 2.4 + t.tall / 2, t.z); s.set(t.r, t.tall, t.r); crown.current!.setMatrixAt(k, mtx.compose(p, q, s))
      const no = m.treeNo?.[k] ?? k   // M160: a tree left out never retints the rest
      c.set('#79ad5a').offsetHSL(((no * 0.07) % 0.05) - 0.025, 0, ((no * 0.11) % 0.1) - 0.05)
      crown.current!.setColorAt(k, c)
    })
    trunk.current!.instanceMatrix.needsUpdate = true; crown.current!.instanceMatrix.needsUpdate = true
    if (crown.current!.instanceColor) crown.current!.instanceColor.needsUpdate = true
  }, [m, lift])
  if (m.trees.length === 0) return null
  // frustumCulled off: an InstancedMesh is culled by its base geometry's bounds at the origin
  return (
    <>
      <instancedMesh key={`t${m.trees.length}`} frustumCulled={false} ref={trunk} args={[undefined, undefined, m.trees.length]}>
        <cylinderGeometry args={[0.24, 0.32, 1, 6]} /><meshLambertMaterial color="#7a5c40" flatShading />
      </instancedMesh>
      <instancedMesh key={`c${m.trees.length}`} frustumCulled={false} ref={crown} userData={CROWNS} args={[undefined, undefined, m.trees.length]}>
        <coneGeometry args={[1, 1, 7]} /><meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  )
}

export function ClusterScene({ frame, lift, gate = true }: { frame: Frame; lift?: Lift | null; gate?: boolean }) {
  const m = frame.meadow
  // M83 s2b: lift = the Glade builder layer's delta (glade-layer.ts), null everywhere else
  const geo = useMemo(() => (m ? (lift ? liftGeometry(meadowGeometry(m), lift) : meadowGeometry(m)) : null), [m, lift])
  const ground = useGroundMaterial()
  useEffect(() => () => geo?.dispose(), [geo])
  const places = useMemo(() => frame.mates.map(mt => ({ x: mt.x, z: mt.z, rot: mt.rot })), [frame])   // stable, or each render re-lifts
  if (!frame.linked || !frame.middle || !m || !geo) return null
  const mid = frame.middle, span = (m.n - 1) * MEADOW_CELL
  return (
    <>
      <mesh geometry={geo} material={ground} userData={{ gladeGround: true }} />
      <MeadowTrees m={m} lift={lift} />
      {/* where the paths meet: a pale ring in the middle of the square */}
      <mesh position={[mid.x, MIDDLE_Y + 0.04, mid.z]} rotation-x={-Math.PI / 2} renderOrder={groundOrder('mark')}><ringGeometry args={[5, 6.2, 28]} /><meshBasicMaterial color="#efe0a8" {...groundMat('mark')} /></mesh>
      {/* the cluster's underside: one stone root under the whole meadow, as each island has its own */}
      <mesh position={[mid.x, -34, mid.z]} rotation={[Math.PI, Math.PI / 4, 0]}><coneGeometry args={[span * 0.62, 60, 8, 2]} /><meshLambertMaterial color={P.under} flatShading /></mesh>
      {frame.mates.map((mt, n) => (
        <group key={mt.quarter} position={[mt.x, 0, mt.z]} rotation-y={mt.rot}>
          <PlotIsland owned={new Set(mt.owned)} pages={0} lift={lift} place={lift ? places[n] : undefined} gate={gate} />
        </group>
      ))}
    </>
  )
}
