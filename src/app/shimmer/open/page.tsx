'use client'

// /shimmer/open — the open world's P0 FEEL SLICE (OPEN_WORLD_PLAN.md). One hillside, the walker Alex
// tuned, standing on land instead of blocks. It exists to answer one question: does the movement
// still feel like his on real ground? Everything else (guns, building, the world) waits on that.
//
// The walker is voxel3d/locomotion.ts, untouched; the world it asks is open/terrain-world.ts over
// open/land.ts. The sky is the shipped `VoxelDayNight` rig — the Core, the canon light — mounted as-is.
// Desktop only for P0 (pointer lock + keys); the phone pass comes with the real HUD.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../voxel3d/day-night'
import { createLoco, tickLocomotion, eyeY, WALK_SPEED, SPEED_CAP } from '../voxel3d/locomotion'
import { terrainWorld } from './terrain-world'
import { LAND_SHAPE, LAND_SIZE, CELL, GRID_N, WATER_Y, PROPS, vertexHeight, heightAt } from './land'

const WORLD = terrainWorld(LAND_SHAPE)
const SPAWN = { x: 0, z: 6 }
const SENS = 0.0022
const FOV = 75, FOV_KICK = 8

// ── colours: warm, stylized, a placeholder palette until the atlas is locked ────────────────────
const C = {
  grass: new THREE.Color('#79a84a'), grassHi: new THREE.Color('#a3c25a'), meadow: new THREE.Color('#8fb552'),
  rock: new THREE.Color('#8c7d6c'), sand: new THREE.Color('#d6c48e'), bed: new THREE.Color('#6d8a72'),
}

function landGeometry(): THREE.BufferGeometry {
  const half = LAND_SIZE / 2
  const pos: number[] = [], col: number[] = []
  const v = (i: number, j: number) => [i * CELL - half, vertexHeight(i, j), j * CELL - half] as const
  const tint = (a: readonly number[], b: readonly number[], c: readonly number[]) => {
    const y = (a[1] + b[1] + c[1]) / 3
    // steepness of the face: 1 = flat
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2]
    const wx = c[0] - a[0], wy = c[1] - a[1], wz = c[2] - a[2]
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const up = Math.abs(ny) / Math.hypot(nx, ny, nz)
    const out = new THREE.Color()
    if (y < WATER_Y - 0.2) out.copy(C.bed)
    else if (y < WATER_Y + 0.5) out.copy(C.sand)
    else if (up < 0.62) out.copy(C.rock)
    else out.copy(C.grass).lerp(C.grassHi, Math.min(1, Math.max(0, (y - 1) / 8))).lerp(C.meadow, ((a[0] * 0.37 + a[2] * 0.21) % 1 + 1) % 1 * 0.35)
    return out
  }
  for (let j = 0; j < GRID_N; j++) for (let i = 0; i < GRID_N; i++) {
    const p00 = v(i, j), p10 = v(i + 1, j), p01 = v(i, j + 1), p11 = v(i + 1, j + 1)
    // ★ The SAME diagonal `heightAt` interpolates: (00,10,11) + (00,11,01), wound to face up.
    for (const tri of [[p00, p11, p10], [p00, p01, p11]] as const) {
      const c = tint(tri[0], tri[1], tri[2])
      for (const p of tri) { pos.push(p[0], p[1], p[2]); col.push(c.r, c.g, c.b) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()   // non-indexed → flat facets, the low-poly read
  return g
}

function Land() {
  const geo = useMemo(landGeometry, [])
  return (
    <mesh geometry={geo}>
      <meshLambertMaterial vertexColors flatShading />
    </mesh>
  )
}

function Props() {
  const rocks = PROPS.filter(p => p.kind !== 'trunk'), trunks = PROPS.filter(p => p.kind === 'trunk')
  const rockRef = useRef<THREE.InstancedMesh>(null), trunkRef = useRef<THREE.InstancedMesh>(null), crownRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    rocks.forEach((r, k) => {
      const b = r.box
      p.set((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2); s.set(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0)
      rockRef.current!.setMatrixAt(k, m.compose(p, q, s))
      rockRef.current!.setColorAt(k, new THREE.Color(r.kind === 'ledge' ? '#9a8a74' : '#a09484').offsetHSL(0, 0, ((k * 0.13) % 0.1) - 0.05))
    })
    trunks.forEach((t, k) => {
      const b = t.box, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, foot = b.y0 + 1
      const tall = 4 + ((k * 0.37) % 1) * 3
      p.set(cx, foot + 1.6, cz); s.set(1, 3.2, 1)
      trunkRef.current!.setMatrixAt(k, m.compose(p, q, s))
      p.set(cx, foot + 2.4 + tall / 2, cz); s.set(1 + (k % 3) * 0.2, tall, 1 + (k % 3) * 0.2)
      crownRef.current!.setMatrixAt(k, m.compose(p, q, s))
      crownRef.current!.setColorAt(k, new THREE.Color('#4f7d3a').offsetHSL(((k * 0.07) % 0.06) - 0.03, 0, ((k * 0.11) % 0.12) - 0.06))
    })
    for (const r of [rockRef, trunkRef, crownRef]) {
      r.current!.instanceMatrix.needsUpdate = true
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true
    }
  }, [rocks, trunks])
  return (
    <>
      <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]}>
        <boxGeometry />
        <meshLambertMaterial flatShading />
      </instancedMesh>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trunks.length]}>
        <cylinderGeometry args={[0.22, 0.3, 1, 6]} />
        <meshLambertMaterial color="#6b4f36" flatShading />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, trunks.length]}>
        <coneGeometry args={[1.9, 1, 7]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </>
  )
}

function Water() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={WATER_Y}>
      <planeGeometry args={[LAND_SIZE, LAND_SIZE]} />
      <meshLambertMaterial color="#4f9bb0" transparent opacity={0.78} />
    </mesh>
  )
}

export interface OpenHud { speed: number; verb: string; x: number; y: number; z: number }

function Walker({ locked, onHud }: { locked: React.MutableRefObject<boolean>; onHud: (h: OpenHud) => void }) {
  const { camera, gl } = useThree()
  const loco = useRef(createLoco(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z))
  const keys = useRef(new Set<string>())
  const look = useRef({ yaw: 0, pitch: -0.05 })
  const hudT = useRef(0)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (e.code === 'KeyR') { loco.current = createLoco(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z); look.current.yaw = 0 }
      if (e.code === 'Space') e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const move = (e: MouseEvent) => {
      if (!locked.current) return
      look.current.yaw -= e.movementX * SENS
      look.current.pitch = Math.max(-1.5, Math.min(1.5, look.current.pitch - e.movementY * SENS))
    }
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move); window.addEventListener('blur', blur)
    // A read-only probe + a teleport for scripted shots (the voxel world's `__atherParty` habit).
    ;(window as unknown as { __open: unknown }).__open = {
      state: () => ({ ...loco.current }),
      tp: (x: number, z: number, yaw = 0) => { loco.current = createLoco(x, heightAt(x, z), z); look.current.yaw = yaw },
      look: (yaw: number, pitch: number) => { look.current.yaw = yaw; look.current.pitch = pitch },
    }
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move); window.removeEventListener('blur', blur)
    }
  }, [locked])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 600; camera.updateProjectionMatrix() }, [camera])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)) }, [gl])

  const fwd = useMemo(() => new THREE.Vector3(), []), right = useMemo(() => new THREE.Vector3(), [])
  const wish = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    const k = keys.current, lc = loco.current, { yaw, pitch } = look.current
    fwd.set(-Math.sin(yaw), 0, -Math.cos(yaw)); right.set(Math.cos(yaw), 0, -Math.sin(yaw))
    const f = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0), r = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0)
    wish.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, r)
    if (wish.lengthSq() > 1) wish.normalize()
    tickLocomotion(lc, {
      mvX: wish.x, mvZ: wish.z, fwdX: fwd.x, fwdZ: fwd.z, rightX: right.x, rightZ: right.z,
      jumpKey: k.has('Space'), crouchKey: k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyC'),
      dt,
    }, WORLD)
    if (lc.py < -40) loco.current = createLoco(SPAWN.x, heightAt(SPAWN.x, SPAWN.z), SPAWN.z)

    camera.position.set(lc.px, eyeY(lc), lc.pz)
    camera.rotation.set(pitch, yaw, 0, 'YXZ')
    const speed = Math.hypot(lc.hvx, lc.hvz)
    const cam = camera as THREE.PerspectiveCamera
    const fov = FOV + FOV_KICK * Math.min(1, Math.max(0, (speed - WALK_SPEED) / (SPEED_CAP - WALK_SPEED)))
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix() }

    hudT.current -= dt
    if (hudT.current <= 0) {
      hudT.current = 0.1
      const verb = lc.swimming ? 'swim' : lc.hanging ? 'hang' : lc.mantleT > 0 ? (lc.vaulting ? 'vault' : 'mantle')
        : lc.climbing ? 'climb' : lc.wallCatchT > 0 ? 'wall-catch' : lc.sliding ? 'slide'
        : lc.airborne ? 'air' : speed < 0.2 ? 'idle' : lc.crouching ? 'crouch' : speed > WALK_SPEED + 0.3 ? 'sprint' : 'walk'
      onHud({ speed, verb, x: lc.px, y: lc.py, z: lc.pz })
    }
  })
  return null
}

export default function OpenSlice() {
  const locked = useRef(false)
  const [isLocked, setLocked] = useState(false)
  const [hud, setHud] = useState<OpenHud>({ speed: 0, verb: 'idle', x: 0, y: 0, z: 0 })
  useEffect(() => {
    const ch = () => { locked.current = !!document.pointerLockElement; setLocked(locked.current) }
    document.addEventListener('pointerlockchange', ch)
    return () => document.removeEventListener('pointerlockchange', ch)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#9fc3d6' }}>
      <Canvas
        camera={{ fov: FOV, near: 0.05, far: 600, position: [SPAWN.x, 2, SPAWN.z] }}
        onClick={(e) => (e.target as HTMLCanvasElement).requestPointerLock?.()}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <VoxelDayNight />
        <Land />
        <Props />
        <Water />
        <Walker locked={locked} onHud={setHud} />
      </Canvas>
      {/* crosshair */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: 4, height: 4, margin: -2, borderRadius: 2, background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 0 1px rgba(0,0,0,0.35)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 12, bottom: 12, padding: '6px 10px', borderRadius: 6, background: 'rgba(12,16,20,0.55)', color: '#e8eef2', font: '12px ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', pointerEvents: 'none' }}>
        {hud.verb.toUpperCase().padEnd(10)} {hud.speed.toFixed(1)} m/s · {hud.x.toFixed(0)}, {hud.y.toFixed(1)}, {hud.z.toFixed(0)}
      </div>
      {!isLocked && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.7)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.6, textAlign: 'center' }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>Open world · feel slice</div>
            Click to play<br />
            WASD move · Space jump / climb (hold) · Shift slide · R respawn · Esc release
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>North: the hill and a tall bluff with a ledge. East: a low cliff. West: a pond.</div>
          </div>
        </div>
      )}
    </div>
  )
}
