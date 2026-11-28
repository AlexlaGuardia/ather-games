// BETA M247 s2: the Dash race on a carved course (pure). Run: npx tsx src/app/shimmer/open/ather/dash-track.test.ts
import { COURSE, COURSE_LEN, BLOCKS, CLIMB_H, GAP_DROP, FIXED_TRACK, trackOf, runHeadless, startState, step, seeded, sectionAt, type Racer, type Section } from './fair-dash-race'
import { emptyCourse, courseSections, courseLine, cumul, project, ARENA, type DashCourse, type Pt } from './dash-course'
import { raceTrack, fallbackLine, trackY, flyY, laneOffset, racerAt, MIN_RACE, FB_WIDTH } from './dash-track'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) <= e
const R = (species: string): Racer => ({ species, element: 'base', stats: { pwr: 24, grd: 24, agi: 24, vig: 24 } })
const straight = (x0: number, z0: number, x1: number, z1: number, n = 40): Pt[] => Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n] as Pt)
const course = (strokes: Pt[][], o: Partial<DashCourse> = {}): DashCourse => ({ ...emptyCourse(), strokes, ...o })

// ── 1. the fixed course as a track is the M233 race ──
{
  const bs = COURSE.find(s => s.kind === 'blocks')!
  ok(FIXED_TRACK.len === COURSE_LEN && FIXED_TRACK.sections === COURSE, `1. the fixed track = COURSE (${COURSE_LEN} m)`)
  ok(JSON.stringify(FIXED_TRACK.blocks) === JSON.stringify(BLOCKS.at.map(a => bs.at + a)), `1. its blocks stand where M233's did (${FIXED_TRACK.blocks.join(', ')})`)
  // M233's groundY, copied: trackY on the fixed track must equal it everywhere
  const old = (d: number) => { const s = sectionAt(d), f = Math.min(1, Math.max(0, (d - s.at) / s.len))
    if (s.kind === 'swim') return -0.45; if (s.kind === 'climb') return f * CLIMB_H
    if (s.kind === 'glide') return f < 0.45 ? CLIMB_H + (-GAP_DROP - CLIMB_H) * (f / 0.45) : -GAP_DROP * (1 - (f - 0.45) / 0.55); return 0 }
  let worst = 0; for (let d = 0; d <= COURSE_LEN; d += 0.25) worst = Math.max(worst, Math.abs(trackY(FIXED_TRACK, d) - old(d)))
  ok(worst < 1e-9, `1. trackY on the fixed track = M233's groundY (worst ${worst})`)
}

// ── 2. no course / a stray dot / sections too short = the fixed course on the stadium ──
{
  const fb = raceTrack(null)
  ok(!fb.published && fb.track === FIXED_TRACK && fb.width === FB_WIDTH, '2. no published course: the fixed course runs (fallback)')
  const L = fb.cum[fb.cum.length - 1]
  ok(L >= COURSE_LEN, `2. the stadium loop (${L.toFixed(1)} m) is long enough for the fixed course (${COURSE_LEN} m)`)
  ok(fallbackLine().every(([x, z]) => Math.abs(x) < ARENA / 2 - 5 && Math.abs(z) < ARENA / 2 - 5), '2. the stadium stays well inside the tent floor')
  ok(!raceTrack(course([straight(0, 0, 5, 0, 5)])).published, `2. a course under MIN_RACE (${MIN_RACE} m) races the fixed one`)
  ok(!raceTrack(course([])).published, '2. an empty course races the fixed one')
}

// ── 3. a published course: its sections, its blocks, raced to its own finish ──
const carved = course([straight(-40, 0, 40, 0, 80)], { width: 5, marks: [{ x: -30, z: 0, kind: 'swim' }, { x: -15, z: 0, kind: 'blocks' }, { x: 5, z: 0, kind: 'climb' }, { x: 15, z: 0, kind: 'run' }, { x: 20, z: 0, kind: 'blocks' }, { x: 26, z: 0, kind: 'run' }] })
{
  const rt = raceTrack(carved)
  const secs = courseSections(carved)
  ok(rt.published && rt.width === 5 && rt.track.sections.length === secs.length && near(rt.track.len, secs[secs.length - 1].at + secs[secs.length - 1].len), `3. the published course races (${rt.track.len.toFixed(1)} m, ${rt.track.sections.map(s => s.kind).join(' > ')})`)
  const b = rt.track.sections.filter(s => s.kind === 'blocks')
  ok(b.length === 2 && rt.track.blocks.length === Math.floor((b[0].len - 1 - 2.5) / 3.5 + 1) + Math.floor((b[1].len - 1 - 2.5) / 3.5 + 1), `3. blocks stand along BOTH blocks stretches (${rt.track.blocks.map(x => x.toFixed(1)).join(', ')})`)
  ok(rt.track.blocks.every(x => rt.track.sections.some(s => s.kind === 'blocks' && x > s.at && x < s.at + s.len)), '3. every block stands inside a blocks stretch')
  let s = startState(rt.track); const r = seeded(3)
  ok(s.blocks.length === rt.track.blocks.length, '3. a racer starts with every block of the course standing')
  const seen = new Set<string>()
  let dMax = 0
  for (let i = 0; i < 20000 && s.fin == null; i++) { s = step(R('fox'), s, 1 / 30, r, rt.track); seen.add(s.doing); dMax = Math.max(dMax, s.d) }
  ok(s.fin != null && near(s.d, rt.track.len) && dMax <= rt.track.len + 1e-9 && s.blocks.every(h => h === 0), `3. the fox finishes the carved course (${s.fin?.toFixed(1)} s) having broken every block`)
  ok(['swim', 'blocks', 'climb', 'run'].every(k => seen.has(k)), `3. she swims, breaks blocks, climbs and runs on it (${[...seen].join(' ')})`)
  // the carved course changes the race: the turtle's swim + blocks course vs the fixed one
  const t = runHeadless(R('turtle'), 2, () => false, 1 / 30, rt.track), f = runHeadless(R('turtle'), 2)
  ok(t.byKind.glide === 0 && f.byKind.glide > 0 && t.byKind.blocks > 0, `3. the race runs ITS sections (no gap on the carved one: glide ${t.byKind.glide.toFixed(1)} s vs fixed ${f.byKind.glide.toFixed(1)} s)`)
  // a climb not followed by a gap is a hill: up and back down
  const hill = rt.track.sections.find(x => x.kind === 'climb')!
  ok(near(trackY(rt.track, hill.at), 0) && trackY(rt.track, hill.at + hill.len * 0.7) > CLIMB_H - 0.01 && near(trackY(rt.track, hill.at + hill.len - 1e-6), 0, 1e-3), '3. a climb with no gap after it is a hill (up, then down)')
}

// ── 4. a gap from flat ground: the walkers go down, fliers lift over ──
{
  const gapC = course([straight(-30, 0, 30, 0, 60)], { marks: [{ x: -10, z: 0, kind: 'glide' }, { x: 10, z: 0, kind: 'run' }] })
  const rt = raceTrack(gapC), g = rt.track.sections.find(s => s.kind === 'glide')!
  ok(trackY(rt.track, g.at + g.len * 0.45) < -GAP_DROP + 0.01 && flyY(rt.track, g.at + g.len / 2) > 1, `4. a flat gap: walkers go down ${GAP_DROP} m, fliers rise over it (${flyY(rt.track, g.at + g.len / 2).toFixed(2)} m)`)
}

// ── 5. lanes: five racers inside the width, on the line ──
{
  const rt = raceTrack(carved)
  const offs = [0, 1, 2, 3, 4].map(i => laneOffset(i, 5, rt.width))
  ok(offs.every(o => Math.abs(o) < rt.width / 2) && new Set(offs.map(o => o.toFixed(3))).size === 5, `5. five lanes inside the ${rt.width} m width (${offs.map(o => o.toFixed(2)).join(', ')})`)
  let worst = 0
  for (let d = 0; d <= rt.track.len; d += 2) for (const o of offs) { const p = racerAt(rt, d, o); worst = Math.max(worst, Math.abs(project(rt.line, rt.cum, p.x, p.z).d - Math.abs(o))) }
  ok(worst < 0.05, `5. a racer at offset o stands o off the line (worst ${worst.toFixed(3)})`)
  const fb = raceTrack(null), p0 = racerAt(fb, 0, 0), p1 = racerAt(fb, COURSE_LEN, 0)
  ok(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 5, '5. on the stadium, the finish is not on top of the start')
  const ln = courseLine(carved.strokes); ok(near(cumul(ln)[cumul(ln).length - 1], rt.cum[rt.cum.length - 1]), '5. the race line is the course line')
}
void ([] as Section[])
console.log(fails ? `FAIL ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
