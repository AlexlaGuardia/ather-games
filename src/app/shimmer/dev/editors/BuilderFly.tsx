'use client'

// ── BETA M83 p1 s1b: THE WORLD BUILDER's 3D VIEW (Alex 11-22: "fly around and build for hours.. zoom in and out without any nodes") ──
// The terrain editor's FLY toggle. It draws the SAME ground the 2D view sculpts (the parsed tile + its 8 neighbours, bare, plus the
// draft's edits) as plain coloured terrain: NO trees, crystals, foraging, towns or props (nodes populate later on the finished map).
// The brush is the editor's own (onBegin / onMove / onEnd take WORLD coords from a raycast), so undo, autosave and Publish are shared.
// Camera = fly-cam.ts (pure): WASD + Space/C, Shift fast, right-drag look, wheel dolly, T top-down. Desktop only (Alex 08: the 3D
// editor stays desktop-only).

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { stepCam, lookCam, zoomCam, toggleTop, camOver, NO_KEYS, type Cam, type Keys } from './fly-cam'
import { ramp } from './terrain-ramp'

export interface FlyTile { name: string; ox: number; oz: number; nx: number; nz: number; cell: number; sizeX: number; sizeZ: number; h: Float32Array; waterY: number
  /** M83 s2a (the Glade): vertices that are not ground; a quad touching one is not drawn, so the islands float in the void */
  voidV?: Uint8Array }
interface Props {
  tiles: FlyTile[]
  /** the draft's height deltas per tile (dm), read live each rev */
  deltas: (name: string) => Record<string, number> | undefined
  rev: number
  heightAt: (x: number, z: number) => number
  radius: number
  focus: { x: number; z: number }
  onBegin: (x: number, z: number) => void
  onMove: (x: number, z: number) => void
  onEnd: () => void
  onHover?: (x: number, z: number) => void
}
// sRGB -> linear (three's own SRGBToLinear is not exported from the package root at runtime, though the types say it is)
const lin = (c: number) => { c = Math.min(1, c); return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4) }
export const FLY_STRIDE = 2   // draw every 2nd grid vertex (8 m): 9 tiles x 126^2 verts; the brush still edits the full 4 m grid

const KEYMAP: Record<string, keyof Keys> = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r', Space: 'up', KeyC: 'down', ShiftLeft: 'fast', ShiftRight: 'fast' }
const typing = (e: Event) => { const el = e.target as HTMLElement | null; return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') }

function TileMesh({ t, deltas, rev, onDown, onMoveP }: { t: FlyTile; deltas: Props['deltas']; rev: number; onDown: (e: ThreeEvent<PointerEvent>) => void; onMoveP: (e: ThreeEvent<PointerEvent>) => void }) {
  const cols = Math.floor((t.nx - 1) / FLY_STRIDE) + 1, rows = Math.floor((t.nz - 1) / FLY_STRIDE) + 1
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(cols * rows * 3), col = new Float32Array(cols * rows * 3), idx: number[] = []
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = j * cols + i
      pos[v * 3] = t.ox - t.sizeX / 2 + Math.min(t.nx - 1, i * FLY_STRIDE) * t.cell
      pos[v * 3 + 2] = t.oz - t.sizeZ / 2 + Math.min(t.nz - 1, j * FLY_STRIDE) * t.cell
      if (i < cols - 1 && j < rows - 1) {
        const V = t.voidV, kk = (ii: number, jj: number) => Math.min(t.nz - 1, jj * FLY_STRIDE) * t.nx + Math.min(t.nx - 1, ii * FLY_STRIDE)
        if (V && (V[kk(i, j)] || V[kk(i + 1, j)] || V[kk(i, j + 1)] || V[kk(i + 1, j + 1)])) continue
        idx.push(v, v + cols, v + 1, v + 1, v + cols, v + cols + 1)
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx)
    return g
  }, [t, cols, rows])
  useEffect(() => () => geo.dispose(), [geo])
  // heights + colours from the base + the draft's deltas, every rev (a brush tick)
  useEffect(() => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute, col = geo.getAttribute('color') as THREE.BufferAttribute
    const P = pos.array as Float32Array, C = col.array as Float32Array, E = deltas(t.name)
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = j * cols + i, k = Math.min(t.nz - 1, j * FLY_STRIDE) * t.nx + Math.min(t.nx - 1, i * FLY_STRIDE)
      const y = t.h[k] + (E?.[k] ?? 0) / 10
      P[v * 3 + 1] = y
      const [r, g, b] = y < t.waterY ? [0.30, 0.48, 0.66] : ramp(y - t.waterY)
      const tint = E?.[k] ? 1.12 : 1   // edited ground reads a touch brighter, like the 2D view's tint
      // M83 s1c: the ramp is sRGB (the 2D canvas paints it raw); three treats vertex colours as LINEAR and re-encodes on output,
      // so raw values came out washed (pale hills, near-white peaks). Decode once here.
      C[v * 3] = lin(r * tint); C[v * 3 + 1] = lin(g * tint); C[v * 3 + 2] = lin(b * tint)
    }
    pos.needsUpdate = true; col.needsUpdate = true
    geo.computeVertexNormals(); geo.computeBoundingSphere(); geo.computeBoundingBox()
  }, [geo, rev, t, deltas, cols, rows])
  return <mesh geometry={geo} onPointerDown={onDown} onPointerMove={onMoveP}><meshLambertMaterial vertexColors /></mesh>
}

function Rig({ heightAt, focus, camRef }: { heightAt: Props['heightAt']; focus: Props['focus']; camRef: React.MutableRefObject<Cam | null> }) {
  const { camera, gl } = useThree()
  const keys = useRef<Keys>({ ...NO_KEYS })
  if (!camRef.current) camRef.current = camOver(focus.x, focus.z, heightAt)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.metaKey) return
      const k = KEYMAP[e.code]; if (k) { keys.current[k] = true; if (e.code === 'Space') e.preventDefault() }
      if (e.code === 'KeyT' && !e.repeat && camRef.current) camRef.current = toggleTop(camRef.current, heightAt)
    }
    const up = (e: KeyboardEvent) => { const k = KEYMAP[e.code]; if (k) keys.current[k] = false }
    const blur = () => { keys.current = { ...NO_KEYS } }
    // right-drag looks; the context menu never opens on the canvas
    let looking = false
    const el = gl.domElement
    const pd = (e: PointerEvent) => { if (e.button === 2) { looking = true; el.setPointerCapture(e.pointerId) } }
    const pm = (e: PointerEvent) => { if (looking && camRef.current) camRef.current = lookCam(camRef.current, e.movementX, e.movementY) }
    const pu = (e: PointerEvent) => { if (e.button === 2) looking = false }
    const cm = (e: Event) => e.preventDefault()
    const wh = (e: WheelEvent) => { e.preventDefault(); if (camRef.current) camRef.current = zoomCam(camRef.current, e.deltaY, heightAt) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
    el.addEventListener('pointerdown', pd); el.addEventListener('pointermove', pm); el.addEventListener('pointerup', pu); el.addEventListener('contextmenu', cm); el.addEventListener('wheel', wh, { passive: false })
    return () => {
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
      el.removeEventListener('pointerdown', pd); el.removeEventListener('pointermove', pm); el.removeEventListener('pointerup', pu); el.removeEventListener('contextmenu', cm); el.removeEventListener('wheel', wh)
    }
  }, [gl, heightAt, camRef])
  useFrame((_, dt) => {
    const c = camRef.current; if (!c) return
    const n = stepCam(c, keys.current, Math.min(dt, 0.1), heightAt); camRef.current = n
    camera.position.set(n.x, n.y, n.z)
    camera.rotation.set(n.pitch, n.yaw, 0, 'YXZ')
  })
  return null
}

function Cursor({ at, radius, heightAt }: { at: React.MutableRefObject<{ x: number; z: number } | null>; radius: number; heightAt: Props['heightAt'] }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const m = ref.current, p = at.current; if (!m) return
    m.visible = !!p; if (!p) return
    m.position.set(p.x, heightAt(p.x, p.z) + 0.6, p.z); m.scale.setScalar(radius)
  })
  return <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}><ringGeometry args={[0.92, 1, 48]} /><meshBasicMaterial color="#fbbf24" transparent opacity={0.9} depthTest={false} /></mesh>
}

export default function BuilderFly(p: Props) {
  const camRef = useRef<Cam | null>(null)
  const hover = useRef<{ x: number; z: number } | null>(null)
  const painting = useRef(false)
  const pr = useRef(p); pr.current = p
  useEffect(() => {
    const up = () => { if (painting.current) { painting.current = false; pr.current.onEnd() } }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [])
  // test hook (scripts/builder-fly-check.mts): the camera, a scripted fly, and "is anything but terrain drawn?"
  const sceneRef = useRef<THREE.Scene | null>(null)
  useEffect(() => {
    ;(window as unknown as { __builderFly?: unknown }).__builderFly = {
      cam: () => camRef.current,
      /** every mesh in the scene by geometry kind: terrain tiles, the sea plane, the brush ring, and anything else (want none) */
      scene: () => {
        const n = { tiles: 0, sea: 0, ring: 0, other: [] as string[] }
        sceneRef.current?.traverse(o => {
          if (!(o as THREE.Mesh).isMesh) return
          const t = (o as THREE.Mesh).geometry?.type
          if (t === 'BufferGeometry') n.tiles++; else if (t === 'PlaneGeometry') n.sea++; else if (t === 'RingGeometry') n.ring++; else n.other.push(t ?? o.type)
        })
        return n
      },
      setCam: (c: Partial<Cam>) => { if (camRef.current) camRef.current = { ...camRef.current, ...c } },
      top: () => { if (camRef.current) camRef.current = toggleTop(camRef.current, pr.current.heightAt) },
    }
    return () => { delete (window as unknown as { __builderFly?: unknown }).__builderFly }
  }, [])
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    if (e.button !== 0) return
    e.stopPropagation(); painting.current = true; hover.current = { x: e.point.x, z: e.point.z }
    pr.current.onBegin(e.point.x, e.point.z)
  }
  const onMoveP = (e: ThreeEvent<PointerEvent>) => {
    hover.current = { x: e.point.x, z: e.point.z }
    pr.current.onHover?.(e.point.x, e.point.z)
    if (painting.current) pr.current.onMove(e.point.x, e.point.z)
  }
  const waterY = p.tiles[0]?.waterY ?? 0
  return (
    <Canvas camera={{ fov: 60, near: 0.5, far: 6000 }} gl={{ antialias: true }} onPointerLeave={() => { hover.current = null }} data-testid="builder-fly"
      onCreated={({ scene }) => { sceneRef.current = scene; scene.background = new THREE.Color('#9fc4dd'); scene.fog = new THREE.Fog('#9fc4dd', 1500, 5000) }}>
      <hemisphereLight args={['#ffffff', '#5a6b4a', 0.9]} />
      <directionalLight position={[-300, 600, -200]} intensity={1.1} />
      <Rig heightAt={p.heightAt} focus={p.focus} camRef={camRef} />
      {p.tiles.map(t => <TileMesh key={t.name} t={t} deltas={p.deltas} rev={p.rev} onDown={onDown} onMoveP={onMoveP} />)}
      {/* the Glade (tiles with void) has no sea: its islands float in the cloud */}
      {p.tiles.length > 0 && !p.tiles.some(t => t.voidV) && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[p.focus.x, waterY, p.focus.z]}><planeGeometry args={[3200, 3200]} /><meshLambertMaterial color="#3d6f99" transparent opacity={0.75} /></mesh>}
      <Cursor at={hover} radius={p.radius} heightAt={p.heightAt} />
    </Canvas>
  )
}
