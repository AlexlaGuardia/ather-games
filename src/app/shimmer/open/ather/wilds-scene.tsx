'use client'

// The Wilds' scene: the biome-tinted tile, water, instanced trees and the waymark stones. Split out of page.tsx.

import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { BIOME, type Wilds, type BiomeId, type Tree } from './wilds'
import { TREE_KINDS, isPruned, subscribeForestry, forestryRev, crownOf, shakeOf, type TreeKind } from './forestry'
import { useFrame } from '@react-three/fiber'
import { GREG_WAYMARK, isLit, type Waymark } from './waymarks'
import { Crystals } from './crystal-nodes'
import { P } from './palette'
import { GROUND, useGroundMaterial } from './ground-look'
import { DAY } from '../shared/sky-palette'
import { VoidHaze, VOID_FLOOR, voidShare, RIM_DARK, RIM_UNTILED, CLIFF_BLACK } from './void-look'
const CLIFF_UNTILED = 3   // metres of pit drop past which the cliff draws untextured (the void's matte black takes it)

/** The tile's ground, cut into CHUNKS×CHUNKS pieces so the renderer can skip what the camera cannot see and what the
 *  fog has swallowed (Alex 11-16 lag: one 375k-vertex mesh per tile drew whole, four tiles a frame). Flat-shaded,
 *  colour per triangle, so a piece is still its own unindexed triangles. */
const CHUNKS = 8
type ChunkPlan = { i0: number; i1: number; j0: number; j1: number; cx: number; cz: number; r: number }
function chunkPlan(W: Wilds): ChunkPlan[] {
  const { nx, nz, cell, sizeX, sizeZ } = W.meta
  const hx = sizeX / 2, hz = sizeZ / 2, out: ChunkPlan[] = []
  const ci = Math.ceil((nx - 1) / CHUNKS), cj = Math.ceil((nz - 1) / CHUNKS)
  for (let J = 0; J < CHUNKS; J++) for (let I = 0; I < CHUNKS; I++) {
    const i0 = I * ci, i1 = Math.min(nx - 1, i0 + ci), j0 = J * cj, j1 = Math.min(nz - 1, j0 + cj)
    if (i1 <= i0 || j1 <= j0) continue
    const xa = i0 * cell - hx, xb = i1 * cell - hx, za = j0 * cell - hz, zb = j1 * cell - hz
    out.push({ i0, i1, j0, j1, cx: (xa + xb) / 2, cz: (za + zb) / 2, r: Math.hypot(xb - xa, zb - za) / 2 })
  }
  return out
}
function chunkGeometry(W: Wilds, { i0, i1, j0, j1 }: ChunkPlan): THREE.BufferGeometry {
  const { nx, cell, sizeX, sizeZ } = W.meta
  const hx = sizeX / 2, hz = sizeZ / 2
  const c = new THREE.Color(), cv = new THREE.Color(), dr = W.voidDrop
  const vh = (i: number, j: number) => W.h[j * nx + i]
  const cells = (i1 - i0) * (j1 - j0)
  const pos = new Float32Array(cells * 18), col = new Float32Array(cells * 18), lay = new Float32Array(cells * 6)
  let o = 0
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
    const b = W.biomes[j * (nx - 1) + i] as BiomeId
    const x0 = i * cell - hx, z0 = j * cell - hz, x1 = x0 + cell, z1 = z0 + cell
    const y00 = vh(i, j), y10 = vh(i + 1, j), y01 = vh(i, j + 1), y11 = vh(i + 1, j + 1)
    const tris = [[x0, y00, z0, x1, y11, z1, x1, y10, z0], [x0, y00, z0, x0, y01, z1, x1, y11, z1]]
    const k00 = j * nx + i, tvi = [[k00, k00 + nx + 1, k00 + 1], [k00, k00 + nx, k00 + nx + 1]]
    const vd = W.voided, isVoid = !!vd?.[j * (nx - 1) + i]
    const rim = vd && !isVoid ? voidShare(vd, nx - 1, W.meta.nz - 1, i, j) : 0   // the 11-23 void look: the lip rolls into the dark
    for (let t = 0; t < 2; t++) {
      const n = ((i * 7 + j * 13 + t * 5) % 11) / 11
      if (isVoid) c.copy(VOID_FLOOR).offsetHSL(0, 0, (n - 0.5) * 0.008)   // M41 + the 11-23 void look: matte near-black
      else if (b === BIOME.water) c.copy(P.bed)
      else if (b === BIOME.shore) c.copy(P.shore)
      else if (b === BIOME.rock) c.copy(P.rock)
      else if (b === BIOME.woods) c.copy(P.woods).lerp(P.woodsHi, n * 0.5)
      else c.copy(P.grass).lerp(P.grassHi, n * 0.45).lerp(P.gold, ((i * 3 + j) % 17) / 17 * 0.15)
      if (rim > 0) c.lerp(VOID_FLOOR, Math.min(RIM_DARK, rim * 1.8))
      const tri = tris[t]
      for (let k = 0; k < 9; k++) pos[o + k] = tri[k]
      const vi = tvi[t]
      for (let k = 0; k < 3; k++) {
        // void v2: the cliff goes black with depth (per vertex, so the wall fades smoothly into the fog column, no band)
        const dk = dr ? Math.min(1, dr[vi[k]] / CLIFF_BLACK) : 0
        if (dk > 0) { cv.copy(c).lerp(VOID_FLOOR, Math.sqrt(dk)); col[o + k * 3] = cv.r; col[o + k * 3 + 1] = cv.g; col[o + k * 3 + 2] = cv.b }
        else { col[o + k * 3] = c.r; col[o + k * 3 + 1] = c.g; col[o + k * 3 + 2] = c.b }
      }
      const cliff = dr ? (dr[tvi[t][0]] + dr[tvi[t][1]] + dr[tvi[t][2]]) / 3 > CLIFF_UNTILED : false   // void v2: no stretched tile on the wall
      const L = isVoid || cliff || rim > RIM_UNTILED ? GROUND.void : b === BIOME.water || b === BIOME.shore ? GROUND.sand : b === BIOME.rock ? GROUND.stone : b === BIOME.woods ? GROUND.loam : GROUND.grass
      lay[o / 3] = L; lay[o / 3 + 1] = L; lay[o / 3 + 2] = L
      o += 9
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aLayer', new THREE.BufferAttribute(lay, 1))
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

/** ★ M44 part 3: a tile's 64 ground pieces were built in ONE task when it mounted (341 ms on the edesk, mid-walk, the frame
 *  the next tiles streamed in). Now the piece nearest the keeper is built at mount (so arrive()'s compile still finds the
 *  ground material, and the ground under a fresh arrival is there on the first frame) and the rest a few ms a frame,
 *  nearest first. Same geometry, same material: only WHEN each piece is built changed. */
const GROUND_BUDGET_MS = 4
/** ONE budget per frame shared by every tile's Ground (three tiles stream in together; per-tile budgets stacked). The first
 *  Ground to run in a frame may always build one piece, so the ground keeps coming even on a slow device. */
const budget = { frame: -1, used: 0, built: false }
function claimBudget(frameKey: number): number {
  if (budget.frame !== frameKey) { budget.frame = frameKey; budget.used = 0; budget.built = false }
  return GROUND_BUDGET_MS - budget.used
}

/** Probe for shot scripts (M58, 11-21): ground pieces within draw range of the keeper not built yet, summed over every mounted
 *  tile. On SwiftShader a tile's ground takes many seconds to come in (one piece a slow frame), so a shot waits for 0. */
const pendingOf = new Set<() => number>()
if (typeof window !== 'undefined') (window as unknown as { __groundPending?: () => number }).__groundPending = () => { let n = 0; for (const f of pendingOf) n += f(); return n }

/** The ground pieces: frustum-culled by three, and hidden past the fog by distance from the keeper. */
function Ground({ W, focus, off }: { W: Wilds; focus: Focus; off: { x: number; z: number } }) {
  const plan = useMemo(() => chunkPlan(W), [W])
  const mat = useGroundMaterial()
  const group = useRef<THREE.Group>(null)
  const built = useRef<(THREE.Mesh | null)[]>([])
  const matRef = useRef(mat); matRef.current = mat
  // build the nearest still-missing piece; false when none is left
  const buildNext = (lx: number, lz: number) => {
    let best = -1, bd = Infinity
    plan.forEach((k, i) => { if (built.current[i]) return; const d = Math.hypot(k.cx - lx, k.cz - lz); if (d < bd) { bd = d; best = i } })
    if (best < 0 || !group.current) return false
    const m = new THREE.Mesh(chunkGeometry(W, plan[best]), matRef.current)
    built.current[best] = m; group.current.add(m)
    return true
  }
  useLayoutEffect(() => {
    built.current = plan.map(() => null)
    const f = focus.current; buildNext(f.x - off.x, f.z - off.z)
    const g = group.current
    return () => { for (const m of built.current) if (m) { g?.remove(m); m.geometry.dispose() } built.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan])
  useEffect(() => { for (const m of built.current) if (m) m.material = mat }, [mat])
  useEffect(() => {
    const f = () => { const q = focus.current, lx = q.x - off.x, lz = q.z - off.z; let n = 0; plan.forEach((k, i) => { if (!built.current[i] && Math.hypot(k.cx - lx, k.cz - lz) - k.r < TREE_DRAW_R) n++ }); return n }
    pendingOf.add(f); return () => { pendingOf.delete(f) }
  }, [plan, focus, off])
  useFrame(state => {
    const f = focus.current, lx = f.x - off.x, lz = f.z - off.z
    const left = claimBudget(state.clock.elapsedTime)
    if (left > 0 || !budget.built) {
      const t0 = performance.now()
      while ((performance.now() - t0 < left || !budget.built) && buildNext(lx, lz)) budget.built = true   // nearest first
      budget.used += performance.now() - t0
    }
    plan.forEach((k, i) => { const m = built.current[i]; if (m) m.visible = Math.hypot(k.cx - lx, k.cz - lz) - k.r < TREE_DRAW_R })
  })
  return <group ref={group} />
}

// The Ather's four trees, each its own look (canon: game/shimmer-skilling.md › Tree Types). A pruned tree stands
// thinned (a smaller, duller crown) until it regrows: forestry.ts keeps the timers, this only draws them.
export const LOOK: Record<TreeKind, { trunk: string; crown: string; emissive?: string; trunkW: number; shape: 'round' | 'dome' | 'weep' | 'giant' }> = {
  goldwood:   { trunk: '#8a6a45', crown: '#c9c25e', trunkW: 1, shape: 'round' },     // warm golden bark, round canopy
  shimmeroak: { trunk: '#5f4430', crown: '#6f9b4f', trunkW: 1.35, shape: 'dome' },   // larger, harder bark, rich grain
  starwillow: { trunk: '#9a8160', crown: '#e7d78e', emissive: '#f2e3a0', trunkW: 0.8, shape: 'weep' },   // weeping, glowing tips
  dawnwood:   { trunk: '#6e4a2c', crown: '#d79b45', trunkW: 2, shape: 'giant' },    // ancient thick trunk, amber-gold
}
/** Trees past the fog are not drawn (Alex 11-16: "the lag hits pretty hard here"). The day fog ends at DAY.fogFar
 *  and the night and the gloom only pull it closer, so a crown past this ring is painted fog colour anyway. Before
 *  this every tree on the four loaded 1 km tiles drew every frame: ~38k trees, 9.1M vertices a frame (wilds-perf.mts). */
export const TREE_DRAW_R = DAY.fogFar + 30
const RELAY_M = 12   // re-lay the near set once the keeper has walked this far
type Focus = React.MutableRefObject<{ x: number; z: number }>

function TreeKindMesh({ trees, kind, focus, off }: { trees: Tree[]; kind: TreeKind; focus: Focus; off: { x: number; z: number } }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null)
  const frev = useSyncExternalStore(subscribeForestry, forestryRev, () => 0)
  const L = LOOK[kind]
  // each DRAWN crown's resting placement, so the one the light is cutting can sway about its base and settle back
  const base = useRef<{ x: number; y: number; z: number; sx: number; sy: number; id: string; bottom: number }[]>([])
  const swaying = useRef(-1)
  const laidAt = useRef<{ x: number; z: number } | null>(null)
  const lay = (fx: number, fz: number) => {
    const tm = trunk.current, cm = crown.current; if (!tm || !cm) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color()
    const now = Date.now(), R2 = TREE_DRAW_R * TREE_DRAW_R, lx = fx - off.x, lz = fz - off.z
    let j = 0
    base.current = []
    trees.forEach((t, k) => {
      const dx = t.x - lx, dz = t.z - lz; if (dx * dx + dz * dz > R2) return
      const cut = isPruned(t.id, now), w = L.trunkW, cr = crownOf(t, cut ? 0.55 : 1), h = cr.trunkH
      p.set(t.x, t.y + h / 2, t.z); s.set(w, h, w); tm.setMatrixAt(j, m.compose(p, q, s))
      // a crown's BOTTOM sits above the keeper's eye (crownOf; the willow's skirt hangs low on purpose)
      const sy = L.shape === 'weep' ? cr.hh * 2 : cr.hh
      p.set(t.x, cr.cy, t.z); s.set(cr.r, sy, cr.r)
      base.current[j] = { x: t.x, y: cr.cy, z: t.z, sx: cr.r, sy, id: t.id, bottom: cr.cy - cr.hh }
      cm.setMatrixAt(j, m.compose(p, q, s))
      c.set(L.crown).offsetHSL(((k * 0.07) % 0.04) - 0.02, cut ? -0.15 : 0, (((k * 0.11) % 0.08) - 0.04) - (cut ? 0.06 : 0))   // by k: a tree keeps its shade
      cm.setColorAt(j, c)
      j++
    })
    tm.count = j; cm.count = j
    tm.instanceMatrix.needsUpdate = true; cm.instanceMatrix.needsUpdate = true
    if (cm.instanceColor) cm.instanceColor.needsUpdate = true
    swaying.current = -1
    laidAt.current = { x: fx, z: fz }
  }
  useFrame(() => {
    const f = focus.current, la = laidAt.current
    if (!la || Math.hypot(f.x - la.x, f.z - la.z) > RELAY_M) lay(f.x, f.z)
    const cm = crown.current; if (!cm) return
    const now = Date.now()
    let k = swaying.current
    if (k < 0) { k = base.current.findIndex(b => shakeOf(b.id, now) >= 0); if (k < 0) return; swaying.current = k }
    const b = base.current[k], u = shakeOf(b.id, now), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
    if (u < 0) { cm.setMatrixAt(k, m.compose(new THREE.Vector3(b.x, b.y, b.z), q, new THREE.Vector3(b.sx, b.sy, b.sx))); cm.instanceMatrix.needsUpdate = true; swaying.current = -1; return }
    // a quick shiver that dies away: tilt about the crown's base, so the top moves and the bottom stays on the trunk
    const amp = 0.16 * (1 - u), a1 = Math.sin(u * 38) * amp, a2 = Math.cos(u * 31) * amp * 0.7
    q.setFromEuler(e.set(a1, 0, a2))
    const offv = new THREE.Vector3(0, b.y - b.bottom, 0).applyQuaternion(q)
    cm.setMatrixAt(k, m.compose(new THREE.Vector3(b.x, b.bottom, b.z).add(offv), q, new THREE.Vector3(b.sx * (1 + 0.04 * Math.sin(u * 50)), b.sy, b.sx)))
    cm.instanceMatrix.needsUpdate = true
  })
  // ⚠ a kind with no trees on this tile renders null, so its refs are null: lay() checks them
  // (shipped without that guard, every tile missing a kind crashed the page on entering the Wilds, 11-15).
  // A prune (frev) or a new tile re-lays at once; walking re-lays from useFrame.
  useEffect(() => { laidAt.current = null }, [trees, frev, L])
  if (trees.length === 0) return null
  // frustumCulled off: an InstancedMesh is culled by its base geometry's bounds at the origin (see open/hillside/page.tsx)
  return (
    <>
      <instancedMesh frustumCulled={false} ref={trunk} args={[undefined, undefined, trees.length]}>
        <cylinderGeometry args={[0.24, 0.32, 1, 6]} /><meshLambertMaterial color={L.trunk} flatShading />
      </instancedMesh>
      <instancedMesh frustumCulled={false} ref={crown} args={[undefined, undefined, trees.length]}>
        {L.shape === 'weep' ? <coneGeometry args={[1, 1, 9, 1, true]} /> : L.shape === 'dome' ? <dodecahedronGeometry args={[1, 0]} /> : <icosahedronGeometry args={[1, 0]} />}
        <meshLambertMaterial flatShading side={L.shape === 'weep' ? THREE.DoubleSide : THREE.FrontSide} emissive={L.emissive ?? '#000000'} emissiveIntensity={L.emissive ? 0.22 : 0} />
      </instancedMesh>
    </>
  )
}
export function Trees({ W, focus, off }: { W: Pick<Wilds, 'trees'>; focus: Focus; off: { x: number; z: number } }) {
  const byKind = useMemo(() => TREE_KINDS.map(k => [k, W.trees.filter(t => t.kind === k)] as const), [W])
  return <>{byKind.map(([k, ts]) => <TreeKindMesh key={k} kind={k} trees={ts} focus={focus} off={off} />)}</>
}

/** A waymark in the world: a standing stone with Enchant's binding ring hovering over it. */
/** M75 s2: `dark` = its ground went grey again (waymarks.ts isLit): the ring and socket dim, the stone stays. */
export function WaymarkStone({ w, greg, dark }: { w: Waymark; greg?: boolean; dark?: boolean }) {
  const glow = dark ? '#5c6066' : greg ? '#e7c766' : '#6fd3c4'
  return (
    <group position={[w.x, w.y, w.z]}>
      <mesh position-y={0.8}><boxGeometry args={[0.55, 1.6, 0.45]} /><meshLambertMaterial color="#b8ae9c" flatShading /></mesh>
      <mesh position-y={2.15} rotation-x={Math.PI / 2}><torusGeometry args={[0.55, 0.06, 5, 16]} /><meshLambertMaterial color={glow} emissive={glow} emissiveIntensity={dark ? 0.05 : 0.9} /></mesh>
      <mesh position-y={0.02} rotation-x={-Math.PI / 2}><ringGeometry args={[1.2, 1.5, 16]} /><meshBasicMaterial color={glow} transparent opacity={dark ? 0.25 : 0.55} /></mesh>
    </group>
  )
}

/** M62 s2: the owner's painted water (wilds-edits, parse › ponds): one flat quad per wet cell at that cell's own level, merged
 *  into a single mesh per tile, the sea's look. Rebuilt only when the tile re-parses (a new Wilds object). */
function Ponds({ W }: { W: Wilds }) {
  const geo = useMemo(() => {
    const cells = W.ponds; if (!cells?.length) return null
    const { cell, sizeX, sizeZ } = W.meta, hx = sizeX / 2, hz = sizeZ / 2
    const pos = new Float32Array(cells.length * 12), idx = new Uint32Array(cells.length * 6)
    cells.forEach((c, n) => {
      const x0 = -hx + c.i * cell, z0 = -hz + c.j * cell, x1 = x0 + cell, z1 = z0 + cell, y = c.y - 0.05, o = n * 12
      pos.set([x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], o)
      idx.set([n * 4, n * 4 + 2, n * 4 + 1, n * 4, n * 4 + 3, n * 4 + 2], n * 6)
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals()
    return g
  }, [W])
  useEffect(() => () => geo?.dispose(), [geo])
  if (!geo) return null
  return <mesh geometry={geo}><meshLambertMaterial color={P.water} transparent opacity={0.8} /></mesh>
}

/** M62 s3: WATERFALLS (wilds-edits fallSheets via the parse: pond edges over lower water + the owner's waterfall lines). Per tile:
 *  one mesh of falling sheets (lip at the top, slanting out to where the water lands; a scrolling streak shader), one mesh of foam
 *  ellipses on the water at each landing (pulsing), and one Points cloud of spray rising off the landings. Probe: window.__wildsFx. */
const SHEET_VS = `varying vec2 vUv; varying float vLen; attribute float len; void main() { vUv = uv; vLen = len; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SHEET_FS = `uniform float uTime; varying vec2 vUv; varying float vLen;
float h(float x) { return fract(sin(x * 127.1) * 43758.5453); }
void main() {
  float col = floor(vUv.x * vLen * 1.5), j = h(col);
  float s = fract(vUv.y * (2.0 + j) - uTime * (1.6 + j * 0.8) + j * 7.0);
  float streak = smoothstep(0.0, 0.25, s) * (1.0 - smoothstep(0.55, 1.0, s));
  float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
  vec3 c = mix(vec3(0.62, 0.80, 0.92), vec3(0.97, 0.99, 1.0), streak);
  gl_FragColor = vec4(c, (0.5 + 0.4 * streak) * edge * (0.75 + 0.25 * vUv.y));
}`
const FOAM_VS = `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FOAM_FS = `uniform float uTime; varying vec2 vUv;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  float ring = smoothstep(1.0, 0.75, d) * (0.55 + 0.3 * sin(uTime * 3.0 - d * 9.0));
  gl_FragColor = vec4(vec3(0.96, 0.98, 1.0), ring * 0.8);
}`
function Waterfalls({ W }: { W: Wilds }) {
  const built = useMemo(() => {
    const S = W.sheets; if (!S?.length) return null
    const sp: number[] = [], suv: number[] = [], sl: number[] = [], si: number[] = []
    const fp: number[] = [], fuv: number[] = [], fi: number[] = []
    const spray: { x: number; y: number; z: number; ux: number; uz: number; len: number; w: number }[] = []
    for (const q of S) {
      const len = Math.hypot(q.bx - q.ax, q.bz - q.az), lx = q.dx * q.land, lz = q.dz * q.land, o = 0.15   // lip, nudged off the rock
      const n = sp.length / 3
      sp.push(q.ax + q.dx * o, q.top, q.az + q.dz * o, q.bx + q.dx * o, q.top, q.bz + q.dz * o, q.bx + lx + q.dx * o, q.bottom, q.bz + lz + q.dz * o, q.ax + lx + q.dx * o, q.bottom, q.az + lz + q.dz * o)
      // an end that meets another sheet's end does not fade (a drawn line's segments join as one curtain): u = 0.5 there
      const joined = (x: number, z: number) => S.some(r => r !== q && (Math.hypot(r.ax - x, r.az - z) < 0.05 || Math.hypot(r.bx - x, r.bz - z) < 0.05))
      const ua = joined(q.ax, q.az) ? 0.5 : 0, ub = joined(q.bx, q.bz) ? 0.5 : 1
      suv.push(ua, 0, ub, 0, ub, 1, ua, 1); sl.push(len, len, len, len); si.push(n, n + 1, n + 2, n, n + 2, n + 3)
      // the foam: an ellipse on the landing water, centred just out from where the sheet meets it
      const ux = (q.bx - q.ax) / len, uz = (q.bz - q.az) / len, mx = (q.ax + q.bx) / 2 + lx + q.dx * (0.9 + q.w * 0.3), mz = (q.az + q.bz) / 2 + lz + q.dz * (0.9 + q.w * 0.3)
      const hl = len / 2 + 1 + q.w * 0.6, hd = 1.3 + q.w * 0.5, y = q.bottom + 0.04, m = fp.length / 3
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) fp.push(mx + ux * hl * a + q.dx * hd * b, y, mz + uz * hl * a + q.dz * hd * b)
      fuv.push(0, 0, 1, 0, 1, 1, 0, 1); fi.push(m, m + 2, m + 1, m, m + 3, m + 2)
      spray.push({ x: mx, y: q.bottom, z: mz, ux, uz, len, w: q.w })
    }
    const sheet = new THREE.BufferGeometry()
    sheet.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sheet.setAttribute('uv', new THREE.Float32BufferAttribute(suv, 2))
    sheet.setAttribute('len', new THREE.Float32BufferAttribute(sl, 1)); sheet.setIndex(si)
    const foam = new THREE.BufferGeometry()
    foam.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); foam.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2)); foam.setIndex(fi)
    // spray: particles spread along each landing, count by length x weight (capped per tile)
    const parts: { bx: number; by: number; bz: number; ph: number; sp: number; dr: number; ux: number; uz: number }[] = []
    for (const f of spray) { const n = Math.min(60, Math.round(f.len * 1.5 * f.w) + 6); for (let k = 0; k < n && parts.length < 900; k++) { const a = (Math.random() - 0.5) * (f.len + 1); parts.push({ bx: f.x + f.ux * a, by: f.y, bz: f.z + f.uz * a, ph: Math.random(), sp: 0.5 + Math.random() * 0.7, dr: 0.8 + f.w * 0.5, ux: Math.random() - 0.5, uz: Math.random() - 0.5 }) } }
    const sprayGeo = new THREE.BufferGeometry(); sprayGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(parts.length * 3), 3))
    return { sheet, foam, sprayGeo, parts, count: S.length }
  }, [W])
  const mats = useMemo(() => ({
    sheet: new THREE.ShaderMaterial({ vertexShader: SHEET_VS, fragmentShader: SHEET_FS, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    foam: new THREE.ShaderMaterial({ vertexShader: FOAM_VS, fragmentShader: FOAM_FS, uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
    spray: new THREE.PointsMaterial({ color: '#f4f9ff', size: 0.35, transparent: true, opacity: 0.7, depthWrite: false }),
  }), [])
  useEffect(() => () => { built?.sheet.dispose(); built?.foam.dispose(); built?.sprayGeo.dispose() }, [built])
  useEffect(() => () => { mats.sheet.dispose(); mats.foam.dispose(); mats.spray.dispose() }, [mats])
  useEffect(() => {
    const g = window as unknown as { __wildsFx?: Record<string, { sheets: number; auto: number; lines: number }> }
    g.__wildsFx = { ...(g.__wildsFx ?? {}), [W.meta.name]: { sheets: built?.count ?? 0, auto: W.sheets?.filter(q => q.auto).length ?? 0, lines: W.sheets?.filter(q => !q.auto).length ?? 0 } }
    return () => { if (g.__wildsFx) delete g.__wildsFx[W.meta.name] }
  }, [built, W])
  useFrame(({ clock }) => {
    if (!built) return
    const t = clock.elapsedTime; mats.sheet.uniforms.uTime.value = t; mats.foam.uniforms.uTime.value = t
    const a = built.sprayGeo.getAttribute('position') as THREE.BufferAttribute, arr = a.array as Float32Array
    built.parts.forEach((p, k) => { const u = (t * p.sp + p.ph) % 1; arr[k * 3] = p.bx + p.ux * u * p.dr; arr[k * 3 + 1] = p.by + Math.sin(u * Math.PI) * (0.8 + p.dr); arr[k * 3 + 2] = p.bz + p.uz * u * p.dr })
    a.needsUpdate = true
  })
  if (!built) return null
  return (
    <>
      <mesh geometry={built.sheet} material={mats.sheet} renderOrder={2} />
      <mesh geometry={built.foam} material={mats.foam} renderOrder={3} />
      <points geometry={built.sprayGeo} material={mats.spray} renderOrder={4} frustumCulled={false} />
    </>
  )
}

/** Void v2: 0 on every cell the pit carve lowered out of DRY land (the sea plane must not show at the bottom of a pit dug below
 *  it), 255 elsewhere. Rows run +z to -z, as the plane's v does once it is laid flat (rotation-x -90deg). null = no pit. PURE. */
export function waterMask(W: Wilds): Uint8Array | null {
  const dr = W.voidDrop; if (!dr) return null
  const { nx, nz, waterY } = W.meta, cx = nx - 1, cz = nz - 1, m = new Uint8Array(cx * cz * 4).fill(255)
  for (let j = 0; j < cz; j++) for (let i = 0; i < cx; i++) {
    const k = j * nx + i, ks = [k, k + 1, k + nx, k + nx + 1]
    if (ks.some(q => dr[q] > 0) && ks.every(q => W.h[q] + dr[q] > waterY)) { const o = ((cz - 1 - j) * cx + i) * 4; m[o] = m[o + 1] = m[o + 2] = m[o + 3] = 0 }
  }
  return m
}
/** The tile's sea plane; masked over a pit (waterMask) by an alphaMap + alphaTest, still one quad and one draw. */
function WaterPlane({ W }: { W: Wilds }) {
  const tex = useMemo(() => {
    const m = waterMask(W); if (!m) return null
    const t = new THREE.DataTexture(m, W.meta.nx - 1, W.meta.nz - 1, THREE.RGBAFormat)
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.needsUpdate = true
    return t
  }, [W])
  useEffect(() => () => tex?.dispose(), [tex])
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={W.meta.waterY - 0.15}>
      <planeGeometry args={[W.meta.sizeX, W.meta.sizeZ]} />
      {tex ? <meshLambertMaterial key="masked" color={P.water} transparent opacity={0.8} alphaMap={tex} alphaTest={0.5} />
        : <meshLambertMaterial key="plain" color={P.water} transparent opacity={0.8} />}
    </mesh>
  )
}

/** `off` = this tile's world offset (the group it sits in); `focus` = the keeper, in world coords. */
export function WildsScene({ W, waymarks, focus, off, infected }: { W: Wilds; waymarks: Waymark[]; focus: Focus; off: { x: number; z: number }; infected?: ReadonlySet<string> }) {
  const greg = { ...GREG_WAYMARK, y: W.heightAt(GREG_WAYMARK.x, GREG_WAYMARK.z) }
  return (
    <>
      <Ground W={W} focus={focus} off={off} />
      <VoidHaze W={W} off={off} />
      <WaterPlane W={W} />
      <Ponds W={W} />
      <Waterfalls W={W} />
      <Trees W={W} focus={focus} off={off} />
      <Crystals W={W} />
      {W.meta.name === GREG_WAYMARK.tile && <WaymarkStone w={greg} greg />}
      {waymarks.filter(w => w.tile === W.meta.name).map(w => <WaymarkStone key={w.id} w={w} dark={!!infected && !isLit(w, infected)} />)}
    </>
  )
}

