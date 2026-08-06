'use client'

// The block-texture spike: the SAME terrain rendered twice, 32px tiles on the left, 64px on the right.
//
// ★ WHY TWO COPIES OF ONE PATCH AND NOT TWO WORLDS. The question is "does the extra resolution reach
// my eye", and that question is only answerable if geometry, lighting, camera and distance are
// identical between the two. So one patch is generated once and both groups share the very same
// BufferGeometry objects — the ONLY difference between left and right is which texture array the
// material samples. Any difference you see is the tile size, by construction.
//
// ★ WHY IT DOES NOT USE THE WORKER. The generation worker belongs to the voxel3d main route and is
// being repaired in another window. A look test does not need streaming: it needs one fixed patch,
// generated once, that never changes while you walk around it. Blocking the main thread for ~0.7s at
// boot is the correct trade here, and it keeps this file entirely out of that lane's way.
//
// ⚠ THIS IS A TEST BED FOR A LOOK CALL, NOT A FEATURE. Nothing here is wired into the game.

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { SECTION, makeColumn, meshColumn, type Column } from '../../voxel/column'
import { createMeshScratch } from '../../voxel/greedy'
import { columnHeight } from '../../voxel/height'
import { buildAttrs } from '../attrs'
import { toGeometry, createVoxelMaterial } from '../mesh-bridge'
import { makeTileArray, createTexturedVoxelMaterial, type TileArray } from './atlas'
import { layerOf, faceOfNormal } from './tiles'
import { TileStrip } from './TileStrip'

const SEED = 1337
/** 8x8 columns = a 128-block patch. Big enough to stand back ~90 blocks and judge minification,
 *  small enough that generating it twice-over costs under a second. */
const PATCH = 8
const SPAN = PATCH * SECTION
/** Gap between the two copies — wide enough to read as two places, narrow enough to pan between. */
const GAP = 24
const OFFSET = SPAN + GAP

type Built = { geom: THREE.BufferGeometry; x: number; y: number; z: number }

export default function TexSpike() {
  const [built, setBuilt] = useState<Built[] | null>(null)
  const [note, setNote] = useState('generating a 128-block patch…')
  const [textured, setTextured] = useState(true)
  const [mips, setMips] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  // ── generate once, off the first paint so the HUD message is actually seen ──────────────────────
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      if (cancelled) return
      try {
        const t0 = performance.now()
        const cols = new Map<string, Column>()
        for (let cz = 0; cz < PATCH; cz++)
          for (let cx = 0; cx < PATCH; cx++)
            cols.set(`${cx},${cz}`, makeColumn(cx * SECTION, cz * SECTION, SEED))
        const tGen = performance.now() - t0

        const t1 = performance.now()
        const scratch = createMeshScratch(SECTION)
        const out: Built[] = []
        let quads = 0
        let faces = 0
        for (let cz = 0; cz < PATCH; cz++) {
          for (let cx = 0; cx < PATCH; cx++) {
            const col = cols.get(`${cx},${cz}`)!
            // Absent neighbours at the patch rim mesh as air, so the patch has visible walls at its
            // edge. That is correct and wanted here — it is a slab you look AT, not a world you
            // stream through, and the walls let you read the ore bands and depth layers in section.
            for (const sm of meshColumn(col, {
              negX: cols.get(`${cx - 1},${cz}`) ?? null,
              posX: cols.get(`${cx + 1},${cz}`) ?? null,
              negZ: cols.get(`${cx},${cz - 1}`) ?? null,
              posZ: cols.get(`${cx},${cz + 1}`) ?? null,
            }, scratch)) {
              const geom = toGeometry(buildAttrs(sm.mesh))
              geom.setAttribute('aLayer', new THREE.BufferAttribute(layerAttr(sm.mesh.materials, sm.mesh.normals), 1))
              out.push({ geom, x: sm.wx, y: sm.wy, z: sm.wz })
              quads += sm.mesh.quads
              faces += sm.mesh.faces
            }
          }
        }
        const tMesh = performance.now() - t1
        if (cancelled) return
        setBuilt(out)
        setNote(
          `${PATCH * PATCH} columns · ${out.length} meshes · ${quads.toLocaleString()} quads ` +
          `from ${faces.toLocaleString()} faces (${(faces / Math.max(1, quads)).toFixed(1)}x greedy win) · ` +
          `gen ${tGen | 0}ms mesh ${tMesh | 0}ms`,
        )
      } catch (e) {
        setErr(String(e))
      }
    }, 30)
    return () => { cancelled = true; clearTimeout(t) }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') setTextured(false)
      if (e.code === 'Digit2') setTextured(true)
      if (e.code === 'KeyM') setMips(m => !m)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 bg-[#0b0d14]">
      <Canvas camera={{ fov: 75, near: 0.1, far: 900 }} shadows={false}>
        <color attach="background" args={['#8fb7d9']} />
        {/* No fog. Fog is exactly what would hide the difference this test is trying to show. */}
        <hemisphereLight args={['#cfe6ff', '#3b3a4a', 1.5]} />
        <directionalLight position={[80, 200, 40]} intensity={1.5} />
        <ambientLight intensity={0.35} />
        {built && <Patches built={built} textured={textured} mips={mips} onError={setErr} />}
        <FlyCam />
        <PointerLockControls />
      </Canvas>

      <div className="absolute top-3 left-3 text-[11px] font-mono text-white/80 bg-black/50 rounded px-2.5 py-2 leading-relaxed pointer-events-none max-w-[26rem]">
        <div className="text-white/95 font-semibold tracking-wide">SHIMMER · BLOCK TEXTURE SPIKE</div>
        <div className="mt-0.5">
          <span className="text-emerald-300">LEFT = 32px</span>
          <span className="text-white/40"> · </span>
          <span className="text-amber-300">RIGHT = 64px</span>
          <span className="text-white/40"> · identical geometry</span>
        </div>
        <div className="text-white/55 mt-1">{note}</div>
        <div className="text-white/70 mt-1">
          mode: {textured ? 'TEXTURED' : 'FLAT COLOUR (control)'} · mipmaps: {mips ? 'on' : 'OFF'}
        </div>
        <div className="mt-1.5 text-white/45">
          click to look · WASD · space up · ctrl down · shift fast<br />
          1 flat · 2 textured · M mipmaps<br />
          <span className="text-white/30">?cam=x,y,z&amp;look=x,y,z pins the shot</span>
        </div>
        <div className="mt-1.5 text-white/35 leading-snug">
          Fly back until the two look the same. That distance is where 64px stops paying.
        </div>
      </div>

      <TileStrip />

      {err && (
        <div className="absolute inset-x-0 bottom-0 bg-red-950/90 text-red-200 text-[11px] font-mono px-3 py-2 leading-relaxed">
          {err}
        </div>
      )}
    </div>
  )
}

/**
 * Per-vertex texture layer, derived from what the mesher already emits.
 *
 * ★ NOTHING IN THE PURE CORE HAD TO CHANGE FOR THIS. Face direction is not exported by `greedy.ts`,
 * but the per-vertex NORMAL is, and for axis-aligned quads the normal IS the face. So top/side/bottom
 * variants work today, with `voxel/` untouched — which also keeps this spike off the toes of the
 * window repairing the worker. If per-face texturing graduates, exporting a face id per quad is the
 * tidier form; it is not needed to answer the look question.
 */
function layerAttr(materials: Uint16Array, normals: Float32Array): Float32Array {
  const n = materials.length
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = layerOf(materials[i], faceOfNormal(normals[i * 3 + 1]))
  return out
}

function Patches({ built, textured, mips, onError }: {
  built: Built[]
  textured: boolean
  mips: boolean
  onError: (s: string) => void
}) {
  const { gl } = useThree()
  const [tiles32, tiles64] = useMemo(() => {
    try {
      return [makeTileArray(32, gl), makeTileArray(64, gl)] as [TileArray, TileArray]
    } catch (e) {
      onError(`tile generation failed: ${e}`)
      throw e
    }
  }, [gl, onError])

  const m32 = useMemo(() => createTexturedVoxelMaterial(tiles32), [tiles32])
  const m64 = useMemo(() => createTexturedVoxelMaterial(tiles64), [tiles64])
  const flat = useMemo(() => createVoxelMaterial(), [])

  useEffect(() => { m32.setMipmapped(mips); m64.setMipmapped(mips) }, [m32, m64, mips])

  // ⚠ Dispose on unmount. Two array textures at 43 layers are ~860KB of VRAM; a hot-reload loop that
  // leaks them is how a dev session ends in a context loss with no obvious cause.
  useEffect(() => () => {
    tiles32.texture.dispose(); tiles64.texture.dispose()
    m32.material.dispose(); m64.material.dispose(); flat.dispose()
  }, [tiles32, tiles64, m32, m64, flat])

  const left = textured ? m32.material : flat
  const right = textured ? m64.material : flat

  return (
    <>
      <group>
        {built.map((b, i) => (
          <mesh key={`l${i}`} geometry={b.geom} material={left} position={[b.x, b.y, b.z]} />
        ))}
      </group>
      <group position={[OFFSET, 0, 0]}>
        {built.map((b, i) => (
          <mesh key={`r${i}`} geometry={b.geom} material={right} position={[b.x, b.y, b.z]} />
        ))}
      </group>
    </>
  )
}

/** Free-fly only — this is a look test, so collision would just get in the way of standing where you
 *  want to stand. */
function FlyCam() {
  const { camera } = useThree()
  const keys = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const d = (e: KeyboardEvent) => { keys.current[e.code] = true }
    const u = (e: KeyboardEvent) => { keys.current[e.code] = false }
    window.addEventListener('keydown', d); window.addEventListener('keyup', u)
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u) }
  }, [])

  // Open framed on BOTH patches, because a comparison you have to go looking for is a comparison
  // that does not get made.
  //
  // ⚠ The midpoint is NOT `OFFSET / 2`. The left patch spans x 0..SPAN and the right spans
  // OFFSET..OFFSET+SPAN, so the pair is centred at `(OFFSET + SPAN) / 2` — got this wrong first
  // time and it opened looking at the left patch with the right one off-screen entirely.
  //
  // ★ `?cam=x,y,z&look=x,y,z` OVERRIDES THE OPENING SHOT, and it earns its keep twice. Comparing two
  // renders is only honest from the SAME viewpoint, and eyeballing your way back to the same spot
  // twice does not happen. It is also the only way to capture a specific view from a backgrounded
  // tab, where the render loop only advances during a screenshot and flying is therefore impossible.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const vec = (k: string) => {
      const p = (q.get(k) ?? '').split(',').map(Number)
      return p.length === 3 && p.every(Number.isFinite) ? p : null
    }
    const cam = vec('cam')
    const look = vec('look')
    if (cam) {
      camera.position.set(cam[0], cam[1], cam[2])
      const l = look ?? [cam[0], cam[1], cam[2] - 1]
      camera.lookAt(l[0], l[1], l[2])
      return
    }

    const midX = (OFFSET + SPAN) / 2
    const h = columnHeight(SPAN / 2, SPAN / 2, SEED)
    // Back off far enough that the full pair fits the narrower of the two FOV axes. Vertical FOV is
    // 75deg; on a portrait viewport the horizontal cone is the tighter one, so solve for that.
    const aspect = typeof window !== 'undefined' ? window.innerWidth / window.innerHeight : 1.6
    const hFov = 2 * Math.atan(Math.tan((75 * Math.PI / 180) / 2) * Math.min(aspect, 1.6))
    const need = (OFFSET + SPAN) / 2 / Math.tan(hFov / 2)
    camera.position.set(midX, h + 46, SPAN / 2 + need)
    camera.lookAt(midX, h, SPAN / 2)
  }, [camera])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current
    const speed = (k.ShiftLeft ? 60 : 18)
    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
    const wish = new THREE.Vector3()
    if (k.KeyW) wish.add(fwd)
    if (k.KeyS) wish.sub(fwd)
    if (k.KeyD) wish.add(right)
    if (k.KeyA) wish.sub(right)
    if (k.Space) wish.y += 1
    if (k.ControlLeft) wish.y -= 1
    if (wish.lengthSq() > 0) camera.position.addScaledVector(wish.normalize(), speed * dt)
  })

  return null
}
