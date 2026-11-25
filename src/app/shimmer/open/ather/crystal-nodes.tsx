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
import { CRYSTAL_KINDS, isMined, subscribeProspecting, prospectingRev, TIER, type CrystalKind } from './prospecting'
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
  violet: { color: '#9a5ae0', glow: '#8a3ad0', k: 0.6 },
  storm:  { color: '#a8daf8', glow: '#6ab8f0', k: 0.55 },
  earth:  { color: '#c8843a', glow: '#a0601a', k: 0.35 },
  water:  { color: '#4ad0c0', glow: '#2ab0a8', k: 0.5 },
  egg:    { color: '#ece4f4', glow: '#c8b8e8', k: 0.5 },
  pure:   { color: '#f4f8ff', glow: '#ffffff', k: 0.7, clear: true },
  ather:  { color: '#ffd860', glow: '#ffc030', k: 0.8, clear: true },
}
const EGG_HUES = ['#8a3ad0', '#6ab8f0', '#a0601a', '#2ab0a8'].map(c => new THREE.Color(c))

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

export function Crystals({ W }: { W: Pick<Wilds, 'crystals'> }) {
  const cluster = useMemo(clusterGeometry, []), chips = useMemo(chipsGeometry, [])
  useEffect(() => () => { cluster.dispose(); chips.dispose() }, [cluster, chips])
  const byKind = useMemo(() => CRYSTAL_KINDS.map(k => [k, W.crystals.filter(c => c.kind === k)] as const), [W])
  return (
    <>
      <Feet nodes={W.crystals} />
      {byKind.map(([k, ns]) => <KindMesh key={k} kind={k} nodes={ns} cluster={cluster} chips={chips} />)}
    </>
  )
}
