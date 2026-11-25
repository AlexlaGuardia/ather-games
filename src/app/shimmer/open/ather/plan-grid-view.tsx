'use client'
// BETA M142: the 1 m grid, drawn in plan mode only (plan-grid.ts has the rules). One draw call; built once per change of ground,
// level or raised floors, never per frame.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useBuildMode } from './build-mode'
import { usePlanLevel } from './plot-level'
import { gridLines, gridSig, raisedCells } from './plan-grid'

const INK = new THREE.Color('#2f3a22')
export function PlanGrid({ owned, works }: { owned: ReadonlySet<string>; works: Parameters<typeof raisedCells>[0] }) {
  return useBuildMode() ? <Lines owned={owned} works={works} /> : null
}
function Lines({ owned, works }: { owned: ReadonlySet<string>; works: Parameters<typeof raisedCells>[0] }) {
  const lv = usePlanLevel(), raised = useMemo(() => raisedCells(works, lv), [works, lv]), sig = gridSig(owned, lv, raised)
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), L = gridLines(owned, lv, raised)
    g.setAttribute('position', new THREE.Float32BufferAttribute(L.pos, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(L.alpha.flatMap(a => [INK.r, INK.g, INK.b, a]), 4))
    g.userData = { segments: L.segments, lv }
    return g
  }, [sig])   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => geo.dispose(), [geo])
  // checks' probe: there only while the grid is drawn
  useEffect(() => {
    const W = window as unknown as { __planGrid?: object }
    W.__planGrid = { ...geo.userData, id: geo.uuid, y: () => geo.getAttribute('position').getY(0), has: (x: number, z: number) => { const p = geo.getAttribute('position'); for (let k = 0; k < p.count; k += 2) { const ax = p.getX(k), az = p.getZ(k), bx = p.getX(k + 1), bz = p.getZ(k + 1); if ((ax === bx && ax === x && z >= az && z <= bz) || (az === bz && az === z && x >= ax && x <= bx)) return true } return false } }
    return () => { delete W.__planGrid }
  }, [geo])
  return <lineSegments name="plan-grid" geometry={geo} frustumCulled={false} renderOrder={3}><lineBasicMaterial vertexColors transparent depthWrite={false} /></lineSegments>
}
