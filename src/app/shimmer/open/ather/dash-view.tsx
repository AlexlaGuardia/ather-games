'use client'
// ── DASH: THE RACE ITSELF (BETA M233 s2, M247 s2 the tent). A full-screen view over the game, its own small canvas. Since M247 s2
// the race runs INSIDE A BIG TENT of the Thistledown troupe (canon: the tents are the Fair's, Magii d2e2dca; thistle + down
// stripes as the Fair's big top in network-scene.tsx): a sand floor (dash-course ARENA m square), BLEACHERS of fans on its four
// sides (a generic Moglin crowd, instanced, bobbing; no lines), and the course as a raised dirt track on the sand. The course is
// the one Alex published in Creative (dash-track raceTrack: its line + sections) or, with none, the fixed M233 course on a
// stadium loop. Racers are the REAL spirit models (SpiritFigure, the species' glb + rig), each in her lane across the width;
// the clip follows what she is doing (run / climb + swim at a walk / a trip lies her down / done sits), fliers lift over a gap.
// The keeper does NOT steer: the only input is CHEER (fair-dash-race.ts cheer). Labels: DASH_UI (@lark).
import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { H } from '../../ui/hearth'
import { ELEMENT_COLORS, type Element, type Species } from '../../spirits/spirit'
import { CHEER, FLIERS, SWIMMERS, BLOCKS, startState, step, cheer, sectionAt, seeded, type Racer, type RunState, type Doing } from './fair-dash-race'
import { DASH_UI as L, fmtTime } from './fair-dash-rules'
import { ARENA, project, type DashCourse } from './dash-course'
import { raceTrack, trackY, flyY, laneOffset, racerAt, FLOOR, type RaceTrack } from './dash-track'
import { SpiritFigure } from './spirit-model'
import { spiritModelFor } from './spirit-models'
import type { RigClip } from './spirit-rig'

export interface Entry extends Racer { who: string; name: string; you?: boolean }
export interface RaceResult { ms: number; place: number; order: { who: string; name: string; ms: number | null; you: boolean }[] }

const KIND_COL: Record<string, string> = { run: '#a07850', climb: '#8d6a48', glide: '#5e4a3a', blocks: '#b39a6e', swim: '#3a5a6a' }
/** the tent: a striped round wall + cone roof standing round the square floor, and the bleachers on the floor's four sides */
export const TENT = { r: 80, wall: 16, peak: 46, panels: 32 } as const
export const BLEACH = { tiers: 5, rise: 0.9, depth: 1.7, seat: 2.2, from: ARENA / 2 + 2 } as const
const THISTLE = new THREE.Color('#8a5aa8'), DOWN = new THREE.Color('#f3ecdf')

/** the raised dirt track: a top strip at the track's height (a trough on a swim) with walls down to the sand */
function TrackMesh({ rt }: { rt: RaceTrack }) {
  const geo = useMemo(() => {
    const pos: number[] = [], col: number[] = [], idx: number[] = [], half = rt.width / 2 + 0.3, len = rt.track.len, c = new THREE.Color()
    const N = Math.max(2, Math.ceil(len / 0.5))
    for (let k = 0; k <= N; k++) {
      const d = (k / N) * len, p = racerAt(rt, d, 0), kind = sectionAt(Math.min(d, len - 1e-6), rt.track).kind
      const y = kind === 'swim' ? -0.9 : trackY(rt.track, d), nx = Math.cos(p.heading), nz = -Math.sin(p.heading)
      c.set(KIND_COL[kind] ?? KIND_COL.run)
      // 4 verts per sample: left wall foot, left top, right top, right wall foot
      for (const [o, yy] of [[-half, FLOOR], [-half, y], [half, y], [half, FLOOR]] as const) { pos.push(p.x + nx * o, yy, p.z + nz * o); col.push(c.r, c.g, c.b) }
      if (k) { const a = (k - 1) * 4, b = k * 4; for (const [u, v] of [[0, 1], [1, 2], [2, 3]]) idx.push(a + u, b + u, a + v, a + v, b + u, b + v) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals()
    return g
  }, [rt])
  // each swim stretch's water surface
  const water = useMemo(() => rt.track.sections.filter(s => s.kind === 'swim').map(s => {
    const pos: number[] = [], idx: number[] = [], half = rt.width / 2 + 0.25, N = Math.max(2, Math.ceil(s.len / 0.5))
    for (let k = 0; k <= N; k++) { const p = racerAt(rt, s.at + (k / N) * s.len, 0), nx = Math.cos(p.heading), nz = -Math.sin(p.heading)
      pos.push(p.x - nx * half, -0.3, p.z - nz * half, p.x + nx * half, -0.3, p.z + nz * half); if (k) { const a = (k - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g
  }), [rt])
  useEffect(() => () => { geo.dispose(); water.forEach(w => w.dispose()) }, [geo, water])
  const fin = racerAt(rt, rt.track.len, 0), st = racerAt(rt, 0, 0), w = rt.width + 0.6
  return (
    <group>
      <mesh geometry={geo}><meshLambertMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      {water.map((g, i) => <mesh key={i} geometry={g}><meshLambertMaterial color="#4aa0d0" transparent opacity={0.6} side={THREE.DoubleSide} /></mesh>)}
      <mesh position={[st.x, 0.02, st.z]} rotation-y={st.heading}><boxGeometry args={[w, 0.04, 0.3]} /><meshBasicMaterial color="#fbf4e4" /></mesh>
      <group position={[fin.x, 0, fin.z]} rotation-y={fin.heading} data-dash-finish>
        <mesh position={[-w / 2, 1.4, 0]}><boxGeometry args={[0.25, 2.8, 0.25]} /><meshLambertMaterial color="#8d4119" /></mesh>
        <mesh position={[w / 2, 1.4, 0]}><boxGeometry args={[0.25, 2.8, 0.25]} /><meshLambertMaterial color="#8d4119" /></mesh>
        <mesh position={[0, 2.8, 0]}><boxGeometry args={[w + 0.3, 0.5, 0.35]} /><meshLambertMaterial color="#c8642a" /></mesh>
      </group>
    </group>
  )
}

function striped(geo: THREE.BufferGeometry, panels: number): THREE.BufferGeometry {
  const g = geo.toNonIndexed(), p = g.attributes.position, col = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i += 3) {
    const cx = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3, cz = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3
    const c = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * panels) % 2 ? THISTLE : DOWN
    for (let v = 0; v < 3; v++) col.set([c.r, c.g, c.b], (i + v) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals()
  return g
}
/** the big tent round the floor, the sand, and the ground under the bleachers */
function TentHall() {
  const g = useMemo(() => ({
    wall: striped(new THREE.CylinderGeometry(TENT.r, TENT.r, TENT.wall, TENT.panels * 2, 1, true), TENT.panels),
    roof: striped(new THREE.ConeGeometry(TENT.r * 1.02, TENT.peak - TENT.wall, TENT.panels * 2, 1, true), TENT.panels),
  }), [])
  useEffect(() => () => { g.wall.dispose(); g.roof.dispose() }, [g])
  return (
    <group data-dash-tent>
      <mesh geometry={g.wall} position-y={FLOOR + TENT.wall / 2}><meshLambertMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      <mesh geometry={g.roof} position-y={FLOOR + TENT.wall + (TENT.peak - TENT.wall) / 2}><meshLambertMaterial vertexColors side={THREE.DoubleSide} /></mesh>
      <mesh position-y={FLOOR + TENT.peak / 2}><cylinderGeometry args={[0.6, 0.6, TENT.peak, 10]} /><meshLambertMaterial color="#6b4a30" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={FLOOR - 0.02}><circleGeometry args={[TENT.r, 48]} /><meshLambertMaterial color="#6e5a44" /></mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={FLOOR}><planeGeometry args={[ARENA, ARENA]} /><meshLambertMaterial color="#e2c98f" /></mesh>
    </group>
  )
}

/** the bleachers: TIERS steps on each side of the floor, with a generic Moglin crowd (instanced bodies + heads) that bobs */
export const fanCount = () => 4 * BLEACH.tiers * Math.floor((ARENA - 4) / BLEACH.seat)
const FAN_COLS = ['#d9a066', '#b98a5e', '#e2c4a0', '#9c7a5a', '#c99a7a', '#a8b07a', '#c4a0c8']
function Bleachers({ cheer }: { cheer: () => number }) {
  const n = fanCount(), bodies = useRef<THREE.InstancedMesh>(null), heads = useRef<THREE.InstancedMesh>(null)
  const seats = useMemo(() => {
    const out: { x: number; y: number; z: number; ph: number }[] = [], per = Math.floor((ARENA - 4) / BLEACH.seat)
    for (let side = 0; side < 4; side++) for (let t = 0; t < BLEACH.tiers; t++) for (let k = 0; k < per; k++) {
      const along = -((per - 1) * BLEACH.seat) / 2 + k * BLEACH.seat + (t % 2 ? BLEACH.seat / 2 : 0), out_ = BLEACH.from + t * BLEACH.depth + BLEACH.depth / 2
      const [x, z] = side === 0 ? [along, out_] : side === 1 ? [out_, -along] : side === 2 ? [-along, -out_] : [-out_, along]
      out.push({ x, y: FLOOR + (t + 1) * BLEACH.rise, z, ph: (side * 97 + t * 31 + k * 13) % 17 })
    }
    return out
  }, [])
  useEffect(() => {
    const c = new THREE.Color()
    seats.forEach((_, i) => { c.set(FAN_COLS[i % FAN_COLS.length]); bodies.current?.setColorAt(i, c); heads.current?.setColorAt(i, c.multiplyScalar(1.08)) })
    if (bodies.current?.instanceColor) bodies.current.instanceColor.needsUpdate = true
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true
  }, [seats])
  const acc = useRef(1), m = useMemo(() => new THREE.Matrix4(), [])
  useFrame(({ clock }, dt) => {
    acc.current += dt; if (acc.current < 0.08) return; acc.current = 0   // a crowd needs no 60 Hz
    const t = clock.elapsedTime, amp = 0.08 + 0.25 * cheer()
    seats.forEach((s, i) => {
      const b = Math.max(0, Math.sin(t * 5 + s.ph)) * amp
      m.makeTranslation(s.x, s.y + 0.45 + b, s.z); bodies.current?.setMatrixAt(i, m)
      m.makeTranslation(s.x, s.y + 1.05 + b, s.z); heads.current?.setMatrixAt(i, m)
    })
    if (bodies.current) bodies.current.instanceMatrix.needsUpdate = true
    if (heads.current) heads.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group data-dash-bleachers={n}>
      {[0, 1, 2, 3].map(side => Array.from({ length: BLEACH.tiers }, (_, t) => {
        const out_ = BLEACH.from + t * BLEACH.depth + BLEACH.depth / 2, h = (t + 1) * BLEACH.rise, len = ARENA + 2 * (t + 1) * BLEACH.depth
        const [x, z] = side === 0 ? [0, out_] : side === 1 ? [out_, 0] : side === 2 ? [0, -out_] : [-out_, 0]
        return <mesh key={`${side}:${t}`} position={[x, FLOOR + h / 2, z]} rotation-y={side % 2 ? Math.PI / 2 : 0}><boxGeometry args={[len, h, BLEACH.depth]} /><meshLambertMaterial color={t % 2 ? '#8a6a48' : '#7a5c3e'} /></mesh>
      }))}
      <instancedMesh ref={bodies} args={[undefined, undefined, n]} frustumCulled={false}><sphereGeometry args={[0.45, 8, 6]} /><meshLambertMaterial /></instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, n]} frustumCulled={false}><sphereGeometry args={[0.32, 8, 6]} /><meshLambertMaterial /></instancedMesh>
    </group>
  )
}

function Blocks({ rt, lane, n, hp }: { rt: RaceTrack; lane: number; n: number; hp: () => number[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([]), o = laneOffset(lane, n, rt.width), bw = Math.max(0.6, (rt.width - 0.8) / n * 0.85)
  useFrame(() => { const h = hp(); refs.current.forEach((m, k) => { if (!m) return; const f = h[k] / BLOCKS.hp; m.visible = f > 0; m.scale.setScalar(0.55 + 0.45 * f) }) })
  return <>{rt.track.blocks.map((d, k) => { const p = racerAt(rt, d, o), y = trackY(rt.track, d)
    return <mesh key={k} ref={m => { refs.current[k] = m }} position={[p.x, y + 0.45, p.z]} rotation-y={p.heading}><boxGeometry args={[bw, 0.9, 0.7]} /><meshLambertMaterial color="#b0a49a" /></mesh> })}</>
}

/** her clip for what she is doing (the race's own state, so the look and the sim never disagree) */
export function clipFor(doing: Doing, go: boolean, flier: boolean): RigClip {
  if (!go) return 'idle'
  switch (doing) {
    case 'run': return 'run'
    case 'climb': case 'swim': return 'walk'
    case 'glide': return flier ? 'idle' : 'run'
    case 'drop': return 'run'
    case 'blocks': case 'sniff': return 'idle'
    case 'trip': return 'lie'
    case 'done': return 'sit'
  }
}

export const RACER_SCALE = 1.6
type Probe = { track: 'published' | 'fallback'; len: number; width: number; racers: { sp: string; you: boolean; x: number; y: number; z: number; d: number; off: number; clip: string }[] }
function Racer3D({ e, rt, lane, n, at, clip, probe }: { e: Entry; rt: RaceTrack; lane: number; n: number; at: () => RunState; clip: RigClip; probe: Probe }) {
  const g = useRef<THREE.Group>(null), flier = FLIERS.includes(e.species), swimmer = SWIMMERS.includes(e.species), o = laneOffset(lane, n, rt.width)
  const look = useMemo(() => spiritModelFor(e.species as Species), [e.species]), acc = useRef(1)
  useFrame(({ clock }, dt) => {
    const s = at(), t = clock.elapsedTime, grp = g.current
    if (!grp) return
    const sec = sectionAt(s.d, rt.track), p = racerAt(rt, s.d, o)
    let y = trackY(rt.track, s.d)
    if (sec.kind === 'glide' && flier && s.d > sec.at) y = flyY(rt.track, s.d)
    if (sec.kind === 'swim') y = swimmer ? -0.5 + 0.05 * Math.sin(t * 6) : -0.42
    const bump = s.doing === 'blocks' ? Math.max(0, Math.sin(t * 9)) * 0.15 : 0   // she butts the block
    grp.position.set(p.x + Math.sin(p.heading) * bump, y, p.z + Math.cos(p.heading) * bump)
    grp.rotation.y = p.heading
    acc.current += dt
    if (acc.current > 0.25) { acc.current = 0; const q = project(rt.line, rt.cum, grp.position.x, grp.position.z)
      probe.racers[lane] = { sp: e.species, you: !!e.you, x: +p.x.toFixed(2), y: +y.toFixed(2), z: +p.z.toFixed(2), d: +s.d.toFixed(1), off: +q.d.toFixed(2), clip } }
  })
  const ring = ELEMENT_COLORS[(e.element as Element)] ?? ELEMENT_COLORS.base
  return (
    <group ref={g} data-racer={e.species}>
      <group scale={RACER_SCALE}>
        {look ? <Suspense fallback={null}><SpiritFigure sp={e.species as Species} look={look} clip={clip} /></Suspense>
          : <mesh position-y={0.3}><sphereGeometry args={[0.25, 12, 10]} /><meshLambertMaterial color="#d4a843" /></mesh>}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}><ringGeometry args={[0.45, 0.58, 20]} /><meshBasicMaterial color={ring} side={THREE.DoubleSide} /></mesh>
      {e.you && <mesh position={[0, 2.3, 0]} rotation-x={Math.PI}><coneGeometry args={[0.2, 0.4, 4]} /><meshBasicMaterial color={H.ember} /></mesh>}
    </group>
  )
}

/** the dash cam: behind your racer along the course, a little above, looking ahead (snaps on the first frame) */
function Follow({ rt, lane, n, at, phone }: { rt: RaceTrack; lane: number; n: number; at: () => RunState; phone: boolean }) {
  const cam = useThree(s => s.camera), look = useRef(new THREE.Vector3()), first = useRef(true)
  useFrame((_, dt) => {
    const s = at(), p = racerAt(rt, s.d, laneOffset(lane, n, rt.width) * 0.5), y = Math.max(trackY(rt.track, s.d), sectionAt(s.d, rt.track).kind === 'glide' ? 0 : -0.5)
    const back = phone ? 8 : 6.5, up = phone ? 5 : 3.8, ahead = racerAt(rt, s.d + 4, 0)
    const want = new THREE.Vector3(p.x - Math.sin(p.heading) * back, y + up, p.z - Math.cos(p.heading) * back)
    const lk = new THREE.Vector3(ahead.x, trackY(rt.track, Math.min(rt.track.len, s.d + 4)) + 0.6, ahead.z)
    const k = first.current ? 1 : 1 - Math.exp(-dt * 3); first.current = false
    cam.position.lerp(want, k); look.current.lerp(lk, k); cam.lookAt(look.current)
  })
  return null
}

const SUB = 0.05, MAX_DT = 0.5
function Stepper({ racers, states, rolls, onTick, speed, rt }: { racers: Entry[]; states: React.MutableRefObject<RunState[]>; rolls: (() => number)[]; onTick: (dt: number) => void; speed?: number; rt: RaceTrack }) {
  const acc = useRef(0)
  useFrame((_, raw) => {
    // real time whatever the frame rate (a slow phone still races at the race's pace): sub-steps of at most SUB s, and a
    // hitch longer than MAX_DT (a tab switch) is dropped rather than raced through
    const dt = Math.min(MAX_DT, raw)
    // M243 (the /shimmer/dev?mode=fair tool): with `speed` the race steps in FIXED SUB steps (speed x real time), so the same
    // seed runs the same race whatever the frame rate (fair-dev.ts runHeat is the same loop headless)
    if (speed) {
      acc.current += dt * speed
      for (let n = 0; acc.current >= SUB && n < 400; n++) { acc.current -= SUB; states.current = states.current.map((s, i) => step(racers[i], s, SUB, rolls[i], rt.track)); onTick(SUB) }
      return
    }
    for (let left = dt; left > 1e-6; left -= SUB) { const h = Math.min(SUB, left); states.current = states.current.map((s, i) => step(racers[i], s, h, rolls[i], rt.track)) }
    onTick(dt)
  })
  return null
}

const COUNT_S = 3, WAIT_S = 15
export function DashRace({ racers, seed, phone, onDone, speed, course }: { racers: Entry[]; seed: number; phone: boolean; onDone: (r: RaceResult) => void; /** M243 dev: fixed steps at this speed */ speed?: number
  /** M247 s2: the published course (GET /shimmer/open/dash-edits); none = the fixed course on the stadium loop */ course?: DashCourse | null }) {
  const rt = useMemo(() => raceTrack(course), [course])
  const probe = useMemo<Probe>(() => ({ track: rt.published ? 'published' : 'fallback', len: rt.track.len, width: rt.width, racers: [] }), [rt])
  useEffect(() => { const w = window as unknown as { __dash?: Probe }; w.__dash = probe; return () => { if (w.__dash === probe) delete w.__dash } }, [probe])
  const states = useRef<RunState[]>(racers.map(() => startState(rt.track)))
  const rolls = useMemo(() => racers.map((_, i) => seeded(seed + i * 7919)), [racers, seed])
  const me = racers.findIndex(r => r.you)
  const [count, setCount] = useState(COUNT_S), [, setTick] = useState(0), hud = useRef(0), myDone = useRef<number | null>(null), sent = useRef(false)
  const [go, setGo] = useState(false)
  useEffect(() => { if (count <= 0) { setGo(true); return } const id = setTimeout(() => setCount(c => c - 1), 800); return () => clearTimeout(id) }, [count])
  const finish = () => {
    if (sent.current) return
    sent.current = true
    const S = states.current, order = racers.map((r, i) => ({ who: r.who, name: r.name, ms: S[i].fin != null ? Math.round(S[i].fin! * 1000) : null, you: !!r.you, d: S[i].d }))
      .sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity) || b.d - a.d)
    onDone({ ms: Math.round((S[me].fin ?? 0) * 1000), place: order.findIndex(o => o.you) + 1, order: order.map(({ d: _d, ...o }) => o) })
  }
  const onTick = (dt: number) => {
    hud.current += dt
    const S = states.current
    if (S[me].fin != null && myDone.current == null) myDone.current = 0
    if (myDone.current != null) myDone.current += dt
    if (S.every(s => s.fin != null) || (myDone.current ?? 0) > WAIT_S) finish()   // the slowest get WAIT_S to come home
    if (hud.current > 0.12) { hud.current = 0; setTick(t => t + 1) }
  }
  const S = states.current, mine = S[me], cheerLevel = () => Math.max(0, ...states.current.map(s => (s.fin != null ? 0.6 : s.burst > 0 ? 1 : 0)))
  const order = racers.map((r, i) => ({ r, s: S[i] })).sort((a, b) => (a.s.fin ?? Infinity) - (b.s.fin ?? Infinity) || b.s.d - a.s.d)
  const cool = mine.cool / CHEER.cooldown
  const n = racers.length
  return (
    <div data-dash-race data-dash-go={go ? '1' : '0'} data-dash-scene="tent" data-dash-track={probe.track} data-dash-len={rt.track.len.toFixed(1)} data-dash-fans={fanCount()}
      data-dash-models={racers.filter(r => !!spiritModelFor(r.species as Species)).length} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#3a2a22' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-5, 4, 8], fov: phone ? 62 : 50, near: 0.1, far: 400 }} gl={{ antialias: true }}>
        <color attach="background" args={['#3a2a22']} />
        <hemisphereLight args={['#fff1d8', '#6e5a44', 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[10, 40, 8]} intensity={1.0} />
        <TentHall />
        <Bleachers cheer={cheerLevel} />
        <TrackMesh rt={rt} />
        {racers.map((e, i) => <Racer3D key={i} e={e} rt={rt} lane={i} n={n} at={() => states.current[i]} probe={probe}
          clip={clipFor(S[i].doing, go, FLIERS.includes(e.species))} />)}
        {racers.map((_, i) => <Blocks key={i} rt={rt} lane={i} n={n} hp={() => states.current[i].blocks} />)}
        <Follow rt={rt} lane={me} n={n} at={() => states.current[me]} phone={phone} />
        {go && <Stepper racers={racers} states={states} rolls={rolls} onTick={onTick} speed={speed} rt={rt} />}
      </Canvas>
      {/* HUD */}
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, pointerEvents: 'none', fontFamily: 'inherit' }}>
        <div data-dash-standings style={{ background: 'rgba(251,244,228,.88)', borderRadius: 10, padding: '6px 10px', fontSize: phone ? 12 : 13, color: H.ink, minWidth: 0 }}>
          {order.map(({ r, s }, k) => (
            <div key={k} data-dash-racer={r.species} data-doing={s.doing} data-d={s.d.toFixed(1)} data-split={JSON.stringify(Object.fromEntries(Object.entries(s.split).map(([k, v]) => [k, Math.round((v ?? 0) * 10) / 10])))} data-you={r.you ? '1' : '0'} data-fin={s.fin != null ? Math.round(s.fin * 1000) : ''}
              style={{ fontWeight: r.you ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {k + 1}. {r.name} <span style={{ color: H.inkFaint }}>· {r.you ? 'you' : r.who} · {s.fin != null ? fmtTime(s.fin * 1000) : L.doing[s.doing]}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(251,244,228,.88)', borderRadius: 10, padding: '6px 10px', textAlign: 'right', color: H.ink, flex: 'none' }}>
          <div data-dash-section={sectionAt(mine.d, rt.track).kind} style={{ fontWeight: 800, fontSize: 16 }}>{L.sections[sectionAt(mine.d, rt.track).kind]}</div>
          <div data-dash-clock style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtTime(mine.t * 1000)}</div>
          <div style={{ height: 4, width: 90, background: 'rgba(58,39,22,.15)', borderRadius: 2, marginTop: 4 }}><div style={{ height: 4, width: `${(mine.d / rt.track.len) * 100}%`, background: H.ember, borderRadius: 2 }} /></div>
        </div>
      </div>
      {!go && <div data-dash-count={count} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', fontSize: 64, fontWeight: 900, color: '#fbf4e4', textShadow: '0 3px 0 rgba(58,39,22,.5)' }}>{count > 0 ? count : L.go}</div>}
      <button data-dash-cheer data-burst={mine.burst > 0 ? '1' : '0'} data-cool={mine.cool.toFixed(1)} disabled={!go || mine.cool > 0 || mine.fin != null}
        onClick={() => { states.current = states.current.map((s, i) => (i === me ? cheer(s, rt.track) : s)); setTick(t => t + 1) }}
        style={{ position: 'absolute', bottom: phone ? 28 : 36, left: '50%', transform: 'translateX(-50%)', width: phone ? 120 : 140, height: phone ? 120 : 140, borderRadius: '50%', border: 'none', cursor: 'pointer',
          fontSize: 20, fontWeight: 900, color: '#fbf4e4', background: mine.burst > 0 ? `radial-gradient(circle,#ffd25a,${H.ember})` : `conic-gradient(rgba(58,39,22,.55) ${cool * 360}deg, ${H.ember} 0)`,
          boxShadow: '0 4px 0 rgba(58,39,22,.35)', opacity: !go || mine.fin != null ? 0.5 : 1 }}>{L.cheer}</button>
    </div>
  )
}
