'use client'

// THE GREEN, ALONE — the Snagbarrows' set piece on a bare plane, free or taken, from any bearing.
//
// ★★★ WHY THIS PAGE EXISTS. The generator for this hold is four pure modules — `burrowtown`,
// `hold-rows`, `ring-floor`, `green-terrain` — with 130-odd asserts between them, and **not one
// human has seen a single block of it.** It also has no worldgen home: the Snagbarrows is Wilds
// Act 2 and the Wilds are behind the sealed Ather Winds gate, so there is nowhere in the world to
// walk to. `dev/court` made the same argument for the crossing station and paid for itself the same
// evening; this is that argument for a set piece that cannot be visited at all.
//
// ⚠⚠ AND IT IS NOT A HOME FOR THE GENERATOR, IT IS A WINDOW ONTO IT. Nothing here decides anything.
// Every block comes from `greenProfileAt` / `greenSurfaceAt` and every seat from `holdRows` — the
// same functions the world will call. `dev/court`'s history counts what re-deriving costs: one
// guessed material id rendered a whole tower in dirt brown while every assert stayed green.
//
// ── ★★ THE FREE/TAKEN TOGGLE IS THE POINT, NOT A CONVENIENCE ──────────────────────────────────
// Canon's beat S6 frees the hold and *"the lights come up out of the rows. The hill goes properly
// bright for the first time in the act."* The doctrine is a LAYER over an intact free town, so the
// same green must render both ways from one generator — and the difference you see here IS the
// reward the whole act is built to deliver. ⚠ The banks are in BOTH: the ground was worn by a town
// that gathered here long before anyone collared anything, and freeing does not un-dig it.
//
// Run: tools/devwin.sh world → http://localhost:3200/shimmer/dev/hold
// Shot: WORLD_OWNER=1 WORLD_URL='http://localhost:3200/shimmer/dev/hold' npx tsx scripts/world-shot.mts out.png 5
import { useEffect, useMemo, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { MAT } from '../../voxel/depth'
import { blockDef } from '../../voxel/registry'
import { buildTileArray, sliceLayer, layerOf, TOP, SIDE, BOTTOM } from '../../voxel3d/tex/tiles'
import { VoxelDayNight, DAY } from '../../voxel3d/day-night'
import { setTimePin } from '../../engine/day-cycle'
import { BODY_H, BODY_R, EYE_STAND } from '../../voxel3d/locomotion'
import { DOWNBARROW_HEARTS } from '../../voxel/burrowtown'
import { holdRows, bowlCentre, DEFAULT_ROWS } from '../../voxel/hold-rows'
import { greenProfileAt, greenSurfaceAt, type GreenMats } from '../../voxel/green-terrain'
import type { Box } from '../../voxel/jigsaw'

const TILE = 16
/** Courses of ground under the surface, so the green reads as land rather than as a sheet. */
const SOIL_DEPTH = 3

/**
 * The scene height a figure's FEET rest at, over the cell (x, z).
 *
 * ── ⚠⚠ `greenProfileAt` RETURNS THE TOP SOLID CELL. A KEEPER STANDS ON TOP OF IT. ──────────────
 * A cell at `y` is drawn as a unit box centred at `y + 0.5` (see `Inst`), so the face you walk on
 * is at `y + 1`. The two numbers are one block apart, both are honest, and both are named like
 * heights — which is exactly how this page shipped with every figure on the green sunk a full
 * block: the audience was placed at the bank's top-cell INDEX and the keeper at a typed `0`.
 * Measured against the generator before the fix: **91 of 91 seats, 0.975 blocks low.**
 *
 * ★ THE WORLD LANE FOUND THE IDENTICAL DEFECT THE SAME AFTERNOON, in the bridge abutments —
 * `columnHeight` (top solid) fed to `deckTopAt` (standing surface), one block low, "both honest,
 * both named like heights". Two files, one confusion, found independently. Anything that wants a
 * FLOOR on this page asks here and nowhere else.
 */
const standAt = (green: Box, x: number, z: number, entryYaw: number): number =>
  greenProfileAt(green, Math.round(x), Math.round(z), entryYaw) + 1

/** A collared spirit, seated. Named so the half-height below is DERIVED and not typed as `0.6`. */
const SEAT_R = 0.3
const SEAT_LEN = 0.55
/** Centre-to-foot of that capsule: the straight half plus the cap. */
const SEAT_HALF = SEAT_LEN / 2 + SEAT_R

/**
 * ★ THE ONLY PLACE IN THIS FEATURE THAT NAMES A MATERIAL. `green-terrain` takes them as arguments
 * because it sits inside the `depth.ts`/`attrs.ts` module cycle; a dev page does not, so the
 * bundle is chosen here, once, and the world will choose its own the same way.
 */
const MATS: GreenMats = {
  grass: MAT.TOPSOIL,
  bare: MAT.PATH,        // "Worn Path" — the same material a hold's trodden ground already uses
  scorch: MAT.GREY_SOIL, // the greying, made ground
  // ⚠ GRASS, NOT SUBSOIL, AND ALEX NAMED THE PROBLEM: *"just looks like a dirt horseshoe."* The
  // banks were brown subsoil, which reads as imported earth — a thing somebody carted in and heaped
  // up. They are none of that: they are **the plot's own ground, raised**, and canon's ground row is
  // *"the plot's grass and paths, worn, trampled, dragged-over"*. Green banks around a bare floor
  // put the contrast where the meaning is, and stop the whole set piece reading as a spoil heap.
  tier: MAT.TOPSOIL,
}

type Cell = { x: number; y: number; z: number; m: number }

function useTiles(materials: number[]): Map<string, THREE.DataTexture> {
  return useMemo(() => {
    const all = buildTileArray(TILE)
    const m = new Map<string, THREE.DataTexture>()
    for (const mat of materials) for (const face of [TOP, SIDE, BOTTOM]) {
      const px = sliceLayer(all, TILE, layerOf(mat, face))
      const t = new THREE.DataTexture(px, TILE, TILE, THREE.RGBAFormat)
      t.colorSpace = THREE.SRGBColorSpace
      t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter
      t.needsUpdate = true
      m.set(`${mat}:${face}`, t)
    }
    return m
  }, [materials.join(',')])
}

const FACE_ORDER = [SIDE, SIDE, TOP, BOTTOM, SIDE, SIDE]

function Blocks({ cells, tex }: { cells: Cell[]; tex: Map<string, THREE.DataTexture> }) {
  const mats = useMemo(() => [...new Set(cells.map(c => c.m))].sort((a, b) => a - b), [cells])
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  return (
    <>
      {mats.map(mat => {
        const mine = cells.filter(c => c.m === mat)
        const materials = FACE_ORDER.map(f => new THREE.MeshLambertMaterial({ map: tex.get(`${mat}:${f}`) ?? null }))
        return <Inst key={mat} geo={geo} materials={materials} cells={mine} />
      })}
    </>
  )
}

function Inst({ geo, materials, cells }: { geo: THREE.BoxGeometry; materials: THREE.Material[]; cells: Cell[] }) {
  const ref = useMemo(() => ({ current: null as THREE.InstancedMesh | null }), [])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const d = new THREE.Object3D()
    cells.forEach((c, i) => {
      d.position.set(c.x + 0.5, c.y + 0.5, c.z + 0.5)
      d.updateMatrix(); mesh.setMatrixAt(i, d.matrix)
    })
    mesh.count = cells.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cells, ref])
  return <instancedMesh ref={r => { ref.current = r }}
    args={[geo, materials as unknown as THREE.Material, Math.max(1, cells.length)]} frustumCulled={false} />
}

/**
 * The audience. ⚠ ONLY ON A TAKEN GREEN — the rows are collared spirits, so a free Downbarrow has
 * the same banks with nobody sat on them. That contrast is beat S6 and it is the reason for the toggle.
 *
 * ★ Dimmed, because canon's whole image is *"he collars the brightest thing in the world and keeps
 * it just bright enough to show"* — a Luminara at full brightness here would say the opposite thing.
 */
function Audience({ green, entryYaw }: { green: Box; entryYaw: number }) {
  const seats = useMemo(() => holdRows(green, entryYaw), [green, entryYaw])
  const geo = useMemo(() => new THREE.CapsuleGeometry(SEAT_R, SEAT_LEN, 3, 6), [])
  // ★★ THEY HAVE TO READ AS LIGHTS, AND THE FIRST PASS DID NOT. Dim grey capsules on brown banks
  // vanished at dusk — and canon's whole first image of this hold, from the bramble road, is
  // *"small lights, moving, in rows"*, with the horror arriving only when you get close enough to
  // see what they are. An audience you cannot pick out is not the set piece canon says it is.
  //
  // ⚠ DIMMED, NOT DARK, AND THE DISTINCTION IS THE ACT. *"He collars the brightest thing in the
  // world and keeps it just bright enough to show."* A Luminara at full brightness here says the
  // opposite thing; one that is merely dark says they have already been put out. This is the
  // guttering middle, and it is what the S6 reward lifts.
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c8b168', emissive: '#8a6f28', emissiveIntensity: 0.85, roughness: 0.7,
  }), [])
  return (
    <>
      {seats.map((s, i) => (
        // ⚠ THE HEIGHT IS ASKED, NOT RE-DERIVED. This read `s.y + rise + 0.6`, which is the bank's
        // top-cell index plus a guess at half a capsule — a block low, on every seat. See `standAt`.
        <mesh key={i} geometry={geo} material={mat}
          position={[s.x + 0.5, standAt(green, s.x, s.z, entryYaw) + SEAT_HALF, s.z + 0.5]} />
      ))}
    </>
  )
}

/**
 * The camera, driven from INSIDE the Canvas.
 *
 * ⚠⚠ THIS WAS A `camera={{ position }}` PROP PLUS `onCreated(lookAt)` AND THE PAGE CAME UP BLACK IN
 * A REAL BROWSER — while rendering perfectly headless, which is how it got shipped. r3f applies its
 * own framing to a default camera and re-derives the projection on resize; a one-shot `lookAt` at
 * creation does not survive that, and nothing errors, so the console is clean and the canvas is
 * simply empty. **A black canvas with no error is a camera problem, not a render failure.**
 *
 * ★ AND THE FIX IS THE PATTERN THIS REPO ALREADY PROVED — `dev/court` and `dev/worktable` both
 * position the camera from a component inside the Canvas. I invented a shorter way and it worked on
 * the one instrument I could see with. Use the shape that ships.
 */
/**
 * ── ★★★ THE ORBIT CANNOT GET LOW, AND THAT IS WHY NOBODY HAD SEEN THIS PLACE ──────────────────
 * The orbit height is `target.y + 10 + dist * 0.45` — it is a FUNCTION OF THE DISTANCE, so there
 * is no vantage on this page below about sixteen blocks up, and at the default `dist` 46 the eye
 * rides **32 blocks over the green**. Every judgement made of this hold has been made from up
 * there. `dev/court` already carries the fix and its reasoning; this is that mode, here.
 *
 * ★ `eye` IS NOT A LOW ORBIT. The height is decided by the ground under the keeper's cell and by
 * `EYE_STAND`, never by `dist` — `dist` only says how far out they are standing. The look is
 * LEVEL, because that is what a keeper's default view is: the far bank rises into it or it does
 * not, and that is the question a picture from above cannot answer.
 */
function Rig({ target, yaw, dist, eye, eyePos }: {
  target: THREE.Vector3; yaw: number; dist: number; eye: boolean; eyePos: THREE.Vector3
}) {
  const { camera } = useThree()
  useEffect(() => {
    if (eye) {
      camera.position.copy(eyePos)
      camera.lookAt(target.x, eyePos.y, target.z)
    } else {
      camera.position.set(
        target.x + Math.cos(yaw) * dist,
        target.y + 10 + dist * 0.45,
        target.z + Math.sin(yaw) * dist)
      camera.lookAt(target)
    }
    camera.updateProjectionMatrix()
  }, [camera, target, yaw, dist, eye, eyePos])
  return null
}

/** A keeper-sized capsule, so proportion is FELT rather than read off a number. */
function Keeper({ at }: { at: [number, number, number] }) {
  return (
    <mesh position={[at[0], at[1] + BODY_H / 2, at[2]]}>
      <capsuleGeometry args={[BODY_R, Math.max(0.01, BODY_H - BODY_R * 2), 4, 8]} />
      <meshLambertMaterial color="#d98f3c" />
    </mesh>
  )
}

export default function HoldPreview() {
  const [taken, setTaken] = useState(true)
  const [entry, setEntry] = useState(0)
  const [hour, setHour] = useState(18)
  const [fog, setFog] = useState(true)
  const [which, setWhich] = useState(0)
  const [dist, setDist] = useState(46)
  const [yaw, setYaw] = useState(-0.7)
  const [eye, setEye] = useState(false)

  useEffect(() => { setTimePin(hour) }, [hour])
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    if (q.get('free') === '1') setTaken(false)
    if (q.get('hour')) setHour(Number(q.get('hour')))
    if (q.get('dist')) setDist(Number(q.get('dist')))
    if (q.get('yaw')) setYaw(Number(q.get('yaw')) * Math.PI / 180)
    if (q.get('fog') === '0') setFog(false)
    if (q.get('eye') === '1') setEye(true)
  }, [])

  const def = DOWNBARROW_HEARTS[which] ?? DOWNBARROW_HEARTS[0]
  const green: Box = useMemo(() => ({ x0: 0, x1: def.w - 1, z0: 0, z1: def.d - 1 }), [def])
  const c = bowlCentre(green)

  // ★ EVERY BLOCK COMES FROM THE SHIPPED FUNCTIONS. Nothing on this page knows the shape.
  const cells = useMemo(() => {
    const out: Cell[] = []
    for (let x = green.x0; x <= green.x1; x++) for (let z = green.z0; z <= green.z1; z++) {
      const top = greenProfileAt(green, x, z, entry)
      const surf = greenSurfaceAt(green, x, z, entry, taken, MATS)
      out.push({ x, y: top, z, m: surf === 0 ? MATS.grass : surf })
      for (let d = 1; d <= SOIL_DEPTH; d++) out.push({ x, y: top - d, z, m: MAT.SUBSOIL })
    }
    return out
  }, [green, entry, taken])

  const tex = useTiles(useMemo(() => [...new Set(cells.map(k => k.m))].sort((a, b) => a - b), [cells]))
  const target = useMemo(() => new THREE.Vector3(c.x, 2, c.z), [c.x, c.z])

  /**
   * Where the keeper is standing, and where their eye is. Snapped to the cell it stands on, so the
   * floor under the camera is the floor the generator actually lays there — not an interpolation
   * between two cells that would put the eye inside a bank on one bearing and over air on the next.
   */
  const eyePos = useMemo(() => {
    const kx = Math.round(c.x + Math.cos(yaw) * dist), kz = Math.round(c.z + Math.sin(yaw) * dist)
    return new THREE.Vector3(kx + 0.5, standAt(green, kx, kz, entry) + EYE_STAND, kz + 0.5)
  }, [green, entry, c.x, c.z, yaw, dist])

  /**
   * The reference figure. On the orbit it stands off the way in, where it reads against the rows.
   * ★ IN EYE MODE IT MOVES TO THE MIDDLE OF THE FLOOR, because from the keeper's own eye the
   * question stops being "how tall is a keeper" and becomes "how big is this ring" — and the only
   * honest answer to that is a keeper-sized figure standing in it at a real distance.
   */
  const refAt = useMemo(() => {
    const r = DEFAULT_ROWS.innerRadius + 7
    const kx = Math.round(eye ? c.x : c.x + Math.cos(entry) * r)
    const kz = Math.round(eye ? c.z : c.z + Math.sin(entry) * r)
    return [kx + 0.5, standAt(green, kx, kz, entry), kz + 0.5] as [number, number, number]
  }, [green, entry, c.x, c.z, eye])

  const seatCount = useMemo(() => holdRows(green, entry).length, [green, entry])

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0f14', color: '#dfe7ee',
                  font: '12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <Canvas camera={{ fov: 50, near: 0.1, far: 900 }}>
        <VoxelDayNight />
        <Rig target={target} yaw={yaw} dist={dist} eye={eye} eyePos={eyePos} />
        {!fog && <fog attach="fog" args={[DAY.bg, 5000, 6000]} />}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[c.x, -SOIL_DEPTH - 0.5, c.z]}>
          <planeGeometry args={[600, 600]} />
          <meshLambertMaterial color="#5f7a4e" />
        </mesh>
        <Blocks cells={cells} tex={tex} />
        {taken && <Audience green={green} entryYaw={entry} />}
        <Keeper at={refAt} />
      </Canvas>

      <div style={{ position: 'absolute', top: 8, left: 8, width: 268, background: 'rgba(8,12,16,0.86)',
                    border: '1px solid rgba(150,180,210,0.22)', borderRadius: 6, padding: '9px 11px' }}>
        <div style={{ textTransform: 'uppercase', letterSpacing: '0.09em', opacity: 0.6, fontSize: 10 }}>
          the snagbarrows — the green
        </div>
        <div style={{ margin: '4px 0 8px' }}>
          {def.id} · {def.w}x{def.d} · {taken ? `${seatCount} collared, in rows` : 'free — Downbarrow'}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
          <button style={btn(taken)} onClick={() => setTaken(true)}>taken</button>
          <button style={btn(!taken)} onClick={() => setTaken(false)}>free</button>
          <button style={btn(false)} onClick={() => setWhich(w => (w + 1) % DOWNBARROW_HEARTS.length)}>green ↻</button>
          <button style={btn(false)} onClick={() => setFog(f => !f)}>fog {fog ? 'on' : 'off'}</button>
          <button style={btn(eye)} onClick={() => setEye(e => !e)}>{eye ? 'keeper eye' : 'from above'}</button>
        </div>
        {(['hour', 'dist', 'yaw', 'way in'] as const).map(k => (
          <label key={k} style={{ display: 'block', opacity: 0.75, marginBottom: 5 }}>
            {k} {k === 'hour' ? hour : k === 'dist' ? dist : k === 'yaw' ? Math.round(yaw * 180 / Math.PI) : Math.round(entry * 180 / Math.PI)}
            <input type="range"
              min={k === 'hour' ? 0 : k === 'dist' ? 14 : -180}
              max={k === 'hour' ? 23 : k === 'dist' ? 140 : 180}
              value={k === 'hour' ? hour : k === 'dist' ? dist : Math.round((k === 'yaw' ? yaw : entry) * 180 / Math.PI)}
              onChange={e => {
                const v = Number(e.target.value)
                if (k === 'hour') setHour(v); else if (k === 'dist') setDist(v)
                else if (k === 'yaw') setYaw(v * Math.PI / 180); else setEntry(v * Math.PI / 180)
              }}
              style={{ width: '100%' }} />
          </label>
        ))}
        <div style={{ marginTop: 6, opacity: 0.5, fontSize: 10, lineHeight: 1.4 }}>
          the banks are in BOTH — the ground was worn by a town that gathered here long before anyone
          collared anything, and freeing does not un-dig it. what lifts is the colour and the rows.
        </div>
        <div style={{ marginTop: 6, opacity: 0.42, fontSize: 10 }}>
          {Object.entries(MATS).map(([k, m]) => `${k}=${blockDef(m)?.name ?? m}`).join(' · ')}
        </div>
      </div>
    </div>
  )
}

const btn = (on: boolean): React.CSSProperties => ({
  background: 'rgba(30,40,52,0.9)', color: on ? '#ffcf8a' : '#cfd8e0',
  border: `1px solid ${on ? '#ffcf8a' : 'rgba(150,180,210,0.25)'}`,
  borderRadius: 4, padding: '3px 8px', font: 'inherit', cursor: 'pointer',
})
