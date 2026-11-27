'use client'
// BETA M247 s1: THE DASH COURSE WORKSPACE (Creative mode, map 'Dash course'; owner only like all of /shimmer/dev). Alex 11-27:
// "a spray paint can tool to mark the course path on the map.. a preview panel under the map showing the dash cam view, play
// runs a test Vulnyx along the track with the camera following, so I see obstructions".
//  - THE MAP: the tent's flat sandbox floor (dash-course ARENA m square) top-down. Tools: Spray (drag = a stroke; the strokes
//    joined + smoothed ARE the course line), Erase (drag cuts strokes, and takes markers off), Section (click on the line = a
//    marker of the picked kind from there on), Start, Finish (click on the line). Width dial, Undo, Clear.
//  - THE CHECKS: tight turns (red rings) and spots where the dash cam stands in the tent wall (orange rings), listed under it.
//  - THE PREVIEW: the dash cam view (three): the test Vulnyx (her real model, SpiritFigure) runs the line at race speed
//    (dash-course previewPlan = fair-dash-race speedIn per section); Play / Pause / scrub.
//  - THE STORE: the builder's 'dash' map (save-builder: draft / Publish / History + roll back), the layer's `course`.
// The look of the tent + bleachers and a race on the published course = s2.
import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  ARENA, WALL, WIDTH_MIN, WIDTH_MAX, KINDS, CAM_BACK, COURSE_UI as U, emptyCourse, sprayPoint, eraseAt, courseLine, cumul, project,
  pointAt, raceSpan, courseSections, tightTurns, camBlocked, camAt, minTurn, previewPlan, previewAt, onFloor, type DashCourse, type Pt,
} from '../../open/ather/dash-course'
import type { SectionKind } from '../../open/ather/fair-dash-race'
import { DASH_UI } from '../../open/ather/fair-dash-rules'
import { SpiritFigure } from '../../open/ather/spirit-model'
import { spiritModelFor } from '../../open/ather/spirit-models'
import { AUTOSAVE_MS, savedAgo, type Layer, type Index, type BuilderMap } from '../../world/builder'

const MAPS: [BuilderMap, string][] = [['wilds', 'the Wilds'], ['glade', 'Moonwell Glade'], ['nyx', 'Nyx continent'], ['dash', U.title]]
const KIND_COL: Record<SectionKind, string> = { run: '#d9b36c', swim: '#4aa3df', climb: '#9a7550', glide: '#b58adf', blocks: '#d0603a' }
const OFF_COL = '#6d6458'
const ERASE_R = 2.5
const H = ARENA / 2
type Tool = 'spray' | 'erase' | 'section' | 'start' | 'finish'
interface BSnap { draft: Layer; draftAt: number | null; index: Index; state: 'unpublished changes' | 'matches live' }
async function call(body?: Record<string, unknown>): Promise<BSnap | null> {
  try {
    const r = body ? await fetch('/shimmer/save-builder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ map: 'dash', ...body }) })
      : await fetch('/shimmer/save-builder?map=dash', { cache: 'no-store' })
    return r.ok ? await r.json() as BSnap : null
  } catch { return null }
}
const hasCourse = (c: DashCourse) => !!(c.strokes.length || c.marks.length || c.start || c.finish)
const layerOf = (c: DashCourse): Layer => ({ v: 1, tiles: {}, water: {}, falls: {}, ...(hasCourse(c) ? { course: c } : {}) })

export default function DashCourseEditor({ onMap }: { onMap: (m: BuilderMap) => void }) {
  const [course, setCourse] = useState<DashCourse>(emptyCourse)
  const [loaded, setLoaded] = useState(false)
  const [tool, setTool] = useState<Tool>('spray')
  const [kind, setKind] = useState<SectionKind>('swim')
  const [snap, setSnap] = useState<BSnap | null>(null)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [msg, setMsg] = useState('')
  const [, tick] = useState(0)
  const hist = useRef<DashCourse[]>([]), lastAct = useRef(''), drag = useRef<null | 'spray' | 'erase'>(null)
  const svg = useRef<SVGSVGElement>(null)
  const courseRef = useRef(course); courseRef.current = course

  // ── derived ──
  const line = useMemo(() => courseLine(course.strokes), [course.strokes])
  const cum = useMemo(() => cumul(line), [line])
  const span = useMemo(() => (line.length >= 2 ? raceSpan(course, line, cum) : { s0: 0, s1: 0 }), [course, line, cum])
  const secs = useMemo(() => courseSections(course, line, cum), [course, line, cum])
  const tight = useMemo(() => tightTurns(line, course.width, cum).filter(s => s.s >= span.s0 && s.s <= span.s1), [line, course.width, cum, span])
  const cam = useMemo(() => (line.length >= 2 ? camBlocked(line, cum, span.s0, span.s1) : []), [line, cum, span])
  const plan = useMemo(() => previewPlan(course, line, cum), [course, line, cum])

  // ── the store ──
  useEffect(() => { call().then(s => { if (s) { setSnap(s); setSavedAt(s.draftAt); if (s.draft.course) setCourse(s.draft.course) } setLoaded(true) }) }, [])
  const edit = useCallback((f: (c: DashCourse) => DashCourse, act: string) => {
    if (act !== lastAct.current || act === 'stroke' || act === 'mark') { hist.current.push(courseRef.current); if (hist.current.length > 200) hist.current.shift() }
    lastAct.current = act
    setCourse(f)
    setDirty(true)
  }, [])
  const undo = () => { const p = hist.current.pop(); if (p) { setCourse(p); setDirty(true); lastAct.current = '' } }
  const save = useCallback(async (c: DashCourse) => {
    const s = await call({ action: 'draft', layer: layerOf(c) })
    if (s) { setSnap(s); setSavedAt(s.draftAt ?? Date.now()); setDirty(false); setMsg('draft saved') } else setMsg('save failed')
    return !!s
  }, [])
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty
  useEffect(() => { const a = setInterval(() => { if (dirtyRef.current && !drag.current) save(courseRef.current) }, AUTOSAVE_MS); const b = setInterval(() => tick(n => n + 1), 5000); return () => { clearInterval(a); clearInterval(b) } }, [save])
  const publish = async () => {
    if (dirty && !(await save(course))) return
    const s = await call({ action: 'publish', note: 'dash course' })
    if (s) { setSnap(s); setMsg(`published v${s.index.live}`) } else setMsg('publish failed')
  }
  const rollback = async (v: number) => {
    const s = await call({ action: 'rollback', v })
    if (s) { setSnap(s); setCourse(s.draft.course ?? emptyCourse()); setDirty(false); hist.current = []; setMsg(`rolled back to v${v}`) } else setMsg('roll back failed')
  }

  // ── the map's pointer ──
  const at = (e: { clientX: number; clientY: number }): Pt => {
    const r = svg.current!.getBoundingClientRect()
    return onFloor(((e.clientX - r.left) / r.width) * ARENA - H, ((e.clientY - r.top) / r.height) * ARENA - H)
  }
  const onLine = (p: Pt): Pt | null => {
    if (line.length < 2) return null
    const q = project(line, cum, p[0], p[1]); if (q.d > Math.max(course.width, 6)) return null
    const o = pointAt(line, cum, q.s); return [Math.round(o.x * 100) / 100, Math.round(o.z * 100) / 100]
  }
  const eraseHere = (p: Pt) => edit(c => ({ ...c, strokes: eraseAt(c.strokes, p[0], p[1], ERASE_R), marks: c.marks.filter(m => Math.hypot(m.x - p[0], m.z - p[1]) > ERASE_R),
    start: c.start && Math.hypot(c.start[0] - p[0], c.start[1] - p[1]) <= ERASE_R ? null : c.start, finish: c.finish && Math.hypot(c.finish[0] - p[0], c.finish[1] - p[1]) <= ERASE_R ? null : c.finish }), 'erase')
  const down = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const p = at(e); (e.target as Element).setPointerCapture?.(e.pointerId)
    if (tool === 'spray') { drag.current = 'spray'; edit(c => ({ ...c, strokes: [...c.strokes, [p]] }), 'stroke') }
    else if (tool === 'erase') { drag.current = 'erase'; lastAct.current = ''; eraseHere(p) }
    else { const q = onLine(p); if (!q) { setMsg('click on the course line'); return }
      if (tool === 'section') edit(c => ({ ...c, marks: [...c.marks, { x: q[0], z: q[1], kind }] }), 'mark')
      else edit(c => ({ ...c, [tool]: q }), 'mark') }
  }
  const move = (e: React.PointerEvent) => {
    if (!drag.current) return
    const p = at(e)
    if (drag.current === 'spray') setCourse(c => { const s = c.strokes.slice(); s[s.length - 1] = sprayPoint(s[s.length - 1], p[0], p[1]); return { ...c, strokes: s } })
    else eraseHere(p)
  }
  const up = () => {
    if (drag.current === 'spray') setCourse(c => { const l = c.strokes[c.strokes.length - 1]; return l && l.length < 2 ? { ...c, strokes: c.strokes.slice(0, -1) } : c })
    drag.current = null
  }

  // ── the preview clock (wall time, so a slow frame rate never slows the race) ──
  const clock = useRef({ on: false, base: 0, t0: 0 })
  const tNow = useCallback(() => { const k = clock.current; return Math.min(plan.T, k.on ? k.base + (performance.now() - k.t0) / 1000 : k.base) }, [plan.T])
  const [playing, setPlaying] = useState(false)
  const playPause = () => {
    const k = clock.current
    if (k.on) { k.base = tNow(); k.on = false; setPlaying(false) }
    else { if (k.base >= plan.T - 1e-3) k.base = 0; k.t0 = performance.now(); k.on = true; setPlaying(true) }
  }
  const [scrubT, setScrubT] = useState(0)
  useEffect(() => { const i = setInterval(() => { const t = tNow(); setScrubT(t); if (clock.current.on && t >= plan.T) { clock.current = { on: false, base: plan.T, t0: 0 }; setPlaying(false) } }, 200); return () => clearInterval(i) }, [tNow, plan.T])
  const pose = useCallback(() => {
    const t = tNow(), q = previewAt(plan, t), p = pointAt(line, cum, q.s), c = line.length >= 2 ? camAt(line, cum, q.s) : [0, -CAM_BACK] as Pt
    return { t, d: q.d, s: q.s, kind: q.kind, x: p.x, z: p.z, heading: p.heading, cam: c }
  }, [tNow, plan, line, cum])

  // the check's probe (read only)
  useEffect(() => {
    const w = window as unknown as { __dashCourse?: unknown }
    w.__dashCourse = { ready: loaded, course: () => courseRef.current, line: () => line, sections: () => secs, preview: () => ({ ...pose(), T: plan.T, playing: clock.current.on }),
      checks: () => ({ tight, cam }), snap: () => snap, dirty: () => dirtyRef.current }
  }, [loaded, line, secs, pose, plan.T, tight, cam, snap])

  const btn = 'px-2.5 py-1 rounded text-xs font-mono border transition-colors'
  const on = 'bg-amber-500/20 border-amber-400 text-amber-200', off = 'bg-white/5 border-white/15 text-white/60 hover:text-white'
  // the line drawn per section (grey before the start / after the finish)
  const runs = useMemo(() => {
    if (line.length < 2) return [] as { col: string; pts: Pt[]; kind: string }[]
    const colAt = (s: number) => { if (s < span.s0 - 1e-6 || s > span.s1 + 1e-6) return ['off', OFF_COL]; let k: SectionKind = 'run'; for (const x of secs) if (span.s0 + x.at <= s + 1e-6) k = x.kind; return [k, KIND_COL[k]] }
    const out: { col: string; pts: Pt[]; kind: string }[] = []
    line.forEach((p, i) => { const [k, col] = colAt(cum[i]); const l = out[out.length - 1]; if (l && l.kind === k) l.pts.push(p); else out.push({ col, kind: k, pts: i ? [line[i - 1], p] : [p] }) })
    return out
  }, [line, cum, secs, span])
  const ps = (pts: Pt[]) => pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')
  const live = pose()

  return (
    <div className="flex flex-col gap-3 text-white/85" data-testid="dash-course-editor">
      <div className="flex flex-wrap gap-1 items-center">
        {MAPS.map(([m, name]) => <button key={m} className={`${btn} ${m === 'dash' ? on : off}`} onClick={() => m !== 'dash' && onMap(m)} data-testid={`map-${m}`}>{name}</button>)}
      </div>
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex flex-col gap-2 w-full max-w-[640px]">
          <div className="flex flex-wrap gap-1 items-center">
            {(['spray', 'erase', 'section', 'start', 'finish'] as const).map(t => <button key={t} className={`${btn} ${tool === t ? on : off}`} onClick={() => setTool(t)} data-testid={`dash-tool-${t}`}>{U[t]}</button>)}
            <select value={kind} onChange={e => { setKind(e.target.value as SectionKind); setTool('section') }} data-testid="dash-kind" className="bg-black/40 border border-white/15 rounded px-1 py-1 text-xs font-mono">
              {KINDS.map(k => <option key={k} value={k}>{DASH_UI.sections[k]}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs font-mono text-white/60 ml-2">{U.width}
              <input type="range" min={WIDTH_MIN} max={WIDTH_MAX} step={0.5} value={course.width} data-testid="dash-width" onChange={e => { const w = Number(e.target.value); edit(c => ({ ...c, width: w }), 'width') }} />
              <span className="tabular-nums w-10">{course.width} m</span></label>
            <button className={`${btn} ${off}`} onClick={undo} data-testid="dash-undo" disabled={!hist.current.length}>{U.undo}</button>
            <button className={`${btn} ${off}`} onClick={() => edit(() => ({ ...emptyCourse(), width: course.width }), 'clear')} data-testid="dash-clear">{U.clear}</button>
          </div>
          <svg ref={svg} viewBox={`${-H} ${-H} ${ARENA} ${ARENA}`} className="w-full aspect-square rounded border border-white/15 touch-none select-none" data-testid="dash-map"
            style={{ cursor: tool === 'erase' ? 'cell' : 'crosshair', background: '#cdb382' }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}>
            <rect x={-H} y={-H} width={ARENA} height={ARENA} fill="none" stroke="#6b4f33" strokeWidth={WALL * 2} />
            {course.strokes.map((s, i) => <polyline key={i} points={ps(s)} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.25} strokeDasharray="0.8 0.6" />)}
            {runs.map((r, i) => <polyline key={i} points={ps(r.pts)} fill="none" stroke={r.col} strokeOpacity={0.85} strokeWidth={course.width} strokeLinecap="round" strokeLinejoin="round" data-run={r.kind} />)}
            {line.length >= 2 && <polyline points={ps(line)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth={0.2} data-testid="dash-line" />}
            {tight.map((s, i) => <circle key={`t${i}`} cx={s.x} cy={s.z} r={3.2} fill="none" stroke="#ff2a2a" strokeWidth={0.5} data-spot="tight" />)}
            {cam.map((s, i) => <circle key={`c${i}`} cx={s.x} cy={s.z} r={2.6} fill="none" stroke="#ff9a1a" strokeWidth={0.5} strokeDasharray="1 0.6" data-spot="cam" />)}
            {course.marks.map((m, i) => <g key={i} data-mark={m.kind}><circle cx={m.x} cy={m.z} r={1.5} fill={KIND_COL[m.kind]} stroke="#1a1208" strokeWidth={0.3} /><text x={m.x} y={m.z - 2} fontSize={2} textAnchor="middle" fill="#1a1208">{DASH_UI.sections[m.kind]}</text></g>)}
            {course.start && <g data-testid="dash-start"><circle cx={course.start[0]} cy={course.start[1]} r={1.7} fill="#3ccf6e" stroke="#0b2" strokeWidth={0.3} /><text x={course.start[0]} y={course.start[1] + 0.7} fontSize={2} textAnchor="middle" fill="#04210f">S</text></g>}
            {course.finish && <g data-testid="dash-finish"><circle cx={course.finish[0]} cy={course.finish[1]} r={1.7} fill="#f4f4f4" stroke="#111" strokeWidth={0.3} /><text x={course.finish[0]} y={course.finish[1] + 0.7} fontSize={2} textAnchor="middle" fill="#111">F</text></g>}
            {line.length >= 2 && <circle cx={live.x} cy={live.z} r={1} fill="#ffd86a" stroke="#3a2a10" strokeWidth={0.25} data-testid="dash-runner" />}
          </svg>
          {/* the PREVIEW PANEL: the dash cam */}
          <div className="rounded border border-white/15 overflow-hidden bg-black/50" style={{ height: 300 }} data-testid="dash-preview">
            {line.length >= 2 ? <Preview line={line} cum={cum} width={course.width} runs={runs} pose={pose} playing={playing} />
              : <div className="h-full flex items-center justify-center text-xs font-mono text-white/45">{U.noLine}</div>}
          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <input type="range" min={0} max={Math.max(0.01, plan.T)} step={0.05} value={Math.min(scrubT, plan.T)} className="flex-1" data-testid="dash-scrub"
              onChange={e => { const t = Number(e.target.value); clock.current = { on: clock.current.on, base: t, t0: performance.now() }; setScrubT(t) }} />
            <span className="tabular-nums w-28 text-right text-white/60" data-testid="dash-time">{scrubT.toFixed(1)} / {plan.T.toFixed(1)} s{live.kind ? ` · ${DASH_UI.sections[live.kind]}` : ''}</span>
            <button className={`${btn} ${playing ? on : off}`} onClick={playPause} disabled={!plan.T} data-testid="dash-play">{playing ? U.pause : U.play}</button>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full lg:w-72">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">{U.title}</div>
          <div className="text-xs font-mono text-white/70" data-testid="dash-length">{line.length >= 2 ? U.length(span.s1 - span.s0, plan.T) : U.noLine}</div>
          <div className="flex flex-wrap gap-1 text-[11px] font-mono" data-testid="dash-sections">
            {secs.map((s, i) => <span key={i} className="px-1.5 py-0.5 rounded" style={{ background: KIND_COL[s.kind], color: '#1a1208' }}>{DASH_UI.sections[s.kind]} {Math.round(s.len)} m</span>)}
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 pt-1">Checks</div>
          <div className="flex flex-col gap-0.5 text-xs font-mono" data-testid="dash-checks">
            {line.length >= 2 && !tight.length && !cam.length && <div className="text-emerald-300/80">{U.checksOk}</div>}
            {tight.map((s, i) => <div key={`t${i}`} className="text-red-300" data-check="tight">{U.tight(s.r ?? 0, minTurn(course.width))} at {Math.round(s.s - span.s0)} m</div>)}
            {cam.map((s, i) => <div key={`c${i}`} className="text-orange-300" data-check="cam">{U.blocked} at {Math.round(Math.max(0, s.s - span.s0))} m</div>)}
          </div>
          <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
            <button onClick={() => save(course)} disabled={!dirty} data-testid="dash-save"
              className={`px-3 py-2 rounded font-mono text-xs uppercase tracking-[0.15em] border ${dirty ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-white/5 border-white/10 text-white/30'}`}>{dirty ? 'Save draft' : 'Draft saved'}</button>
            <div className="text-[11px] font-mono text-white/45" data-testid="dash-status">{dirty ? 'unsaved, autosave soon' : savedAgo(savedAt, Date.now())} · {dirty || snap?.state !== 'matches live' ? 'unpublished changes' : 'matches live'}{msg ? ` · ${msg}` : ''}</div>
            <button onClick={publish} disabled={!dirty && snap?.state === 'matches live'} data-testid="dash-publish"
              className={`px-3 py-2 rounded font-mono text-xs uppercase tracking-[0.15em] border ${dirty || snap?.state !== 'matches live' ? 'bg-sky-500/20 border-sky-400 text-sky-200' : 'bg-white/5 border-white/10 text-white/30'}`}>Publish</button>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/40 pt-1">History</div>
            <div className="max-h-48 overflow-y-auto space-y-1" data-testid="dash-history">
              {!snap?.index.versions.length && <div className="text-xs text-white/35">nothing published yet</div>}
              {[...(snap?.index.versions ?? [])].reverse().map(v => (
                <div key={v.v} className="flex items-center gap-2 text-xs font-mono">
                  <span className={v.v === snap?.index.live ? 'text-emerald-300' : 'text-white/60'}>v{v.v}</span>
                  <span className="flex-1 truncate text-white/70">{v.note}</span>
                  {v.v === snap?.index.live ? <span className="text-emerald-300/80 text-[10px] uppercase">live</span>
                    : <button className="text-[10px] uppercase text-sky-300 hover:text-sky-100" onClick={() => rollback(v.v)} data-testid={`dash-rollback-${v.v}`}>roll back</button>}
                </div>
              ))}
            </div>
          </div>
          <div className="text-[11px] text-white/40 leading-snug">Spray: drag on the floor. Section / Start / Finish: click on the line. Erase also takes markers off.</div>
        </div>
      </div>
    </div>
  )
}

type Pose = { s: number; x: number; z: number; heading: number; cam: Pt; kind: SectionKind | null }
/** the dash cam view: the floor, the tent wall, the lane in its section colours, the test Vulnyx, a camera trailing her */
function Preview({ line, cum, width, runs, pose, playing }: { line: Pt[]; cum: number[]; width: number; runs: { col: string; pts: Pt[] }[]; pose: () => Pose; playing: boolean }) {
  const look = useMemo(() => spiritModelFor('fox'), [])
  return (
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, 4, -6], fov: 55, near: 0.1, far: 400 }} gl={{ antialias: true }}>
      <color attach="background" args={['#2a2018']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[20, 40, 10]} intensity={1.2} />
      <mesh rotation-x={-Math.PI / 2}><planeGeometry args={[ARENA, ARENA]} /><meshLambertMaterial color="#cdb382" /></mesh>
      {[[0, -H], [0, H], [-H, 0], [H, 0]].map(([x, z], i) => (
        <mesh key={i} position={[x, 2, z]} rotation-y={i < 2 ? 0 : Math.PI / 2}><boxGeometry args={[ARENA, 4, WALL]} /><meshLambertMaterial color="#7a5a3a" /></mesh>
      ))}
      {runs.map((r, i) => <Ribbon key={i} pts={r.pts} width={width} col={r.col} />)}
      <Runner pose={pose} playing={playing} look={look} />
      <DashCam pose={pose} line={line} cum={cum} />
    </Canvas>
  )
}
function Ribbon({ pts, width, col }: { pts: Pt[]; width: number; col: string }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry(), v: number[] = [], idx: number[] = []
    pts.forEach((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1
      const nx = -dz / L * width / 2, nz = dx / L * width / 2
      v.push(p[0] + nx, 0.03, p[1] + nz, p[0] - nx, 0.03, p[1] - nz)
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k) }
    })
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g
  }, [pts, width])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo}><meshBasicMaterial color={col} side={THREE.DoubleSide} /></mesh>
}
function Runner({ pose, playing, look }: { pose: () => Pose; playing: boolean; look: ReturnType<typeof spiritModelFor> }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => { const p = pose(); if (g.current) { g.current.position.set(p.x, 0.03, p.z); g.current.rotation.y = p.heading } })
  return (
    <group ref={g} data-testid="dash-vulnyx">
      <group scale={2}>
        {look ? <Suspense fallback={null}><SpiritFigure sp="fox" look={look} clip={playing ? 'run' : 'idle'} /></Suspense>
          : <mesh position-y={0.3}><sphereGeometry args={[0.2, 12, 10]} /><meshBasicMaterial color="#ffd86a" /></mesh>}
      </group>
    </group>
  )
}
function DashCam({ pose, line, cum }: { pose: () => Pose; line: Pt[]; cum: number[] }) {
  const cam = useThree(s => s.camera), at = useRef(new THREE.Vector3()), first = useRef(true)
  useFrame((_, dt) => {
    const p = pose(), ahead = pointAt(line, cum, p.s + 3)
    const want = new THREE.Vector3(p.cam[0], 3.2, p.cam[1]), look = new THREE.Vector3(ahead.x, 0.6, ahead.z)
    const k = first.current ? 1 : 1 - Math.exp(-Math.min(0.1, dt) * 4); first.current = false
    cam.position.lerp(want, k); at.current.lerp(look, k); cam.lookAt(at.current)
  })
  return null
}
