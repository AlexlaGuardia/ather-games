'use client'

// The home plot's scene: the full-size island, the garden grid, fold-mist over ground you do not hold, the one
// gate, Gregory, and the threshold. Rules live in plot.ts; this only draws them.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import {
  PLOT_N, PLOT_CELL, PLOT_HALF, PLOT_R, GRID, SQ, GRID_HALF, THRESHOLD, GATE, GATE_FACE, GROUND_Y,
  plotHeightAt, plotVertexHeight, plotCellIsLand, sqId, ringOf, canBuy,
} from './plot'
import { P } from './palette'
import { CloudPillows, CloudSea, HorizonRing } from '../shared/cloud-edge'
import { plotEdgePuffs, plotFarPuffs, PLOT_SEA_Y } from './edge-clouds'
import { GROUND, pushLayer, useGroundMaterial } from './ground-look'

function plotGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = [], lay: number[] = []
  const v = (i: number, j: number) => [i * PLOT_CELL - PLOT_HALF, plotVertexHeight(i, j), j * PLOT_CELL - PLOT_HALF] as const
  const c = new THREE.Color()
  for (let j = 0; j < PLOT_N; j++) for (let i = 0; i < PLOT_N; i++) {
    if (!plotCellIsLand(i, j)) continue
    const p00 = v(i, j), p10 = v(i + 1, j), p01 = v(i, j + 1), p11 = v(i + 1, j + 1)
    for (const tri of [[p00, p11, p10], [p00, p01, p11]] as const) {
      const cx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3, cz = (tri[0][2] + tri[1][2] + tri[2][2]) / 3
      const r = Math.hypot(cx, cz) / PLOT_R
      c.copy(P.grass).lerp(P.grassHi, Math.max(0, 0.5 - r) * 0.7).lerp(P.gold, (((cx * 0.37 + cz * 0.23) % 1) + 1) % 1 * 0.14)
      for (const p of tri) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b) }
      pushLayer(lay, GROUND.grass, 3)
    }
    const drop = -3
    const edges: [number, number, readonly [number, number, number], readonly [number, number, number]][] = [
      [0, -1, p00, p10], [1, 0, p10, p11], [0, 1, p11, p01], [-1, 0, p01, p00],
    ]
    for (const [di, dj, a, b] of edges) {
      if (plotCellIsLand(i + di, j + dj)) continue
      const sc = new THREE.Color(P.under)
      const quad = [a, b, [b[0], drop, b[2]], a, [b[0], drop, b[2]], [a[0], drop, a[2]]] as const
      for (const p of quad) { pos.push(p[0], p[1], p[2]); col.push(sc.r, sc.g, sc.b) }
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

/** Faint lines along the grid, laid on the ground, so the squares read as squares. */
function gridLines(): THREE.BufferGeometry {
  const pts: number[] = []
  const step = 2
  for (let k = 0; k <= GRID; k++) {
    const a = k * SQ - GRID_HALF
    for (let t = -GRID_HALF; t < GRID_HALF; t += step) {
      pts.push(a, plotHeightAt(a, t) + 0.06, t, a, plotHeightAt(a, t + step) + 0.06, t + step)
      pts.push(t, plotHeightAt(t, a) + 0.06, a, t + step, plotHeightAt(t + step, a) + 0.06, a)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts.map(p => (Number.isFinite(p) ? p : 0)), 3))
  return g
}

function Gate() {
  const y = GROUND_Y - 0.4   // M52: it stands in the Green's centre, on the square (MIDDLE_Y = GROUND_Y)
  return (
    <group position={[GATE.x, y, GATE.z]} rotation-y={GATE_FACE}>
      <mesh position-y={0.375}><cylinderGeometry args={[1.6, 1.8, 0.75, 12]} /><meshLambertMaterial color="#b9ab90" flatShading /></mesh>
      <mesh position-y={3.4}><torusGeometry args={[2.3, 0.22, 6, 24]} /><meshLambertMaterial color="#e7c766" emissive="#c79a2e" emissiveIntensity={0.6} flatShading /></mesh>
      <mesh position-y={3.4}><circleGeometry args={[2.1, 24]} /><meshBasicMaterial color="#f4e3b0" transparent opacity={0.35} side={THREE.DoubleSide} /></mesh>
      <pointLight position-y={3.4} color="#f2d88a" intensity={6} distance={18} />
    </group>
  )
}

/* Gregory is not drawn here any more (BETA M30 part 2): he lives at Moonwell Glade (glade-greg.tsx). */

/** Fold-mist over every square you do not hold. Squares Greg would sell you now glow gold under the mist. Instanced, one
 *  mesh per look (for sale, or sealed by ring): a 15×15 garden has up to 216 mist squares, four gardens in a cluster. */
function Mist({ owned, pages }: { owned: ReadonlySet<string>; pages: number }) {
  const groups = useMemo(() => {
    const g = new Map<string, { x: number; y: number; z: number }[]>()
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) {
      if (owned.has(sqId(i, j))) continue
      const x = (i + 0.5) * SQ - GRID_HALF, z = (j + 0.5) * SQ - GRID_HALF, h = plotHeightAt(x, z)
      const key = canBuy(owned, i, j, pages, Number.MAX_SAFE_INTEGER).ok ? 'sale' : `r${ringOf(i, j)}`   // "for sale" ignores what you can afford
      if (!g.has(key)) g.set(key, [])
      g.get(key)!.push({ x, y: (Number.isFinite(h) ? h : 1) + 3, z })
    }
    return [...g.entries()]
  }, [owned, pages])
  return <>{groups.map(([key, pts]) => <MistGroup key={`${key}:${pts.length}`} pts={pts} sale={key === 'sale'} ring={key === 'sale' ? 0 : Number(key.slice(1))} />)}</>
}
function MistGroup({ pts, sale, ring }: { pts: { x: number; y: number; z: number }[]; sale: boolean; ring: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4()
    pts.forEach((p, k) => ref.current!.setMatrixAt(k, m.makeTranslation(p.x, p.y, p.z)))
    ref.current!.instanceMatrix.needsUpdate = true
  }, [pts])
  return (
    <instancedMesh ref={ref} frustumCulled={false} args={[undefined, undefined, pts.length]}>
      <boxGeometry args={[SQ - 0.1, 7, SQ - 0.1]} />
      <meshLambertMaterial color={sale ? '#f3e2a8' : '#eef0f2'} transparent opacity={sale ? 0.42 : 0.62 + ring * 0.08} depthWrite={false} />
    </instancedMesh>
  )
}

/** The island alone (ground, grid, underside, threshold, gate, Gregory, mist): your plot, or a cluster-mate's set at
 *  their place (ather/cluster-scene.tsx). The sky round it is PlotScene's, drawn once. */
export function PlotIsland({ owned, pages }: { owned: ReadonlySet<string>; pages: number }) {
  const geo = useMemo(plotGeometry, [])
  const lines = useMemo(gridLines, [])
  const ground = useGroundMaterial()
  return (
    <>
      <mesh geometry={geo} material={ground} />
      <lineSegments geometry={lines}><lineBasicMaterial color="#7f9a55" transparent opacity={0.45} /></lineSegments>
      <mesh position-y={-20} rotation-x={Math.PI}><coneGeometry args={[PLOT_R * 1.05, 34, 12, 2]} /><meshLambertMaterial color={P.under} flatShading /></mesh>
      <mesh position={[THRESHOLD.x, plotHeightAt(THRESHOLD.x, THRESHOLD.z) + 0.03, THRESHOLD.z]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.1, 1.45, 18]} /><meshBasicMaterial color="#efe0a8" />
      </mesh>
      <Gate />
      <Mist owned={owned} pages={pages} />
    </>
  )
}

export function PlotScene({ owned, pages, linked = false }: { owned: ReadonlySet<string>; pages: number; linked?: boolean }) {
  // BETA M24: the island hangs IN the cloud-ocean (edge-clouds.ts): pillows banked round the rim and under it, loose puffs
  // out in the void, the sea below and the horizon ring. One instanced draw for every puff (was 34 separate meshes).
  // linked into a cluster the meadow meets the rim, so only the far puffs (cluster-scene's skirt is that edge)
  const puffs = useMemo(() => [...(linked ? [] : plotEdgePuffs()), ...plotFarPuffs()], [linked])
  return (
    <>
      <PlotIsland owned={owned} pages={pages} />
      <CloudSea y={PLOT_SEA_Y} r={1400} />
      <CloudPillows puffs={puffs} />
      <HorizonRing y={PLOT_SEA_Y + 20} />
    </>
  )
}
