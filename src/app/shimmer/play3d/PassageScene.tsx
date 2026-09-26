'use client'

/**
 * The Passage's look — rock, lanterns, stalls and cabinets over the generated map (`passage-hall.ts`).
 *
 * ★ A BLOCKOUT WITH A MOOD, not final art (the art-medium law: generated first, Alex judges). What it
 * has to carry on the first walk is canon's own three words — *"lantern-lit. Surprisingly warm."* — and
 * the read of the place: a stair down out of the light, a tunnel, then a cavern that opens up with
 * awnings round its rim, and a room of glowing cabinets through an arch.
 *
 * `ZoneGeometry` is told `ownSolids` for this zone, so the brown building boxes it would draw for tile
 * 103 are not drawn; rock is drawn here instead, ONLY where a solid cell touches floor (the rest of the
 * mountain is never seen). Collision is untouched: the walker still reads the grid.
 *
 * ⚠ LIGHT BUDGET. Point lights cost every lit fragment on Alex's UHD 630 (memory: reference_alex_desktop_gpu),
 * so only a handful of lanterns carry a real light; the rest are emissive glass. The fill comes from the
 * zone's UNDERGROUND mood (`world/atmosphere.tsx`), which is warm and does not turn with the hour.
 */
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PASSAGE, T, isTravellerBay, type Cabinet, type Stall, type Wagon } from './passage-hall'
import { caravanFor } from './caravans'

import { passage as P } from './scene-palette'

const ROCK = P.rock
const CEIL = P.ceiling
const FLOOR = P.floor
const WOOD = P.wood
const GLASS = P.glass
const IRON = P.iron

/** deterministic 0..1 per cell */
const hash = (x: number, z: number, k = 0) => {
  let s = (x * 73856093) ^ (z * 19349663) ^ (k * 83492791)
  s = (s ^ (s >>> 13)) * 1274126177
  return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff
}

/** Headroom over the floor: tall in the cavern and the arcade room, low in the tunnels. */
function ceilingOver(x: number, z: number): number {
  const c = PASSAGE.cavern, a = PASSAGE.arcade
  const d = Math.hypot((x - c.cx) / c.rx, (z - c.cz) / c.rz)
  if (d < 1.15) return 6.5 - 2.2 * Math.max(0, d - 0.35)   // a dome: high in the middle, lower to the rim
  if (x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1) return 4.6
  return 3.6
}

function RockAndCeiling() {
  const rockRef = useRef<THREE.InstancedMesh>(null)
  const floorRef = useRef<THREE.InstancedMesh>(null)
  const { rocks, floors, roof } = useMemo(() => {
    const g = PASSAGE.grid, h = PASSAGE.heights
    const fixture = new Set<string>([...PASSAGE.stalls.flatMap(s => {
      const side = s.face[0] === 0 ? [1, 0] : [0, 1]
      return [-1, 0, 1].map(k => `${s.x + side[0] * k},${s.z + side[1] * k}`)
    }), ...PASSAGE.cabinets.map(c => `${c.x},${c.z}`),
      ...PASSAGE.wagons.flatMap(w => [-1, 0, 1].flatMap(dx => [`${w.x + dx},${w.z}`, `${w.x + dx},${w.z + 1}`]))])
    const rocks: { x: number; z: number; y0: number; y1: number; c: string; s: number; k: number }[] = []
    // the zone's own floor tiles draw as grass; the Passage lays packed earth a hair above them
    const floors: { x: number; z: number; y: number; c: string }[] = []
    for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
      if (g[z][x] === T.ROCK) {
        if (fixture.has(`${x},${z}`)) continue
        // only rock that touches floor is ever seen
        let floorY = Infinity, top = 0
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const t = g[z + dz]?.[x + dx]
          if (t === undefined || t === T.ROCK) continue
          const fy = h[z + dz][x + dx]
          floorY = Math.min(floorY, fy)
          top = Math.max(top, fy + ceilingOver(x + dx, z + dz))
        }
        if (floorY === Infinity) continue
        // stacked chunks, each its own size, colour and lean, so a wall reads as courses of dug rock
        // rather than one plank per cell (the first bench shot read as a wooden fence)
        const y0 = floorY - 0.6, y1 = top + 0.4
        let y = y0, k = 0
        while (y < y1) {
          const tall = Math.min(y1 - y, 0.8 + hash(x, z, 10 + k) * 0.9)
          rocks.push({ x: x + (hash(x, z, 20 + k) - 0.5) * 0.18, z: z + (hash(x, z, 30 + k) - 0.5) * 0.18, y0: y, y1: y + tall,
                       c: ROCK[Math.floor(hash(x, z, 40 + k) * ROCK.length)], s: 0.95 + hash(x, z, 50 + k) * 0.3, k })
          y += tall * 0.92; k++
        }
      } else {
        floors.push({ x, z, y: h[z][x] + 0.02, c: FLOOR[Math.floor(hash(x, z, 5) * FLOOR.length)] })
      }
    }
    // ── the roof: ONE continuous mesh, facing down. Per-cell planes at per-cell heights left a black seam
    // at every step (the first bench shot read as a coffered grid). A corner shared by up to four floor
    // cells takes the HIGHEST roof any of them wants, so neighbours agree on it and there is no gap.
    const corner = (cx: number, cz: number) => {
      let y = -Infinity
      for (const [dx, dz] of [[0, 0], [-1, 0], [0, -1], [-1, -1]] as const) {
        const x = cx + dx, z = cz + dz
        if (g[z]?.[x] === undefined || g[z][x] === T.ROCK) continue
        y = Math.max(y, h[z][x] + ceilingOver(cx - 0.5, cz - 0.5))
      }
      return y === -Infinity ? null : y + (hash(cx, cz, 2) - 0.5) * 0.45
    }
    const pos: number[] = [], colr: number[] = [], idx: number[] = []
    const vid = new Map<string, number>(), cc = new THREE.Color()
    const vert = (cx: number, cz: number) => {
      const k = `${cx},${cz}`
      let i = vid.get(k)
      if (i === undefined) {
        i = pos.length / 3; vid.set(k, i)
        pos.push(cx - 0.5, corner(cx, cz) ?? 0, cz - 0.5)
        cc.set(CEIL[Math.floor(hash(cx, cz, 3) * CEIL.length)]); colr.push(cc.r, cc.g, cc.b)
      }
      return i
    }
    for (let z = 0; z < g.length; z++) for (let x = 0; x < g[z].length; x++) {
      if (g[z][x] === T.ROCK) continue
      const a = vert(x, z), b = vert(x + 1, z), c = vert(x + 1, z + 1), d = vert(x, z + 1)
      // wound so the face normal points DOWN: seen from below, invisible from a camera above the mountain
      idx.push(a, b, c, a, c, d)
    }
    const roof = new THREE.BufferGeometry()
    roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    roof.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3))
    roof.setIndex(idx)
    roof.computeVertexNormals()
    return { rocks, floors, roof }
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color()
    const r = rockRef.current
    if (r) {
      rocks.forEach((b, i) => {
        // a little yaw and width jitter per cell so a wall reads as dug rock, not a stack of crates
        q.setFromEuler(new THREE.Euler((hash(b.x, b.z, 60 + b.k) - 0.5) * 0.12, (hash(b.x, b.z, 4 + b.k) - 0.5) * 0.9, (hash(b.x, b.z, 70 + b.k) - 0.5) * 0.12))
        m.compose(new THREE.Vector3(b.x, (b.y0 + b.y1) / 2, b.z), q, new THREE.Vector3(b.s, b.y1 - b.y0, b.s))
        r.setMatrixAt(i, m); r.setColorAt(i, col.set(b.c))
      })
      r.instanceMatrix.needsUpdate = true
      if (r.instanceColor) r.instanceColor.needsUpdate = true
    }
    const f = floorRef.current
    if (f) {
      q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
      floors.forEach((b, i) => {
        m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(1, 1, 1))
        f.setMatrixAt(i, m); f.setColorAt(i, col.set(b.c))
      })
      f.instanceMatrix.needsUpdate = true
      if (f.instanceColor) f.instanceColor.needsUpdate = true
    }
  }, [rocks, floors])

  return (
    <>
      <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={floorRef} args={[undefined, undefined, floors.length]} receiveShadow>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <mesh geometry={roof}>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
    </>
  )
}

function Lantern({ x, z, y, lit, big }: { x: number; z: number; y: number; lit: boolean; big?: boolean }) {
  const hang = big ? 3.4 : 2.3
  return (
    <group position={[x, y, z]}>
      {!big && <mesh position={[0, hang / 2, 0]}><boxGeometry args={[0.08, hang, 0.08]} /><meshStandardMaterial color={IRON} /></mesh>}
      {/* the heart lantern is four lamps hung round the pillar, not one slab over it */}
      {(big ? [[1.35, 0], [-1.35, 0], [0, 1.35], [0, -1.35]] : [[0, 0]]).map(([ox, oz], i) => (
        <mesh key={i} position={[ox, hang, oz]}>
          <boxGeometry args={[0.32, 0.42, 0.32]} />
          <meshStandardMaterial color={GLASS} emissive={GLASS} emissiveIntensity={0.85} />
        </mesh>
      ))}
      {lit && <pointLight position={[0, hang - 0.2, 0]} color={P.lamp} intensity={big ? 26 : 12} distance={big ? 18 : 11} decay={1.6} />}
    </group>
  )
}

function StallFixture({ s }: { s: Stall }) {
  const empty = isTravellerBay(s)
  // the counter runs along the bay's width; the trader stands one cell behind it
  const along = s.face[0] === 0 ? 0 : Math.PI / 2
  const bx = s.x - s.face[0], bz = s.z - s.face[1]
  return (
    <group>
      <group position={[s.x, 0, s.z]} rotation={[0, along, 0]}>
        <mesh position={[0, 0.5, 0]} castShadow receiveShadow><boxGeometry args={[3, 1, 0.8]} /><meshStandardMaterial color={WOOD} roughness={0.8} /></mesh>
        {empty
          ? <mesh position={[0, 1.02, 0]}><boxGeometry args={[3.1, 0.06, 0.9]} /><meshStandardMaterial color={P.dustSheet} roughness={1} /></mesh>
          : [-0.9, 0, 0.9].map((o, i) => (
              <mesh key={i} position={[o, 1.12, 0]} castShadow>
                <boxGeometry args={[0.45, 0.22, 0.35]} />
                <meshStandardMaterial color={P.wares[i]} emissive={P.wares[i]} emissiveIntensity={0.25} />
              </mesh>
            ))}
      </group>
      {/* the awning over the bay, between the trader and the counter, pitched down toward the cavern;
          rolled up on an empty bay. Rx(θ>0) drops the local +z edge, and local +z is the face direction. */}
      <group position={[s.x - s.face[0] * 0.5, 0, s.z - s.face[1] * 0.5]} rotation={[0, along, 0]}>
        {empty
          ? <mesh position={[0, 2.7, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.18, 0.18, 3.2, 10]} /><meshStandardMaterial color={s.cloth} roughness={1} /></mesh>
          : <mesh position={[0, 2.75, 0]} rotation={[0.35 * (s.face[1] || s.face[0]), 0, 0]} castShadow>
              <boxGeometry args={[3.3, 0.06, 2.1]} /><meshStandardMaterial color={s.cloth} roughness={1} side={THREE.DoubleSide} />
            </mesh>}
        {[-1.55, 1.55].map(o => <mesh key={o} position={[o, 1.35, -0.5 * (s.face[1] || s.face[0])]}><boxGeometry args={[0.1, 2.7, 0.1]} /><meshStandardMaterial color={WOOD} /></mesh>)}
      </group>
      {/* the trader: a role, not a person — the same placeholder figure the walker uses for keepers */}
      {!empty && (
        <group position={[bx, 0, bz]}>
          <mesh position={[0, 0.85, 0]} castShadow><capsuleGeometry args={[0.32, 0.7, 4, 10]} /><meshStandardMaterial color={s.cloth} /></mesh>
          <mesh position={[0, 1.55, 0]} castShadow><sphereGeometry args={[0.26, 14, 14]} /><meshStandardMaterial color={P.skin} /></mesh>
        </group>
      )}
    </group>
  )
}

function CabinetFixture({ c, isOwner }: { c: Cabinet; isOwner: boolean }) {
  const dark = c.game.tier !== 'live' && !isOwner
  const hue = hash(c.x, c.z, 7)
  const glow = useMemo(() => new THREE.Color().setHSL(hue, 0.75, 0.55), [hue])
  const yaw = Math.atan2(c.face[0], c.face[1])
  return (
    <group position={[c.x, 0, c.z]} rotation={[0, yaw, 0]}>
      <mesh position={[0, 1.0, 0]} castShadow receiveShadow><boxGeometry args={[0.95, 2.0, 0.8]} /><meshStandardMaterial color={P.cabinet.body} roughness={0.6} /></mesh>
      {/* screen, leaned back */}
      <mesh position={[0, 1.35, 0.36]} rotation={[-0.2, 0, 0]}>
        <planeGeometry args={[0.72, 0.56]} />
        <meshStandardMaterial color={dark ? P.cabinet.dark : glow} emissive={dark ? P.cabinet.off : glow} emissiveIntensity={dark ? 0 : 1.1} />
      </mesh>
      {/* marquee */}
      <mesh position={[0, 1.88, 0.3]}>
        <boxGeometry args={[0.9, 0.2, 0.22]} />
        <meshStandardMaterial color={dark ? P.cabinet.marqueeDark : P.cabinet.marquee} emissive={dark ? P.cabinet.off : P.cabinet.marqueeGlow} emissiveIntensity={dark ? 0 : 0.9} />
      </mesh>
      {/* control deck */}
      <mesh position={[0, 0.98, 0.45]} rotation={[0.35, 0, 0]}><boxGeometry args={[0.9, 0.08, 0.3]} /><meshStandardMaterial color={P.cabinet.deck} /></mesh>
    </group>
  )
}

/** A caravan wagon parked in its bay, flap open toward the road; shuttered when nobody is in. The
 *  roster is read once per mount — a caravan that pulls out while you stand there changes on your next
 *  visit, which is how a parked caravan behaves anyway. */
function WagonFixture({ w }: { w: Wagon }) {
  const open = useMemo(() => caravanFor(w.slot, Date.now()).open, [w.slot])
  // the wagon's long axis runs along the road (x); its bed spans the bay's two rows, the flap faces -z
  const cz = w.z + 0.5
  return (
    <group position={[w.x, 0, cz]}>
      <mesh position={[0, 1.05, 0]} castShadow receiveShadow><boxGeometry args={[2.8, 0.9, 1.7]} /><meshStandardMaterial color={P.wagon.body} roughness={0.9} /></mesh>
      {/* the canvas top: a half-barrel over the bed */}
      <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 2.7, 14, 1, false, Math.PI / 2, Math.PI]} />
        <meshStandardMaterial color={P.wagon.canvas[w.slot]} roughness={1} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 1].flatMap(sx => [-1, 1].map(sz => (
        <mesh key={`${sx}${sz}`} position={[sx * 0.95, 0.5, sz * 0.9]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.12, 14]} />
          <meshStandardMaterial color={P.wagon.wheel} roughness={0.9} />
        </mesh>
      )))}
      {/* the side flap, propped open over the road as an awning, or shut against the canvas */}
      {open
        ? <mesh position={[0, 2.05, -1.25]} rotation={[-0.45, 0, 0]} castShadow><boxGeometry args={[2.6, 0.05, 1.1]} /><meshStandardMaterial color={P.wagon.canvas[w.slot]} roughness={1} side={THREE.DoubleSide} /></mesh>
        : <mesh position={[0, 1.35, -0.88]}><boxGeometry args={[2.6, 0.7, 0.05]} /><meshStandardMaterial color={P.wagon.canvas[w.slot]} roughness={1} /></mesh>}
      {open && [-0.8, 0, 0.8].map((o, i) => (
        <mesh key={i} position={[o, 1.6, -0.75]}>
          <boxGeometry args={[0.4, 0.2, 0.3]} />
          <meshStandardMaterial color={P.wares[i]} emissive={P.wares[i]} emissiveIntensity={0.25} />
        </mesh>
      ))}
      {open && <Lantern x={1.5} z={-1.0} y={0} lit={w.slot === 'daily'} />}
    </group>
  )
}

function FarRoadRubble() {
  const { x, z } = PASSAGE.farRoad
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[(hash(i, 1) - 0.3) * 1.2, 0.3 + hash(i, 2) * 0.5, (hash(i, 3) - 0.5) * 2.6]} castShadow>
          <dodecahedronGeometry args={[0.35 + hash(i, 4) * 0.45]} />
          <meshStandardMaterial color={ROCK[i % ROCK.length]} roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

/** Which lanterns carry a real light: the heart, every other rim lantern, the arch, one mid-tunnel. */
const LIT = new Set<number>((() => {
  const L = PASSAGE.lanterns, out: number[] = []
  L.forEach((l, i) => {
    if (l.big) out.push(i)
  })
  const rim = L.map((l, i) => ({ l, i })).filter(({ l }) => !l.big && Math.hypot(l.x - PASSAGE.cavern.cx, l.z - PASSAGE.cavern.cz) < PASSAGE.cavern.rx)
  rim.forEach(({ i }, k) => { if (k % 2 === 0) out.push(i) })
  const arch = L.findIndex(l => Math.abs(l.z - (PASSAGE.arcade.z0 - 1)) < 0.01)
  if (arch >= 0) out.push(arch)
  out.push(2)   // mid-tunnel
  return out
})())

export function PassageScene({ isOwner }: { isOwner: boolean }) {
  const a = PASSAGE.arcade
  return (
    <group>
      <RockAndCeiling />
      {PASSAGE.lanterns.map((l, i) => <Lantern key={i} {...l} lit={LIT.has(i)} />)}
      {PASSAGE.stalls.map(s => <StallFixture key={s.id} s={s} />)}
      {PASSAGE.cabinets.map(c => <CabinetFixture key={c.id} c={c} isOwner={isOwner} />)}
      {/* the arcade room's own light: cooler, so the cabinets read as a different room from the market */}
      <pointLight position={[(a.x0 + a.x1) / 2, 3.8, (a.z0 + a.z1) / 2]} color={P.arcadeLight} intensity={14} distance={20} decay={1.4} />
      {PASSAGE.wagons.map(w => <WagonFixture key={w.slot} w={w} />)}
      <FarRoadRubble />
    </group>
  )
}
