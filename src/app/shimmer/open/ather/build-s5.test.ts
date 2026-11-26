// BETA M169 s5: foundations (Low / High + their stone steps), the deck, the porch, the balcony and the columns as Build pieces.
// A foundation / deck / porch is a SLAB: what is set on it rides up (walls, doors, furniture). The walker is the real one
// (shared/locomotion on terrain-world) on rooms.ts pieceBoxes. Run: npx tsx src/app/shimmer/open/ather/build-s5.test.ts
import { buildCatalog, buildBoxes, buildSolids, pieceIcon, pieceSpan, raised, stepCount, UP, RAIL } from './build-catalog'
import { FURNITURE } from './furniture'
import { SCENERY_BY, sceneryBoxes } from './scenery'
import { planPiece, canPlacePiece, pieceBoxes, KEEP_CLEAR, saveWorks, loadWorks, type Works } from './rooms'
import { plotFootprints } from './obstacles'
import { buildAll, plannedNeeds } from './plot-bom'
import { newInv, give, countOf } from '../shared/inventory'
import { STARTING_SQUARES, squareAt, sqId, GROUND_Y } from './plot'
import { terrainWorld, type Box } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput, type LocoState } from '../shared/locomotion'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify, near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const WALL = FURNITURE.goldwood_panel.h
const NEW = ['foundation_low', 'foundation_high', 'found_step', 'found_steps', 'deck', 'porch', 'balcony', 'column', 'stone_column']

// ── the pieces: in their sub-categories, in Creative's Build too, each its own icon, h = the top of what is drawn ──
const cat = Object.fromEntries(buildCatalog().map(g => [g.sub, g.ids]))
ok(J(cat['Foundations + decks']) === J(['foundation_low', 'foundation_high', 'found_step', 'found_steps', 'deck', 'porch', 'balcony']), `Foundations + decks (${cat['Foundations + decks']})`)
ok(J(cat['Columns']) === J(['column', 'stone_column']), `Columns (${cat['Columns']})`)
for (const id of NEW) {
  const f = FURNITURE[id], b = buildBoxes(f)!, top = Math.max(...b.map(x => x.p[1] + x.s[1] / 2)), K = SCENERY_BY.get(`piece:${id}`)
  ok(K?.group === 'Build' && K.sub === f.build, `${id}: in Creative's Build, ${f.build}`)
  ok(b.length > 0 && Math.abs(top - f.h) < 0.06, `${id}: h ${f.h} is its drawn top ${top.toFixed(3)}`)
  ok(pieceIcon(id).length === b.length * 3, `${id}: an icon from its boxes`)
  ok(f.recipe.length > 0 && f.solid, `${id}: a recipe, solid`)
  ok(raised(f) === (id === 'balcony'), `${id}: ${id === 'balcony' ? 'on the wall tops' : 'on the ground'}`)
  ok(!!f.slab === ['foundation_low', 'foundation_high', 'deck', 'porch'].includes(id), `${id}: ${f.slab ? 'a slab: what is set on it rides up' : 'not a slab'}`)
}
ok(new Set(NEW.map(id => pieceIcon(id).map(f => f.d + f.fill).join())).size === NEW.length, 'nine different icons')
// sizes off Magii's sheets / the build: plinths 0.6 + 1.2, steps 0.45 deep each under the walker's 0.5 m, deck 0.12, porch flush with a Low
ok(FURNITURE.foundation_low.h === 0.6 && FURNITURE.foundation_high.h === 1.2 && FURNITURE.deck.h === 0.12 && FURNITURE.porch.h === FURNITURE.foundation_low.h, 'heights: Low 0.6, High 1.2, deck 0.12, porch = Low')
ok(FURNITURE.column.w === 0.6 && FURNITURE.column.h === 4.88 && FURNITURE.balcony.d === 1, 'column 0.6 x 4.88, balcony reaches 1 m')
for (const [id, plinth] of [['found_step', 0.6], ['found_steps', 1.2]] as const) { const s = buildSolids(FURNITURE[id])!.map(t => t.h)
  ok(s.length === stepCount(FURNITURE[id]) && [0, ...s, plinth].every((h, k, a) => k === 0 || (h - a[k - 1] < 0.5 && h > a[k - 1])), `${id}: ${s.length} steps up to ${plinth}, each under 0.5 m (${s})`) }
{ const s = buildSolids(FURNITURE.balcony)!; ok(s.every(t => (t.y ?? 0) >= UP.top - 1e-9) && pieceSpan(FURNITURE.balcony)[0] >= UP.top - 1e-9 && s.length === 4, 'balcony: a floor + 3 rails, all up on the wall tops') }

// ── the real walker ──
const own = new Set(STARTING_SQUARES), held = (x: number, z: number) => { const s = squareAt(x, z); return !!s && own.has(sqId(s.i, s.j)) }
let X = 0, Z = 0
find: for (let z = -150; z < 150; z++) for (let x = -150; x < 150; x++) if ([[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]].every(([a, b]) => held(x + a, z + b)) && KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + 10)) { X = x; Z = z; break find }
const base = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })
const plan = (w: Works, item: string, dx: number, dz: number, q = 0) => { const r = planPiece(w, own, item, X + dx, Z + dz, q); if ('why' in r) throw new Error(`${item}: ${r.why}`); return r.works }
const refuse = (w: Works, item: string, dx: number, dz: number, q = 0) => { const r = planPiece(w, own, item, X + dx, Z + dz, q); return 'why' in r ? r.why : null }
const stand = (w: Works) => ({ ...w, pieces: [...w.pieces, ...(w.planned ?? [])], planned: undefined }) as Works
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const worldOf = (bx: Box[]) => terrainWorld({ ground: () => GROUND_Y, solids: () => bx, water: () => [] })
type Run = { lc: LocoState; top: number }
const go = (bx: Box[], mv: [number, number], t: number, from: { x: number; z: number } | Run, stop?: (l: LocoState) => boolean): Run => {
  const world = worldOf(bx), lc = 'lc' in from ? from.lc : createLoco(from.x, GROUND_Y, from.z); let top = lc.py
  if (!('lc' in from)) for (let k = 0; k < 60; k++) tickLocomotion(lc, input(), world)
  for (let k = 0; k < 60 * t && !stop?.(lc); k++) { tickLocomotion(lc, input({ mvX: mv[0], mvZ: mv[1], fwdX: mv[0], fwdZ: mv[1] || -1 }), world); top = Math.max(top, lc.py) }
  for (let k = 0; k < 30; k++) tickLocomotion(lc, input(), world)
  return { lc, top }
}
const feet = (r: Run) => r.lc.py - GROUND_Y

const FLOOR = UP.top + UP.floorT
const sets = (w: Works, item: string, dx: number, dz: number) => canPlacePiece(w, own, item, X + dx, Z + dz, 0).ok
const lands = (bx: Box[], from: { x: number; z: number }, mv: [number, number], t = 6) => go(bx, mv, t, from, l => l.pz < Z)   // stop over the middle

// 1 a stone step up onto a Low foundation, two onto a High; without them a plinth is a wall; a deck is a step up; a porch + its step
for (const [found, steps, H] of [['foundation_low', 'found_step', 0.6], ['foundation_high', 'found_steps', 1.2]] as const) {
  const w = plan(plan(base(), found, 0, 0), steps, 0, 1 + FURNITURE[steps].d / 2), B = pieceBoxes(stand(w))
  const r = lands(B, { x: X, z: Z + 3 }, [0, -1], 4); ok(near(feet(r), H, 0.03) && r.lc.pz < Z + 0.1, `${found}: up the ${steps} and onto it (feet ${feet(r).toFixed(2)}, z ${(r.lc.pz - Z).toFixed(2)})`)
  const bare = lands(pieceBoxes(stand(plan(base(), found, 0, 0))), { x: X, z: Z + 3 }, [0, -1], 4)
  ok(feet(bare) < 0.05 && bare.lc.pz > Z + 1, `${found} with no step: she stops at it (feet ${feet(bare).toFixed(2)}, z ${(bare.lc.pz - Z).toFixed(2)})`) }
{ const r = lands(pieceBoxes(stand(plan(base(), 'deck', 0, 0))), { x: X, z: Z + 3 }, [0, -1], 3); ok(near(feet(r), 0.12, 0.03) && r.lc.pz < Z + 0.5, `onto the deck (feet ${feet(r).toFixed(2)})`) }
{ const w = plan(plan(base(), 'porch', 0, 0), 'found_step', 0, 1 + 0.225), r = lands(pieceBoxes(stand(w)), { x: X, z: Z + 3 }, [0, -1], 4)
  ok(near(feet(r), 0.6, 0.03) && r.lc.pz < Z + 0.5, `up the step onto the porch (feet ${feet(r).toFixed(2)})`) }

// 2 what is set on a foundation rides up with it: a wall panel and a door stand on the plinth, not in it; a table on the porch
let F = plan(plan(base(), 'foundation_low', 0, 0), 'goldwood_panel_wide', 0, -0.85)
F = plan(F, 'foundation_low', 2, 0); F = plan(F, 'door', 2, -0.85)   // a second plinth snapped beside the first, a door on it
{ const B = pieceBoxes(stand(F)), top = Math.max(...B.map(b => b.y1))
  ok(near(top, GROUND_Y + 0.6 + WALL, 0.01), `a wall on a Low foundation tops out at 0.6 + 4.8 (${(top - GROUND_Y).toFixed(2)})`)
  ok(refuse(F, 'foundation_high', 1, 0) !== null, `a plinth over a plinth: refused (${refuse(F, 'foundation_high', 1, 0)})`)
  ok(refuse(F, 'goldwood_slab', 0, 0.5) !== null, 'a floor slab on a foundation: refused (one slab layer)')
  ok(sets(stand(plan(base(), 'porch', 0, 0)), 'goldwood_table', 0, 0), 'a table on the porch: fine') }

// 3 the balcony: a stair up to an upper floor on two walls, the balcony off its far end (turned to face out): walk out onto it, the
//    rail stops her at its edge, she stands there; she walks under it on the ground
let wk = plan(base(), 'stair', 0, 0)
wk = plan(wk, 'goldwood_panel_wide', -0.85, -4, 1); wk = plan(wk, 'goldwood_panel_wide', 0.85, -4, 1)
wk = plan(wk, 'upper_floor', 0, -4); wk = plan(wk, 'balcony', 0, -5.5, 2)
const SB = pieceBoxes(stand(wk))
{ const out = go(SB, [0, -1], 12, { x: X, z: Z + 4 })
  ok(near(feet(out), FLOOR, 0.03) && out.lc.pz < Z - 5.1 && out.lc.pz > Z - 6 && !out.lc.airborne, `up the stair, across the upper floor, out onto the balcony to its rail (feet ${feet(out).toFixed(2)}, z ${(out.lc.pz - Z).toFixed(2)})`)
  const still = go(SB, [0, 0], 3, out); ok(near(feet(still), FLOOR, 0.03), `she stands on the balcony (feet ${feet(still).toFixed(2)})`)
  const side = go(SB, [1, 0], 3, still); ok(near(feet(side), FLOOR, 0.03) && side.lc.px < X + 1, `its end rail holds her too (x ${(side.lc.px - X).toFixed(2)})`) }
{ const under = go(SB, [0, 1], 4, { x: X, z: Z - 8 }, l => l.pz > Z - 5.5); ok(feet(under) < 0.05 && under.lc.pz > Z - 6, `she walks under the balcony on the ground (z ${(under.lc.pz - Z).toFixed(2)})`) }
ok(refuse(wk, 'balcony', 0, -5.2, 2) !== null, 'a second balcony over the first: refused')
{ const noRail = { ...FURNITURE.balcony }; const s = buildSolids(noRail)!; ok(s.filter(t => t.h > FLOOR + 0.5).length === 3 && s.every(t => t.h <= FLOOR + RAIL.h + 1e-9), 'balcony rails 1 m over its floor') }

// 4 a column blocks; spirits go round a column, step over a deck
{ const r = lands(pieceBoxes(stand(plan(base(), 'column', 0, 0))), { x: X, z: Z + 3 }, [0, -1], 4); ok(r.lc.pz > Z + 0.3, `a column stops her (z ${(r.lc.pz - Z).toFixed(2)})`) }

// 5 plan, pay, build, reload (the foundation house)
{ const bill = Object.fromEntries(plannedNeeds(F.planned).map(c => [c.id, c.n]))
  ok(J(bill) === J({ stone_brick: 8, goldwood_plank: 8 }), `the bill: 2 Low foundations 8 bricks + a wide panel 3 + a door 5 planks (${J(bill)})`)
  const inv = give(give(newInv(), 'stone_brick', 8).inv, 'goldwood_plank', 8).inv
  ok(!buildAll(F, give(give(newInv(), 'stone_brick', 7).inv, 'goldwood_plank', 8).inv, null).ok, 'a brick short: no Build')
  const r = buildAll(F, inv, null); ok(r.ok && r.works.pieces.length === 4 && countOf(r.inv, 'stone_brick') === 0, 'Build pays, all four stand')
  const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  if (r.ok) { saveWorks(r.works); const back = loadWorks(); ok(back.pieces.filter(p => p.item === 'foundation_low').length === 2 && near(Math.max(...pieceBoxes(back).map(b => b.y1)), GROUND_Y + 0.6 + WALL, 0.01), 'reload: both plinths stand, the wall still up on them') } }

// 6 Creative: the balcony's parts up in the air, a foundation from the ground
{ const bx = sceneryBoxes([{ id: 'a', k: 'piece:balcony', x: X, z: Z, q: 0, s: 1, y: GROUND_Y }] as any)
  ok(bx.length === 4 && bx.every(b => b.y0 >= GROUND_Y + UP.top - 1e-6), `Creative: the balcony's 4 boxes are up on the wall tops`)
  const fb = sceneryBoxes([{ id: 'b', k: 'piece:foundation_high', x: X, z: Z, q: 0, s: 1, y: GROUND_Y }] as any)
  ok(fb.length >= 1 && near(Math.max(...fb.map(b => b.y1)), GROUND_Y + 1.2, 0.01), 'Creative: a High foundation 1.2 m tall') }
// old pieces keep their old boxes
ok(pieceBoxes(stand(plan(base(), 'goldwood_panel', 0, 0))).every(b => near(b.y0, GROUND_Y - 0.5) && near(b.y1, GROUND_Y + WALL)), 'old pieces: boxes as before')

console.log(`build-s5: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
