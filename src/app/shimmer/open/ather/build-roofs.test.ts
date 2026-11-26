// BETA M169 s4: roofs (clay tile / living turf; gable, sloped, flat), ceilings, beams, upper floors, the gable end and the chimney as
// Build pieces. Everything but the chimney stands ON the 4.8 m wall tops: an upper floor lets a keeper off a stair's or a ladder's
// top and stand there, and walk under it. The walker is the real one (shared/locomotion on terrain-world) on rooms.ts pieceBoxes.
// Run: npx tsx src/app/shimmer/open/ather/build-roofs.test.ts
import { buildCatalog, buildBoxes, buildSolids, pieceIcon, pieceSpan, raised, UP } from './build-catalog'
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
const NEW = ['upper_floor', 'upper_floor_wide', 'ceiling', 'beam', 'roof_gable_tile', 'roof_gable_turf', 'roof_slope_tile', 'roof_slope_turf', 'roof_flat_tile', 'roof_flat_turf', 'gable_end', 'chimney']

// ── the pieces: in their sub-categories, in Creative's Build too, each its own icon, h = the top of what is drawn ──
const cat = Object.fromEntries(buildCatalog().map(g => [g.sub, g.ids]))
ok(J(cat['Floors']) === J(['goldwood_slab', 'goldwood_slab_wide', 'stone_slab', 'stone_slab_wide', 'upper_floor', 'upper_floor_wide']), `Floors + the upper floors (${cat['Floors']})`)
ok(J(cat['Roofs + ceilings']) === J(['ceiling', 'beam', 'roof_gable_tile', 'roof_gable_turf', 'roof_slope_tile', 'roof_slope_turf', 'roof_flat_tile', 'roof_flat_turf', 'gable_end']), `Roofs + ceilings (${cat['Roofs + ceilings']})`)
ok(J(cat['Chimney']) === J(['chimney']), 'Chimney')
ok(near(UP.top, WALL), 'the wall top is the 4.8 m wall')
for (const id of NEW) {
  const f = FURNITURE[id], b = buildBoxes(f)!, top = Math.max(...b.map(x => x.p[1] + x.s[1] / 2)), K = SCENERY_BY.get(`piece:${id}`)
  ok(K?.group === 'Build' && K.sub === f.build, `${id}: in Creative's Build, ${f.build}`)
  ok(b.length > 0 && Math.abs(top - f.h) < 0.06, `${id}: h ${f.h} is its drawn top ${top.toFixed(3)}`)
  ok(pieceIcon(id).length === b.length * 3, `${id}: an icon from its boxes`)
  ok(f.recipe.length > 0 && f.solid, `${id}: a recipe, solid`)
  ok(raised(f) === (id !== 'chimney'), `${id}: ${id === 'chimney' ? 'stands on the ground' : 'stands on the wall tops'}`)
  if (raised(f)) ok(buildSolids(f)!.every(t => (t.y ?? 0) >= UP.top - UP.beam - 1e-9) && pieceSpan(f)[0] >= UP.top - UP.beam - 1e-9, `${id}: every part up on the wall tops, head room under it`)
}
ok(new Set(NEW.map(id => pieceIcon(id).map(f => f.d + f.fill).join())).size === NEW.length, 'twelve different icons')
ok(FURNITURE.roof_gable_tile.skin === 'tile' && FURNITURE.roof_gable_turf.skin === 'turf' && buildBoxes(FURNITURE.roof_gable_tile)![0].c !== buildBoxes(FURNITURE.roof_gable_turf)![0].c, 'two skins, drawn apart: clay tile and turf')
// each course of a sloped roof is one easy step above the last (the walker's 0.5 m)
for (const id of ['roof_gable_tile', 'roof_slope_tile']) { const s = buildSolids(FURNITURE[id])!.map(t => t.h).sort((a, b) => a - b)
  ok(s.every((h, k) => k === 0 || h - s[k - 1] < 0.5), `${id}: courses under a step apart`) }

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

// 1 a stair up to an upper floor laid on two wall runs: up the stair, onto the floor, stand there; walk under it at the bottom
let wk = plan(base(), 'stair', 0, 0)
wk = plan(wk, 'goldwood_panel_wide', -0.85, -4, 1); wk = plan(wk, 'goldwood_panel_wide', 0.85, -4, 1)   // two walls along z, 1.7 m apart
wk = plan(wk, 'upper_floor', 0, -4)   // ON both walls and touching the stair's top: refused by nothing under it
const S = stand(wk), SB = pieceBoxes(S)
{ const up = go(SB, [0, -1], 10, { x: X, z: Z + 4 }, l => l.pz < Z - 4)
  ok(near(feet(up), FLOOR, 0.03) && up.lc.pz < Z - 3.2 && !up.lc.airborne, `up the stair and onto the upper floor (feet ${feet(up).toFixed(2)}, z ${(up.lc.pz - Z).toFixed(2)})`)
  const still = go(SB, [0, 0], 3, up); ok(near(feet(still), FLOOR, 0.03) && !still.lc.airborne, `she stands there (feet ${feet(still).toFixed(2)})`) }
{ const under = go(SB, [0, 1], 6, { x: X, z: Z - 8 }, l => l.pz > Z - 3.2)   // from beyond, between the walls, under the floor toward the stair
  ok(under.lc.pz > Z - 3.6 && feet(under) < 0.05, `she walks under it on the ground (feet ${feet(under).toFixed(2)}, z ${(under.lc.pz - Z).toFixed(2)})`) }
// without the upper floor, the stair's top drops her: the old 0.3 m wall top
{ const bare = pieceBoxes(stand(plan(plan(plan(base(), 'stair', 0, 0), 'goldwood_panel_wide', -0.85, -4, 1), 'goldwood_panel_wide', 0.85, -4, 1)))
  const r = go(bare, [0, -1], 10, { x: X, z: Z + 4 }, l => l.pz < Z - 4); ok(feet(r) < 1, `no upper floor: off the stair's top she drops (feet ${feet(r).toFixed(2)})`) }

// 2 a ladder against a wall, an upper floor laid on that wall's top behind it: climb, step off, stand on the floor
{ let L = plan(base(), 'ladder', 0, 0); L = plan(L, 'goldwood_panel_wide', 0, -0.25); L = plan(L, 'upper_floor', 0, -1.25)
  const LB = pieceBoxes(stand(L)), up = go(LB, [0, -1], 10, { x: X, z: Z + 2 }, l => !l.onLadder && l.pz < Z - 1.2)
  ok(near(feet(up), FLOOR, 0.03) && up.lc.pz < Z - 0.5 && !up.lc.onLadder && !up.lc.airborne, `up the ladder, onto the upper floor (feet ${feet(up).toFixed(2)}, z ${(up.lc.pz - Z).toFixed(2)})`)
  const still = go(LB, [0, 0], 3, up); ok(near(feet(still), FLOOR, 0.03), `and stands there (feet ${feet(still).toFixed(2)})`) }

// 3 placing: a raised piece clashes only with raised ones; walls, tables and stairs under it are fine; a roof over a room's walls
ok(refuse(wk, 'upper_floor', 0, -4.5) !== null, `a second upper floor over the first: refused (${refuse(wk, 'upper_floor', 0, -4.5)})`)
const sets = (w: Works, item: string, dx: number, dz: number) => canPlacePiece(w, own, item, X + dx, Z + dz, 0).ok   // furniture is set, not planned
ok(sets(stand(wk), 'goldwood_table', 0, -4), 'a table under the upper floor: fine')
ok(refuse(wk, 'roof_gable_tile', 3, -4) === null && refuse(plan(wk, 'roof_gable_tile', 3, -4), 'roof_flat_turf', 3, -4) !== null, 'a roof beside it: fine; a flat roof in the same place: refused')
ok(refuse(base(), 'chimney', 0, 0) === null && !sets({ ...base(), pieces: [{ id: 't', item: 'goldwood_table', x: X, z: Z, q: 0, placedAt: 0 }] }, 'chimney', 0, 0), 'a chimney is on the ground: a table in its place refuses it')
{ const roofed = plan(plan(base(), 'goldwood_panel_wide', 0, -2), 'roof_gable_turf', 0, 0, 1)   // a 2 m section across a wall
  ok(roofed.planned!.length === 2, 'a roof over a wall: fine') }

// 4 spirits walk under them; a chimney is in their way
{ const fp = plotFootprints([{ id: 'u', item: 'upper_floor', x: 0, z: 0, q: 0 }, { id: 'r', item: 'roof_slope_tile', x: 5, z: 0, q: 0 }, { id: 'c', item: 'chimney', x: 10, z: 0, q: 0 }] as any)
  ok(fp.length === 1 && fp[0].id === 'c', `spirits: only the chimney is in their way (${fp.map(f => f.id)})`) }

// 5 plan, pay, build, reload (the stair house)
{ const bill = Object.fromEntries(plannedNeeds(wk.planned).map(c => [c.id, c.n]))
  ok(J(bill) === J({ goldwood_plank: 12 + 3 + 3 + 4 }), `the bill: stair 12 + 2 wide panels 6 + upper floor 4 (${J(bill)})`)
  ok(!buildAll(wk, give(newInv(), 'goldwood_plank', 21).inv, null).ok, 'a plank short: no Build')
  const r = buildAll(wk, give(newInv(), 'goldwood_plank', 22).inv, null); ok(r.ok && r.works.pieces.length === 4 && countOf(r.inv, 'goldwood_plank') === 0, 'Build pays 22, all four stand')
  const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  if (r.ok) { saveWorks(r.works); const back = loadWorks(); ok(back.pieces.some(p => p.item === 'upper_floor') && pieceBoxes(back).some(b => near(b.y1, GROUND_Y + FLOOR) && near(b.y0, GROUND_Y + UP.top)), 'reload: the upper floor stands, up on the wall tops') }
  const roofBill = Object.fromEntries(plannedNeeds(plan(plan(base(), 'roof_gable_tile', 0, 0), 'roof_gable_turf', 3, 0).planned).map(c => [c.id, c.n]))
  ok(J(roofBill) === J({ goldwood_plank: 4, stone_brick: 6, goldwood_bark: 6 }), `a tile and a turf roof bill their skins (${J(roofBill)})`) }

// 6 Creative: the same parts, up in the air
{ const bx = sceneryBoxes([{ id: 'a', k: 'piece:upper_floor', x: X, z: Z, q: 0, s: 1, y: GROUND_Y }] as any)
  ok(bx.length === 1 && near(bx[0].y0, GROUND_Y + UP.top) && near(bx[0].y1, GROUND_Y + FLOOR), `Creative: the upper floor's box is up on the wall tops (${bx[0]?.y0.toFixed(2)}..${bx[0]?.y1.toFixed(2)})`)
  const r = go(bx, [0, -1], 3, { x: X, z: Z + 3 }); ok(r.lc.pz < Z - 1.5 && feet(r) < 0.05, 'Creative: she walks under it') }
// old pieces keep their old boxes: no `y`, from under the floor as before
ok(pieceBoxes(stand(plan(base(), 'goldwood_panel', 0, 0))).every(b => near(b.y0, GROUND_Y - 0.5)), 'old pieces: boxes from the floor as before')

console.log(`build-roofs: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
