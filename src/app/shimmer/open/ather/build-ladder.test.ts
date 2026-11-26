// BETA M169 s3b: the Ladder: a Build piece (planks), and the ladder rule in shared/locomotion.ts: walk into it and climb it to any
// height; on and off at the top and the bottom; no Space needed (the phone's joystick is the same wish). The walker is the real one
// (shared/locomotion on terrain-world) on the pieces' own walker boxes (rooms.ts pieceBoxes; Creative: scenery.ts sceneryBoxes).
// Run: npx tsx src/app/shimmer/open/ather/build-ladder.test.ts
import { buildCatalog, buildBoxes, buildSolids, pieceIcon } from './build-catalog'
import { FURNITURE } from './furniture'
import { SCENERY_BY, sceneryBoxes } from './scenery'
import { planPiece, pieceBoxes, KEEP_CLEAR, saveWorks, loadWorks, type Works } from './rooms'
import { buildAll, plannedNeeds } from './plot-bom'
import { newInv, give, countOf } from '../shared/inventory'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from './plot'
import { terrainWorld, gridShape, type Box } from '../terrain-world'
import { createLoco, tickLocomotion, cellWorld, type LocoInput, type LocoState } from '../shared/locomotion'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify, near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const WALL = FURNITURE.goldwood_panel.h

// ── the piece: in Ramps + ladders, Creative's Build too, the wall top's height, planks ──
const cat = Object.fromEntries(buildCatalog().map(g => [g.sub, g.ids]))
ok(J(cat['Ramps + ladders']) === J(['ramp', 'ladder']), `Ramps + ladders (${cat['Ramps + ladders']})`)
ok(FURNITURE.ladder.name === 'Ladder' && SCENERY_BY.get('piece:ladder')?.group === 'Build' && SCENERY_BY.get('piece:ladder')?.sub === 'Ramps + ladders', 'Ladder: in Creative\'s Build, same sub-category')
ok(near(FURNITURE.ladder.h, WALL) && J(FURNITURE.ladder.recipe) === J([{ id: 'goldwood_plank', n: 4 }]), 'as tall as the wall top, 4 planks')
ok(J(buildSolids(FURNITURE.ladder)) === J([{ x: 0, z: 0, w: 0.6, d: 0.1, h: WALL, ladder: true }]), 'one thin climbable box')
{ const b = buildBoxes(FURNITURE.ladder, false)!; ok(b.length > 10 && near(Math.max(...b.map(x => x.p[1] + x.s[1] / 2)), WALL), `stiles + rungs (${b.length} boxes)`)
  ok(pieceIcon('ladder').length === b.length * 3 && new Set(['ramp', 'ladder', 'stair'].map(id => pieceIcon(id).map(f => f.d).join())).size === 3, 'its own icon') }

// ── the real walker ──
const own = new Set(STARTING_SQUARES), held = (x: number, z: number) => { const s = squareAt(x, z); return !!s && own.has(sqId(s.i, s.j)) }
let X = 0, Z = 0
find: for (let z = -150; z < 150; z++) for (let x = -150; x < 150; x++) if ([[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]].every(([a, b]) => held(x + a, z + b)) && KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + 10)) { X = x; Z = z; break find }
const base = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })
const plan = (w: Works, item: string, dx: number, dz: number, q = 0) => { const r = planPiece(w, own, item, X + dx, Z + dz, q); if ('why' in r) throw new Error(`${item}: ${r.why}`); return r.works }
const stand = (w: Works) => ({ ...w, pieces: [...w.pieces, ...(w.planned ?? [])], planned: undefined }) as Works
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const worldOf = (w: Works) => { const bx: Box[] = pieceBoxes(w); return terrainWorld({ ground: () => GROUND_Y, solids: () => bx, water: () => [] }) }
type Run = { lc: LocoState; top: number; onAt: number }
/** from (x, z) on the ground (or `from`), wish (mvX, mvZ) [+ Space] for up to t s or until `stop`; then stand still */
const go = (w: Works, mv: [number, number], t: number, from: { x: number; z: number } | Run, stop?: (l: LocoState) => boolean, jump = false): Run => {
  const world = worldOf(w), lc = 'lc' in from ? from.lc : createLoco(from.x, GROUND_Y, from.z); let top = lc.py, onAt = -1
  if (!('lc' in from)) for (let k = 0; k < 60; k++) tickLocomotion(lc, input(), world)
  for (let k = 0; k < 60 * t && !stop?.(lc); k++) { tickLocomotion(lc, input({ mvX: mv[0], mvZ: mv[1], fwdX: mv[0], fwdZ: mv[1] || -1, jumpKey: jump && k < 3 }), world); top = Math.max(top, lc.py); if (lc.onLadder && onAt < 0) onAt = k }
  for (let k = 0; k < 20; k++) tickLocomotion(lc, input(), world)
  return { lc, top, onAt }
}
const feet = (r: Run) => r.lc.py - GROUND_Y
// a ladder against a wall panel (its back to the wall, climbed from +z toward -z); the wall top is 4.8 m
let wk = plan(base(), 'ladder', 0, 0); wk = plan(wk, 'goldwood_panel', 0, -0.25)
const S = stand(wk)
// 1 bottom: walk into it, climb to the top, walk on over it onto the wall top
const up = go(S, [0, -1], 8, { x: X, z: Z + 2 }, l => !l.onLadder && l.py - GROUND_Y > 4.7)
ok(up.onAt > 0 && up.top - GROUND_Y > 4.75, `walking into it she takes hold and climbs to the top (feet ${(up.top - GROUND_Y).toFixed(2)})`)
ok(!up.lc.onLadder && near(feet(up), WALL, 0.02) && up.lc.pz < Z - 0.1 && !up.lc.airborne, `walking on, she steps off onto the wall top (feet ${feet(up).toFixed(2)}, z ${(up.lc.pz - Z).toFixed(2)})`)
// half way: let go of the stick, she stays where she is (no slide, no fall)
{ const mid = go(S, [0, -1], 8, { x: X, z: Z + 2 }, l => l.py - GROUND_Y > 2.4), h = feet(mid), still = go(S, [0, 0], 2, mid)
  ok(h > 2.3 && near(feet(still), h, 0.05) && !!still.lc.onLadder, `half way, hands off: she stays on the ladder at ${feet(still).toFixed(2)}`)
  // sideways walks are not a climb
  const side = go(S, [1, 0], 0.3, still); ok(near(feet(side), h, 0.05), 'a sideways wish neither climbs nor drops')
  // Space lets go: a kick back off it, then she falls
  const z0 = still.lc.pz, kick = go(S, [0, 0], 2, still, undefined, true); ok(!kick.lc.onLadder && kick.lc.pz > z0 + 0.3 && feet(kick) < 0.1, `Space lets go and she drops off it (z +${(kick.lc.pz - z0).toFixed(2)}, feet ${feet(kick).toFixed(2)})`) }
// 2 top: from the wall top, walk toward the ladder: she swings onto it and climbs down; at the bottom she walks off
const down = go(S, [0, 1], 8, up, l => !!l.onLadder)
ok(!!down.lc.onLadder && down.lc.pz > Z && feet(down) > 4.6, `on the wall top, walking toward it she swings onto it (feet ${feet(down).toFixed(2)}, z ${(down.lc.pz - Z).toFixed(2)})`)
const bottom = go(S, [0, 1], 8, down, l => !l.onLadder)
ok(!bottom.lc.onLadder && feet(bottom) < 0.02 && !bottom.lc.airborne, `walking on, she climbs down and off at the bottom (feet ${feet(bottom).toFixed(2)})`)
const zb = bottom.lc.pz, away = go(S, [0, 1], 1, bottom); ok(away.lc.pz > zb + 1.5 && !away.lc.onLadder, `and walks away from it (z +${(away.lc.pz - zb).toFixed(2)})`)
// grip climbing could never do this: CLIMB_MAX_RISE 2.5; without the ladder flag the same box is a wall she cannot walk up
{ const flat = (w: Works) => { const bx = pieceBoxes(w).map(({ ladder: _l, ...b }) => { void _l; return b }); return terrainWorld({ ground: () => GROUND_Y, solids: () => bx, water: () => [] }) }
  const lc = createLoco(X, GROUND_Y, Z + 2); let top = 0; const wd = flat(S)
  for (let k = 0; k < 60 * 6; k++) { tickLocomotion(lc, input({ mvZ: -1 }), wd); top = Math.max(top, lc.py - GROUND_Y) }
  ok(top < 0.5, `the same box without the ladder rule: a wall (feet up to ${top.toFixed(2)})`) }
// a free-standing ladder: up to its top and she waits there (nothing to step onto), then down again
{ const F = stand(plan(base(), 'ladder', 0, 0)), r = go(F, [0, -1], 5, { x: X, z: Z + 2 })
  ok(!!r.lc.onLadder && near(feet(r), WALL, 0.02), `free-standing: she waits on the top rung (feet ${feet(r).toFixed(2)})`)
  ok(feet(go(F, [0, 1], 5, r)) < 0.02, 'and climbs back down') }
// turned a quarter: climbed along x
{ const T = stand(plan(plan(base(), 'ladder', 0, 0, 1), 'goldwood_panel', 0.25, 0, 1)), r = go(T, [1, 0], 8, { x: X - 2, z: Z }, l => !l.onLadder && l.py - GROUND_Y > 4.7)
  ok(near(feet(r), WALL, 0.02) && r.lc.px > X + 0.1, `turned a quarter: up and onto the wall top (feet ${feet(r).toFixed(2)}, x ${(r.lc.px - X).toFixed(2)})`) }
// a world without ladderAt (the voxel oracle, the server) never sees one
ok(!('ladderAt' in cellWorld(() => false)) && typeof terrainWorld(gridShape(() => false)).ladderAt === 'function', 'only terrain worlds answer ladderAt')

// ── plan, pay, build, reload ──
{ const bill = Object.fromEntries(plannedNeeds(wk.planned).map(c => [c.id, c.n]))
  ok(J(bill) === J({ goldwood_plank: 4 + 2 }), `the bill: ladder 4 + panel 2 (${J(bill)})`)
  ok(!buildAll(wk, give(newInv(), 'goldwood_plank', 5).inv, null).ok, 'a plank short: no Build')
  const r = buildAll(wk, give(newInv(), 'goldwood_plank', 6).inv, null); ok(r.ok && r.works.pieces.length === 2 && countOf(r.inv, 'goldwood_plank') === 0, 'Build pays 6, both stand')
  const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  if (r.ok) { saveWorks(r.works); const back = loadWorks(); ok(back.pieces.some(p => p.item === 'ladder') && pieceBoxes(back).some(b => b.ladder), 'reload: the ladder stands and climbs') } }

// ── Creative: the same box, a ladder to the walker ──
{ const bx = sceneryBoxes([{ id: 'a', k: 'piece:ladder', x: X, z: Z, q: 0, s: 1, y: GROUND_Y }] as any)
  ok(bx.length === 1 && bx[0].ladder === true, 'Creative: one ladder box')
  const wd = terrainWorld({ ground: () => GROUND_Y, solids: () => bx, water: () => [] }), lc = createLoco(X, GROUND_Y, Z + 2); let top = 0
  for (let k = 0; k < 60 * 5; k++) { tickLocomotion(lc, input({ mvZ: -1 }), wd); top = Math.max(top, lc.py - GROUND_Y) }
  ok(top > 4.7, `Creative: she climbs it (feet ${top.toFixed(2)})`) }

console.log(`build-ladder: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
