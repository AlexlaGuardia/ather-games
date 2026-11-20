// Run: npx tsx src/app/shimmer/open/ather/plot-bom.test.ts
// Plot BOM (ather/plot-bom.ts, BETA M37 slice 4; Alex 11-20). The pins: a drawn plan is DRAFT (free, not solid); its list is
// planks per metre by wood, a pane per window, floor planks + roof bricks per room m²; Build needs every line (bag + bank),
// spends exactly it and stands the walls; erasing a built piece refunds, a draft refunds nothing; a save from before slice 4
// (no draft, no paid) loads as BUILT and its rooms count as paid; the Stonery's jobs make the new parts from existing items.
import { planRun, runKeys, raze, wallBoxes, adoptWalls, adoptPaid, findRooms, toggleWindow, toggleDoor, paintWall, type Walls } from './plot-walls'
import { billOf, buildPlan, planNeeds, reconcile, paneFor, STONE_BRICK, CRYSTAL_PANE, AMOUNTS } from './plot-bom'
import { STONE_REFINE, REFINE } from './furniture'
import { newInv, give, countOf, itemDef } from '../shared/inventory'
import { freshBank, putIn } from './garden-bank'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const box = (w: number, d: number, mat: 'goldwood' | 'dawnwood' = 'goldwood'): Walls => {
  let ws: Walls = {}
  for (const [a, b] of [[{ i: 0, j: 0 }, { i: w, j: 0 }], [{ i: 0, j: d }, { i: w, j: d }], [{ i: 0, j: 0 }, { i: 0, j: d }], [{ i: w, j: 0 }, { i: w, j: d }]]) ws = planRun(ws, runKeys(a, b), mat)
  return ws
}
const need = (n: { id: string; n: number }[], id: string) => n.find(x => x.id === id)?.n ?? 0

// a plan is draft: free, not solid, not built
const plan = box(5, 4)
ok(Object.values(plan).every(w => w.draft === true) && Object.keys(plan).length === 18, 'a drawn run is a plan: every piece draft')
ok(wallBoxes(plan, 0).length === 0, 'a draft wall is not solid to the walker')
// the list: 18 m of goldwood, a 20 m² room: floor planks + roof bricks
{ const p = planNeeds(plan, {})
  ok(p.pieces === 18 && p.rooms === 1 && need(p.needs, 'goldwood_plank') === 18 * AMOUNTS.wallPerM + 20 * AMOUNTS.floorPerM2 && need(p.needs, STONE_BRICK) === 20 * AMOUNTS.roofPerM2, `5x4 room list: ${JSON.stringify(p.needs)}`) }
{ const m = box(3, 3, 'dawnwood'), p = planNeeds(m, {})
  ok(need(p.needs, 'dawnwood_plank') === 12 && need(p.needs, 'goldwood_plank') === 9 && need(p.needs, STONE_BRICK) === 9, 'each wood pays in its own planks; the floor is goldwood') }
// a window adds a pane on the list; a door adds nothing
{ const w = toggleWindow(plan, 'v,0,1'); ok(w.ok && need(planNeeds(w.walls, {}).needs, CRYSTAL_PANE) === 1, 'a planned window puts one pane on the list')
  const d = toggleDoor(plan, 'h,1,0'); ok(d.ok && need(planNeeds(d.walls, {}).needs, 'goldwood_plank') === 38 && !need(planNeeds(d.walls, {}).needs, CRYSTAL_PANE), 'a planned door costs the same planks, no extra')
  ok(d.ok && Object.values(d.walls).every(x => x.draft), 'a door / window keeps the piece a draft') }
// have / need against bag + bank; Build only when every line is there
{ const empty = newInv(0), b0 = billOf(plan, {}, empty, freshBank())
  ok(!b0.ok && !b0.empty && b0.lines.every(l => l.short && l.have === 0), 'nothing on hand: every line short, Build off')
  let inv = give(newInv(0), 'goldwood_plank', 38).inv; inv = give(inv, STONE_BRICK, 19).inv
  ok(!billOf(plan, {}, inv, freshBank()).ok, 'one brick short: Build off')
  const bank = putIn(freshBank(), 30, STONE_BRICK, 1).bank
  ok(billOf(plan, {}, inv, bank).ok, 'the Keepstone counts with the bag: Build on')
  const r = buildPlan(plan, {}, inv, bank)
  ok(r.ok && Object.values(r.walls).every(x => !x.draft) && Object.keys(r.paid).length === 1 && r.paid[Object.keys(r.paid)[0]] === 20, 'Build: walls stand, the room is paid')
  if (r.ok) {
    ok(countOf(r.inv, 'goldwood_plank') === 0 && countOf(r.inv, STONE_BRICK) + (r.bank?.stacks.reduce((a, s) => a + (s.id === STONE_BRICK ? s.n : 0), 0) ?? 0) === 0, 'Build spends exactly the list')
    ok(wallBoxes(r.walls, 0).length === 18, 'built walls are solid')
    ok(billOf(r.walls, r.paid, r.inv, r.bank).empty, 'once built, the list is empty')
    // erase refunds a built piece
    const z = raze(r.walls, r.inv, runKeys({ i: 0, j: 0 }, { i: 2, j: 0 })); ok(z.down === 2 && countOf(z.inv, 'goldwood_plank') === 2, 'erasing a built piece refunds its plank')
    // ...and a room that no longer closes gives its floor and roof back
    const rc = reconcile(z.walls, r.paid, z.inv); ok(Object.keys(rc.paid).length === 0 && countOf(rc.inv, 'goldwood_plank') === 22 && countOf(rc.inv, STONE_BRICK) === 20, 'a broken room refunds its floor planks and roof bricks')
    const still = reconcile(r.walls, r.paid, r.inv); ok(Object.keys(still.paid).length === 1 && still.back.length === 0, 'a standing room refunds nothing') }
  const no = buildPlan(plan, {}, give(newInv(0), 'goldwood_plank', 38).inv, freshBank()); ok(!no.ok, 'short: Build spends nothing and says so') }
// a draft refunds nothing
{ const i0 = newInv(0), z = raze(plan, i0, runKeys({ i: 0, j: 0 }, { i: 5, j: 0 })); ok(z.down === 5 && JSON.stringify(z.inv) === JSON.stringify(i0), 'erasing a plan gives nothing back (nothing was spent)') }
// built windows: pane paid at the cut, back at the fill-in, back on erase
{ const built: Walls = adoptWalls({ 'h,0,0': { mat: 'goldwood' } })
  const w = toggleWindow(built, 'h,0,0'); if (w.ok) {
    const none = paneFor(built, w.walls, 'h,0,0', newInv(0), freshBank()); ok('why' in none, 'a window in a built wall needs a pane on hand')
    const inv = give(newInv(0), CRYSTAL_PANE, 1).inv, pay = paneFor(built, w.walls, 'h,0,0', inv, freshBank()); ok(!('why' in pay) && countOf(pay.inv, CRYSTAL_PANE) === 0, 'the pane is spent at the cut')
    const back = toggleWindow(w.walls, 'h,0,0'); if (back.ok) { const g = paneFor(w.walls, back.walls, 'h,0,0', newInv(0), null); ok(!('why' in g) && countOf(g.inv, CRYSTAL_PANE) === 1, 'filling the window in returns the pane') }
    const z = raze(w.walls, newInv(0), ['h,0,0']); ok(countOf(z.inv, CRYSTAL_PANE) === 1 && countOf(z.inv, 'goldwood_plank') === 1, 'erasing a built window returns plank and pane') } else ok(false, 'toggleWindow') }
// paint: a plan repaints free
{ const p = paintWall(plan, newInv(0), 'h,1,0', 'dawnwood'); ok('walls' in p && p.walls['h,1,0'].mat === 'dawnwood' && p.walls['h,1,0'].draft === true, 'a plan repaints free and stays a plan') }
// GRANDFATHER: a pre-slice-4 save loads built, its room paid, nothing on the list
{ const old = JSON.parse(JSON.stringify({ 'h,0,0': { mat: 'goldwood' }, 'h,1,0': { mat: 'goldwood' }, 'h,0,1': { mat: 'goldwood' }, 'h,1,1': { mat: 'goldwood' }, 'v,0,0': { mat: 'goldwood' }, 'v,2,0': { mat: 'goldwood' } }))
  const ws = adoptWalls(old), paid = adoptPaid(undefined, ws)
  ok(Object.values(ws).every(w => !w.draft) && wallBoxes(ws, 0).length === 6, 'a pre-slice-4 wall is built and solid')
  ok(findRooms(ws).length === 1 && paid[findRooms(ws)[0].key] === 2, 'a pre-slice-4 room is paid (grandfathered)')
  ok(billOf(ws, paid, newInv(0), null).empty, 'a pre-slice-4 house puts nothing on the list')
  ok(adoptWalls(JSON.parse(JSON.stringify(plan)))['h,1,0'].draft === true, 'a saved plan keeps its draft flag')
  ok(Object.keys(adoptPaid({ a: 4, b: -1, c: 'x' }, ws)).join() === 'a', 'a saved paid map keeps only real areas') }
// the Stonery makes the new parts from items that exist, and the parts are real bag rows
for (const j of STONE_REFINE) {
  ok(j.in.every(c => itemDef(c.id).name !== c.id && itemDef(c.id).name.length > 0) && itemDef(j.out.id).name !== j.out.id, `Stonery job ${j.id}: input and output are real items`)
  ok(!REFINE.some(r => r.id === j.id), `Stonery job ${j.id} does not shadow a Carpentry job`)
}
ok(itemDef(STONE_BRICK).name === 'Stone Brick' && itemDef(CRYSTAL_PANE).name === 'Crystal Pane', 'plain names, no proper names')
console.log(`plot-bom: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
