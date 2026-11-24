// M126: the trio through a raised house's door and back, and out of the plot along the path to the gate. npx tsx src/app/shimmer/open/ather/garden-follow.test.ts
// Real pieces: plot-walls / plot-found boxes, the real formation, the real trot, the real cluster ground. The keeper is scripted.
import { gardenFollow, openAt, setGardenGround } from './garden-follow'
import { keeperTrail, makeGuide, makeTrail, TRAIL } from '../shared/keeper-trail'
import { makeFormation, type Keeper, type Member } from '../shared/follow-formation'
import { makeTrot, type SpiritNav } from './spirit-trot'
import { SPIRIT_RIGS } from './spirit-models'
import { bodyRadius } from './obstacles'
import { GROWN } from '../../sprites/creature-size'
import { findRooms, wallBoxes, type Walls } from './plot-walls'
import { doorSteps, floorAt, plinthBoxes } from './plot-found'
import { clusterFrame, clusterGround } from './cluster'
import { GATE, GROUND_Y, PATH_START, STARTING_SQUARES, THRESHOLD, plotHeightAt } from './plot'
import type { Works } from './rooms'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── a house 8 x 6 m, x -144..-136, z 98..104, raised 1.2 m, a 2 m door in its north wall (z 98, x -141..-139) ─────────────────
const X0 = -144, X1 = -136, Z0 = 98, Z1 = 104, W: Record<string, Walls[string]> = {}
for (let i = X0; i < X1; i++) { W[`h,${i},${Z0}`] = i === -141 || i === -140 ? { mat: 'goldwood', kind: 'door' } : { mat: 'goldwood' }; W[`h,${i},${Z1}`] = { mat: 'goldwood' } }
for (let j = Z0; j < Z1; j++) { W[`v,${X0},${j}`] = { mat: 'goldwood' }; W[`v,${X1},${j}`] = { mat: 'goldwood' } }
const key = findRooms(W)[0].key
const house = (found: number) => ({ v: 1, rooms: [], chests: [], pieces: [], walls: W, paid: { [key]: 48 }, found }) as unknown as Works
const frame = clusterFrame(null, [])
function world(found: number) {
  const w = house(found), lift = () => found
  const walls = [...wallBoxes(W, GROUND_Y, lift), ...plinthBoxes(w, GROUND_Y), ...doorSteps(w, GROUND_Y)]
  keeperTrail.clear(); setGardenGround({ owned: new Set(STARTING_SQUARES), works: w, walls, frame })
  const solid = wallBoxes(W, GROUND_Y, lift).filter(b => b.y0 < GROUND_Y + found + 1)
  return { w, solid }
}
type Sim = ReturnType<typeof sim>
function sim(ids: ('fox' | 'axolotl')[], at: Keeper, y: number, hz = 60) {
  const k = { ...at }, ms: Member[] = [], navs = ids.map(sp => gardenFollow(bodyRadius(GROWN[sp]), GROUND_Y)), f = makeFormation(() => ms)
  keeperTrail.note(k.x, y, k.z, true)
  const trots = ids.map((sp, i) => { const id = 's' + i
    ms.push({ id, kind: 'spirit', r: bodyRadius(GROWN[sp]), blocked: navs[i].slotBlocked })
    const nav: SpiritNav = { home: { x: -125, z: 108 + i * 2 }, rMin: 0.9, rMax: 1.5, roam: { maxLeg: 4.5, away: 3 }, blocked: (x, z) => openAt(x, z, bodyRadius(GROWN[sp]), GROUND_Y) === null, follow: navs[i] }
    const t = makeTrot(nav, 7 + i * 5, SPIRIT_RIGS[sp]!.trot); t.follow(() => ({ ...k, slot: f.last().slots[id] })); return t })
  const st = { maxV: 0, inWall: 0, far: 0, yOff: 0, jumps: 0 }
  let prev: ({ x: number; z: number })[] = trots.map(t => ({ ...t.pose() })), n = 0
  const run = (secs: number, solid: { x0: number; x1: number; z0: number; z1: number }[], move?: (dt: number) => number | void) => {
    for (let i = 0; i < secs * hz; i++) { const dt = 1 / hz, ky = move?.(dt); if (typeof ky === 'number') y = ky
      keeperTrail.note(k.x, y, k.z, true); f.tick(k, dt)
      trots.forEach((t, q) => { const p = t.step(dt); navs[q].stand(p.x, p.z)
        const v = Math.hypot(p.x - prev[q].x, p.z - prev[q].z) / dt; if (n > 5) { st.maxV = Math.max(st.maxV, v); if (v > 9.5) st.jumps++ }
        // the whole step, not just its end: no wall between two frames
        for (let s = 1; s <= 8; s++) { const x = prev[q].x + (p.x - prev[q].x) * s / 8, z = prev[q].z + (p.z - prev[q].z) * s / 8; if (n > 5 && solid.some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)) { st.inWall++; break } }
        st.far = Math.max(st.far, n > hz * 4 ? Math.hypot(p.x - k.x, p.z - k.z) : 0); prev[q] = { x: p.x, z: p.z } }); n++ }
  }
  const to = (x: number, z: number, mps: number, solid: Parameters<typeof run>[1], ky: (x: number, z: number) => number) => {
    const d = Math.hypot(x - k.x, z - k.z); k.yaw = Math.atan2(-(x - k.x), -(z - k.z)); const ux = (x - k.x) / d, uz = (z - k.z) / d
    run(d / mps, solid, dt => { k.x += ux * mps * dt; k.z += uz * mps * dt; return ky(k.x, k.z) }) }
  return { k, st, run, to, gaps: () => trots.map(t => Math.hypot(t.pose().x - k.x, t.pose().z - k.z)), poses: () => trots.map((t, q) => ({ x: t.pose().x, z: t.pose().z, y: navs[q].y() })), navs, f }
}
const inside = (p: { x: number; z: number }) => p.x > X0 && p.x < X1 && p.z > Z0 && p.z < Z1

for (const [ids, tag] of [[['fox', 'axolotl'], 'duo'], [['fox', 'fox', 'axolotl'], 'trio']] as const) for (const found of [0, 1.2]) for (const hz of [60, 6]) {
  const T = `${tag}, floor +${found}, ${hz} fps`, { w, solid } = world(found)
  const ky = (x: number, z: number) => { const h = floorAt(w, GROUND_Y, x, z); return z < Z0 && z > Z0 - 1.5 && Math.abs(x + 140) < 1.2 ? GROUND_Y + found * Math.min(1, Math.max(0, (z - Z0 + 1.5) / 1.5)) : h }
  const s = sim([...ids], { x: -140, z: 92, yaw: 0 }, GROUND_Y, hz)
  s.run(5, solid); ok(s.gaps().every(g => g < 4), `${T}: beside the keeper outside (${s.gaps().map(g => g.toFixed(1))})`)
  s.to(-140, 101, 3, solid, ky); s.to(-138, 102.5, 3, solid, ky); s.to(-142, 102.5, 3, solid, ky); s.run(5, solid)
  ok(s.poses().every(inside) && s.poses().every(p => Math.abs(p.y - GROUND_Y - found) < 0.05), `${T}: in through the door, on its floor (${s.poses().map(p => `${p.x.toFixed(1)},${p.z.toFixed(1)} y ${p.y.toFixed(2)}`).join(' ')})`)
  s.to(-140, 101, 3, solid, ky); s.to(-140, 93, 3, solid, ky); s.to(-128, 93, 5, solid, ky); s.run(5, solid)
  ok(s.poses().every(p => !inside(p) && Math.abs(p.y - GROUND_Y) < 0.05) && s.gaps().every(g => g < 4), `${T}: out again, beside the keeper (${s.gaps().map(g => g.toFixed(1))}; y ${s.poses().map(p => p.y.toFixed(2))})`)
  ok(s.st.inWall === 0, `${T}: never in a wall (${s.st.inWall} steps)`); ok(s.st.jumps === 0, `${T}: no jump (fastest ${s.st.maxV.toFixed(1)} m/s)`)
}
// ── out of the plot: the threshold, the path, the Green's gate, and back ─────────────────────────────────────────────────────
for (const [ids, tag] of [[['fox', 'axolotl'], 'duo'], [['fox', 'fox', 'axolotl'], 'trio']] as const) {
  const { solid } = world(0), G = (x: number, z: number) => { const h = plotHeightAt(x, z); return Number.isFinite(h) ? h : clusterGround(frame, x, z) }
  const s = sim([...ids], { x: THRESHOLD.x, z: THRESHOLD.z, yaw: 0 }, GROUND_Y); s.run(5, solid)
  const path = frame.paths[0].pts, way = (Math.hypot(path[0][0] - PATH_START.x, path[0][1] - PATH_START.z) < Math.hypot(path[path.length - 1][0] - PATH_START.x, path[path.length - 1][1] - PATH_START.z) ? path : [...path].reverse()) as [number, number][]
  ok(way.every(([x, z]) => Number.isFinite(G(x, z))), `${tag}: the path has ground all the way`)
  for (const [x, z] of way) if (Math.hypot(x - s.k.x, z - s.k.z) > 0.01) s.to(x, z, 5, solid, G)
  s.to(GATE.x + 3, GATE.z - 3, 5, solid, G); s.run(6, solid)
  ok(s.gaps().every(g => g < 4), `${tag}: out of the plot to the gate, all beside the keeper (${s.gaps().map(g => g.toFixed(1))})`)
  ok(s.poses().every(p => Math.abs(p.y - G(p.x, p.z)) < 0.1), `${tag}: on the ground there (${s.poses().map(p => (p.y - G(p.x, p.z)).toFixed(2))})`)
  ok(s.f.state().layout === 'arc', `${tag}: on the open Green they stand in the arc (${s.f.state().layout})`)
  for (const [x, z] of [...way].reverse()) if (Math.hypot(x - s.k.x, z - s.k.z) > 0.01) s.to(x, z, 5, solid, G)
  s.to(THRESHOLD.x, THRESHOLD.z, 5, solid, G); s.run(6, solid)
  ok(s.gaps().every(g => g < 4) && s.st.far < 9, `${tag}: and back on the plot (${s.gaps().map(g => g.toFixed(1))}; furthest ${s.st.far.toFixed(1)} m)`); ok(s.st.jumps === 0, `${tag}: no jump (${s.st.maxV.toFixed(1)} m/s)`)
}
// ── the trail itself ──
{ const t = makeTrail(); for (let i = 0; i <= 40; i++) t.note(i * 0.1, 2, 0, true)
  ok(t.at(2, 0.25) !== null && t.at(2, 0.35) === null, 'trail: 0.3 m either side'); ok(t.at(2, 0, 5) === null, 'trail: another floor is not it')
  const n = t.crumbs().length; for (let i = 0; i < 40; i++) t.note(4 + i * 0.05, 2 - i * 0.3, 0, false); ok(t.crumbs().length === n && t.at(5, 0) === null, 'trail: a fall that never lands is no way')
  t.note(40, 2, 0, true); ok(t.at(2, 0) === null && t.level() === 2, 'trail: a travel starts it over')
  for (let i = 0; i < 4000; i++) t.note(40 + i * 0.2, 2, 0, true); ok(t.crumbs().length <= TRAIL.max + 60 && t.at(41, 0) === null && t.at(40 + 3999 * 0.2, 0) === 2, 'trail: bounded') }
// ── no trail between (she was at her planter behind a house): the grid search goes round ──
{ const bl = (x: number, z: number) => x > -5 && x < 5 && Math.abs(z) < 0.6 || x < -12 || x > 12 || Math.abs(z) > 8, t = makeTrail(), g = makeGuide(t, bl); let p = { x: 0, z: -3 }, hit = 0; const goal = { x: 0, z: 3 }
  for (let i = 0; i < 600; i++) { const w = g.toward(p, goal, 1 / 60); if (!w) continue; const d = Math.hypot(w.x - p.x, w.z - p.z), s = Math.min(d, 4 / 60); if (d > 1e-6) p = { x: p.x + (w.x - p.x) / d * s, z: p.z + (w.z - p.z) / d * s }; if (Math.abs(p.x) < 4.9 && Math.abs(p.z) < 0.5) hit++ }
  ok(Math.hypot(p.x - goal.x, p.z - goal.z) < 0.2 && !hit, `search: round the wall (${p.x.toFixed(1)},${p.z.toFixed(1)}, ${hit} in it)`) }
// ── following since before she was drawn: she starts beside the keeper; a wall built between = set down out of sight only ──
{ world(0); const s = sim(['fox'], { x: -140, z: 92, yaw: 0 }, GROUND_Y); s.run(0.2, []); ok(s.gaps()[0] < 4, `back in the garden: beside the keeper at once (${s.gaps()[0].toFixed(1)} m)`)
  const fn = gardenFollow(0.42, GROUND_Y), k = { x: -140, z: 92, yaw: 0 }, slot = { x: -140, z: 94.3 }; let a: unknown = null
  for (let i = 0; i < 600 && !a; i++) a = fn.lost({ x: -140, z: 80 }, k, slot, 1 / 60); ok(!a, 'lost in front of the keeper: never set down')
  for (let i = 0; i < 600 && !a; i++) a = fn.lost({ x: -140, z: 104 }, k, slot, 1 / 60); ok(!!a, 'lost behind them: set down in her place') }
fails.forEach(m => console.log('FAIL', m)); console.log(`garden-follow: ${pass} pass, ${fails.length} fail`); if (fails.length) process.exit(1)
