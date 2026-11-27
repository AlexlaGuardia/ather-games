// BETA M247 s1: the Dash course (pure). Run: npx tsx src/app/shimmer/open/ather/dash-course.test.ts
import {
  cleanCourse, courseCanon, emptyCourse, sprayPoint, eraseAt, chaikin, resample, courseLine, cumul, project, pointAt, courseSections,
  raceSpan, radius3, tightTurns, minTurn, camAt, camBlocked, previewPlan, previewAt, ARENA, WALL, MIN_GAP, WIDTH_MAX, WIDTH_MIN, CAM_BACK, TEST_VULNYX,
  type DashCourse, type Pt,
} from './dash-course'
import { speedIn } from './fair-dash-race'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e

// a loop: a circle of radius R sprayed in one stroke (a point every ~1.5 m)
const circle = (R: number, cx = 0, cz = 0, n = 0): Pt[] => { const k = n || Math.ceil(2 * Math.PI * R / 1.5); return Array.from({ length: k + 1 }, (_, i) => [cx + R * Math.cos(i / k * 2 * Math.PI), cz + R * Math.sin(i / k * 2 * Math.PI)] as Pt) }
const straight = (x0: number, z0: number, x1: number, z1: number, n = 20): Pt[] => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n] as Pt)
const course = (strokes: Pt[][], o: Partial<DashCourse> = {}): DashCourse => ({ ...emptyCourse(), strokes, ...o })

// ── 1. the spline from strokes ──
{
  const loop = courseLine([circle(25)]), cum = cumul(loop), L = cum[cum.length - 1]
  ok(near(L, 2 * Math.PI * 25, 3), `1. a sprayed circle (R 25) becomes a line ${L.toFixed(1)} m long (2piR ${(2 * Math.PI * 25).toFixed(1)})`)
  const steps = loop.slice(1).map((p, i) => Math.hypot(p[0] - loop[i][0], p[1] - loop[i][1]))
  ok(steps.slice(0, -1).every(d => near(d, 1, 0.01)), '1. resampled every STEP (1 m) along it')
  ok(loop.every(p => near(Math.hypot(p[0], p[1]), 25, 0.6)), '1. smoothed, it stays on the circle (within 0.6 m)')
  // two strokes join end to start in paint order
  const two = courseLine([straight(-20, 0, 0, 0), straight(0, 5, 20, 5)])
  ok(near(two[0][0], -20) && near(two[two.length - 1][0], 20) && near(two[two.length - 1][1], 5), '1. two strokes join into one line, first stroke first, ends kept')
  const zig: Pt[] = [[0, 0], [10, 0], [10, 10]], ch = chaikin(zig, 1)
  ok(ch.length === 6 && near(ch[1][0], 2.5) && near(ch[2][0], 7.5) && near(ch[3][0], 10) && near(ch[3][1], 2.5), '1. Chaikin cuts each corner at 1/4 and 3/4, ends kept')
  ok(resample([[0, 0], [3.5, 0]]).length === 5, '1. resample: 0,1,2,3 + the end 3.5')
  ok(courseLine([]).length === 0 && courseLine([[[1, 1]]]).length === 0, '1. no line from nothing / a single point')
}
// ── 2. spraying + erasing + width + cleaning ──
{
  let s: Pt[] = []
  s = sprayPoint(s, 0, 0); s = sprayPoint(s, MIN_GAP * 0.5, 0); s = sprayPoint(s, 2, 0)
  ok(s.length === 2, '2. a spray point within MIN_GAP of the last is dropped')
  ok(sprayPoint([], 999, -999)[0][0] === ARENA / 2 && sprayPoint([], 999, -999)[0][1] === -ARENA / 2, '2. spray is clamped to the floor')
  const cut = eraseAt([straight(-10, 0, 10, 0)], 0, 0, 1.5)
  ok(cut.length === 2 && cut[0].every(p => p[0] < -1.5) && cut[1].every(p => p[0] > 1.5), '2. the eraser cuts through a stroke: two strokes, nothing within its radius')
  ok(eraseAt([straight(-10, 0, 10, 0)], 0, 0, 50).length === 0, '2. erase it all = no strokes')
  const c = cleanCourse({ course: { width: 99, strokes: [[[0, 0], [1, 1], ['x', 2]], [[0, 0]], 'junk'], marks: [{ x: 1, z: 1, kind: 'swim' }, { x: 1, z: 1, kind: 'lava' }], start: [0, 0], finish: [999, 0] } })!
  ok(c.width === WIDTH_MAX && cleanCourse({ course: { width: 0, strokes: [[[0, 0], [2, 2]]] } })!.width === WIDTH_MIN, '2. width is clamped to the dial')
  ok(c.strokes.length === 1 && c.strokes[0].length === 2, '2. junk points / one-point strokes dropped')
  ok(c.marks.length === 1 && c.marks[0].kind === 'swim' && c.start !== null && c.finish === null, '2. a junk section kind / an off-floor finish dropped')
  ok(cleanCourse({}) === null && cleanCourse({ course: { strokes: [] } }) === null && cleanCourse({ course: [] }) === null, '2. no course = null (the layer omits it)')
  ok(courseCanon(c) === courseCanon(cleanCourse({ course: JSON.parse(JSON.stringify(c)) })), '2. canon round-trips')
  // width changes the tight-turn check
  const bend = courseLine([circle(6)])
  ok(tightTurns(bend, WIDTH_MIN).length === 0 && tightTurns(bend, WIDTH_MAX).length > 0, `2. a radius-6 loop is fine at width ${WIDTH_MIN} (min ${minTurn(WIDTH_MIN)}) and tight at ${WIDTH_MAX} (min ${minTurn(WIDTH_MAX)})`)
}
// ── 3. section placement ──
{
  const line = courseLine([straight(-30, 0, 30, 0, 60)]), cum = cumul(line), L = cum[cum.length - 1]
  ok(near(L, 60, 1e-6), '3. a 60 m straight')
  const c = course([straight(-30, 0, 30, 0, 60)], { marks: [{ x: 0, z: 2, kind: 'swim' }, { x: -10, z: -1, kind: 'climb' }, { x: 15, z: 0, kind: 'blocks' }] })
  const secs = courseSections(c, line, cum)
  ok(secs.map(s => s.kind).join() === 'run,climb,swim,blocks', `3. markers in line order, 'run' before the first: ${secs.map(s => s.kind).join()}`)
  ok(near(secs[1].at, 20, 1e-6) && near(secs[1].len, 10, 1e-6) && near(secs[2].at, 30, 1e-6) && near(secs[3].len, 15, 1e-6), '3. each marker\'s kind runs from its spot (projected) to the next')
  ok(near(secs.reduce((a, s) => a + s.len, 0), 60, 1e-6), '3. the sections cover the whole course')
  const sf = course(c.strokes, { marks: c.marks, start: [-5, 3], finish: [25, -3] })
  const { s0, s1 } = raceSpan(sf, line, cum), s2 = courseSections(sf, line, cum)
  ok(near(s0, 25, 1e-6) && near(s1, 55, 1e-6), '3. start + finish project onto the line')
  ok(s2[0].at === 0 && near(s2.reduce((a, s) => a + s.len, 0), 30, 1e-6) && s2[0].kind === 'climb' && near(s2[1].at, 5, 1e-6), '3. sections run start -> finish in race metres; a marker before the start sets the first kind')
  const swapped = course(c.strokes, { start: [25, 0], finish: [-20, 0] })
  ok(near(raceSpan(swapped, line, cum).s1 - raceSpan(swapped, line, cum).s0, 45, 1e-6), '3. finish before start = swapped, never negative')
  const same = course(c.strokes, { marks: [{ x: -5, z: 0, kind: 'swim' }, { x: 5, z: 0, kind: 'swim' }] })
  ok(courseSections(same, line, cum).length === 2, '3. equal neighbours merge')
  ok(courseSections(course([])).length === 0, '3. no line = no sections')
  const p = project(line, cum, 7, 4)
  ok(near(p.s, 37, 1e-6) && near(p.d, 4, 1e-6), '3. project: s along, d off')
  const q = pointAt(line, cum, 12.5)
  ok(near(q.x, -17.5, 1e-6) && near(q.heading, Math.PI / 2, 1e-6), '3. pointAt + heading (+x)')
}
// ── 4. the tight-turn check ──
{
  ok(near(radius3([10, 0], [0, 10], [-10, 0]), 10, 1e-9) && radius3([0, 0], [1, 0], [2, 0]) === Infinity, '4. radius3: circle through 3 points; straight = Infinity')
  const big = courseLine([circle(25)])
  ok(tightTurns(big, 4).length === 0, '4. a wide loop (R 25) has no tight turn')
  // a crafted HAIRPIN: up a straight, a 2 m-radius turn, back down
  const hair: Pt[] = [...straight(-2, -20, -2, 10, 15), ...Array.from({ length: 9 }, (_, i) => [-2 * Math.cos(i / 8 * Math.PI), 10 + 2 * Math.sin(i / 8 * Math.PI)] as Pt).slice(1), ...straight(2, 10, 2, -20, 15).slice(1)]
  const hl = courseLine([hair]), hc = cumul(hl), t = tightTurns(hl, 4, hc)
  ok(t.length === 1, `4. the hairpin is flagged once (${t.length} spots)`)
  ok(!!t[0] && t[0].z > 7 && t[0].r! < 3, `4. at the hairpin (z ${t[0]?.z.toFixed(1)}, radius ${t[0]?.r} m)`)
  // two hairpins = two spots
  const two: Pt[] = [...hair, ...Array.from({ length: 9 }, (_, i) => [4 - 2 * Math.cos(i / 8 * Math.PI), -20 - 2 * Math.sin(i / 8 * Math.PI)] as Pt).slice(1)]
  ok(tightTurns(courseLine([two]), 4).length === 2, '4. two hairpins = two spots')
}
// ── 5. the cam check ──
{
  const H = ARENA / 2
  // a line hugging the floor's edge heading +x: the cam stands behind, inside = fine
  const inner = courseLine([straight(-30, 0, 30, 0, 30)])
  ok(camBlocked(inner).length === 0, '5. a line in the middle: the cam is clear')
  // a line that runs straight away from the wall at the floor's edge: the cam behind her is IN the wall
  const fromWall = courseLine([straight(-H + 1, 0, 0, 0, 30)]), fc = cumul(fromWall)
  const b = camBlocked(fromWall, fc)
  ok(b.length === 1 && b[0].s < CAM_BACK, `5. starting at the wall, heading away: the cam is blocked at the start (${b.length} spot, s ${b[0]?.s})`)
  const [cx] = camAt(fromWall, fc, 0)
  ok(near(cx, -H + 1 - CAM_BACK, 0.01), '5. camAt past the start = straight back along her heading')
  ok(camBlocked(fromWall, fc, 10, fc[fc.length - 1]).length === 0, '5. a blocked spot before the start is not counted')
  ok(H - WALL > 0, '5. the wall sits inside the floor')
}
// ── 6. the preview run at race speed ──
{
  const c = course([straight(-30, 0, 30, 0, 60)], { marks: [{ x: 0, z: 0, kind: 'swim' }] })
  const p = previewPlan(c)
  const vRun = speedIn(TEST_VULNYX, 'run'), vSwim = speedIn(TEST_VULNYX, 'swim')
  ok(near(p.T, 30 / vRun + 30 / vSwim, 1e-6), `6. her time = each section at her race speed (${p.T.toFixed(2)} s)`)
  const a = previewAt(p, 1), b2 = previewAt(p, 2), z = previewAt(p, p.T + 5)
  ok(near(a.d, vRun, 1e-6) && b2.d > a.d && a.kind === 'run', '6. she advances every second')
  ok(near(z.d, 60, 1e-6) && previewAt(p, 30 / vRun + 1).kind === 'swim', '6. ends at the finish; in the swim after the run')
  ok(previewPlan(course([])).T === 0 && previewAt(previewPlan(course([])), 3).kind === null, '6. no line = nothing to run')
}
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
