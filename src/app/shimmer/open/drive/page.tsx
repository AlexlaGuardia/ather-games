'use client'

// /shimmer/open/drive — the DARTER on its test track (OPEN_WORLD_PLAN.md › P5). One courser, one proving
// ground, a chase camera. It exists to answer one question before the big map exists: does driving feel
// good? Handling is open/courser.ts (pure, tested); the ground is open/track.ts.
//
// ⚠ The car's LOOK is placeholder geometry (a canon design brief for the Darter is Magii's, not yet asked).
// It borrows only what canon already says a manalic vehicle has: a mana core and rune-lit channel trim.
// Desktop only for now (keys); the phone pass comes with the real HUD.

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { VoxelDayNight } from '../../voxel3d/day-night'
import { createCourser, tickCourser, bodySpeeds, slipAngle, type Courser, type CourserInput } from '../courser'
import { DarterModel } from '../darter-view'
import { TRACK_SIZE, HALF, ROAD_W, SPAWN, JUMP, WHOOPS, baseHeight, jumpHeight, whoopsHeight, trackHeight, ovalOffset, cones } from '../track'

const STEP = 1 / 120
const FOV = 68, FOV_KICK = 14

const C = {
  grass: new THREE.Color('#6f9e45'), grass2: new THREE.Color('#86b04f'), road: new THREE.Color('#3b3f47'),
  kerbA: new THREE.Color('#c9473d'), kerbB: new THREE.Color('#ece6d8'), paint: new THREE.Color('#e2d9b8'),
  ramp: new THREE.Color('#9b8a6e'), rampSide: new THREE.Color('#6f6250'),
}

// ── the ground: 2 m grid over the smooth base; the road, kerbs and skidpad painted in vertex colour ──
function groundGeometry(): THREE.BufferGeometry {
  const cell = 2, n = TRACK_SIZE / cell
  const pos: number[] = [], col: number[] = []
  const paint = (x: number, z: number) => {
    const off = Math.abs(ovalOffset(x, z))
    if (off < ROAD_W / 2) {
      // a dashed centre line on the oval
      const ang = Math.atan2(z / 90, x / 150)
      if (off < 0.25 && Math.floor(ang * 40) % 2 === 0) return C.paint
      return C.road
    }
    if (off < ROAD_W / 2 + 1.2) return Math.floor(Math.atan2(z / 90, x / 150) * 60) % 2 === 0 ? C.kerbA : C.kerbB
    const dPad = Math.hypot(x + 95, z - 20)
    if (dPad < 24 && Math.abs(dPad - 14) > 0.6) return C.road.clone().lerp(C.grass, 0.08)
    if (dPad < 24) return C.paint
    // the slalom lane: a strip of tarmac down the infield
    if (Math.abs(z + 6) < 6 && Math.abs(x) < 72) return C.road
    return ((Math.floor(x / 8) + Math.floor(z / 8)) & 1) ? C.grass : C.grass2
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x0 = i * cell - HALF, z0 = j * cell - HALF, x1 = x0 + cell, z1 = z0 + cell
    const p = (x: number, z: number) => [x, baseHeight(x, z), z] as const
    const c = paint(x0 + cell / 2, z0 + cell / 2)
    for (const q of [p(x0, z0), p(x1, z1), p(x1, z0), p(x0, z0), p(x0, z1), p(x1, z1)]) { pos.push(...q); col.push(c.r, c.g, c.b) }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

// ── the jump wedge and the whoops strip, meshed from the very functions the car reads ──
function featureGeometry(): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = []
  const quad = (a: number[], b: number[], c: number[], d: number[], k: THREE.Color) => {
    for (const p of [a, b, c, a, c, d]) { pos.push(p[0], p[1], p[2]); col.push(k.r, k.g, k.b) }
  }
  const j = JUMP, y = (x: number, z: number) => jumpHeight(x, z) + 0.01
  quad([j.x0, 0.01, j.z0], [j.x0, 0.01, j.z1], [j.x1, y(j.x1, j.z1), j.z1], [j.x1, y(j.x1, j.z0), j.z0], C.ramp)
  quad([j.x1, 0, j.z0], [j.x1, j.h, j.z0], [j.x1, j.h, j.z1], [j.x1, 0, j.z1], C.rampSide)               // the lip face
  quad([j.x0, 0, j.z0], [j.x1, 0, j.z0], [j.x1, j.h, j.z0], [j.x0, 0, j.z0], C.rampSide)                  // sides
  quad([j.x0, 0, j.z1], [j.x0, 0, j.z1], [j.x1, j.h, j.z1], [j.x1, 0, j.z1], C.rampSide)
  const w = WHOOPS, seg = 0.5
  for (let x = w.x0; x < w.x1; x += seg) {
    const h0 = whoopsHeight(x, (w.z0 + w.z1) / 2) + 0.012, h1 = whoopsHeight(x + seg, (w.z0 + w.z1) / 2) + 0.012
    const shade = C.road.clone().lerp(C.paint, Math.min(0.25, h0 * 0.4))
    quad([x, h0, w.z0], [x, h0, w.z1], [x + seg, h1, w.z1], [x + seg, h1, w.z0], shade)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

function Track() {
  const ground = useMemo(groundGeometry, [])
  const feat = useMemo(featureGeometry, [])
  return (
    <>
      <mesh geometry={ground}><meshLambertMaterial vertexColors flatShading /></mesh>
      <mesh geometry={feat}><meshLambertMaterial vertexColors flatShading side={THREE.DoubleSide} /></mesh>
      {/* the fence at the edge of the slab */}
      {[[0, -HALF, TRACK_SIZE, 0.6], [0, HALF, TRACK_SIZE, 0.6], [-HALF, 0, 0.6, TRACK_SIZE], [HALF, 0, 0.6, TRACK_SIZE]].map(([x, z, w, d], k) => (
        <mesh key={k} position={[x, 0.6, z]}><boxGeometry args={[w, 1.2, d]} /><meshLambertMaterial color="#a8916c" /></mesh>
      ))}
    </>
  )
}

// ── cones: knock them flying ──
interface ConeBody { x: number; y: number; z: number; vx: number; vy: number; vz: number; spin: number; tilt: number; home: { x: number; z: number } }
const makeCones = (): ConeBody[] => cones().map(c => ({ x: c.x, y: trackHeight(c.x, c.z), z: c.z, vx: 0, vy: 0, vz: 0, spin: 0, tilt: 0, home: c }))

function Cones({ bodies }: { bodies: React.MutableRefObject<ConeBody[]> }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const m = useMemo(() => new THREE.Matrix4(), []), q = useMemo(() => new THREE.Quaternion(), []), e = useMemo(() => new THREE.Euler(), [])
  const p = useMemo(() => new THREE.Vector3(), []), s = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useFrame(() => {
    const im = ref.current; if (!im) return
    bodies.current.forEach((b, k) => {
      e.set(b.tilt, b.spin, 0); q.setFromEuler(e)
      p.set(b.x, b.y + 0.4, b.z)
      im.setMatrixAt(k, m.compose(p, q, s))
    })
    im.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, bodies.current.length]}>
      <coneGeometry args={[0.32, 0.8, 8]} />
      <meshLambertMaterial color="#ee7a2a" />
    </instancedMesh>
  )
}

export interface DriveHud { kmh: number; drift: boolean; air: number; gearR: boolean }

function Driver({ onHud }: { onHud: (h: DriveHud) => void }) {
  const { camera, gl } = useThree()
  const car = useRef<Courser>(createCourser(SPAWN.x, SPAWN.z, SPAWN.yaw, trackHeight))
  const model = useRef<THREE.Group | null>(null)
  const steerVis = useRef(0)
  const keys = useRef(new Set<string>())
  const scripted = useRef<Partial<CourserInput> | null>(null)
  const coneBodies = useRef<ConeBody[]>(makeCones())
  const acc = useRef(0), hudT = useRef(0)
  const camMode = useRef<'chase' | 'hood'>('chase')
  const camPos = useMemo(() => new THREE.Vector3(SPAWN.x, 4, SPAWN.z + 8), [])
  const look = useMemo(() => new THREE.Vector3(), [])
  const shake = useRef(0)

  const reset = () => {
    car.current = createCourser(SPAWN.x, SPAWN.z, SPAWN.yaw, trackHeight)
    coneBodies.current = makeCones()
    camPos.set(SPAWN.x, 4, SPAWN.z + 8)
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current.add(e.code)
      if (e.code === 'KeyR') reset()
      if (e.code === 'KeyC') camMode.current = camMode.current === 'chase' ? 'hood' : 'chase'
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.code)
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    // A probe + scripted driving for screenshots and flow checks (the open slice's `__open` habit).
    ;(window as unknown as { __drive: unknown }).__drive = {
      state: () => ({ ...car.current, ...bodySpeeds(car.current), slip: slipAngle(car.current) }),
      tp: (x: number, z: number, yaw = 0, speed = 0) => {
        const c = createCourser(x, z, yaw, trackHeight); c.vx = -Math.sin(yaw) * speed; c.vz = -Math.cos(yaw) * speed
        car.current = c; camPos.set(x + Math.sin(yaw) * 8, trackHeight(x, z) + 3, z + Math.cos(yaw) * 8)
      },
      input: (i: Partial<CourserInput> | null) => { scripted.current = i },
      cam: (m: 'chase' | 'hood') => { camMode.current = m },
    }
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { (camera as THREE.PerspectiveCamera).far = 900; camera.updateProjectionMatrix() }, [camera])
  useEffect(() => { gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.25)) }, [gl])

  useFrame((_, frameDt) => {
    const k = keys.current
    const sc = scripted.current
    const throttle = sc?.throttle ?? ((k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0))
    const steer = sc?.steer ?? ((k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0))
    const handbrake = sc?.handbrake ?? k.has('Space')

    // fixed-step sim: the same 1/120 the tests run
    acc.current = Math.min(acc.current + frameDt, 0.1)
    const c = car.current
    while (acc.current >= STEP) {
      acc.current -= STEP
      tickCourser(c, { throttle, steer, handbrake, dt: STEP }, trackHeight)
      // the fence: bounce off the slab's edge instead of driving into the void
      const lim = HALF - 2.5
      if (Math.abs(c.x) > lim) { c.x = Math.sign(c.x) * lim; c.vx *= -0.35 }
      if (Math.abs(c.z) > lim) { c.z = Math.sign(c.z) * lim; c.vz *= -0.35 }
      // cones
      for (const b of coneBodies.current) {
        const dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz)
        if (d < 1.9 && b.y < c.y + 1.2) {
          const sp = Math.hypot(c.vx, c.vz)
          if (sp > 1) { b.vx = c.vx * 0.9 + (dx / (d || 1)) * 3; b.vz = c.vz * 0.9 + (dz / (d || 1)) * 3; b.vy = 2 + sp * 0.18 }
        }
        if (b.vx || b.vy || b.vz) {
          b.vy -= 22 * STEP
          b.x += b.vx * STEP; b.y += b.vy * STEP; b.z += b.vz * STEP
          b.spin += Math.hypot(b.vx, b.vz) * STEP * 0.8; b.tilt += Math.hypot(b.vx, b.vz) * STEP * 1.6
          const h = trackHeight(b.x, b.z)
          if (b.y <= h) { b.y = h; b.vy = 0; b.vx *= 0.9; b.vz *= 0.9; if (Math.hypot(b.vx, b.vz) < 0.2) { b.vx = 0; b.vz = 0; b.tilt = Math.PI / 2 } }
        }
      }
    }

    // ── place the model: ride the ground's pitch and roll, lean into turns ──
    const g = model.current
    const { fwd, lat } = bodySpeeds(c)
    if (g) {
      const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw), rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw)
      let pitch = 0, roll = 0
      if (!c.airborne) {
        pitch = Math.atan2(trackHeight(c.x + fx * 1.3, c.z + fz * 1.3) - trackHeight(c.x - fx * 1.3, c.z - fz * 1.3), 2.6)
        roll = Math.atan2(trackHeight(c.x + rx * 0.9, c.z + rz * 0.9) - trackHeight(c.x - rx * 0.9, c.z - rz * 0.9), 1.8)
      } else pitch = Math.atan2(c.vy, Math.max(4, Math.hypot(c.vx, c.vz))) * 0.6
      const lean = Math.max(-0.07, Math.min(0.07, c.yawRate * fwd * 0.006))
      g.position.set(c.x, c.y, c.z)
      g.rotation.set(pitch, c.yaw, 0, 'YXZ')
      const body = g.getObjectByName('body')
      if (body) body.rotation.z = -roll + lean
      g.userData.wheelAngle = c.wheelAngle
    }
    steerVis.current = c.steer

    // ── camera ──
    const cam = camera as THREE.PerspectiveCamera
    const fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw)
    shake.current = Math.max(shake.current * Math.exp(-frameDt * 9), Math.min(1, c.landed / 12))
    const sk = shake.current * 0.18
    if (camMode.current === 'chase') {
      // trail the TRAVEL direction a little, not only the nose, so a drift shows the car sideways
      const sp = Math.hypot(c.vx, c.vz)
      const tx = sp > 3 ? c.vx / sp : fx, tz = sp > 3 ? c.vz / sp : fz
      const bx = fx * 0.65 + tx * 0.35, bz = fz * 0.65 + tz * 0.35, bl = Math.hypot(bx, bz) || 1
      const back = 6.8 + Math.min(2.2, sp * 0.05)
      const want = new THREE.Vector3(c.x - (bx / bl) * back, c.y + 2.3, c.z - (bz / bl) * back)
      want.y = Math.max(want.y, trackHeight(want.x, want.z) + 1.2)
      camPos.lerp(want, 1 - Math.exp(-frameDt * 7))
      cam.position.set(camPos.x + (Math.random() - 0.5) * sk, camPos.y + (Math.random() - 0.5) * sk, camPos.z)
      look.set(c.x + fx * 4, c.y + 1.0, c.z + fz * 4)
      cam.lookAt(look)
    } else {
      cam.position.set(c.x + fx * 0.4, c.y + 1.25, c.z + fz * 0.4)
      look.set(c.x + fx * 20, c.y + 1.0, c.z + fz * 20)
      cam.lookAt(look)
    }
    const fov = FOV + FOV_KICK * Math.min(1, Math.max(0, (Math.abs(fwd) - 12) / 30))
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, frameDt * 5); cam.updateProjectionMatrix() }

    hudT.current -= frameDt
    if (hudT.current <= 0) {
      hudT.current = 0.08
      onHud({ kmh: Math.hypot(fwd, lat) * 3.6, drift: slipAngle(c) > 0.26 && !c.airborne, air: c.airborne ? c.airT : 0, gearR: fwd < -0.5 })
    }
  })

  return (
    <>
      <DarterModel car={model} steer={steerVis} />
      <Cones bodies={coneBodies} />
    </>
  )
}

export default function DriveSlice() {
  const [hud, setHud] = useState<DriveHud>({ kmh: 0, drift: false, air: 0, gearR: false })
  const [started, setStarted] = useState(false)
  useEffect(() => {
    const go = () => setStarted(true)
    window.addEventListener('keydown', go, { once: true })
    return () => window.removeEventListener('keydown', go)
  }, [])
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#9fc3d6' }}>
      <Canvas camera={{ fov: FOV, near: 0.1, far: 900, position: [SPAWN.x, 4, SPAWN.z + 8] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <VoxelDayNight />
        <Track />
        <Driver onHud={setHud} />
      </Canvas>

      {/* speedo */}
      <div style={{ position: 'absolute', right: 20, bottom: 18, textAlign: 'right', color: '#f4efe2', pointerEvents: 'none', textShadow: '0 2px 8px rgba(0,0,0,0.55)' }}>
        <div style={{ font: '700 54px var(--font-game), system-ui', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{Math.round(hud.kmh)}</div>
        <div style={{ font: '600 11px var(--font-game), system-ui', letterSpacing: '0.25em', opacity: 0.75 }}>KM/H {hud.gearR ? '· R' : ''}</div>
      </div>
      {(hud.drift || hud.air > 0.25) && (
        <div style={{ position: 'absolute', left: '50%', top: '18%', transform: 'translateX(-50%)', font: '700 15px var(--font-game), system-ui', letterSpacing: '0.35em', color: '#d4a843', textShadow: '0 2px 10px rgba(0,0,0,0.6)', pointerEvents: 'none' }}>
          {hud.air > 0.25 ? `AIR ${hud.air.toFixed(1)}s` : 'DRIFT'}
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, top: 12, padding: '5px 9px', borderRadius: 6, background: 'rgba(12,16,20,0.5)', color: '#e8eef2', font: '600 11px var(--font-game), system-ui', letterSpacing: '0.2em', pointerEvents: 'none' }}>
        DARTER · TEST TRACK
      </div>
      {!started && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ padding: '18px 24px', borderRadius: 10, background: 'rgba(12,16,20,0.72)', color: '#eef3f6', font: '14px system-ui, sans-serif', lineHeight: 1.65, textAlign: 'center' }}>
            <div style={{ font: '600 13px system-ui', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 6 }}>The Darter · test track</div>
            W / ↑ throttle · S / ↓ brake, reverse · A D / ← → steer<br />
            Space handbrake (drift) · C camera · R reset
            <div style={{ opacity: 0.7, fontSize: 12, marginTop: 6 }}>Ahead: the jump. South straight: the whoops. Infield: slalom + skidpad. East: the hill.</div>
            <div style={{ marginTop: 8, fontWeight: 600 }}>Press any key to drive</div>
          </div>
        </div>
      )}
    </div>
  )
}
