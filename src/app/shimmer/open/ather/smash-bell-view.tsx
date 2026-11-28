'use client'
// ★ BETA M246 (assets, 2026-11-27): SMASH REDO, THE BELL SHOW in the CLASH RING (clash-ring.tsx's Arena; the camera from a
// ClashCam table through clash-ceremony.ts camPose, as the ring's). Replaces s1's SmashPole. Per contestant (smash-bell.ts):
//   INTRO   her card + a shout-out to her keeper; she stands at the near wall facing us
//   WALK    she turns and walks to the centre, her BACK TO THE CAMERA, facing the BIG BELL at the far end
//   STRIKE  a wind-up, a lunge, her move's bolt flies to the bell (smash-score.ts: her favourite or strongest move)
//   GAUGE   the bell's needle climbs its column and the bell glows as the score counts up
//   CRACK   (over 9000 only) the bell cracks and the Moglin judge yells (placeholder line, @lark)
//   SCORE   the big number
// Then the next contestant (lobby: the run's seats, the same order for every keeper); at the end the winner (lobby) and Back.
// The bell, its frame and the gauge are plain code-built shapes, our own colours: first pass, 🟨 for Alex.
// The check's window: data-bell-beat / -i / -log (every beat as `beat:i`) / -score / -cracked / -back (her back to the camera).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { H } from '../../ui/hearth'
import { SpiritFigure } from './spirit-model'
import { formLook, spiritModelFor, type SpiritElement } from './spirit-models'
import type { RigClip } from './spirit-rig'
import { Arena } from './clash-ring'
import { camPose, type ClashCam } from './clash-ceremony'
import { gaugeOf, cracks } from './smash-score'
import { beatAt, showMs, bellMs, SMASH_CAM, SMASH_LOOK, SMASH_SPOT, FACE_BELL, BELL_UI as L, showWinner, type BellContestant, type BellBeat } from './smash-bell'

const FIG = 1.8
const BELL_Y = 3.9, BELL_H = 2.3, BELL_R = 1.25
// `?bellx=N` (0.1..20) paces the show alone (a slow shot pass: the WebGL screenshot lags); else `?clashx=N` (1..20) as the ring
const speedDial = () => { try { const q = new URLSearchParams(window.location.search), b = Number(q.get('bellx')), v = Number(q.get('clashx')); return b >= 0.1 && b <= 20 ? b : v >= 1 && v <= 20 ? v : 1 } catch { return 1 } }
const ease = (k: number) => 1 - (1 - k) * (1 - k)

interface Now { i: number; beat: BellBeat | 'end'; k: number; c: BellContestant | null; noSwing: boolean }

export function SmashBellView({ contestants, over = true, speed, title, onExit, cam = SMASH_CAM }: {
  contestants: BellContestant[]
  /** no more scores will come (solo: always; lobby: smashDone). A contestant still without a score is then skipped. */
  over?: boolean
  speed?: number; title?: string; onExit: () => void; cam?: ClashCam
}) {
  const x = useMemo(() => speed ?? speedDial(), [speed])
  const [i, setI] = useState(0)
  const startAt = useRef<number | null>(null), [tick, setTick] = useState(0)
  // the LOAD CARD: while the bell scene's models load (heavy pages: seconds) her show waits, so no beat plays on an empty ring
  const { active } = useProgress()
  const [ready, setReady] = useState(false), [capped, setCapped] = useState(false)
  useEffect(() => { if (active) { setReady(false); return }; const t = setTimeout(() => setReady(true), 500); return () => clearTimeout(t) }, [active])
  useEffect(() => { const t = setTimeout(() => setCapped(true), 25000); return () => clearTimeout(t) }, [])
  const loaded = ready || capped
  if (startAt.current === null || !loaded) startAt.current = performance.now()   // her show starts at the first render (never 0: a 0 start reads as long over)
  const log = useRef<string[]>([]), lastBeat = useRef('')
  const noSwing = useRef<Set<number>>(new Set())
  useEffect(() => { const t = setInterval(() => setTick(n => n + 1), 50); return () => clearInterval(t) }, [])
  const c = i < contestants.length ? contestants[i] : null
  const ms = performance.now() - (startAt.current ?? performance.now())
  let st: Now = { i, beat: 'end', k: 1, c: null, noSwing: false }
  if (c) {
    if (c.score === null) {
      // her score is not heard yet: hold on her intro; the contest over without it = no swing
      const b = beatAt(ms, null, x)
      st = { i, beat: 'intro', k: b.beat === 'intro' ? b.k : 1, c, noSwing: over }
    } else {
      const b = beatAt(ms, c.score, x)
      st = { i, beat: b.beat, k: b.k, c, noSwing: false }
    }
  }
  // advance: her show is over (or she never swung and the contest is over, after her intro)
  useEffect(() => {
    if (!c) return
    const done = c.score === null ? over && ms >= bellMs('intro', x) : ms >= showMs(c.score, x)
    if (done) { if (c.score === null) noSwing.current.add(i); setI(n => n + 1); startAt.current = performance.now() }
  }, [tick])   // eslint-disable-line react-hooks/exhaustive-deps
  const key = `${st.beat}:${st.i}`
  if (key !== lastBeat.current) { lastBeat.current = key; log.current.push(st.noSwing && st.beat === 'intro' ? `noswing:${st.i}` : key) }

  const cracked = !!c && c.score !== null && cracks(c.score) && (st.beat === 'crack' || st.beat === 'score')
  const shown = !c || c.score === null ? null : st.beat === 'gauge' ? Math.round(c.score * ease(st.k)) : st.beat === 'crack' || st.beat === 'score' ? c.score : null
  const winner = st.beat === 'end' && contestants.length > 1 ? showWinner(contestants) : null
  const phone = useNarrow()
  // the bell keeps the last swing's needle + crack under the end card
  const last = contestants.length ? contestants[contestants.length - 1] : null
  const live = useRef(st); live.current = st.beat === 'end' && last && last.score !== null ? { ...st, beat: 'score', k: 1, c: last } : st
  const skip = () => { setI(contestants.length); startAt.current = performance.now() }

  return (
    <div data-smash-bell-view data-bell-beat={st.beat} data-bell-i={st.i} data-bell-log={log.current.join(',')} data-bell-score={shown ?? ''} data-bell-cracked={cracked ? '1' : '0'}
      data-bell-loaded={loaded ? '1' : '0'} data-bell-n={contestants.length} data-bell-order={contestants.map(q => q.keeper).join('|')} data-bell-winner={winner === null ? '' : `${contestants[winner].keeper}:${contestants[winner].score}`}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: '#1d1712', color: H.ink }}>
      <Canvas data-bell-canvas dpr={[1, 1.5]} gl={{ antialias: true }} camera={{ position: [0, cam.height, cam.distance], fov: cam.fov, near: 0.05, far: 300 }}>
        <color attach="background" args={['#a9c8d8']} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 8, 6]} intensity={1.4} />
        <Arena />
        <Bell live={live} />
        {c && <Striker key={`${c.key}:${i}`} c={c} live={live} />}
        {!c && last && <Striker key={`end:${last.key}`} c={last} live={live} />}
        <BellCamera cam={cam} />
      </Canvas>

      {!loaded && <div data-bell-loading style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1d1712', color: '#fff4d8', fontSize: 20, fontWeight: 800, zIndex: 5 }}>{L.loading}</div>}

      {title && <div style={{ position: 'absolute', top: 10, left: 12, fontSize: 12, fontWeight: 800, color: '#fff4d8', textShadow: '0 2px 6px rgba(0,0,0,.6)', pointerEvents: 'none' }}>{title} · {Math.min(i + 1, contestants.length)}/{contestants.length}</div>}

      {/* INTRO: her card + the shout-out to her keeper */}
      {c && st.beat === 'intro' && (
        <div data-bell-intro={c.keeper} style={{ position: 'absolute', left: '50%', top: phone ? 40 : 34, transform: 'translateX(-50%)', width: phone ? 'calc(100% - 32px)' : 360, padding: '12px 16px', borderRadius: 14, background: H.paper, boxShadow: '0 8px 26px rgba(0,0,0,.45)', textAlign: 'center', animation: 'bellup .4s ease-out both' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: H.inkSoft, textTransform: 'uppercase', letterSpacing: '.06em' }}>{L.upNext}</div>
          <div style={{ fontSize: phone ? 24 : 28, fontWeight: 900, color: c.you ? H.ember : H.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: H.inkSoft }}>{L.form(c.element)}{c.move ? ` · ${c.move}` : ''}</div>
          <div data-bell-shout style={{ marginTop: 8, fontSize: phone ? 18 : 20, fontWeight: 900, color: H.rust }}>{L.shout(c.keeper, c.you)}</div>
          {st.noSwing && <div data-bell-noswing style={{ marginTop: 4, fontSize: 13, color: H.inkFaint }}>{L.noSwing}</div>}
        </div>
      )}
      {/* GAUGE + SCORE: the big number */}
      {shown !== null && (
        <div data-bell-scorebox style={{ position: 'absolute', top: phone ? 40 : 34, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fff4d8', textShadow: '0 2px 6px rgba(0,0,0,.6)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{L.score}</div>
          <div style={{ fontSize: phone ? 64 : 88, lineHeight: 1, fontWeight: 900, color: cracked ? '#ffdf6a' : '#fff4d8', textShadow: '0 5px 18px rgba(0,0,0,.7)', fontVariantNumeric: 'tabular-nums', animation: st.beat === 'score' ? 'bellpop .35s ease-out both' : undefined }}>{shown.toLocaleString('en-US')}</div>
          {c && st.beat === 'score' && <div style={{ fontSize: 14, fontWeight: 700, color: '#fff4d8', textShadow: '0 2px 6px rgba(0,0,0,.6)' }}>{c.name}{c.move ? ` · ${c.move}` : ''}</div>}
        </div>
      )}
      {/* CRACK: the bell cracked; the Moglin judge yells */}
      {cracked && (
        <div data-bell-judge style={{ position: 'absolute', left: 0, right: 0, margin: '0 auto', bottom: phone ? 70 : 60, width: phone ? 'calc(100% - 32px)' : 400, boxSizing: 'border-box', padding: '12px 16px', borderRadius: 14, background: H.paper, boxShadow: '0 8px 26px rgba(0,0,0,.5)', textAlign: 'center', animation: 'bellpop .35s ease-out both' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: H.rust }}>{L.cracked}</div>
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 800, color: H.inkSoft, textTransform: 'uppercase', letterSpacing: '.06em' }}>{L.judge}</div>
          <div data-bell-judge-line style={{ fontSize: phone ? 17 : 19, fontWeight: 800, color: H.ink }}>{L.judgeLine}</div>
        </div>
      )}
      {/* END: the winner (lobby) + Back */}
      {st.beat === 'end' && (
        <div data-bell-end style={{ position: 'absolute', left: '50%', top: '66%', transform: 'translate(-50%,-50%)', width: 'min(340px, calc(100% - 32px))', padding: 18, borderRadius: 14, background: H.paper, boxShadow: '0 8px 30px rgba(0,0,0,.45)', textAlign: 'center' }}>
          {winner !== null && contestants[winner].score !== null && <div data-bell-champion style={{ fontSize: 18, fontWeight: 900, color: H.ember }}>{L.winner(contestants[winner].name, contestants[winner].keeper, contestants[winner].score!)}</div>}
          {contestants.map((q, k) => (
            <div key={q.key} data-bell-row={q.keeper} data-bell-row-score={q.score ?? ''} style={{ display: 'flex', gap: 8, fontSize: 14, fontWeight: k === winner ? 900 : 600, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.keeper} · {q.name}</span><span>{q.score === null ? L.noSwing : q.score.toLocaleString('en-US')}</span>
            </div>))}
          <button data-smash-exit onClick={onExit} style={{ marginTop: 14, padding: '10px 18px', borderRadius: 10, border: 'none', background: H.ember, color: '#fff8ea', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>{L.back}</button>
        </div>
      )}
      {st.beat !== 'end' && <button data-bell-skip onClick={skip} style={{ position: 'absolute', bottom: 12, right: 12, padding: '7px 14px', borderRadius: 16, border: 'none', fontWeight: 800, fontSize: 13, background: 'rgba(255,248,232,.85)', color: H.ink, cursor: 'pointer' }}>{L.skip}</button>}
      <style>{'@keyframes bellup { from { transform: translate(-50%, 18px); opacity: 0 } to { transform: translate(-50%, 0); opacity: 1 } } @keyframes bellpop { from { transform: scale(.5); opacity: 0 } 70% { transform: scale(1.1) } to { transform: none; opacity: 1 } }'}</style>
    </div>
  )
}

function useNarrow() {
  const [n, setN] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700)
  useEffect(() => { const f = () => setN(window.innerWidth < 700); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return n
}

/** the bell show's camera: the ClashCam table through camPose (as the ring's), aimed past the centre at the bell */
function BellCamera({ cam }: { cam: ClashCam }) {
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera, size = useThree(s => s.size)
  useFrame(() => {
    const p = camPose(cam, size.width / Math.max(1, size.height))
    if (camera.fov !== p.fov) { camera.fov = p.fov; camera.updateProjectionMatrix() }
    camera.position.set(p.x, p.y, SMASH_LOOK.z + p.z)
    camera.lookAt(0, SMASH_LOOK.y, SMASH_LOOK.z)
    camera.updateMatrixWorld()
  })
  return null
}

/** THE BIG BELL at the far end: a timber frame, a bronze bell (lathe), its clapper; the GAUGE column beside it (the needle
 *  climbs as the score counts up; the top notch = 9000); over 9000 the bell cracks (dark zigzag) and shakes. */
function Bell({ live }: { live: { current: Now } }) {
  const bell = useRef<THREE.Group>(null), fill = useRef<THREE.Mesh>(null), needle = useRef<THREE.Group>(null), crack = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshStandardMaterial>(null), flash = useRef<THREE.Mesh>(null)
  const profile = useMemo(() => {
    const pts: THREE.Vector2[] = []
    for (let s = 0; s <= 16; s++) { const v = s / 16, r = 0.32 + 0.55 * Math.pow(v, 1.6) + (v > 0.85 ? (v - 0.85) * 1.4 : 0); pts.push(new THREE.Vector2(r * BELL_R, -v * BELL_H)) }
    return pts
  }, [])
  const cracks3 = useMemo(() => { const seg: { x: number; y: number; l: number; a: number }[] = []; let x = 0.05, y = -0.35
    for (let s = 0; s < 9; s++) { const a = (s % 2 ? -1 : 1) * (0.5 + 0.25 * ((s * 7) % 3)), l = 0.24; seg.push({ x: x + Math.sin(a) * l / 2, y: y - Math.cos(a) * l / 2, l, a }); x += Math.sin(a) * l; y -= Math.cos(a) * l }
    return seg }, [])
  const ticks = useMemo(() => Array.from({ length: 10 }, (_, k) => k), [])
  const GH = 4.6
  useFrame(() => {
    const s = live.current, c = s.c, sc = c?.score ?? 0
    const shown = !c || c.score === null ? 0 : s.beat === 'gauge' ? sc * ease(s.k) : s.beat === 'crack' || s.beat === 'score' ? sc : 0
    const g = gaugeOf(shown)
    if (fill.current) { fill.current.scale.y = Math.max(0.001, g); fill.current.position.y = 0.2 + (GH * g) / 2 }
    if (needle.current) needle.current.position.y = 0.2 + GH * g
    const isCrack = !!c && c.score !== null && cracks(c.score) && (s.beat === 'crack' || s.beat === 'score')
    if (crack.current) crack.current.visible = isCrack
    if (mat.current) { mat.current.emissive.setRGB(1, 0.75, 0.25); mat.current.emissiveIntensity = isCrack ? 0.15 : g * 0.9; mat.current.color.set(isCrack ? '#8a6a32' : '#c9973a') }
    if (bell.current) {
      const hitK = s.beat === 'strike' ? Math.max(0, (s.k - 0.75) / 0.25) : 0
      const swing = s.beat === 'gauge' ? Math.sin(s.k * Math.PI * 4) * 0.12 * (1 - s.k) * (0.4 + g) : hitK * 0.08
      bell.current.rotation.x = -swing
      bell.current.position.x = s.beat === 'crack' ? Math.sin(performance.now() / 22) * 0.06 * (1 - s.k) : 0
    }
    if (flash.current) { const on = s.beat === 'strike' && s.k > 0.75; flash.current.visible = on || (s.beat === 'gauge' && s.k < 0.15); const k = on ? (s.k - 0.75) / 0.25 : 1; flash.current.scale.setScalar(0.4 + k * 1.6) }
  })
  const z = SMASH_SPOT.bell
  return (
    <group position={[0, 0, z]}>
      {/* the frame: two posts and a beam */}
      {[-1.9, 1.9].map(px => <mesh key={px} position={[px, 2.7, 0]}><boxGeometry args={[0.32, 5.4, 0.32]} /><meshLambertMaterial color="#6b4a2c" /></mesh>)}
      <mesh position={[0, 5.45, 0]}><boxGeometry args={[4.4, 0.36, 0.42]} /><meshLambertMaterial color="#5a3d24" /></mesh>
      <mesh position={[0, 0.12, 0]}><boxGeometry args={[4.6, 0.24, 1.2]} /><meshLambertMaterial color="#7d6248" /></mesh>
      {/* the bell, hung from the beam */}
      <group ref={bell} position={[0, 5.3, 0]}>
        <mesh position-y={-0.1}><cylinderGeometry args={[0.12, 0.12, 0.3, 10]} /><meshLambertMaterial color="#3a2b1c" /></mesh>
        <group position-y={-0.22}>
          <mesh><latheGeometry args={[profile, 40]} /><meshStandardMaterial ref={mat} color="#c9973a" metalness={0.55} roughness={0.35} side={THREE.DoubleSide} /></mesh>
          <mesh position-y={-BELL_H * 0.92}><sphereGeometry args={[0.22, 14, 10]} /><meshStandardMaterial color="#5b4320" metalness={0.4} roughness={0.5} /></mesh>
          {/* the crack: a dark zigzag down the bell's face (toward the camera) */}
          <group ref={crack} visible={false} position={[0, 0, 0]}>
            {cracks3.map((q, k) => { const v = Math.min(1, -q.y / BELL_H), r = (0.32 + 0.55 * Math.pow(v, 1.6)) * BELL_R + 0.02; return (
              <mesh key={k} position={[q.x, q.y, Math.sqrt(Math.max(0.01, r * r - q.x * q.x))]} rotation-z={q.a}><boxGeometry args={[0.07, q.l + 0.04, 0.03]} /><meshBasicMaterial color="#1a120a" /></mesh>) })}
          </group>
        </group>
      </group>
      {/* the strike's flash on the bell */}
      <mesh ref={flash} visible={false} position={[0, BELL_Y - 0.3, 1.3]}><sphereGeometry args={[0.5, 16, 12]} /><meshBasicMaterial color="#fff2b0" transparent opacity={0.75} depthWrite={false} /></mesh>
      {/* the gauge column: notches, the glowing fill, the needle; the top notch (9000) red */}
      <group position={[2.95, 0, 0.2]}>
        <mesh position-y={0.2 + GH / 2}><boxGeometry args={[0.62, GH + 0.2, 0.18]} /><meshLambertMaterial color="#3b2a1c" /></mesh>
        <mesh ref={fill} position={[0, 0.2, 0.1]}><boxGeometry args={[0.38, GH, 0.05]} /><meshBasicMaterial color="#ffc94a" /></mesh>
        {ticks.map(k => <mesh key={k} position={[0, 0.2 + (GH * (k + 1)) / 10, 0.13]}><boxGeometry args={[k === 9 ? 0.6 : 0.5, 0.04, 0.02]} /><meshBasicMaterial color={k === 9 ? '#d23a22' : '#f4e2bc'} /></mesh>)}
        <group ref={needle} position-y={0.2}>
          <mesh position={[-0.42, 0, 0.12]} rotation-z={-Math.PI / 2}><coneGeometry args={[0.13, 0.3, 3]} /><meshBasicMaterial color="#fff6dc" /></mesh>
        </group>
      </group>
    </group>
  )
}

/** the contestant: intro at the near wall facing us, the walk to the centre (back to the camera), the strike and her bolt */
function Striker({ c, live }: { c: BellContestant; live: { current: Now } }) {
  const g = useRef<THREE.Group>(null), body = useRef<THREE.Group>(null), bolt = useRef<THREE.Mesh>(null)
  const camera = useThree(s => s.camera), gl = useThree(s => s.gl)
  const look = useMemo(() => (c.element === 'base' ? spiritModelFor(c.species) : formLook(c.species, c.element as SpiritElement)), [c.species, c.element])
  const [clip, setClip] = useState<RigClip>('idle')
  const lastBack = useRef('')
  const fwd = useMemo(() => new THREE.Vector3(), []), to = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const s = live.current; if (!g.current || !body.current) return
    let z: number = SMASH_SPOT.from, yaw = 0, lunge = 0, crouch = 1, cl: RigClip = 'idle'
    if (s.beat === 'intro') { z = SMASH_SPOT.from; yaw = s.k < 0.8 ? 0 : FACE_BELL * ((s.k - 0.8) / 0.2) }
    else if (s.beat === 'walk') { z = SMASH_SPOT.from + (SMASH_SPOT.at - SMASH_SPOT.from) * ease(s.k); yaw = FACE_BELL; cl = s.k < 0.95 ? 'walk' : 'idle' }
    else if (s.beat === 'strike') { z = SMASH_SPOT.at; yaw = FACE_BELL; if (s.k < 0.45) crouch = 1 - 0.12 * (s.k / 0.45); else { lunge = 0.7 * Math.sin(Math.min(1, (s.k - 0.45) / 0.3) * Math.PI / 2); cl = 'run' } }
    else { z = SMASH_SPOT.at; yaw = FACE_BELL }
    g.current.position.set(0, 0, z - lunge)
    g.current.rotation.y = yaw
    body.current.scale.set(FIG, FIG * crouch, FIG)
    if (cl !== clip) setClip(cl)
    // her bolt: from her to the bell over the strike's second half
    if (bolt.current) {
      const on = s.beat === 'strike' && s.k >= 0.45 && s.k < 0.8
      bolt.current.visible = on
      if (on) { const k = (s.k - 0.45) / 0.35; bolt.current.position.set(0, 1.1 + k * (BELL_Y - 1.5), SMASH_SPOT.at - 0.6 + (SMASH_SPOT.bell + 1.3 - SMASH_SPOT.at + 0.6) * k) }
    }
    // the check's window: is her back to the camera? (her facing vs the way to the camera)
    fwd.set(Math.sin(g.current.rotation.y), 0, Math.cos(g.current.rotation.y))
    to.set(camera.position.x - g.current.position.x, 0, camera.position.z - g.current.position.z)
    const back = fwd.dot(to) < 0 ? '1' : '0'
    if (back !== lastBack.current) { lastBack.current = back; gl.domElement.closest('[data-smash-bell-view]')?.setAttribute('data-bell-back', back) }
  })
  const col = c.element === 'storm' ? '#9fd0ff' : c.element === 'earth' ? '#d6a35a' : c.element === 'water' ? '#6fd6ff' : c.element === 'mana' ? '#d39bff' : '#fff1a8'
  return (
    <>
      <group ref={g}>
        <group ref={body} scale={FIG}>
          {look ? <SpiritFigure sp={c.species} look={look} clip={clip} />
            : <mesh position-y={0.25} userData={{ spiritModel: `orb:${c.species}` }}><sphereGeometry args={[0.16, 16, 12]} /><meshBasicMaterial color="#ffd86a" /></mesh>}
        </group>
        <mesh rotation-x={-Math.PI / 2} position-y={0.01}><circleGeometry args={[0.32 * FIG, 24]} /><meshBasicMaterial color="#000" transparent opacity={0.18} depthWrite={false} /></mesh>
      </group>
      <mesh ref={bolt} visible={false}><sphereGeometry args={[0.32, 16, 12]} /><meshBasicMaterial color={col} transparent opacity={0.9} depthWrite={false} /></mesh>
    </>
  )
}

