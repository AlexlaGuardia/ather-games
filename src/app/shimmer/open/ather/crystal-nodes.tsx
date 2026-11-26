'use client'
// THE CRYSTAL NODES, DRAWN (prospecting.ts has the rules; wilds.ts places them). Canon: "small glinting formations
// jutting from the ground" (game/shimmer-skilling.md › Prospecting), and the LIGHT LAW (shimmer-resources.md): crystal is
// lit from within. Each node is a squat foot of crag with a cluster of points standing out of it; the cluster takes its
// kind's canon colour and glows. The Ather Crystal PULSES (canon: "golden, translucent, pulsing"); the Trails' hidden
// crystal (the egg hunt) shimmers through every element's colour so it never gives itself away. A fractured node keeps
// its foot and a few dull chips until it grows back.
// One InstancedMesh per kind per tile, like the trees. Code-drawn filler: Alex judges the look.

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Wilds, Crystal } from './wilds'
import { CRYSTAL_KINDS, SEEPS, isSeep, isStone, isMined, subscribeProspecting, prospectingRev, TIER, type CrystalKind, type SeepKind } from './prospecting'
import { dayProgress, daylight } from '../../engine/day-cycle'

/** one soft round falloff for every node's glow (made once) */
let SOFT: THREE.CanvasTexture | null = null
function soft() {
  if (SOFT || typeof document === 'undefined') return SOFT
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.3, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, 64, 64)
  return (SOFT = new THREE.CanvasTexture(c))
}

export const CRYSTAL_LOOK: Record<CrystalKind, { color: string; glow: string; k: number; clear?: boolean }> = {
  raw:    { color: '#e8eaf2', glow: '#c8d2ff', k: 0.3 },
  // M185 s1: the four gems' canon looks (world/ather.md › THE FOUR GRADES): Fuli ruby, Rhyloid diamond, Dinloid emerald, Aqual pearl
  violet: { color: '#c8203c', glow: '#e0304a', k: 0.6 },              // Fuli: ruby, deep red
  storm:  { color: '#eef6ff', glow: '#bfe4ff', k: 0.75, clear: true }, // Rhyloid: diamond, clear, fire inside
  earth:  { color: '#1fa860', glow: '#22c070', k: 0.5 },              // Dinloid: emerald, green
  water:  { color: '#f2ece0', glow: '#fff6ea', k: 0.35 },             // Aqual: pearl, soft white lustre
  egg:    { color: '#ece4f4', glow: '#c8b8e8', k: 0.5 },
  pure:   { color: '#f4f8ff', glow: '#ffffff', k: 0.7, clear: true },
  ather:  { color: '#ffd860', glow: '#ffc030', k: 0.8, clear: true },
  // M185 s2: a mana seep's colour is its SHARDS' (raw mana, as the raw node's: ground loot + the burst read it); the tent = SEEP_LOOK
  seep_s: { color: '#e8eaf2', glow: '#a8b8ff', k: 0.45 },
  seep_m: { color: '#e8eaf2', glow: '#a8b8ff', k: 0.5 },
  seep_l: { color: '#e8eaf2', glow: '#a8b8ff', k: 0.55 },
  // M185 s3: stone = blankstone's own pale even grey (no light inside: it is not crystal); its body = StoneMesh
  stone:  { color: '#bdb7ab', glow: '#e4ded2', k: 0 },
}
const EGG_HUES = ['#e0304a', '#bfe4ff', '#22c070', '#fff6ea'].map(c => new THREE.Color(c))

/** a cluster of points: one tall, three leaning out, unit height ~1.2 m before a node's own scale */
export function clusterGeometry() {
  const parts: THREE.BufferGeometry[] = []
  const add = (h: number, r: number, x: number, z: number, tx: number, tz: number) => {
    const g = new THREE.ConeGeometry(r, h, 6, 1)
    g.translate(0, h / 2, 0); g.rotateX(tx); g.rotateZ(tz); g.translate(x, 0.12, z)
    parts.push(g.toNonIndexed())
  }
  add(1.25, 0.2, 0, 0, 0.05, -0.08)
  add(0.8, 0.15, 0.22, 0.1, 0.2, -0.45)
  add(0.7, 0.14, -0.2, 0.12, 0.35, 0.4)
  add(0.6, 0.12, 0.04, -0.24, -0.5, 0.1)
  const m = mergeGeometries(parts)!
  m.computeVertexNormals()
  return m
}
/** what is left once it has been worked: three low chips */
function chipsGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const [x, z, h] of [[0.12, 0, 0.22], [-0.14, 0.1, 0.16], [0, -0.15, 0.13]]) { const g = new THREE.ConeGeometry(0.1, h, 5); g.translate(x, h / 2 + 0.1, z); parts.push(g.toNonIndexed()) }
  return mergeGeometries(parts)!
}

function KindMesh({ nodes, kind, cluster, chips }: { nodes: Crystal[]; kind: CrystalKind; cluster: THREE.BufferGeometry; chips: THREE.BufferGeometry }) {
  const live = useRef<THREE.InstancedMesh>(null), dead = useRef<THREE.InstancedMesh>(null), mat = useRef<THREE.MeshLambertMaterial>(null)
  const glow = useRef<THREE.PointsMaterial>(null), next = useRef(0), night = useRef(0)
  const rev = useSyncExternalStore(subscribeProspecting, prospectingRev, () => 0)
  const L = CRYSTAL_LOOK[kind]
  useEffect(() => {
    if (!live.current || !dead.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler()
    const hide = new THREE.Matrix4().makeScale(0, 0, 0), now = Date.now()
    nodes.forEach((c, k) => {
      const gone = isMined(c.id, now)
      p.set(c.x, c.y - 0.08, c.z); q.setFromEuler(e.set(0, c.rot, 0)); s.set(c.s, c.s * (kind === 'ather' || kind === 'pure' ? 1.15 : 1), c.s)
      live.current!.setMatrixAt(k, gone ? hide : m.compose(p, q, s))
      dead.current!.setMatrixAt(k, gone ? m.compose(p, q, s) : hide)
    })
    live.current.instanceMatrix.needsUpdate = true; dead.current.instanceMatrix.needsUpdate = true
  }, [nodes, rev, kind])
  // the light inside: a soft glow at each LIVE node's heart, faint by day, full after dusk (worked nodes give none)
  const glowGeo = useMemo(() => {
    const now = Date.now(), pts = nodes.filter(c => !isMined(c.id, now))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(c => [c.x, c.y + 0.55 * c.s, c.z]), 3))
    return g
  }, [nodes, rev])
  useEffect(() => () => glowGeo.dispose(), [glowGeo])
  // the Ather Crystal pulses; the hidden one drifts through the four elements' light
  useFrame(({ clock }) => {
    const mt = mat.current; if (!mt) return
    const t = clock.elapsedTime
    if (t > next.current) { next.current = t + 1; night.current = 1 - daylight(dayProgress()) }
    if (glow.current) glow.current.opacity = (0.18 + 0.55 * night.current) * (kind === 'ather' ? 0.8 + 0.3 * Math.sin(t * 2.2) : 1)
    if (kind === 'ather') mt.emissiveIntensity = L.k * (0.75 + 0.35 * Math.sin(t * 2.2))
    else if (kind === 'egg') { const u = (t * 0.25) % 4, i = Math.floor(u); mt.emissive.copy(EGG_HUES[i]).lerp(EGG_HUES[(i + 1) % 4], u - i) }
  })
  if (!nodes.length) return null
  return (
    <>
      <instancedMesh frustumCulled={false} ref={live} args={[cluster, undefined, nodes.length]}>
        <meshLambertMaterial ref={mat} color={L.color} emissive={L.glow} emissiveIntensity={L.k} flatShading transparent={!!L.clear} opacity={L.clear ? 0.88 : 1} />
      </instancedMesh>
      <points geometry={glowGeo} frustumCulled={false}>
        <pointsMaterial ref={glow} map={soft()} color={L.glow} size={1.2 + 0.45 * TIER[kind]} sizeAttenuation transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      <instancedMesh frustumCulled={false} ref={dead} args={[chips, undefined, nodes.length]}>
        <meshLambertMaterial color="#8a857e" flatShading />
      </instancedMesh>
    </>
  )
}

// ── M185 s2b: MANA SEEPS, drawn. Mana seeps out of a gap in the ground and crystallises (RULED c73ab4e). The look Alex LOCKED
// 11-26 (look B, 'crystal tent', Magii #17937): white crystal ribs arch up over a dark crack and meet at a crown, and each rib's
// leg runs on out over the ground and forks, like a web. Small / Medium / Large grow in rib count and spread. Never a puddle,
// never rising spray, never fountain-like (the Anemonyx mana-well must never be mistaken for one): the only wet thing is a
// thin line of light in the crack. Worked: the ribs go dull grey and the crack goes dark until it seeps again.
// Code-drawn: ONE merged geometry per size (ribs + links + crown), so a seep is 1 draw call (+ its crack + its glow).
/** the tent at node scale 1 (m): ribs, crown height, where a rib meets the ground, how far its leg runs on. A keeper stands
 *  ~1.75 m, so a small seep is ankle-to-knee high, a medium near hip high, a large about chest high (x the node's 0.8-1.3 scale). */
export const SEEP_SIZE: Record<SeepKind, { ribs: number; crown: number; foot: number; leg: number }> = {
  seep_s: { ribs: 6, crown: 0.45, foot: 0.5, leg: 0.85 },
  seep_m: { ribs: 9, crown: 0.8, foot: 0.95, leg: 1.6 },
  seep_l: { ribs: 13, crown: 1.2, foot: 1.55, leg: 2.6 },
}
/** the colours: white crystal lit faintly from within; the leak's own light (a pale mana blue) only in the crack */
export const SEEP_LOOK = { rib: '#f2f6ff', ribGlow: '#b8ccff', worked: '#8c8e96', leak: '#9fd8ff', dark: '#1c1a22' }
/** one size of seep's tent, merged: the ribs (crown -> arch -> foot -> leg -> fork), a link between each pair of ribs, the crown */
export function seepTentGeometry(kind: SeepKind) {
  const { ribs, crown: H, foot: F, leg: G } = SEEP_SIZE[kind], parts: THREE.BufferGeometry[] = []
  const rad = 0.022 + 0.014 * H, V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const ribAt: THREE.CatmullRomCurve3[] = []
  for (let k = 0; k < ribs; k++) {
    const a = (k / ribs) * Math.PI * 2 + 0.25 * Math.sin(k * 2.3), c = Math.cos(a), s = Math.sin(a)
    const f = F * (0.88 + 0.16 * Math.sin(k * 1.7)), g = G * (0.85 + 0.2 * Math.sin(k * 2.9)), bend = 0.18 * Math.sin(k * 3.7)
    const at = (r: number, y: number, side = 0) => V(c * r - s * side, y, s * r + c * side)
    const curve = new THREE.CatmullRomCurve3([at(0.05 * H, H), at(0.45 * f, 0.92 * H), at(0.85 * f, 0.55 * H), at(f, 0.06), at((f + g) / 2, 0.03, bend * (g - f)), at(g, 0.02, bend * 1.6 * (g - f))])
    ribAt.push(curve)
    parts.push(new THREE.TubeGeometry(curve, 16, rad, 4, false).toNonIndexed())
    // the fork at the leg's end: two short twigs
    const end = curve.getPoint(1), dir = end.clone().sub(curve.getPoint(0.94)).setY(0).normalize()
    for (const t of [-0.6, 0.55]) {
      const d2 = dir.clone().applyAxisAngle(V(0, 1, 0), t), tw = new THREE.CatmullRomCurve3([end, end.clone().addScaledVector(d2, 0.14 + 0.08 * H).setY(0.015)])
      parts.push(new THREE.TubeGeometry(tw, 2, rad * 0.7, 3, false).toNonIndexed())
    }
  }
  // the web: a thin link from each rib to the next, part way down the arch
  for (let k = 0; k < ribs; k++) {
    const A = ribAt[k].getPoint(0.28 + 0.06 * Math.sin(k)), B = ribAt[(k + 1) % ribs].getPoint(0.33 + 0.05 * Math.cos(k))
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([A, B]), 2, rad * 0.6, 3, false).toNonIndexed())
  }
  // the crown: a crusted knot where the ribs meet
  const knot = new THREE.IcosahedronGeometry(0.09 + 0.08 * H, 0); knot.scale(1.3, 0.7, 1.3); knot.translate(0, H, 0); parts.push(knot)
  const m = mergeGeometries(parts.map(g => { g.deleteAttribute('uv'); g.deleteAttribute('normal'); return g }))!
  m.computeVertexNormals()
  for (const g of parts) g.dispose()
  return m
}
/** the crack under the tent: a long thin sliver lying flat (unit; each seep scales it to its foot) */
function crackGeometry() {
  const g = new THREE.OctahedronGeometry(1, 0); g.scale(0.75, 0.012, 0.07); g.translate(0, 0.02, 0)
  return g
}
function SeepMesh({ nodes, kind, crack, heightAt }: { nodes: Crystal[]; kind: SeepKind; crack: THREE.BufferGeometry; heightAt?: (x: number, z: number) => number }) {
  const live = useRef<THREE.InstancedMesh>(null), dry = useRef<THREE.InstancedMesh>(null), cracks = useRef<THREE.InstancedMesh>(null)
  const glow = useRef<THREE.PointsMaterial>(null), ribMat = useRef<THREE.MeshLambertMaterial>(null), next = useRef(0), night = useRef(0)
  const rev = useSyncExternalStore(subscribeProspecting, prospectingRev, () => 0)
  const tent = useMemo(() => seepTentGeometry(kind), [kind])
  useEffect(() => () => tent.dispose(), [tent])
  const Z = SEEP_SIZE[kind]
  useEffect(() => {
    if (!live.current || !dry.current || !cracks.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), hide = new THREE.Matrix4().makeScale(0, 0, 0), now = Date.now()
    const lit = new THREE.Color(SEEP_LOOK.leak), dark = new THREE.Color(SEEP_LOOK.dark), tilt = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3()
    nodes.forEach((c, k) => {
      const gone = isMined(c.id, now), p = new THREE.Vector3(c.x, c.y - 0.03, c.z)
      // the tent lies ON the ground: tilted to the slope under it (a seep on a hillside, legs on the hill, not in the air)
      q.setFromEuler(e.set(0, c.rot, 0))
      if (heightAt) {
        const d = Z.foot * c.s, gx = heightAt(c.x - d, c.z) - heightAt(c.x + d, c.z), gz = heightAt(c.x, c.z - d) - heightAt(c.x, c.z + d)
        if (Number.isFinite(gx) && Number.isFinite(gz)) q.premultiply(tilt.setFromUnitVectors(up, n.set(gx, 2 * d, gz).normalize()))
      }
      const tentM = m.clone().compose(p, q, new THREE.Vector3(c.s, c.s, c.s))
      live.current!.setMatrixAt(k, gone ? hide : tentM)
      dry.current!.setMatrixAt(k, gone ? tentM : hide)
      cracks.current!.setMatrixAt(k, m.clone().compose(p, q, new THREE.Vector3(Z.foot * c.s, 1, Z.foot * c.s)))
      cracks.current!.setColorAt(k, gone ? dark : lit)
    })
    for (const r of [live, dry, cracks]) r.current!.instanceMatrix.needsUpdate = true
    if (cracks.current.instanceColor) cracks.current.instanceColor.needsUpdate = true
  }, [nodes, rev, Z, heightAt])
  // the leak's light low in the crack, for live seeps only
  const glowGeo = useMemo(() => {
    const now = Date.now(), pts = nodes.filter(c => !isMined(c.id, now))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(c => [c.x, c.y + 0.12, c.z]), 3))
    return g
  }, [nodes, rev])
  useEffect(() => () => glowGeo.dispose(), [glowGeo])
  // the crystal breathes a little, slow (nothing rises, nothing sprays: it seeps)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (t > next.current) { next.current = t + 1; night.current = 1 - daylight(dayProgress()) }
    if (ribMat.current) ribMat.current.emissiveIntensity = 0.28 + 0.08 * Math.sin(t * 0.9) + 0.2 * night.current
    if (glow.current) glow.current.opacity = 0.2 + 0.45 * night.current
  })
  if (!nodes.length) return null
  return (
    <>
      <instancedMesh frustumCulled={false} ref={live} args={[tent, undefined, nodes.length]}>
        <meshLambertMaterial ref={ribMat} color={SEEP_LOOK.rib} emissive={SEEP_LOOK.ribGlow} emissiveIntensity={0.3} flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={dry} args={[tent, undefined, nodes.length]}>
        <meshLambertMaterial color={SEEP_LOOK.worked} flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={cracks} args={[crack, undefined, nodes.length]}>
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
      <points geometry={glowGeo} frustumCulled={false}>
        <pointsMaterial ref={glow} map={soft()} color={SEEP_LOOK.leak} size={0.8 + 1.2 * Z.foot} sizeAttenuation transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </>
  )
}

// ── M185 s3: STONE, drawn. A pale squat boulder of blankstone (two blocks leaning together), clearly lighter than the dark crag
// foot under the crystals so a chain reads as a string of the same thing. Worked = a low heap of rubble until it grows back.
// No glow: stone is not lit from within (the light law is crystal's). One instanced mesh live + one worked, per tile.
export function stoneGeometry() {
  const a = new THREE.DodecahedronGeometry(0.42, 0); a.scale(1.15, 0.8, 1); a.translate(0, 0.28, 0)
  const b = new THREE.DodecahedronGeometry(0.28, 0); b.scale(1, 0.9, 1.1); b.rotateY(0.6); b.translate(0.36, 0.2, 0.12)
  const c = new THREE.DodecahedronGeometry(0.2, 0); c.translate(-0.3, 0.13, -0.16)
  const m = mergeGeometries([a.toNonIndexed(), b.toNonIndexed(), c.toNonIndexed()])!
  m.computeVertexNormals()
  return m
}
function rubbleGeometry() {
  const parts: THREE.BufferGeometry[] = []
  for (const [x, z, r] of [[0.15, 0.05, 0.14], [-0.16, 0.1, 0.11], [0.02, -0.18, 0.1], [-0.05, 0.02, 0.09]]) { const g = new THREE.DodecahedronGeometry(r, 0); g.scale(1, 0.6, 1); g.translate(x, r * 0.5, z); parts.push(g.toNonIndexed()) }
  return mergeGeometries(parts)!
}
function StoneMesh({ nodes }: { nodes: Crystal[] }) {
  const live = useRef<THREE.InstancedMesh>(null), dead = useRef<THREE.InstancedMesh>(null)
  const rev = useSyncExternalStore(subscribeProspecting, prospectingRev, () => 0)
  const body = useMemo(stoneGeometry, []), rubble = useMemo(rubbleGeometry, [])
  useEffect(() => () => { body.dispose(); rubble.dispose() }, [body, rubble])
  useEffect(() => {
    if (!live.current || !dead.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler()
    const hide = new THREE.Matrix4().makeScale(0, 0, 0), now = Date.now()
    nodes.forEach((c, k) => {
      const gone = isMined(c.id, now)
      p.set(c.x, c.y - 0.06, c.z); q.setFromEuler(e.set(0, c.rot, 0)); s.set(c.s, c.s, c.s)
      live.current!.setMatrixAt(k, gone ? hide : m.compose(p, q, s))
      dead.current!.setMatrixAt(k, gone ? m.compose(p, q, s) : hide)
    })
    live.current.instanceMatrix.needsUpdate = true; dead.current.instanceMatrix.needsUpdate = true
  }, [nodes, rev])
  if (!nodes.length) return null
  return (
    <>
      <instancedMesh frustumCulled={false} ref={live} args={[body, undefined, nodes.length]}>
        <meshLambertMaterial color={CRYSTAL_LOOK.stone.color} flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={dead} args={[rubble, undefined, nodes.length]}>
        <meshLambertMaterial color="#8f8a80" flatShading />
      </instancedMesh>
    </>
  )
}

/** the crag foot under every node, one mesh for the tile */
function Feet({ nodes }: { nodes: Crystal[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!ref.current) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    nodes.forEach((c, k) => ref.current!.setMatrixAt(k, m.compose(new THREE.Vector3(c.x, c.y - 0.05, c.z), q.setFromEuler(e.set(0, c.rot * 1.7, 0)), new THREE.Vector3(0.62 * c.s, 0.32 * c.s, 0.55 * c.s))))
    ref.current.instanceMatrix.needsUpdate = true
  }, [nodes])
  if (!nodes.length) return null
  return (
    <instancedMesh frustumCulled={false} ref={ref} args={[undefined, undefined, nodes.length]}>
      <dodecahedronGeometry args={[1, 0]} /><meshLambertMaterial color="#7a7068" flatShading />
    </instancedMesh>
  )
}

export function Crystals({ W }: { W: Pick<Wilds, 'crystals'> & { heightAt?: (x: number, z: number) => number } }) {
  const cluster = useMemo(clusterGeometry, []), chips = useMemo(chipsGeometry, [])
  useEffect(() => () => { cluster.dispose(); chips.dispose() }, [cluster, chips])
  const hAt = useMemo(() => W.heightAt ? (x: number, z: number) => W.heightAt!(x, z) : undefined, [W])
  const crack = useMemo(crackGeometry, [])
  useEffect(() => () => crack.dispose(), [crack])
  const byKind = useMemo(() => CRYSTAL_KINDS.filter(k => !isSeep(k) && !isStone(k)).map(k => [k, W.crystals.filter(c => c.kind === k)] as const), [W])
  const seeps = useMemo(() => SEEPS.map(k => [k, W.crystals.filter(c => c.kind === k)] as const), [W])
  const rocks = useMemo(() => W.crystals.filter(c => !isSeep(c.kind) && !isStone(c.kind)), [W])
  const stones = useMemo(() => W.crystals.filter(c => isStone(c.kind)), [W])
  return (
    <>
      <Feet nodes={rocks} />
      {byKind.map(([k, ns]) => <KindMesh key={k} kind={k} nodes={ns} cluster={cluster} chips={chips} />)}
      {seeps.map(([k, ns]) => <SeepMesh key={k} kind={k} nodes={ns} crack={crack} heightAt={hAt} />)}
      <StoneMesh nodes={stones} />
    </>
  )
}
