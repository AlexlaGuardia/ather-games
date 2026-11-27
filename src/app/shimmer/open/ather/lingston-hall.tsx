'use client'
// ── LINGSTON'S TRADE HALL, drawn (BETA M228 s1; canon world/gates.md › LINGSTON IS THE GRAND EXCHANGE). The old market square
// at the STAND-IN spot (lingston.ts › LINGSTON_STANDIN, until Alex places Lingston): stone paving, an open market hall (columns
// + roof, no walls) with the counter and its three Moglin attendants, the stopped clocktower (a placeholder: its hands never
// move), and three of the settlement kit's trade houses (settlement-lots.ts blueprints) on the square's edges. Their walls +
// the counter + the tower stand in the walker's solids (setSettlementBoxes, the same register the settlements use).
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { MoglinModel, furOf } from '../shared/moglin-model'
import { BlueprintStack } from './blueprint-stack'
import { placeBlueprint } from './plot-blueprint'
import { tradeBuilding, setSettlementBoxes } from './settlement-lots'
import type { Box } from '../terrain-world'
import { LINGSTON, SQUARE_HALF, HALL, COUNTER, ATTENDANT_X, ATTENDANT_Z, DAIS, CLOCKTOWER, EXCHANGE_NAME, toWorld, frontageLots } from './lingston'

const STONE = '#b9ad97', STONE_DK = '#8f846f', ROOF = '#7b4a35', WOOD = '#6b4a30'
/** the attendants' ids (nameless; only their fur tone hashes off these) */
export const ATTENDANT_IDS = ['lingston-attendant-0', 'lingston-attendant-1', 'lingston-attendant-2'] as const

function signTexture(name: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#3b2617'; g.fillRect(0, 0, 512, 128)
  g.strokeStyle = '#c99a4b'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 112)
  g.fillStyle = '#f1d08a'; g.textAlign = 'center'; g.textBaseline = 'middle'
  let px = 54
  do { g.font = `700 ${px}px Georgia, 'Times New Roman', serif`; px -= 2 } while (g.measureText(name.toUpperCase()).width > 460 && px > 20)
  g.fillText(name.toUpperCase(), 256, 68)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}

/** a box in the square's frame → a world AABB that holds it (for the walker) */
function boxOf(lx: number, lz: number, w: number, d: number, y0: number, y1: number): Box {
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]].map(([u, v]) => toWorld(lx + u, lz + v))
  return { x0: Math.min(...pts.map(p => p.x)), x1: Math.max(...pts.map(p => p.x)), z0: Math.min(...pts.map(p => p.z)), z1: Math.max(...pts.map(p => p.z)), y0, y1 }
}

export function LingstonHall({ ground }: { ground: (x: number, z: number) => number }) {
  const y0 = ground(LINGSTON.x, LINGSTON.z)
  // the paving: 2.4 m flags, each laid at the land under it (the square is not levelled: it is old ground)
  const flags = useMemo(() => {
    const out: { x: number; y: number; z: number }[] = []
    for (let i = -SQUARE_HALF + 1.2; i < SQUARE_HALF; i += 2.4) for (let j = -SQUARE_HALF + 1.2; j < SQUARE_HALF; j += 2.4) {
      const w = toWorld(i, j); out.push({ x: i, z: j, y: ground(w.x, w.z) - y0 })
    }
    return out
  }, [ground, y0])
  const flagMesh = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(2.3, 0.3, 2.3), new THREE.MeshLambertMaterial({ color: STONE }), flags.length)
    const o = new THREE.Object3D()
    flags.forEach((f, k) => { o.position.set(f.x, f.y + 0.02, f.z); o.rotation.set(0, (k % 3) * 0.02, 0); o.updateMatrix(); m.setMatrixAt(k, o.matrix) })
    m.instanceMatrix.needsUpdate = true; m.receiveShadow = true
    return m
  }, [flags])
  useEffect(() => () => { flagMesh.geometry.dispose(); (flagMesh.material as THREE.Material).dispose() }, [flagMesh])
  const hy = (lx: number, lz: number) => { const w = toWorld(lx, lz); return ground(w.x, w.z) - y0 }
  // the hall's roof sits over the highest corner, so no column is buried
  const roofY = Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => hy(HALL.x + (a * HALL.w) / 2, HALL.z + (b * HALL.d) / 2))) + HALL.h
  const cols = useMemo(() => {
    const out: [number, number][] = []
    for (let k = 0; k <= 6; k++) { const x = HALL.x - HALL.w / 2 + (k * HALL.w) / 6; out.push([x, HALL.z - HALL.d / 2], [x, HALL.z + HALL.d / 2]) }
    out.push([HALL.x - HALL.w / 2, HALL.z], [HALL.x + HALL.w / 2, HALL.z])
    return out
  }, [])
  const lots = useMemo(() => frontageLots(), [])
  const houses = useMemo(() => lots.map(l => ({ l, bp: tradeBuilding(l.profession), y: ground(l.x, l.z) })), [lots, ground])
  const sign = useMemo(() => signTexture(EXCHANGE_NAME), [])
  useEffect(() => () => sign.dispose(), [sign])
  const cy = hy(0, COUNTER.z), ty = hy(CLOCKTOWER.x, CLOCKTOWER.z)
  // M228 s2: the attendants' step, one level top over the highest ground under it (the square is old, not levelled)
  const daisY = Math.max(cy, ...ATTENDANT_X.map(x => hy(x, ATTENDANT_Z)), hy(-COUNTER.half, DAIS.z1), hy(COUNTER.half, DAIS.z1)) + DAIS.h
  const { camera, scene } = useThree()
  useEffect(() => {   // M228 s2 check probe (READ only): can the camera see each attendant's head + shoulders, or what blocks it
    const g = window as unknown as { __ather?: Record<string, unknown> }
    const HEAD = 0.65, SHOULDER = 0.42   // a chibi Moglin's head centre / shoulders above its feet (moglin-model BUILD.chibi)
    const sight = () => {
      const groups: THREE.Object3D[] = []; scene.traverse(o => { if (typeof o.userData?.attendant === 'number') groups.push(o) })
      const rc = new THREE.Raycaster(); rc.camera = camera
      const at = (grp: THREE.Object3D, y: number) => {
        const pt = grp.localToWorld(new THREE.Vector3(0, y, 0)), from = camera.position.clone(), d = pt.distanceTo(from)
        rc.set(from, pt.clone().sub(from).normalize()); rc.far = d - 0.02
        const hit = rc.intersectObjects(scene.children, true).find(h => {
          let o: THREE.Object3D | null = h.object; while (o) { if (o === grp || !o.visible) return false; o = o.parent } return true
        })
        const ndc = pt.clone().project(camera)
        return { clear: !hit, onScreen: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z < 1, blocker: hit ? (hit.object.userData?.lingstonCounter ? 'counter' : hit.object.name || hit.object.type) : null }
      }
      return groups.map(grp => ({ i: grp.userData.attendant as number, head: at(grp, HEAD), shoulder: at(grp, SHOULDER) }))
    }
    g.__ather = { ...(g.__ather ?? {}), lingstonSight: sight }
    return () => { if (g.__ather?.lingstonSight === sight) delete g.__ather!.lingstonSight }
  }, [camera, scene])
  useEffect(() => {   // the walker's solids: the kit houses' walls, the counter, the tower (never the open hall's floor)
    const boxes: Box[] = [
      ...houses.flatMap(h => placeBlueprint(h.bp, { x: h.l.x, z: h.l.z, yaw: h.l.yaw, y: h.y }).boxes),
      boxOf(0, COUNTER.z, COUNTER.half * 2, COUNTER.d, y0 + cy - 1, y0 + cy + COUNTER.h),
      boxOf(CLOCKTOWER.x, CLOCKTOWER.z, CLOCKTOWER.w, CLOCKTOWER.w, y0 + ty - 1, y0 + ty + CLOCKTOWER.h),
    ]
    setSettlementBoxes('lingston', boxes)
    return () => setSettlementBoxes('lingston', null)
  }, [houses, y0, cy, ty])
  return (
    <group userData={{ lingston: true }}>
      <group position={[LINGSTON.x, y0, LINGSTON.z]} rotation-y={LINGSTON.yaw}>
        <primitive object={flagMesh} />
        {/* the open hall: columns, a beam round the top, a pitched roof */}
        {cols.map(([x, z], k) => { const b = hy(x, z); return <mesh key={k} position={[x, (b + roofY) / 2, z]} castShadow><cylinderGeometry args={[0.32, 0.4, roofY - b + 0.3, 10]} /><meshLambertMaterial color={STONE} /></mesh> })}
        <mesh position={[HALL.x, roofY + 0.25, HALL.z]}><boxGeometry args={[HALL.w + 0.8, 0.5, HALL.d + 0.8]} /><meshLambertMaterial color={STONE_DK} /></mesh>
        {[-1, 1].map(s => (
          <mesh key={s} position={[HALL.x, roofY + 1.55, HALL.z + s * (HALL.d / 4 + 0.2)]} rotation-x={s * 0.48} castShadow>
            <boxGeometry args={[HALL.w + 1.6, 0.25, HALL.d / 2 + 1.4]} /><meshLambertMaterial color={ROOF} />
          </mesh>
        ))}
        <mesh position={[HALL.x, roofY + 1.2, HALL.z + HALL.d / 2 + 0.45]}><planeGeometry args={[4.6, 1.15]} /><meshBasicMaterial map={sign} toneMapped={false} /></mesh>
        {/* the counter, and the three attendants behind it facing the keeper's side */}
        <mesh position={[0, cy + COUNTER.h / 2 - 0.3, COUNTER.z]} castShadow userData={{ lingstonCounter: true }}><boxGeometry args={[COUNTER.half * 2, COUNTER.h + 0.6, COUNTER.d]} /><meshLambertMaterial color={WOOD} /></mesh>
        <mesh position={[0, cy + COUNTER.h + 0.05, COUNTER.z]} userData={{ lingstonCounter: true }}><boxGeometry args={[COUNTER.half * 2 + 0.3, 0.1, COUNTER.d + 0.3]} /><meshLambertMaterial color="#8a6a46" /></mesh>
        {/* M228 s2: the step the attendants stand on, so their heads + shoulders clear the low counter */}
        <mesh position={[0, daisY - (DAIS.h + 0.6) / 2, (DAIS.z0 + DAIS.z1) / 2]} receiveShadow><boxGeometry args={[COUNTER.half * 2, DAIS.h + 0.6, DAIS.z0 - DAIS.z1]} /><meshLambertMaterial color={STONE_DK} /></mesh>
        {ATTENDANT_X.map((x, i) => (
          <group key={i} position={[x, daisY, ATTENDANT_Z]} userData={{ attendant: i }}>
            <MoglinModel action="idle" garb="apron" tone={furOf(ATTENDANT_IDS[i])} seed={i * 3 + 1} />
          </group>
        ))}
        {/* the stopped clocktower (placeholder): a stone shaft, a face whose hands stay where they stopped, a pointed cap */}
        <group position={[CLOCKTOWER.x, ty, CLOCKTOWER.z]}>
          <mesh position-y={CLOCKTOWER.h / 2 - 0.5} castShadow><boxGeometry args={[CLOCKTOWER.w, CLOCKTOWER.h + 1, CLOCKTOWER.w]} /><meshLambertMaterial color={STONE_DK} /></mesh>
          <mesh position-y={CLOCKTOWER.h + 1.6}><coneGeometry args={[CLOCKTOWER.w * 0.82, 3.4, 4]} /><meshLambertMaterial color={ROOF} /></mesh>
          <group position={[0, CLOCKTOWER.h - 2, CLOCKTOWER.w / 2 + 0.03]}>
            <mesh><circleGeometry args={[1.25, 28]} /><meshLambertMaterial color="#efe6cf" /></mesh>
            <mesh position={[0, 0.3, 0.02]} rotation-z={0.35}><planeGeometry args={[0.1, 0.75]} /><meshBasicMaterial color="#2a2320" /></mesh>
            <mesh position={[0.22, -0.3, 0.03]} rotation-z={2.6}><planeGeometry args={[0.08, 0.95]} /><meshBasicMaterial color="#2a2320" /></mesh>
          </group>
        </group>
      </group>
      {/* three trade houses from the settlement kit on the square's edges (world space: placeBlueprint lays them out) */}
      {houses.map(h => { const g = placeBlueprint(h.bp, { x: h.l.x, z: h.l.z, yaw: h.l.yaw, y: h.y }).group; return <BlueprintStack key={h.l.id} bp={h.bp} x={g.x} z={g.z} y={h.y} rotY={g.rotY} /> })}
    </group>
  )
}
