'use client'

/**
 * Rune Hold's look — the Passage's materials over the town's own grid (`rune-hold-look.ts`).
 *
 * ★ A BLOCKOUT WITH A MOOD, not final art (the art-medium law: generated first, Alex judges). Canon's
 * words are the brief: *"stone buildings stacked along winding streets. Warm lantern light."* So the
 * brown boxes become coursed stone with a timber band, lit windows, a slate gable and a chimney; the
 * long east run becomes the dug hillside the town is carved into; the paths are laid as cobbles and the
 * grass goes from lawn to mountain meadow; lanterns stand on the street edges.
 *
 * `ZoneGeometry` is told `ownSolids` for this zone, so its brown blocks are not drawn and these are.
 * The ground is laid a hair ABOVE the zone's own floor tiles, which still draw underneath (editing and
 * the warp glow keep working). Collision is untouched: the walker still reads the grid.
 *
 * ⚠ LIGHT BUDGET (memory: reference_alex_desktop_gpu): the town has a sun, so lanterns are emissive
 * glass and only the few round the square carry a real light.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { blocksOf, lanternsOf, openSides, hash, isBuilding, inFront, PATH, BUILDING, FRONTS, NOTICE_BOARD, type Block, type Front } from './rune-hold-look'
import { runeHold as RH, passage as P, hubGate } from './scene-palette'
import { LANDING } from '../world/landing'
import { portalMaterial } from '../voxel3d/portal-material'

export interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; tilt?: number; c: string }

/** One instanced mesh of unit boxes (or planes laid flat), each placed, scaled and coloured. */
/** `emissive` lights every instance; `glow` is its colour (the town's window glass unless told otherwise). */
export function Instances({ items, flat, emissive, glow = RH.window, cast = true }: { items: Inst[]; flat?: boolean; emissive?: number; glow?: string; cast?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const r = ref.current
    if (!r) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color()
    const v = new THREE.Vector3(), s = new THREE.Vector3()
    items.forEach((b, i) => {
      e.set(flat ? -Math.PI / 2 : (b.tilt ?? 0), flat ? 0 : (b.yaw ?? 0), flat ? (b.yaw ?? 0) : (b.tilt ?? 0) * 0.7, flat ? 'YXZ' : 'XYZ')
      q.setFromEuler(e)
      m.compose(v.set(b.x, b.y, b.z), q, s.set(b.sx, b.sy, b.sz))
      r.setMatrixAt(i, m); r.setColorAt(i, col.set(b.c))
    })
    r.instanceMatrix.needsUpdate = true
    if (r.instanceColor) r.instanceColor.needsUpdate = true
    r.computeBoundingSphere()
  }, [items, flat])
  if (!items.length) return null
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={cast && !flat} receiveShadow>
      {flat ? <planeGeometry args={[1, 1]} /> : <boxGeometry args={[1, 1, 1]} />}
      {emissive
        ? <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={emissive} roughness={0.6} />
        : <meshStandardMaterial roughness={0.95} />}
    </instancedMesh>
  )
}

const pick = <T,>(arr: readonly T[], x: number, z: number, k: number) => arr[Math.floor(hash(x, z, k) * arr.length) % arr.length]

/** A gable per house: one merged mesh, vertex-coloured, eaves past the walls. */
function roofsOf(blocks: Block[], heightAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const pos: number[] = [], col: number[] = []
  const c = new THREE.Color()
  const tri = (a: number[], b: number[], d: number[], hex: string, shade = 1) => {
    pos.push(...a, ...b, ...d)
    c.set(hex).multiplyScalar(shade)
    for (let i = 0; i < 3; i++) col.push(c.r, c.g, c.b)
  }
  const quad = (a: number[], b: number[], d: number[], e: number[], hex: string, shade = 1) => { tri(a, b, d, hex, shade); tri(a, d, e, hex, shade) }
  for (const b of blocks) {
    if (b.kind !== 'house') continue
    const eave = 0.45
    const x0 = b.x0 - 0.5 - eave, x1 = b.x1 + 0.5 + eave, z0 = b.z0 - 0.5 - eave, z1 = b.z1 + 0.5 + eave
    const base = heightAt(b.x0, b.z0) + b.h
    const span = b.ridgeX ? z1 - z0 : x1 - x0
    const rise = Math.min(4.2, span * 0.32)
    const hex = pick(RH.roof, b.x0, b.z0, 9)
    if (b.ridgeX) {
      const zm = (z0 + z1) / 2
      quad([x0, base, z0], [x0, base + rise, zm], [x1, base + rise, zm], [x1, base, z0], hex, 1)
      quad([x1, base, z1], [x1, base + rise, zm], [x0, base + rise, zm], [x0, base, z1], hex, 0.82)
      // gable ends in stone, set back under the eave
      const gx0 = b.x0 - 0.5, gx1 = b.x1 + 0.5, gz0 = b.z0 - 0.5, gz1 = b.z1 + 0.5
      const s = pick(RH.stone, b.x0, b.z0, 11)
      tri([gx0, base, gz0], [gx0, base, gz1], [gx0, base + rise * ((gz1 - gz0) / (z1 - z0)), zm], s, 0.9)
      tri([gx1, base, gz1], [gx1, base, gz0], [gx1, base + rise * ((gz1 - gz0) / (z1 - z0)), zm], s, 0.9)
    } else {
      const xm = (x0 + x1) / 2
      quad([x0, base, z1], [xm, base + rise, z1], [xm, base + rise, z0], [x0, base, z0], hex, 1)
      quad([x1, base, z0], [xm, base + rise, z0], [xm, base + rise, z1], [x1, base, z1], hex, 0.82)
      const gx0 = b.x0 - 0.5, gx1 = b.x1 + 0.5, gz0 = b.z0 - 0.5, gz1 = b.z1 + 0.5
      const s = pick(RH.stone, b.x0, b.z0, 11)
      tri([gx1, base, gz0], [gx0, base, gz0], [xm, base + rise * ((gx1 - gx0) / (x1 - x0)), gz0], s, 0.9)
      tri([gx0, base, gz1], [gx1, base, gz1], [xm, base + rise * ((gx1 - gx0) / (x1 - x0)), gz1], s, 0.9)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.computeVertexNormals()
  return g
}

/**
 * THE LANDING — a round plaza with the plot's swirl portal standing on it (Alex, 2026-09-26: *"a simple
 * plaza with the disc portal we have in the homeplot"*). Canon's *framed* gate (`world/gates.md`: *"an
 * arch, a plinth"*) is the PLINTH here: the dais and the stone ring the disc stands in. The door under
 * it is `LANDING` (3 wide, 2 deep), so the disc spans exactly the columns that cross. Tinted the Rune
 * Hold gate's Ather-side colour: two ends of one gate are one frequency.
 */
function LandingPlaza({ y0 }: { y0: number }) {
  const cx = LANDING.x + (LANDING.w - 1) / 2, cz = LANDING.y + (LANDING.h - 1) / 2
  const R = 1.75                                   // the disc: as wide as the door, a hair inside it
  const mat = useMemo(() => {
    const c = new THREE.Color(hubGate.runeHold)
    return portalMaterial(new THREE.Vector3(c.r, c.g, c.b))
  }, [])
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime; mat.uniforms.uNear.value = 0.6 })
  const cy = y0 + 0.3 + R
  const { ring, kerb } = useMemo(() => {
    // the ring: voussoirs round the disc, each turned to face its centre; its foot is left open
    const ring: Stone[] = []
    const n = 22
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      if (Math.sin(a) < -0.8) continue
      ring.push({ x: cx + Math.cos(a) * (R + 0.28), y: cy + Math.sin(a) * (R + 0.28), z: cz, sx: 0.62, sy: 0.5, sz: 0.7, roll: a - Math.PI / 2, c: RH.landing.ring })
    }
    // the ring's two feet, planted either side of the door
    for (const side of [-1, 1]) ring.push({ x: cx + side * (R + 0.35), y: y0 + 0.55, z: cz, sx: 0.8, sy: 0.9, sz: 0.95, c: RH.landing.kerb })
    // the kerb round the dais: dressed blocks, a gap on the south where the square walks up
    const kerb: Stone[] = []
    const kr = 4.6, kn = 36
    for (let i = 0; i < kn; i++) {
      const a = (i / kn) * Math.PI * 2
      if (Math.abs(a - Math.PI / 2) < 0.35) continue
      kerb.push({ x: cx + Math.cos(a) * kr, y: y0 + 0.14, z: cz + Math.sin(a) * kr, sx: 0.78, sy: 0.28, sz: 0.4, yaw: Math.PI / 2 - a, c: RH.landing.kerb })
    }
    return { ring, kerb }
  }, [cx, cz, cy, y0])
  return (
    <group>
      <mesh position={[cx, y0 + 0.06, cz]} receiveShadow>
        <cylinderGeometry args={[4.4, 4.5, 0.12, 48]} />
        <meshStandardMaterial color={RH.landing.dais} roughness={0.9} />
      </mesh>
      <mesh position={[cx, y0 + 0.125, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[2.6, 3.0, 48]} />
        <meshStandardMaterial color={RH.landing.inlay} roughness={0.85} />
      </mesh>
      <Stones items={ring} />
      <Stones items={kerb} />
      <mesh position={[cx, cy, cz]} material={mat} renderOrder={2}>
        <planeGeometry args={[R * 2, R * 2]} />
      </mesh>
      <pointLight position={[cx, cy, cz]} color={hubGate.runeHold} intensity={8} distance={9} decay={1.6} />
      
    </group>
  )
}

interface Stone { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw?: number; roll?: number; c: string }

/** Placed stones that turn about Y (`yaw`) and then in their own face (`roll`) — the kerb and the ring. */
function Stones({ items }: { items: Stone[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const r = ref.current
    if (!r) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color()
    const v = new THREE.Vector3(), s = new THREE.Vector3()
    items.forEach((b, i) => {
      q.setFromEuler(e.set(0, b.yaw ?? 0, b.roll ?? 0, 'YXZ'))
      m.compose(v.set(b.x, b.y, b.z), q, s.set(b.sx, b.sy, b.sz))
      r.setMatrixAt(i, m); r.setColorAt(i, col.set(b.c))
    })
    r.instanceMatrix.needsUpdate = true
    if (r.instanceColor) r.instanceColor.needsUpdate = true
    r.computeBoundingSphere()
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial roughness={0.9} />
    </instancedMesh>
  )
}

const F = RH.front

/** The sign's face: canon's name, and one mark for what the place is. Drawn once into a canvas. */
function signTexture(f: Front): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128
  const x = c.getContext('2d')!
  x.fillStyle = F.sign; x.fillRect(0, 0, 512, 128)
  x.strokeStyle = F.signGild; x.lineWidth = 6; x.strokeRect(6, 6, 500, 116)
  // the mark, left: a line drawing in the gilt
  x.save(); x.translate(64, 64); x.strokeStyle = F.signGild; x.fillStyle = F.signGild; x.lineWidth = 6; x.lineCap = 'round'
  if (f.kind === 'tavern') { x.strokeRect(-22, -24, 36, 48); x.beginPath(); x.arc(20, 0, 14, -Math.PI / 2, Math.PI / 2); x.stroke() }
  else if (f.kind === 'cafe') { x.beginPath(); x.arc(0, 4, 22, 0, Math.PI); x.stroke(); x.beginPath(); x.moveTo(-26, 4); x.lineTo(26, 4); x.stroke(); for (const d of [-9, 5]) { x.beginPath(); x.moveTo(d, -8); x.quadraticCurveTo(d + 8, -18, d, -30); x.stroke() } }
  else if (f.kind === 'books') { x.beginPath(); x.moveTo(0, -20); x.lineTo(-30, -26); x.lineTo(-30, 22); x.lineTo(0, 28); x.lineTo(30, 22); x.lineTo(30, -26); x.closePath(); x.moveTo(0, -20); x.lineTo(0, 28); x.stroke() }
  else if (f.kind === 'stair') { x.beginPath(); x.moveTo(-30, -24); for (let i = 0; i < 4; i++) { x.lineTo(-30 + i * 15, -24 + (i + 1) * 12); x.lineTo(-15 + i * 15, -24 + (i + 1) * 12) } x.stroke() }
  else { x.beginPath(); x.moveTo(-32, 10); x.lineTo(24, 10); x.lineTo(34, 0); x.lineTo(24, -10); x.lineTo(-32, -10); x.closePath(); x.stroke(); x.beginPath(); x.moveTo(-10, -10); x.lineTo(-22, -26); x.moveTo(-10, 10); x.lineTo(-22, 26); x.stroke() }
  x.restore()
  x.fillStyle = F.signInk; x.font = '600 50px Georgia, serif'; x.textBaseline = 'middle'
  x.fillText(f.name, 120, 68, 372)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A storefront: a timber frame round the opening, a sign over it, and what marks the place. A SHUT front
 *  has its door closed (canon opens the fronts one at a time, as their systems exist). */
function Storefront({ f }: { f: Front }) {
  const tex = useMemo(() => signTexture(f), [f])
  const yaw = Math.atan2(f.face[0], f.face[1])       // turn +z (a plane's front) to face outward
  const half = f.w / 2, H = 2.7, d = f.depth ?? 0
  return (
    <group position={[f.x, 0, f.z]} rotation={[0, yaw, 0]}>
      {d > 0 && (
        // the porch's side walls are the building's stone; a timber ceiling closes the recess under the lintel
        <mesh position={[0, H + 0.02, d / 2 + 0.1]}><boxGeometry args={[f.w + 0.2, 0.1, d + 0.2]} /><meshStandardMaterial color={F.jamb} /></mesh>
      )}
      <group position={[0, 0, d]}>
      {/* jambs and lintel, standing just proud of the wall */}
      {[-1, 1].map(e => <mesh key={e} position={[e * (half + 0.12), H / 2, 0.12]} castShadow><boxGeometry args={[0.26, H, 0.3]} /><meshStandardMaterial color={F.jamb} roughness={0.8} /></mesh>)}
      <mesh position={[0, H + 0.14, 0.12]} castShadow><boxGeometry args={[f.w + 0.8, 0.32, 0.36]} /><meshStandardMaterial color={F.jamb} roughness={0.8} /></mesh>
      </group>
      {f.shut && (
        <group position={[0, 0, -0.08]}>
          <mesh position={[0, (H - 0.1) / 2, 0]}><boxGeometry args={[f.w - 0.06, H - 0.1, 0.12]} /><meshStandardMaterial color={F.door} roughness={0.85} /></mesh>
          {[0.6, H - 0.6].map(y => <mesh key={y} position={[0, y, 0.07]}><boxGeometry args={[f.w - 0.1, 0.1, 0.04]} /><meshStandardMaterial color={F.doorBand} /></mesh>)}
        </group>
      )}
      <group position={[0, 0, d]}>
      {/* the sign, over the lintel */}
      <mesh position={[0, H + 0.95, 0.2]}><boxGeometry args={[Math.max(3.2, f.w + 1.4), 0.86, 0.08]} /><meshStandardMaterial color={F.sign} /></mesh>
      <mesh position={[0, H + 0.95, 0.25]}><planeGeometry args={[Math.max(3.1, f.w + 1.3), 0.78]} /><meshStandardMaterial map={tex} roughness={0.7} /></mesh>
      {f.kind === 'cafe' && (
        // the café's striped awning over its door: Greg's cover is coffee, tea, quiet conversation
        <group position={[0, H + 0.3, 0.75]} rotation={[0.42, 0, 0]}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-1.5 + 0.25 + i * 0.5, 0, 0]} castShadow><boxGeometry args={[0.5, 0.05, 1.4]} /><meshStandardMaterial color={F.awning[i % 2]} roughness={0.9} /></mesh>
          ))}
        </group>
      )}
      {(f.kind === 'tavern' || f.kind === 'stair' || f.kind === 'books') && [-1, 1].map(e => (
        // a lamp each side of the door, the warm glass the town's lanterns use
        <mesh key={e} position={[e * (half + 0.55), 2.1, 0.3]}><boxGeometry args={[0.26, 0.34, 0.26]} /><meshStandardMaterial color={P.glass} emissive={P.glass} emissiveIntensity={1} /></mesh>
      ))}
      {f.kind === 'stair' && (
        // the Passage goes DOWN: a darker mouth behind the frame
        <mesh position={[0, 1.3, -0.35]}><boxGeometry args={[f.w, 2.6, 0.2]} /><meshStandardMaterial color={P.iron} /></mesh>
      )}
      </group>
    </group>
  )
}

/** The Notice Board: two posts, a board under a little roof, notices pinned at angles. */
function NoticeBoard() {
  const { x, z, face } = NOTICE_BOARD
  const yaw = Math.atan2(face[0], face[1])
  const notes = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    x: -1 + (i % 4) * 0.66 + (hash(i, 3, 1) - 0.5) * 0.2, y: 1.5 + Math.floor(i / 4) * 0.62 + (hash(i, 3, 2) - 0.5) * 0.15,
    r: (hash(i, 3, 3) - 0.5) * 0.35, w: 0.42 + hash(i, 3, 4) * 0.18, h: 0.5 + hash(i, 3, 5) * 0.12, c: F.notes[i % F.notes.length],
  })), [])
  return (
    <group position={[x, 0, z]} rotation={[0, yaw, 0]}>
      {[-1.45, 1.45].map(px => <mesh key={px} position={[px, 1.3, 0]} castShadow><boxGeometry args={[0.16, 2.6, 0.16]} /><meshStandardMaterial color={F.jamb} /></mesh>)}
      <mesh position={[0, 1.8, 0]} castShadow receiveShadow><boxGeometry args={[2.8, 1.5, 0.1]} /><meshStandardMaterial color={F.board} roughness={0.9} /></mesh>
      <mesh position={[0, 2.72, 0]} rotation={[0, 0, 0]} castShadow><boxGeometry args={[3.2, 0.1, 0.6]} /><meshStandardMaterial color={RH.roof[0]} /></mesh>
      {notes.map((n, i) => (
        <group key={i} position={[n.x, n.y, 0.06]} rotation={[0, 0, n.r]}>
          <mesh><planeGeometry args={[n.w, n.h]} /><meshStandardMaterial color={n.c} roughness={1} side={THREE.DoubleSide} /></mesh>
          <mesh position={[0, n.h / 2 - 0.06, 0.01]}><boxGeometry args={[0.05, 0.05, 0.02]} /><meshStandardMaterial color={F.pin} /></mesh>
        </group>
      ))}
    </group>
  )
}

/** Hearth smoke: a few soft puffs rising and fading, looped. Cheap: six meshes, one material each. */
function Smoke({ x, y, z }: { x: number; y: number; z: number }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const N = 6
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      const k = ((t * 0.22 + i / N) % 1)
      m.position.set(x + Math.sin(t * 0.4 + i) * 0.3 * k + k * 0.8, y + k * 4.5, z + Math.cos(t * 0.3 + i) * 0.25 * k)
      m.scale.setScalar(0.35 + k * 1.3)
      ;(m.material as THREE.MeshStandardMaterial).opacity = 0.42 * (1 - k)
    })
  })
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <mesh key={i} ref={el => { refs.current[i] = el }}>
          <sphereGeometry args={[0.5, 8, 6]} />
          <meshStandardMaterial color={F.smoke} transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
    </>
  )
}

export function RuneHoldScene({ grid, heights, version = 0 }: { grid: number[][]; heights?: number[][]; version?: number }) {
  const look = useMemo(() => {
    const g = grid
    const heightAt = (x: number, z: number) => heights?.[z]?.[x] ?? 0
    const blocks = blocksOf(g)
    const owner = new Map<string, Block>()
    for (const b of blocks) for (let z = b.z0; z <= b.z1; z++) for (let x = b.x0; x <= b.x1; x++) if (isBuilding(g, x, z)) owner.set(`${x},${z}`, b)

    const stone: Inst[] = [], hill: Inst[] = [], timber: Inst[] = [], windows: Inst[] = [], sills: Inst[] = []
    const ground: Inst[] = [], chimneys: Inst[] = []
    for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
      const v = g[z][x]
      if (v === undefined || v < 0) continue
      const y0 = heightAt(x, z)
      if ((v & 0xff) !== BUILDING) {
        // the ground: cobbles on the streets, meadow elsewhere, worn bare where the two meet
        const t = v & 0xff
        if (t === PATH) {
          // a mortar bed, then four setts on it: a metre-square slab read as floor tiles on a lawn
          ground.push({ x, y: y0 + 0.03, z, sx: 1, sy: 1, sz: 1, c: RH.mortar })
          for (let q = 0; q < 4; q++) {
            const ox = (q & 1 ? 0.25 : -0.25) + (hash(x, z, 20 + q) - 0.5) * 0.05, oz = (q & 2 ? 0.25 : -0.25) + (hash(x, z, 24 + q) - 0.5) * 0.05
            ground.push({ x: x + ox, y: y0 + 0.045, z: z + oz, sx: 0.44, sy: 0.44, sz: 1, yaw: (hash(x, z, 1 + q) - 0.5) * 0.25, c: pick(RH.cobble, x, z, 2 + q * 3) })
          }
        }
        else if (t === 97) {
          let nearPath = false
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (((g[z + dz]?.[x + dx] ?? -1) & 0xff) === PATH) nearPath = true
          ground.push({ x, y: y0 + 0.025, z, sx: 1, sy: 1, sz: 1, c: nearPath && hash(x, z, 3) < 0.55 ? pick(RH.worn, x, z, 4) : pick(RH.meadow, x, z, 5) })
        }
        continue
      }
      const b = owner.get(`${x},${z}`)!
      const sides = openSides(g, x, z)
      if (b.kind === 'hillside') {
        if (!sides.length) {
          // the hill's back: a grassy crest nobody walks, broken so it reads as ground and not a lid
          hill.push({ x, y: y0 + b.h - 0.3 + hash(x, z, 6) * 1.2, z, sx: 1.02, sy: 0.6, sz: 1.02, c: pick(RH.hillTop, x, z, 7) })
          continue
        }
        // the Passage's dug rock: stacked chunks, each its own size, colour and lean
        let y = y0 - 0.4, k = 0
        const top = y0 + b.h + hash(x, z, 8) * 1.6
        while (y < top) {
          const tall = Math.min(top - y, 0.8 + hash(x, z, 10 + k) * 0.9)
          hill.push({ x: x + (hash(x, z, 20 + k) - 0.5) * 0.2, y: y + tall / 2, z: z + (hash(x, z, 30 + k) - 0.5) * 0.2,
            sx: 1 + hash(x, z, 50 + k) * 0.3, sy: tall, sz: 1 + hash(x, z, 55 + k) * 0.3,
            yaw: (hash(x, z, 4 + k) - 0.5) * 0.9, tilt: (hash(x, z, 60 + k) - 0.5) * 0.12, c: pick(RH.hill, x, z, 40 + k) })
          y += tall * 0.92; k++
        }
        continue
      }
      if (!sides.length) continue // buried: under the roof, never seen
      // CUT stone: even courses, a little play in each block, so it reads as masonry and not dug rock
      const course = 0.55
      const n = Math.round(b.h / course)
      for (let k = 0; k < n; k++) {
        const inset = (hash(x, z, 70 + k) - 0.5) * 0.06
        stone.push({ x: x + inset, y: y0 + course * (k + 0.5), z: z + inset, sx: 1.02, sy: course * 0.97, sz: 1.02,
          yaw: (hash(x, z, 80 + k) - 0.5) * 0.05, c: pick(RH.stone, x, z, 90 + k) })
      }
      // the timber band under the eave (a pier gets a stone capstone instead, below)
      if (b.kind === 'kiosk') continue
      timber.push({ x, y: y0 + b.h + 0.12, z, sx: 1.08, sy: 0.26, sz: 1.08, c: RH.timber })
      if (b.kind !== 'house') continue
      // windows: a lit pane on an outer face, one storey or two, never at a corner
      if (sides.length === 1 && !inFront(x, z)) {
        const [dx, dz] = sides[0]
        const along = dx !== 0
        const floors = b.h > 4.8 ? [1.7, 3.5] : [1.7]
        floors.forEach((wy, i) => {
          if (hash(x, z, 100 + i) > 0.34) return
          const ox = x + dx * 0.52, oz = z + dz * 0.52
          windows.push({ x: ox, y: y0 + wy, z: oz, sx: along ? 0.06 : 0.5, sy: 0.72, sz: along ? 0.5 : 0.06, c: RH.window })
          sills.push({ x: x + dx * 0.56, y: y0 + wy - 0.42, z: z + dz * 0.56, sx: along ? 0.14 : 0.66, sy: 0.1, sz: along ? 0.66 : 0.14, c: RH.sill })
          sills.push({ x: x + dx * 0.55, y: y0 + wy + 0.42, z: z + dz * 0.55, sx: along ? 0.12 : 0.62, sy: 0.12, sz: along ? 0.62 : 0.12, c: RH.timber })
        })
      }
    }
    // one chimney per house, near the ridge, at the gable the hash picks. A hearth's chimney smokes (the Mug's).
    const hearths = new Set(FRONTS.filter(f => f.kind === 'tavern').map(f => owner.get(`${Math.floor(f.x - f.face[0] * 0.5)},${Math.floor(f.z - f.face[1] * 0.5)}`)))
    const smokes: { x: number; y: number; z: number }[] = []
    for (const b of blocks) {
      if (b.kind !== 'house') continue
      const cx = b.ridgeX ? b.x0 + 1.5 + hash(b.x0, b.z0, 12) * (b.x1 - b.x0 - 3) : (b.x0 + b.x1) / 2 + 1.2
      const cz = b.ridgeX ? (b.z0 + b.z1) / 2 + 1.2 : b.z0 + 1.5 + hash(b.x0, b.z0, 13) * (b.z1 - b.z0 - 3)
      const base = heightAt(b.x0, b.z0) + b.h
      chimneys.push({ x: cx, y: base + 1.6, z: cz, sx: 0.9, sy: 3.2, sz: 0.9, c: pick(RH.stone, b.x0, b.z0, 14) })
      chimneys.push({ x: cx, y: base + 3.3, z: cz, sx: 1.05, sy: 0.22, sz: 1.05, c: RH.timber })
      if (hearths.has(b)) smokes.push({ x: cx, y: base + 3.5, z: cz })
    }

    // lanterns: the square's few carry a real light
    const lamps = lanternsOf(g)
    const kiosks = blocks.filter(b => b.kind === 'kiosk')
    const sq = kiosks.length
      ? { x: kiosks.reduce((s, b) => s + (b.x0 + b.x1) / 2, 0) / kiosks.length, z: kiosks.reduce((s, b) => s + (b.z0 + b.z1) / 2, 0) / kiosks.length }
      : { x: g[0].length / 2, z: g.length / 2 }
    const lit = new Set([...lamps].sort((a, b) => Math.hypot(a.x - sq.x, a.z - sq.z) - Math.hypot(b.x - sq.x, b.z - sq.z)).slice(0, 4))
    const posts: Inst[] = [], glass: Inst[] = []
    for (const l of lamps) {
      const y0 = heightAt(l.x, l.z)
      posts.push({ x: l.x, y: y0 + 1.15, z: l.z, sx: 0.09, sy: 2.3, sz: 0.09, c: P.iron })
      posts.push({ x: l.x, y: y0 + 2.62, z: l.z, sx: 0.44, sy: 0.08, sz: 0.44, c: P.iron })
      glass.push({ x: l.x, y: y0 + 2.36, z: l.z, sx: 0.32, sy: 0.42, sz: 0.32, c: P.glass })
    }
    const lights = lamps.filter(l => lit.has(l)).map(l => ({ x: l.x, y: heightAt(l.x, l.z) + 2.2, z: l.z }))

    return { stone, hill, timber, windows, sills, ground, chimneys, posts, glass, lights, smokes, roof: roofsOf(blocks, heightAt) }
  // `version` bumps when the map editor paints — the grid is the same array, mutated in place
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grid, heights, version])

  return (
    <>
      <Instances items={look.ground} flat cast={false} />
      <Instances items={look.stone} />
      <Instances items={look.hill} />
      <Instances items={look.timber} />
      <Instances items={look.sills} cast={false} />
      <Instances items={look.chimneys} />
      <Instances items={look.posts} />
      <Instances items={look.windows} emissive={0.9} cast={false} />
      <Instances items={look.glass} emissive={1.1} cast={false} />
      <mesh geometry={look.roof} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <LandingPlaza y0={heights?.[LANDING.y]?.[LANDING.x] ?? 0} />
      {FRONTS.map(f => <Storefront key={f.id} f={f} />)}
      <NoticeBoard />
      {look.smokes.map((sm, i) => <Smoke key={i} {...sm} />)}
      {look.lights.map((l, i) => <pointLight key={i} position={[l.x, l.y, l.z]} color={P.lamp} intensity={10} distance={10} decay={1.6} />)}
    </>
  )
}
