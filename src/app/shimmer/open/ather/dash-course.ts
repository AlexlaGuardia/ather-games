// BETA M247 s1: THE DASH COURSE the owner carves in Creative (Alex 11-27: "a spray paint can tool to mark the course path..
// the painted line IS the race path data"). The race today runs one fixed straight course (fair-dash-race.ts COURSE); this is
// the data a carved one is made of, and everything the editor needs to check it, PURE (no React, no three, no DOM, no fetch).
//  - STROKES: what the spray can laid down, in the order painted (world metres on the tent floor, centred on 0,0). The course
//    line = the strokes joined end to start, smoothed (Chaikin) and resampled every STEP m. Erase cuts points out of strokes.
//  - WIDTH: the lane's width, a dial (WIDTH_MIN..WIDTH_MAX).
//  - MARKS: section markers AT A POINT on the floor ({x, z, kind}); a marker's kind runs from its spot along the line to the
//    next marker. Before the first marker the course is 'run'. Kept as points (not metres) so repainting a stretch never slides
//    a marker somewhere else: each one is projected onto the current line.
//  - START / FINISH: points too, projected the same way. None = the line's two ends.
//  - THE CHECKS: tight turns (the line's radius under TURN_MIN + half the width: the inner edge folds) and spots where the DASH
//    CAM (CAM_BACK m behind her along the line) would stand outside the floor, i.e. in the tent wall.
//  - THE PREVIEW: a test Vulnyx at her base stats runs it at race speed (fair-dash-race speedIn per section), so the preview's
//    time is the race's.
// The builder layer carries it as `course` on the 'dash' map (world/builder.ts), draft -> publish -> version -> rollback.
// s2 (the tent scene) reads the published layer and races on courseSections + pointAt instead of the fixed COURSE.
import { speedIn, type SectionKind, type Racer } from './fair-dash-race'

export type Pt = [number, number]
export interface CourseMark { x: number; z: number; kind: SectionKind }
export interface DashCourse { v: 1; width: number; strokes: Pt[][]; marks: CourseMark[]; start: Pt | null; finish: Pt | null }

/** the tent floor: a square ARENA m on a side, centred on 0,0 (s2's tent stands round it) */
export const ARENA = 90
/** the tent wall's thickness inside the floor's edge (the camera standing in it = blocked) */
export const WALL = 1.5
export const WIDTH_MIN = 2, WIDTH_MAX = 8, WIDTH_DEFAULT = 4
/** the line is resampled every STEP m */
export const STEP = 1
/** spray points closer than this to the last one are dropped (a still hand does not pile points up) */
export const MIN_GAP = 0.75
/** a turn's centre radius must be at least TURN_MIN + width / 2 */
export const TURN_MIN = 4
/** the radius is measured over three points TURN_SPAN m apart on the line */
export const TURN_SPAN = 3
/** the dash cam stands this far behind her along the line (dash-view's Follow stands 4-5 m back) */
export const CAM_BACK = 6
export const STROKES_MAX = 200, POINTS_MAX = 6000, MARKS_MAX = 64
export const KINDS: readonly SectionKind[] = ['run', 'swim', 'climb', 'glide', 'blocks']
/** the test Vulnyx: the fox model at the species' typical base (fair-dash-race's pull = 1) */
export const TEST_VULNYX: Racer = { species: 'fox', element: 'base', stats: { pwr: 24, grd: 24, agi: 24, vig: 24 } }

export const emptyCourse = (): DashCourse => ({ v: 1, width: WIDTH_DEFAULT, strokes: [], marks: [], start: null, finish: null })

const H = ARENA / 2
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= H ? Math.round(v * 100) / 100 : null)
const pt = (v: unknown): Pt | null => {
  if (!Array.isArray(v) || v.length !== 2) return null
  const x = num(v[0]), z = num(v[1]); return x == null || z == null ? null : [x, z]
}
/** junk-proof: the `course` of a layer file (null = none / nothing painted) */
export function cleanCourse(j: unknown): DashCourse | null {
  const raw = (j as { course?: unknown } | null)?.course as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const c = emptyCourse()
  const w = Number(raw.width); c.width = Number.isFinite(w) ? Math.min(WIDTH_MAX, Math.max(WIDTH_MIN, Math.round(w * 10) / 10)) : WIDTH_DEFAULT
  let n = 0
  if (Array.isArray(raw.strokes)) for (const s of raw.strokes.slice(0, STROKES_MAX)) {
    if (!Array.isArray(s)) continue
    const pts: Pt[] = []
    for (const p of s) { if (n >= POINTS_MAX) break; const q = pt(p); if (q) { pts.push(q); n++ } }
    if (pts.length >= 2) c.strokes.push(pts)
  }
  if (Array.isArray(raw.marks)) for (const m of raw.marks.slice(0, MARKS_MAX)) {
    const o = m as Record<string, unknown> | null, x = num(o?.x), z = num(o?.z), k = o?.kind as SectionKind
    if (x != null && z != null && KINDS.includes(k)) c.marks.push({ x, z, kind: k })
  }
  c.start = pt(raw.start); c.finish = pt(raw.finish)
  return c.strokes.length || c.marks.length || c.start || c.finish ? c : null
}
/** order-stable text of a course (builder.ts sameLayer) */
export const courseCanon = (c: DashCourse | null | undefined): string => (c ? JSON.stringify([c.width, c.strokes, c.marks.map(m => [m.x, m.z, m.kind]), c.start, c.finish]) : '')

// ── painting ──
/** a stroke point clamped to the floor, rounded to the cm */
export const onFloor = (x: number, z: number): Pt => [Math.round(Math.max(-H, Math.min(H, x)) * 100) / 100, Math.round(Math.max(-H, Math.min(H, z)) * 100) / 100]
/** add a sprayed point to a stroke: dropped when within MIN_GAP of its last point */
export function sprayPoint(stroke: Pt[], x: number, z: number): Pt[] {
  const p = onFloor(x, z), l = stroke[stroke.length - 1]
  return l && Math.hypot(p[0] - l[0], p[1] - l[1]) < MIN_GAP ? stroke : [...stroke, p]
}
/** the eraser at (x, z), radius r: cuts every stroke point within r out, splitting a stroke in two where it cuts through */
export function eraseAt(strokes: Pt[][], x: number, z: number, r: number): Pt[][] {
  const out: Pt[][] = []
  for (const s of strokes) {
    let cur: Pt[] = []
    for (const p of s) {
      if (Math.hypot(p[0] - x, p[1] - z) <= r) { if (cur.length >= 2) out.push(cur); cur = [] } else cur.push(p)
    }
    if (cur.length >= 2) out.push(cur)
  }
  return out
}

// ── the line ──
/** Chaikin corner cutting, ends kept */
export function chaikin(p: Pt[], iters = 2): Pt[] {
  let a = p
  for (let it = 0; it < iters && a.length > 2; it++) {
    const b: Pt[] = [a[0]]
    for (let i = 0; i < a.length - 1; i++) {
      const [x0, z0] = a[i], [x1, z1] = a[i + 1]
      b.push([x0 * 0.75 + x1 * 0.25, z0 * 0.75 + z1 * 0.25], [x0 * 0.25 + x1 * 0.75, z0 * 0.25 + z1 * 0.75])
    }
    b.push(a[a.length - 1]); a = b
  }
  return a
}
/** points every `step` m along a polyline (the last point kept) */
export function resample(p: Pt[], step = STEP): Pt[] {
  if (p.length < 2) return p.slice()
  const out: Pt[] = [p[0]]; let carry = 0
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, z0] = p[i], [x1, z1] = p[i + 1], L = Math.hypot(x1 - x0, z1 - z0)
    let d = step - carry
    while (d <= L) { const t = d / L; out.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t]); d += step }
    carry = L - (d - step)
  }
  const e = p[p.length - 1], l = out[out.length - 1]
  if (Math.hypot(e[0] - l[0], e[1] - l[1]) > 1e-6) out.push(e)
  return out
}
/** THE COURSE LINE: the strokes joined in paint order, smoothed, resampled every STEP m. [] = nothing to race on */
export function courseLine(strokes: Pt[][]): Pt[] {
  const all: Pt[] = []
  for (const s of strokes) for (const p of s) { const l = all[all.length - 1]; if (!l || l[0] !== p[0] || l[1] !== p[1]) all.push(p) }
  return all.length < 2 ? [] : resample(chaikin(all, 3))
}
/** metres along the line at each point */
export function cumul(line: Pt[]): number[] {
  const c = [0]
  for (let i = 1; i < line.length; i++) c.push(c[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]))
  return c
}
/** the nearest spot on the line to (x, z): s = metres along it, d = how far off it */
export function project(line: Pt[], cum: number[], x: number, z: number): { s: number; d: number } {
  let best = { s: 0, d: Infinity }
  for (let i = 0; i < line.length - 1; i++) {
    const [x0, z0] = line[i], dx = line[i + 1][0] - x0, dz = line[i + 1][1] - z0, L2 = dx * dx + dz * dz
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2)) : 0
    const d = Math.hypot(x0 + dx * t - x, z0 + dz * t - z)
    if (d < best.d) best = { s: cum[i] + (cum[i + 1] - cum[i]) * t, d }
  }
  if (line.length === 1) best = { s: 0, d: Math.hypot(line[0][0] - x, line[0][1] - z) }
  return best
}
/** a point s metres along the line, and the heading there (radians, atan2(dx, dz): 0 = +z) */
export function pointAt(line: Pt[], cum: number[], s: number): { x: number; z: number; heading: number } {
  if (!line.length) return { x: 0, z: 0, heading: 0 }
  if (line.length === 1) return { x: line[0][0], z: line[0][1], heading: 0 }
  const L = cum[cum.length - 1], q = Math.max(0, Math.min(L, s))
  let i = 0; while (i < cum.length - 2 && cum[i + 1] < q) i++
  const seg = cum[i + 1] - cum[i], t = seg > 0 ? (q - cum[i]) / seg : 0
  const [x0, z0] = line[i], [x1, z1] = line[i + 1]
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, heading: Math.atan2(x1 - x0, z1 - z0) }
}

// ── sections ──
export interface CourseSection { kind: SectionKind; at: number; len: number }
/** where the race starts and ends on the line (metres): start/finish projected, else the two ends; start < finish */
export function raceSpan(c: DashCourse, line: Pt[], cum: number[]): { s0: number; s1: number } {
  const L = cum[cum.length - 1] ?? 0
  let s0 = c.start && line.length ? project(line, cum, c.start[0], c.start[1]).s : 0
  let s1 = c.finish && line.length ? project(line, cum, c.finish[0], c.finish[1]).s : L
  if (s1 < s0) [s0, s1] = [s1, s0]
  return { s0, s1 }
}
/** the course's sections from start to finish, in race metres (0 = the start), the shape fair-dash-race's COURSE has:
 *  each marker's kind runs from its spot to the next marker; before the first one it is 'run'; equal neighbours merge */
export function courseSections(c: DashCourse, line = courseLine(c.strokes), cum = cumul(line)): CourseSection[] {
  if (line.length < 2) return []
  const { s0, s1 } = raceSpan(c, line, cum)
  if (s1 - s0 <= 0) return []
  const ms = c.marks.map(m => ({ s: project(line, cum, m.x, m.z).s, kind: m.kind })).sort((a, b) => a.s - b.s)
  let kind: SectionKind = 'run'
  for (const m of ms) if (m.s <= s0) kind = m.kind
  const cuts: { s: number; kind: SectionKind }[] = [{ s: s0, kind }]
  for (const m of ms) if (m.s > s0 && m.s < s1) cuts.push(m)
  const out: CourseSection[] = []
  cuts.forEach((m, i) => {
    const end = i + 1 < cuts.length ? cuts[i + 1].s : s1, at = m.s - s0, len = end - m.s
    if (len <= 1e-6) return
    const last = out[out.length - 1]
    if (last && last.kind === m.kind) last.len += len; else out.push({ kind: m.kind, at, len })
  })
  return out
}

// ── the checks ──
/** the radius of the circle through three points (Infinity on a straight) */
export function radius3(a: Pt, b: Pt, c: Pt): number {
  const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1])
  const area2 = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2)
}
export interface Spot { s: number; x: number; z: number; r?: number }
/** group consecutive flagged samples into one spot each (its worst sample) */
function spots(line: Pt[], cum: number[], flag: (i: number) => number | null): Spot[] {
  const out: Spot[] = []; let cur: Spot | null = null, lastI = -9
  for (let i = 0; i < line.length; i++) {
    const v = flag(i); if (v == null) continue
    if (!cur || i - lastI > 2) { cur = { s: cum[i], x: line[i][0], z: line[i][1], r: v }; out.push(cur) }
    else if (v < (cur.r ?? Infinity)) Object.assign(cur, { s: cum[i], x: line[i][0], z: line[i][1], r: v })
    lastI = i
  }
  return out
}
/** the minimum centre radius a turn may have at this width */
export const minTurn = (width: number) => TURN_MIN + width / 2
/** TIGHT TURNS: spots where the line turns tighter than minTurn(width) (radius over TURN_SPAN m either side) */
export function tightTurns(line: Pt[], width: number, cum = cumul(line)): Spot[] {
  const k = Math.max(1, Math.round(TURN_SPAN / STEP)), lim = minTurn(width)
  return spots(line, cum, i => {
    if (i - k < 0 || i + k >= line.length) return null
    const r = radius3(line[i - k], line[i], line[i + k])
    return r < lim ? Math.round(r * 10) / 10 : null
  })
}
/** where the dash cam stands when she is s metres along: CAM_BACK m back along the line (past the start: straight back) */
export function camAt(line: Pt[], cum: number[], s: number): Pt {
  const p = pointAt(line, cum, s)
  if (s >= CAM_BACK) { const q = pointAt(line, cum, s - CAM_BACK); const dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1; return [p.x + (dx / L) * CAM_BACK, p.z + (dz / L) * CAM_BACK] }
  return [p.x - Math.sin(p.heading) * CAM_BACK, p.z - Math.cos(p.heading) * CAM_BACK]
}
/** CAM BLOCKED: spots where the dash cam would stand in the tent wall or past it (r = how far inside the floor it is, < WALL) */
export function camBlocked(line: Pt[], cum = cumul(line), s0 = 0, s1 = cum[cum.length - 1] ?? 0): Spot[] {
  const lim = H - WALL
  return spots(line, cum, i => {
    if (cum[i] < s0 || cum[i] > s1) return null
    const [x, z] = camAt(line, cum, cum[i]), inside = lim - Math.max(Math.abs(x), Math.abs(z))
    return inside < 0 ? Math.round((inside + WALL) * 10) / 10 : null
  })
}

// ── the preview run ──
export interface Preview { T: number; secs: (CourseSection & { t0: number; v: number })[]; s0: number; s1: number }
/** the test Vulnyx's run: per section her race speed (fair-dash-race speedIn), so the preview's time is the race's time */
export function previewPlan(c: DashCourse, line = courseLine(c.strokes), cum = cumul(line), r: Racer = TEST_VULNYX): Preview {
  const { s0, s1 } = line.length >= 2 ? raceSpan(c, line, cum) : { s0: 0, s1: 0 }
  let t = 0
  const secs = courseSections(c, line, cum).map(sec => { const v = speedIn(r, sec.kind), o = { ...sec, t0: t, v }; t += sec.len / v; return o })
  return { T: t, secs, s0, s1 }
}
/** where she is t seconds in: race metres d, line metres s, and her section */
export function previewAt(p: Preview, t: number): { d: number; s: number; kind: SectionKind | null } {
  if (!p.secs.length) return { d: 0, s: p.s0, kind: null }
  const q = Math.max(0, Math.min(p.T, t))
  let sec = p.secs[0]; for (const x of p.secs) if (x.t0 <= q) sec = x
  const d = Math.min(sec.at + sec.len, sec.at + (q - sec.t0) * sec.v)
  return { d, s: p.s0 + d, kind: sec.kind }
}

/** plain UI labels (@lark may reword; no canon words) */
export const COURSE_UI = {
  title: 'Dash course',
  spray: 'Spray', erase: 'Erase', section: 'Section', start: 'Start', finish: 'Finish',
  width: 'Width', undo: 'Undo', clear: 'Clear',
  play: 'Play', pause: 'Pause',
  noLine: 'Spray a course line on the floor to start.',
  checksOk: 'No tight turns, the cam is clear.',
  tight: (r: number, lim: number) => `Tight turn: radius ${r} m (needs ${lim.toFixed(1)} m)`,
  blocked: 'Cam blocked by the tent wall',
  length: (m: number, s: number) => `${Math.round(m)} m, about ${s.toFixed(1)} s for a Vulnyx`,
} as const
