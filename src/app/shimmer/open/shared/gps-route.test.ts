// gps-route.ts (BETA M63 s2). Run: npx tsx src/app/shimmer/open/shared/gps-route.test.ts
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { clear, planRoute, planSteps, terrainPath, roadGraph, trailAhead, project, polyLength, GuideRoute, STRAY_M, MIN_GAP_S, ROAD_COST, LIVE_BUDGET, DEFAULT_BUDGET, type RouteWorld, type XZ, type RoadGraph } from './gps-route'
import { MAX_WALK_GRADIENT } from '../terrain-world'
import { makeRegion, type RegionMeta } from '../region'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** Every 0.5 m along every segment: the rise per metre never passes maxRise, and nothing is wet. */
function walkable(w: RouteWorld, pts: XZ[], maxRise = MAX_WALK_GRADIENT, step = 0.5): string | null {
  for (let k = 1; k < pts.length; k++) {
    const [ax, az] = pts[k - 1], [bx, bz] = pts[k], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / step))
    let ph = w.ground(ax, az)
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n, h = w.ground(x, z)
      if (Math.abs(h - ph) / (L / n) > maxRise + 1e-6) return `seg ${k} at (${x.toFixed(1)},${z.toFixed(1)}) rise ${(Math.abs(h - ph) / (L / n)).toFixed(2)}`
      if (w.water?.(x, z)) return `seg ${k} wet at (${x.toFixed(1)},${z.toFixed(1)})`
      ph = h
    }
  }
  return null
}
const minAbsZNearX0 = (pts: XZ[]) => { let m = Infinity; for (let k = 1; k < pts.length; k++) { const [ax, az] = pts[k - 1], [bx, bz] = pts[k]; for (let t = 0; t <= 1; t += 0.01) { const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (Math.abs(x) < 1) m = Math.min(m, Math.abs(z)) } } return m }

// 1. A RIDGE between you and the goal: a wall 30 m high with 3:1 faces, ~120 m long (|z| < 60; real land is continuous, so
//    the ends taper instead of standing as a vertical cliff that a 1 m sample could straddle). The straight line climbs it.
{
  const ridge = (x: number, z: number) => Math.max(0, 30 - 3 * Math.abs(x) - 3 * Math.max(0, Math.abs(z) - 50))   // 3:1 on every face, ends taper by z = 60
  const w: RouteWorld = { ground: ridge }
  ok(!clear(w, -40, 0, 40, 0), 'ridge: the straight line is not walkable (control)')
  const r = planRoute(w, [-40, 0], [40, 0])
  ok(r.reached && r.mode === 'terrain', `ridge: reached by terrain (${r.mode}, reached ${r.reached})`)
  const bad = walkable(w, r.pts); ok(!bad, `ridge: never exceeds walkable slope (${bad})`)
  ok(minAbsZNearX0(r.pts) >= 59.5, `ridge: goes AROUND the end of the ridge (min |z| at the crest ${minAbsZNearX0(r.pts).toFixed(1)})`)
  ok(r.pts[0][0] === -40 && r.pts[r.pts.length - 1][0] === 40, 'ridge: starts where you stand, ends at the goal')
  ok(r.length < 200 && r.pts.length <= 8, `ridge: smoothed, not a staircase of cells (${r.length.toFixed(0)} m, ${r.pts.length} pts)`)
  // the walker's own rule is the default: a climber who could take 3:1 goes straight over
  const climber = planRoute({ ground: ridge, maxRise: 3.5 }, [-40, 0], [40, 0])
  ok(climber.pts.length === 2 && Math.abs(climber.length - 80) < 1e-6, 'ridge: maxRise 3.5 goes straight over (the slope rule is what bends it)')
  // a GENTLE hill is walked straight over (no detour for slopes you can walk)
  const hill = { ground: (x: number, z: number) => Math.max(0, 10 - 0.5 * Math.hypot(x, z)) }
  ok(planRoute(hill, [-40, 0], [40, 0]).pts.length === 2, 'gentle hill (0.5): straight over')
}

// 2. WATER: a lake across the straight line, dry round its ends
{
  const w: RouteWorld = { ground: () => 0, water: (x, z) => Math.abs(x) < 15 && Math.abs(z) < 50 }
  const r = planRoute(w, [-40, 5], [40, -5])
  const bad = walkable(w, r.pts)
  ok(r.reached && !bad, `lake: reached and dry all the way (${bad})`)
  ok(minAbsZNearX0(r.pts) >= 50, 'lake: goes round it')
  // standing IN water: you may walk out (the start is not checked)
  ok(planRoute(w, [0, 0], [40, 0]).reached, 'lake: a route out of the water from inside it')
}

// 3. VOXEL GROUND: one block = a vault (passes), a two-block face = climb country (refused)
{
  const step1 = { ground: (x: number) => (x >= 0 ? 1 : 0) }, step2 = { ground: (x: number) => (x >= 0 ? 2 : 0) }
  ok(clear(step1, -3, 0.3, 3, 0.3), 'voxel: a 1-block step is walkable (vault)')
  ok(!clear(step2, -3, 0.3, 3, 0.3), 'voxel: a 2-block face is not (climb)')
  // a 2-block wall with a 1-block stair beside it: the route takes the stair
  const stair: RouteWorld = { ground: (x, z) => x < 0 ? 0 : (z > 20 && z < 26 && x < 3 ? 1 : 2) }
  const r = planRoute(stair, [-10, 0], [10, 0]), bad = walkable(stair, r.pts, MAX_WALK_GRADIENT, 1)   // 1 m chords: a block over 0.5 m reads 2
  ok(r.reached && !bad && r.pts.some(p => p[1] > 15), `voxel: routes to the stair (${bad})`)
}

// 4. ROADS: taken when they help, ignored when they don't
const lineRoad = (pts: XZ[], extra?: { a: string; b: string; pts: XZ[] }[]): RoadGraph => roadGraph({
  junctions: [{ id: 'A', x: pts[0][0], z: pts[0][1] }, { id: 'B', x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] }, ...(extra ?? []).flatMap(e => [{ id: e.a, x: e.pts[0][0], z: e.pts[0][1] }, { id: e.b, x: e.pts[e.pts.length - 1][0], z: e.pts[e.pts.length - 1][1] }])],
  edges: [{ id: 'e0', a: 'A', b: 'B', pts }, ...(extra ?? []).map((e, i) => ({ id: `x${i}`, ...e }))],
})!
{
  const flat = () => 0
  const road = lineRoad([[0, 10], [500, 10], [1000, 10]])
  ok(road.edges.length === 1 && Math.abs(road.edges[0].len - 1000) < 1e-9, 'roadGraph: one edge, its length')
  // far goal along the road: the road wins (10 + 1000*0.6 + 30 < 1000 straight)
  const far = planRoute({ ground: flat, roads: road }, [0, 0], [1000, 40])
  ok(far.mode === 'road' && far.reached, `road: a far goal along the road takes it (${far.mode})`)
  ok(far.pts.some(p => p[1] === 10 && p[0] === 500), 'road: the route runs ON the road (its middle point)')
  // a near goal: straight across the grass
  const near = planRoute({ ground: flat, roads: road }, [0, 0], [30, 0])
  ok(near.mode === 'terrain' && near.pts.length === 2, `road: a near goal ignores the road (${near.mode})`)
  // a road that leads AWAY from the goal is not taken
  const away = lineRoad([[0, 10], [-1000, 10]])
  ok(planRoute({ ground: flat, roads: away }, [0, 0], [600, 0]).mode === 'terrain', 'road: a road leading away is ignored')
  // a goal BEHIND a 4 km ridge (no way round inside the budget) that a road crosses through a cut: the road is the way
  const wall = (x: number, z: number) => (Math.abs(z - 200) < 2000 && Math.abs(x) < 10 && Math.abs(z) > 4 ? 40 : 0)
  const cut = lineRoad([[-300, 0], [300, 0]])
  const r = planRoute({ ground: wall, roads: cut }, [-150, 80], [150, 60])
  ok(r.mode === 'road' && r.reached, `road: behind a ridge, the road through the cut (${r.mode}, reached ${r.reached})`)
  // the legs off the road: everything before the first point on it, everything after the last
  const on = r.pts.map(p => p[1] === 0), i0 = on.indexOf(true), i1 = on.lastIndexOf(true)
  const offRoad = i0 < 0 ? 'never on the road' : walkable({ ground: wall }, r.pts.slice(0, i0 + 1)) ?? walkable({ ground: wall }, r.pts.slice(i1))
  ok(!offRoad, `road: the walks to and from the road stay walkable (${offRoad})`)
  // ferry edges are not walkable
  ok(roadGraph({ junctions: [{ id: 'A', x: 0, z: 0 }, { id: 'B', x: 9, z: 0 }], edges: [{ id: 'f', a: 'A', b: 'B', pts: [[0, 0], [9, 0]] }], ferries: [{ edge: 'f' }] }) === null, 'roadGraph: a ferry edge is dropped')
  // two roads joined at a junction: the planner chains them
  const two = lineRoad([[0, 10], [800, 10]], [{ a: 'B', b: 'C', pts: [[800, 10], [800, 800]] }])
  const turn = planRoute({ ground: flat, roads: two }, [0, 0], [810, 790])
  ok(turn.mode === 'road' && turn.pts.some(p => p[0] === 800 && p[1] === 10), `road: chains two edges through their junction (${turn.mode})`)
  ok(ROAD_COST < 1, 'ROAD_COST under 1 (roads preferred)')
}

// 5. A GOAL YOU CANNOT REACH (a mesa with cliffs all round): a partial route toward it, still walkable, never nothing
{
  const mesa: RouteWorld = { ground: (x, z) => Math.hypot(x - 60, z) < 15 ? 30 : 0 }
  const r = planRoute(mesa, [0, 0], [60, 0], 6000)
  ok(!r.reached && r.pts.length >= 2, `mesa: partial (reached ${r.reached}, ${r.pts.length} pts)`)
  const end = r.pts[r.pts.length - 1]
  ok(Math.hypot(end[0] - 60, end[1]) < 22, `mesa: ends at the foot of the cliff (${Math.hypot(end[0] - 60, end[1]).toFixed(1)} m from the goal)`)
  ok(!walkable(mesa, r.pts), 'mesa: the partial route is walkable')
  ok(r.spent <= 6000, `mesa: inside its budget (${r.spent})`)
}

// 6. READING IT: project + trailAhead
{
  const pts: XZ[] = [[0, 0], [10, 0], [10, 10]]
  ok(Math.abs(polyLength(pts) - 20) < 1e-9, 'polyLength')
  const p = project(pts, 10.5, 4); ok(Math.abs(p.s - 14) < 1e-9 && Math.abs(p.d - 0.5) < 1e-9, `project (${p.s}, ${p.d})`)
  const t = trailAhead(pts, 2, 1, 12, 2)
  ok(t.length === 6 && Math.abs(t[0][0] - 4) < 1e-9 && Math.abs(t[3][0] - 10) < 1e-9 && Math.abs(t[4][1] - 2) < 1e-9 && Math.abs(t[5][1] - 4) < 1e-9, `trailAhead: every 2 m from your point, round the corner (${JSON.stringify(t)})`)
  ok(trailAhead(pts, 0, 0, 100, 2).length === 10, 'trailAhead: stops at the route end')
}

// 7. THE CACHE: plans once, replans on a stray / a new goal, never per frame, never on a timer
{
  const ridge = (x: number, z: number) => Math.max(0, 30 - 3 * Math.abs(x) - 3 * Math.max(0, Math.abs(z) - 50))
  const g = new GuideRoute(() => ({ ground: ridge }), LIVE_BUDGET, Infinity)   // unsliced: every get finishes its plan
  const goal: XZ = [40, 0]
  g.get(-40, 0, goal, 0)
  for (let f = 1; f < 60; f++) g.get(-40 + f * 0.05, 0, goal, f / 60)
  ok(g.plans === 1, `cache: one plan across a second of walking the line (${g.plans})`)
  const r0 = g.route!
  g.get(-40, -STRAY_M - 20, goal, 1.01)
  ok(g.plans === 2 && g.route !== r0, `cache: straying ${STRAY_M + 20} m off replans (${g.plans})`)
  g.get(-40, -STRAY_M - 60, goal, 1.01 + MIN_GAP_S / 2)
  ok(g.plans === 2, 'cache: not twice inside MIN_GAP_S')
  g.get(-40, -STRAY_M - 60, [40, 30], 1.02 + MIN_GAP_S / 2)
  ok(g.plans === 3, 'cache: a new goal replans at once')
  const m = new GuideRoute(() => ({ ground: (x, z) => Math.hypot(x - 60, z) < 15 ? 30 : 0 }), LIVE_BUDGET, Infinity)
  m.get(0, 0, [60, 0], 0); for (let f = 1; f <= 600; f++) m.get(0, 0, [60, 0], f / 60)
  ok(!m.route!.reached && m.plans === 1, `cache: an unreachable goal is not re-planned on a timer (${m.plans} plans in 10 s)`)
}

// 7b. TIME-SLICED: a clock that says "out of time" after every step = the slowest phone imaginable. One step per frame.
{
  const ridge = (x: number, z: number) => Math.max(0, 30 - 3 * Math.abs(x) - 3 * Math.max(0, Math.abs(z) - 50))
  let tick = 0
  const g = new GuideRoute(() => ({ ground: ridge }), LIVE_BUDGET, 1, () => tick++)
  const goal: XZ = [40, 0]
  let frames = 0, first: ReturnType<GuideRoute['get']> = null
  while (frames < 100000) { first = g.get(-40, 0, goal, frames / 60); frames++; if (first) break }
  ok(frames > 5 && !!first, `slice: the plan lands over many frames, null (straight dots) until then (${frames} frames)`)
  const sync = planRoute({ ground: ridge }, [-40, 0], goal, LIVE_BUDGET)
  ok(JSON.stringify(first!.pts) === JSON.stringify(sync.pts), 'slice: the sliced plan is the same route as the one-go plan')
  // a stray: the OLD route keeps showing while the replan runs, then the new one replaces it
  const old = g.route!
  const t = 10
  let shown = g.get(-40, -STRAY_M - 30, goal, t), during = 0
  ok(g.busy && shown === old, 'slice: during a replan the old route is still what draws')
  for (let f = 1; f < 100000 && g.busy; f++) { shown = g.get(-40, -STRAY_M - 30, goal, t + f / 60); if (g.busy && shown === old) during++ }
  ok(!g.busy && shown !== old && during > 3, `slice: the replan lands and replaces it (${during} frames on the old one)`)
  // a NEW goal drops the old route at once (it leads somewhere else)
  ok(g.get(-40, 0, [0, 90], t + 9999) === null || !g.busy, 'slice: a new goal draws straight dots until its plan lands')
}

// 8. THE REAL CONTINENT: the budget holds and a cross-country quest routes (timing is what the frame loop pays on a replan)
{
  const NAME = 'continent'
  const meta = JSON.parse(readFileSync(`public/open/${NAME}.json`, 'utf8')) as RegionMeta
  const raw = meta.binGz ? gunzipSync(readFileSync(`public/open/${NAME}.bin.gz`)) : readFileSync(`public/open/${NAME}.bin`)
  const R = makeRegion(meta, new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2))
  const roads = roadGraph(meta.network)
  ok(!!roads && roads.edges.length > 20, `continent: road graph built (${roads?.edges.length} edges)`)
  const w: RouteWorld = { ground: (x, z) => R.heightAt(x, z), water: (x, z) => R.heightAt(x, z) < -0.15, roads }
  const places = meta.places.filter(p => p.kind === 'town' || p.kind === 'city' || p.name)
  const trips: [XZ, XZ][] = []
  for (let k = 0; k + 1 < Math.min(places.length, 12); k += 2) trips.push([[places[k].x + 40, places[k].z + 25], [places[k + 1].x - 30, places[k + 1].z + 35]])
  let worst = 0, maxSpent = 0, roadsTaken = 0, reached = 0, slopeBad: string | null = null
  for (const [a, b] of trips) {
    const c0 = process.cpuUsage(), r = planRoute(w, a, b, LIVE_BUDGET), cu = process.cpuUsage(c0), ms = (cu.user + cu.system) / 1000
    worst = Math.max(worst, ms); maxSpent = Math.max(maxSpent, r.spent)
    if (r.mode === 'road') roadsTaken++
    if (r.reached) reached++
    if (r.mode === 'terrain' && r.reached && !slopeBad) slopeBad = walkable(w, r.pts)
    if (!r.reached) console.log(`  unreached: ${a.map(Math.round)} -> ${b.map(Math.round)} (${r.mode}, ${r.pts.length} pts, spent ${r.spent})`)
  }
  // the frame loop's view: a 3 ms slice per frame on the slowest trip; no frame may stall on it
  {
    let worstFrame = 0, mostFrames = 0, landed = 0
    const frameMs: number[] = []
    for (const [a, b] of trips) {
      const g = new GuideRoute(() => w)
      let frames = 0
      // CPU time, not wall: the box is shared (load 19-32 during a peer's build on 11-21 read a 3 ms slice as 368 ms wall)
      for (; frames < 5000; frames++) { const c0 = process.cpuUsage(); g.get(a[0], a[1], b, frames / 60); const c = process.cpuUsage(c0), ms = (c.user + c.system) / 1000; frameMs.push(ms); worstFrame = Math.max(worstFrame, ms); if (!g.busy) break }
      mostFrames = Math.max(mostFrames, frames + 1); if (!g.busy && g.route) landed++
    }
    const p99 = [...frameMs].sort((a, b) => a - b)[Math.floor(frameMs.length * 0.99)]
    console.log(`continent slice: ${landed}/${trips.length} landed, slowest in ${mostFrames} frames, p99 frame ${p99.toFixed(1)} ms, worst ${worstFrame.toFixed(1)} ms (${frameMs.length} frames)`)
    ok(landed === trips.length, 'continent slice: every plan lands')
    // SLICE_MS + one batch (sized by cell); CPU time, so a loaded box cannot fail it
    // A frame = SLICE_MS + at most ONE step past the deadline, so the bound worth asserting is the step, counted in ground
    // samples (the planner's whole cost), not timed: on this shared 2-vCPU box the same step timed 6.8 ms one run and
    // 0.5 ms the next (scheduler + GC). Profiled 11-21: ≤ ~3.3k samples a step at ~21 ns each = ~0.07 ms here.
    let maxStep = 0
    for (const [a, b] of trips) {
      let calls = 0
      const cw: RouteWorld = { ground: (x, z) => { calls++; return w.ground(x, z) }, water: (x, z) => { calls++; return w.water!(x, z) }, roads }
      const gen = planSteps(cw, a, b, LIVE_BUDGET)
      for (;;) { calls = 0; const r = gen.next(); maxStep = Math.max(maxStep, calls); if (r.done) break }
    }
    ok(maxStep <= 4000, `continent slice: no step does more than 4000 ground samples (${maxStep}): a frame overshoots its slice by ~0.1 ms, ~0.5 on a slow phone`)
    ok(worstFrame < 25, `continent slice: no frame over 25 ms CPU, a gross guard only (${worstFrame.toFixed(1)} ms)`)
  }
  console.log(`continent: ${trips.length} town-to-town trips, ${reached} reached, ${roadsTaken} by road, worst ${worst.toFixed(0)} ms`)
  ok(trips.length >= 4, 'continent: enough trips sampled')
  ok(roadsTaken >= Math.ceil(trips.length / 2), `continent: most town-to-town trips take the roads (${roadsTaken}/${trips.length})`)
  ok(!slopeBad, `continent: terrain routes stay walkable (${slopeBad})`)
  ok(maxSpent <= LIVE_BUDGET && LIVE_BUDGET <= DEFAULT_BUDGET, `continent: every plan inside LIVE_BUDGET (${maxSpent})`)
  // loose on purpose: the box is shared and the budget above is the real bound (measured 11-21: 60-160 ms at LIVE_BUDGET); CPU time so a loaded box cannot fail it
  ok(worst < 400, `continent: a live plan costs < 400 ms CPU worst case (${worst.toFixed(0)} ms)`)
}

console.log(`gps-route: ${pass} pass, ${fails.length} fail`)
if (fails.length) { console.log(fails.join('\n')); process.exit(1) }
