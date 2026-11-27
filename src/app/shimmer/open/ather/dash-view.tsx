'use client'
// ── DASH: THE RACE ITSELF (BETA M233 s2). A full-screen view over the game, its own small canvas (an instanced space: the
// course is code-built pieces, cheap, nothing loaded). Five lanes, the course along +x in sections (fair-dash-race.ts COURSE):
// grass run, a water stretch, a ramp climb, the GAP (fliers glide it from the top of the climb; the rest go down into it and
// back up), three blocks per lane, the run to the finish arch. Racers are code-built bodies: wings for fliers, a tail for
// swimmers, a shell for the heavy ones, an element ring underfoot, an ember marker over YOUR spirit. The camera follows yours.
// The keeper does NOT steer: the only input is CHEER (fair-dash-race.ts cheer: a burst, a cooldown). Labels: DASH_UI (@lark).
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { H } from '../../ui/hearth'
import { ELEMENT_COLORS, type Element } from '../../spirits/spirit'
import { COURSE, COURSE_LEN, BLOCKS, CLIMB_H, GAP_DROP, CHEER, FLIERS, SWIMMERS, HEAVY, startState, step, cheer, sectionAt, seeded, type Racer, type RunState } from './fair-dash-race'
import { DASH_UI as L, fmtTime } from './fair-dash-rules'

export interface Entry extends Racer { who: string; name: string; you?: boolean }
export interface RaceResult { ms: number; place: number; order: { who: string; name: string; ms: number | null; you: boolean }[] }

const LANE_W = 1.7
const laneZ = (i: number, n: number) => (i - (n - 1) / 2) * LANE_W
/** the ground's height along the course (the non-fliers' path): flat run, sunk water, the ramp, down into the gap and up */
export function groundY(d: number): number {
  const s = sectionAt(d), f = Math.min(1, Math.max(0, (d - s.at) / s.len))
  if (s.kind === 'swim') return -0.45
  if (s.kind === 'climb') return f * CLIMB_H
  if (s.kind === 'glide') return f < 0.45 ? CLIMB_H + (-GAP_DROP - CLIMB_H) * (f / 0.45) : -GAP_DROP * (1 - (f - 0.45) / 0.55)
  return 0
}
/** a flier's height over the gap: from the top of the climb, gliding down to the far side */
const flyY = (d: number) => { const s = sectionAt(d), f = (d - s.at) / s.len; return CLIMB_H * (1 - f) + 0.35 * Math.sin(f * Math.PI) }
const SP_COLOR: Record<string, string> = { fox: '#e8a04a', axolotl: '#f2a6c0', 'water-bear': '#b8a890', turtle: '#7fa36a', owl: '#9c8466', frog: '#79b85a', firefly: '#e4d36a', rabbit: '#e9e2d4', hummingbird: '#5fc4a8', bat: '#6a5a7a' }

function Course({ n }: { n: number }) {
  const pieces = useMemo(() => {
    const out: { x: number; y: number; len: number; rot: number; color: string }[] = []
    const STEP = 1
    for (let d = 0; d < COURSE_LEN; d += STEP) {
      const s = sectionAt(d + STEP / 2), y0 = groundY(d), y1 = groundY(Math.min(COURSE_LEN, d + STEP))
      if (s.kind === 'swim') continue
      out.push({ x: d + STEP / 2, y: (y0 + y1) / 2 - 0.1, len: Math.hypot(STEP, y1 - y0) + 0.02, rot: Math.atan2(y1 - y0, STEP), color: s.kind === 'climb' ? '#a08060' : s.kind === 'glide' ? '#6a5848' : s.kind === 'blocks' ? '#b39a6e' : '#6fa65a' })
    }
    return out
  }, [])
  const swim = COURSE.find(s => s.kind === 'swim')!, w = n * LANE_W + 1
  return (
    <group>
      {pieces.map((p, i) => <mesh key={i} position={[p.x, p.y, 0]} rotation-z={p.rot}><boxGeometry args={[p.len, 0.2, w]} /><meshLambertMaterial color={p.color} /></mesh>)}
      {/* the water: a pit with a surface */}
      <mesh position={[swim.at + swim.len / 2, -1.1, 0]}><boxGeometry args={[swim.len, 0.2, w]} /><meshLambertMaterial color="#3a5a6a" /></mesh>
      <mesh position={[swim.at + swim.len / 2, -0.3, 0]}><boxGeometry args={[swim.len, 0.05, w]} /><meshLambertMaterial color="#4aa0d0" transparent opacity={0.6} /></mesh>
      {/* start + finish */}
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.25, 0.04, w]} /><meshBasicMaterial color="#fbf4e4" /></mesh>
      <group position={[COURSE_LEN, 0, 0]}>
        <mesh position={[0, 1.4, -w / 2]}><boxGeometry args={[0.25, 2.8, 0.25]} /><meshLambertMaterial color="#8d4119" /></mesh>
        <mesh position={[0, 1.4, w / 2]}><boxGeometry args={[0.25, 2.8, 0.25]} /><meshLambertMaterial color="#8d4119" /></mesh>
        <mesh position={[0, 2.8, 0]}><boxGeometry args={[0.35, 0.5, w + 0.3]} /><meshLambertMaterial color="#c8642a" /></mesh>
      </group>
      {/* flowers along the runs (what a calm spirit stops to sniff) */}
      {COURSE.filter(s => s.kind === 'run').flatMap((s, k) => Array.from({ length: 8 }, (_, i) => (
        <mesh key={`${k}:${i}`} position={[s.at + 1 + i * (s.len - 2) / 7, 0.12, (i % 2 ? 1 : -1) * (w / 2 + 0.2)]}><sphereGeometry args={[0.14, 8, 6]} /><meshLambertMaterial color={['#f2c84a', '#e889b8', '#b38ae0'][i % 3]} /></mesh>
      )))}
      <mesh rotation-x={-Math.PI / 2} position={[COURSE_LEN / 2, -2.6, 0]}><planeGeometry args={[COURSE_LEN + 60, 60]} /><meshLambertMaterial color="#4c6a3c" /></mesh>
    </group>
  )
}

function Blocks({ lane, n, hp }: { lane: number; n: number; hp: () => number[] }) {
  const refs = useRef<(THREE.Mesh | null)[]>([])
  const sec = COURSE.find(s => s.kind === 'blocks')!
  useFrame(() => { const h = hp(); refs.current.forEach((m, k) => { if (!m) return; const f = h[k] / BLOCKS.hp; m.visible = f > 0; m.scale.setScalar(0.55 + 0.45 * f) }) })
  return <>{BLOCKS.at.map((a, k) => <mesh key={k} ref={m => { refs.current[k] = m }} position={[sec.at + a, 0.45, laneZ(lane, n)]}><boxGeometry args={[0.7, 0.9, LANE_W * 0.8]} /><meshLambertMaterial color="#b0a49a" /></mesh>)}</>
}

function Body({ e, at }: { e: Entry; at: () => RunState }) {
  const g = useRef<THREE.Group>(null), wl = useRef<THREE.Mesh>(null), wr = useRef<THREE.Mesh>(null)
  const flier = FLIERS.includes(e.species), swimmer = SWIMMERS.includes(e.species), heavy = HEAVY.includes(e.species)
  useFrame(({ clock }) => {
    const s = at(), t = clock.elapsedTime, o = g.current
    if (!o) return
    const sec = sectionAt(s.d), moving = s.stop <= 0 && s.fin == null
    let y = groundY(s.d)
    if (sec.kind === 'glide' && flier && s.d > sec.at) y = flyY(s.d)
    if (sec.kind === 'swim') y = swimmer ? -0.5 + 0.05 * Math.sin(t * 6) : -0.35
    o.position.set(s.d, y + (moving && sec.kind !== 'swim' ? Math.abs(Math.sin(t * 10)) * 0.08 : 0), o.position.z)
    o.rotation.z = s.doing === 'trip' ? -1.2 : sec.kind === 'climb' ? 0.4 : 0
    o.children[1].position.y = s.doing === 'sniff' ? 0.25 : 0.55   // the head dips to the flower
    const flap = flier ? (sec.kind === 'glide' && s.d > sec.at ? 0.25 : Math.sin(t * 22) * 0.9) : 0
    if (wl.current) wl.current.rotation.x = flap
    if (wr.current) wr.current.rotation.x = -flap
  })
  const c = SP_COLOR[e.species] ?? '#d4a843', ring = ELEMENT_COLORS[(e.element as Element)] ?? ELEMENT_COLORS.base
  return (
    <group ref={g} data-racer={e.species}>
      <mesh position={[0, 0.3, 0]} scale={heavy ? [1.25, 0.85, 1.25] : [1, 1, 1]}><sphereGeometry args={[0.3, 14, 10]} /><meshLambertMaterial color={c} /></mesh>
      <mesh position={[0.28, 0.55, 0]}><sphereGeometry args={[0.2, 12, 9]} /><meshLambertMaterial color={c} /></mesh>
      {heavy && <mesh position={[0, 0.42, 0]} scale={[1.3, 0.55, 1.3]}><sphereGeometry args={[0.3, 12, 8]} /><meshLambertMaterial color="#6a5a40" /></mesh>}
      {flier && <><mesh ref={wl} position={[0, 0.4, 0.3]}><boxGeometry args={[0.35, 0.04, 0.5]} /><meshLambertMaterial color={c} /></mesh>
        <mesh ref={wr} position={[0, 0.4, -0.3]}><boxGeometry args={[0.35, 0.04, 0.5]} /><meshLambertMaterial color={c} /></mesh></>}
      {swimmer && <mesh position={[-0.38, 0.25, 0]} rotation-z={0.3}><boxGeometry args={[0.35, 0.08, 0.18]} /><meshLambertMaterial color={c} /></mesh>}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><ringGeometry args={[0.34, 0.44, 20]} /><meshBasicMaterial color={ring} side={THREE.DoubleSide} /></mesh>
      {e.you && <mesh position={[0.1, 1.05, 0]} rotation-x={Math.PI}><coneGeometry args={[0.15, 0.3, 4]} /><meshBasicMaterial color={H.ember} /></mesh>}
    </group>
  )
}

function Follow({ at, phone }: { at: () => RunState; phone: boolean }) {
  const cam = useThree(s => s.camera), look = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    const s = at(), y = Math.max(groundY(s.d), sectionAt(s.d).kind === 'glide' ? 0 : -0.5)
    const want = new THREE.Vector3(s.d - (phone ? 4 : 5), y + (phone ? 4.5 : 3.6), phone ? 8.5 : 7.5)
    const k = 1 - Math.exp(-dt * 3)
    cam.position.lerp(want, k); look.current.lerp(new THREE.Vector3(s.d + 3, y + 0.5, 0), k); cam.lookAt(look.current)
  })
  return null
}

const SUB = 0.05, MAX_DT = 0.5
function Stepper({ racers, states, rolls, onTick, speed }: { racers: Entry[]; states: React.MutableRefObject<RunState[]>; rolls: (() => number)[]; onTick: (dt: number) => void; speed?: number }) {
  const acc = useRef(0)
  useFrame((_, raw) => {
    // real time whatever the frame rate (a slow phone still races at the race's pace): sub-steps of at most SUB s, and a
    // hitch longer than MAX_DT (a tab switch) is dropped rather than raced through
    const dt = Math.min(MAX_DT, raw)
    // M243 (the /shimmer/dev?mode=fair tool): with `speed` the race steps in FIXED SUB steps (speed x real time), so the same
    // seed runs the same race whatever the frame rate (fair-dev.ts runHeat is the same loop headless)
    if (speed) {
      acc.current += dt * speed
      for (let n = 0; acc.current >= SUB && n < 400; n++) { acc.current -= SUB; states.current = states.current.map((s, i) => step(racers[i], s, SUB, rolls[i])); onTick(SUB) }
      return
    }
    for (let left = dt; left > 1e-6; left -= SUB) { const h = Math.min(SUB, left); states.current = states.current.map((s, i) => step(racers[i], s, h, rolls[i])) }
    onTick(dt)
  })
  return null
}

const COUNT_S = 3, WAIT_S = 15
export function DashRace({ racers, seed, phone, onDone, speed }: { racers: Entry[]; seed: number; phone: boolean; onDone: (r: RaceResult) => void; /** M243 dev: fixed steps at this speed */ speed?: number }) {
  const states = useRef<RunState[]>(racers.map(() => startState()))
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
  const S = states.current, mine = S[me]
  const order = racers.map((r, i) => ({ r, s: S[i] })).sort((a, b) => (a.s.fin ?? Infinity) - (b.s.fin ?? Infinity) || b.s.d - a.s.d)
  const cool = mine.cool / CHEER.cooldown
  const n = racers.length
  return (
    <div data-dash-race data-dash-go={go ? '1' : '0'} style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#9cc6e0' }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-5, 4, 8], fov: phone ? 62 : 50, near: 0.1, far: 300 }} gl={{ antialias: true }}>
        <color attach="background" args={['#a9d2ea']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[10, 18, 8]} intensity={1.2} />
        <Course n={n} />
        {racers.map((e, i) => <group key={i} position-z={laneZ(i, n)}><Body e={e} at={() => states.current[i]} /></group>)}
        {racers.map((_, i) => <Blocks key={i} lane={i} n={n} hp={() => states.current[i].blocks} />)}
        <Follow at={() => states.current[me]} phone={phone} />
        {go && <Stepper racers={racers} states={states} rolls={rolls} onTick={onTick} speed={speed} />}
      </Canvas>
      {/* HUD */}
      <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, pointerEvents: 'none', fontFamily: 'inherit' }}>
        <div data-dash-standings style={{ background: 'rgba(251,244,228,.88)', borderRadius: 10, padding: '6px 10px', fontSize: phone ? 12 : 13, color: H.ink, minWidth: 0 }}>
          {order.map(({ r, s }, k) => (
            <div key={k} data-dash-racer={r.species} data-doing={s.doing} data-d={s.d.toFixed(1)} data-split={JSON.stringify(Object.fromEntries(Object.entries(s.split).map(([k, v]) => [k, Math.round((v ?? 0) * 10) / 10])))} data-you={r.you ? '1' : '0'}
              style={{ fontWeight: r.you ? 800 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {k + 1}. {r.name} <span style={{ color: H.inkFaint }}>· {r.you ? 'you' : r.who} · {L.doing[s.doing]}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(251,244,228,.88)', borderRadius: 10, padding: '6px 10px', textAlign: 'right', color: H.ink, flex: 'none' }}>
          <div data-dash-section={sectionAt(mine.d).kind} style={{ fontWeight: 800, fontSize: 16 }}>{L.sections[sectionAt(mine.d).kind]}</div>
          <div data-dash-clock style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{fmtTime(mine.t * 1000)}</div>
          <div style={{ height: 4, width: 90, background: 'rgba(58,39,22,.15)', borderRadius: 2, marginTop: 4 }}><div style={{ height: 4, width: `${(mine.d / COURSE_LEN) * 100}%`, background: H.ember, borderRadius: 2 }} /></div>
        </div>
      </div>
      {!go && <div data-dash-count={count} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', fontSize: 64, fontWeight: 900, color: '#fbf4e4', textShadow: '0 3px 0 rgba(58,39,22,.5)' }}>{count > 0 ? count : L.go}</div>}
      <button data-dash-cheer data-burst={mine.burst > 0 ? '1' : '0'} data-cool={mine.cool.toFixed(1)} disabled={!go || mine.cool > 0 || mine.fin != null}
        onClick={() => { states.current = states.current.map((s, i) => (i === me ? cheer(s) : s)); setTick(t => t + 1) }}
        style={{ position: 'absolute', bottom: phone ? 28 : 36, left: '50%', transform: 'translateX(-50%)', width: phone ? 120 : 140, height: phone ? 120 : 140, borderRadius: '50%', border: 'none', cursor: 'pointer',
          fontSize: 20, fontWeight: 900, color: '#fbf4e4', background: mine.burst > 0 ? `radial-gradient(circle,#ffd25a,${H.ember})` : `conic-gradient(rgba(58,39,22,.55) ${cool * 360}deg, ${H.ember} 0)`,
          boxShadow: '0 4px 0 rgba(58,39,22,.35)', opacity: !go || mine.fin != null ? 0.5 : 1 }}>{L.cheer}</button>
    </div>
  )
}
