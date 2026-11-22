// Run: npx tsx src/app/shimmer/open/ather/plot-bom.test.ts
// Plot BOM (ather/plot-bom.ts, BETA M37 slice 4; Alex 11-20). The pins: a drawn plan is DRAFT (free, not solid); its list is
// planks per metre by wood, a pane per window, floor planks + roof bricks per room m²; Build needs every line (bag + bank),
// spends exactly it and stands the walls; erasing a built piece refunds, a draft refunds nothing; a save from before slice 4
// (no draft, no paid) loads as BUILT and its rooms count as paid; the Stonery's jobs make the new parts from existing items.
import { planRun, runKeys, raze, wallBoxes, adoptWalls, adoptPaid, adoptCarry, findRooms, toggleWindow, toggleDoor, paintWall, paintFloor, type Walls } from './plot-walls'
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
// M50: a wall piece costs AMOUNTS.wallPerM (1.5) planks; a list's line rounds up. W(n) = n pieces' planks
const W = (n: number) => Math.ceil(n * AMOUNTS.wallPerM - 1e-9)
// the list: 18 m of goldwood, a 20 m² room: floor planks + roof bricks
{ const p = planNeeds(plan, {})
  ok(p.pieces === 18 && p.rooms === 1 && need(p.needs, 'goldwood_plank') === W(18) + 20 * AMOUNTS.floorPerM2 && need(p.needs, STONE_BRICK) === 20 * AMOUNTS.roofPerM2, `5x4 room list: ${JSON.stringify(p.needs)}`) }
{ const m = box(3, 3, 'dawnwood'), p = planNeeds(m, {})
  ok(need(p.needs, 'dawnwood_plank') === W(12) && need(p.needs, 'goldwood_plank') === 9 && need(p.needs, STONE_BRICK) === 9, 'each wood pays in its own planks; the floor is goldwood') }
// a window adds a pane on the list; a door adds nothing
{ const w = toggleWindow(plan, 'v,0,1'); ok(w.ok && need(planNeeds(w.walls, {}).needs, CRYSTAL_PANE) === 1, 'a planned window puts one pane on the list')
  const d = toggleDoor(plan, 'h,1,0'); ok(d.ok && need(planNeeds(d.walls, {}).needs, 'goldwood_plank') === W(18) + 20 && !need(planNeeds(d.walls, {}).needs, CRYSTAL_PANE), 'a planned door costs the same planks, no extra')
  ok(d.ok && Object.values(d.walls).every(x => x.draft), 'a door / window keeps the piece a draft') }
// have / need against bag + bank; Build only when every line is there
{ const empty = newInv(0), b0 = billOf(plan, {}, empty, freshBank())
  ok(!b0.ok && !b0.empty && b0.lines.every(l => l.short && l.have === 0), 'nothing on hand: every line short, Build off')
  let inv = give(newInv(0), 'goldwood_plank', W(18) + 20).inv; inv = give(inv, STONE_BRICK, 19).inv
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
    // 11-22: a built piece gives back what it was charged (1.5 planks since M50), not a flat 1: two pieces = 3 planks
    const z = raze(r.walls, r.inv, runKeys({ i: 0, j: 0 }, { i: 2, j: 0 })); ok(z.down === 2 && countOf(z.inv, 'goldwood_plank') === 2 * AMOUNTS.wallPerM, `erasing 2 built pieces refunds what they cost (${countOf(z.inv, 'goldwood_plank')})`)
    // ...and a room that no longer closes gives its floor and roof back
    const rc = reconcile(z.walls, r.paid, z.inv); ok(Object.keys(rc.paid).length === 0 && countOf(rc.inv, 'goldwood_plank') === 2 * AMOUNTS.wallPerM + 20 && countOf(rc.inv, STONE_BRICK) === 20, 'a broken room refunds its floor planks and roof bricks')
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
    const z = raze(w.walls, newInv(0), ['h,0,0']); ok(countOf(z.inv, CRYSTAL_PANE) === 1 && countOf(z.inv, 'goldwood_plank') === 1 && (z.carry.goldwood_plank ?? 0) === 0.5, 'erasing a built window (pre-fix piece: the rate) returns its pane, 1 plank and carries the half') } else ok(false, 'toggleWindow') }
// paint: a plan repaints free
{ const st = planRun({}, ['h,0,0'], 'stucco'), p = paintWall(st, 'h,0,0', '#336699'); ok('walls' in p && p.walls['h,0,0'].tint === '#336699' && p.walls['h,0,0'].draft === true, 'a planned stucco wall paints free and stays a plan') }
// slice 5: brick / stucco walls and floor patterns on the list
{ let m: Walls = {}; for (const [a, b] of [[{ i: 0, j: 0 }, { i: 4, j: 0 }]]) m = planRun(m, runKeys(a, b), 'brick')
  ok(need(planNeeds(m, {}).needs, STONE_BRICK) === W(4), 'a 4 m brick wall costs W(4) Stone Brick')
  const s2 = planRun({}, runKeys({ i: 0, j: 0 }, { i: 3, j: 0 }), 'stucco'); ok(need(planNeeds(s2, {}).needs, 'stucco') === W(3), 'a 3 m stucco wall costs W(3) Stucco')
  const bx = box(3, 2), room = findRooms(bx)[0], tile = paintFloor(undefined, room, 'tile', '#999999')
  const a = planNeeds(bx, {}, tile).needs, b = planNeeds(bx, {}).needs
  ok(need(a, 'goldwood_plank') === W(10) && need(a, STONE_BRICK) === 12, 'a 6 m² tile floor swaps its 6 planks for 6 bricks (+ roof 6)')
  ok(need(b, 'goldwood_plank') === W(10) + 6 && need(b, STONE_BRICK) === 6, 'no floor set = planks, as before')
  const hb = planNeeds(bx, {}, paintFloor(undefined, room, 'herringbone', '#aa8844')).needs; ok(need(hb, 'goldwood_plank') === W(10) + 6, 'herringbone is a wood pattern: planks')
  const fl = paintFloor(undefined, room, 'flagstone', '#777777'), inv = give(newInv(0), 'stone_brick', 40).inv
  const built = buildPlan(bx, {}, give(inv, 'goldwood_plank', W(10)).inv, null, fl); ok(built.ok, 'builds with the pattern\'s materials')
  if (built.ok) { const rc = reconcile({}, built.paid, built.inv, fl); ok(countOf(rc.inv, STONE_BRICK) - countOf(built.inv, STONE_BRICK) === 12, 'a broken flagstone room refunds its stone floor and roof') } }
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
ok(STONE_REFINE.some(j => j.out.id === 'stucco' && j.in[0].id === 'blankstone') && itemDef('stucco').name === 'Stucco', 'the Stonery mixes Stucco from blankstone')
ok(itemDef(STONE_BRICK).name === 'Stone Brick' && itemDef(CRYSTAL_PANE).name === 'Crystal Pane', 'plain names, no proper names')
// ── 11-22: EXACT REFUNDS (raze gave a flat 1 plank a piece while M50 charged 1.5: a keeper lost a third of every wall) ──────
{ const run = (n: number) => planRun({}, runKeys({ i: 0, j: 10 }, { i: n, j: 10 }), 'goldwood')
  const roundTrip = (n: number) => {
    const inv0 = give(newInv(0), 'goldwood_plank', 40).inv, b = buildPlan(run(n), {}, inv0, null)
    if (!b.ok) return null
    const spent = 40 - countOf(b.inv, 'goldwood_plank'), z = raze(b.walls, b.inv, Object.keys(b.walls))
    return { spent, back: countOf(z.inv, 'goldwood_plank') - countOf(b.inv, 'goldwood_plank'), carry: z.carry, paid: Object.values(b.walls).reduce((t, w) => t + (w.paid ?? 0), 0) }
  }
  const r12 = roundTrip(12); ok(!!r12 && r12.spent === 18 && r12.back === 18 && !Object.keys(r12.carry).length, `build 12 / erase 12: 18 spent, 18 back (${JSON.stringify(r12)})`)
  const r1 = roundTrip(1); ok(!!r1 && r1.spent === 2 && r1.back === 2, `build 1 / erase 1: gives back what it charged, 2 (${JSON.stringify(r1)})`)
  for (const n of [1, 2, 3, 5, 7, 11]) { const r = roundTrip(n); ok(!!r && r.back === r.spent && Math.abs(r.paid - r.spent) < 1e-9, `build ${n} / erase ${n}: back ${r?.back} = spent ${r?.spent}, the pieces' paid adds up`) }
  // erase one piece at a time: the halves are CARRIED, never floored away
  { const b = buildPlan(run(12), {}, give(newInv(0), 'goldwood_plank', 40).inv, null)
    if (b.ok) { let walls = b.walls, inv = b.inv, carry: Record<string, number> = {}
      for (const k of Object.keys(b.walls)) { const z = raze(walls, inv, [k], carry); walls = z.walls; inv = z.inv; carry = z.carry }
      ok(countOf(inv, 'goldwood_plank') === 40 && !Object.keys(carry).length, `piece by piece, all 18 come back (${countOf(inv, 'goldwood_plank')} planks, carry ${JSON.stringify(carry)})`) } }
  // a pre-fix piece (no paid) gives back the rate, fractions carried
  { const old = adoptWalls({ 'h,0,0': { mat: 'goldwood' }, 'h,1,0': { mat: 'goldwood' } })
    const a = raze(old, newInv(0), ['h,0,0']); ok(countOf(a.inv, 'goldwood_plank') === 1 && a.carry.goldwood_plank === 0.5, 'a pre-fix piece: 1 now, the half carried')
    const b2 = raze(a.walls, a.inv, ['h,1,0'], a.carry); ok(countOf(b2.inv, 'goldwood_plank') === 3 && !b2.carry.goldwood_plank, 'the next piece completes it: 3 for 2 pieces') }
  // paid survives a save round trip; a draft never carries one
  { const w = adoptWalls(JSON.parse(JSON.stringify({ 'h,0,0': { mat: 'goldwood', paid: 2 }, 'h,1,0': { mat: 'goldwood', draft: true, paid: 9 } })))
    ok(w['h,0,0'].paid === 2 && w['h,1,0'].paid === undefined, 'paid survives the save; a draft carries none') }
  ok(JSON.stringify(adoptCarry({ goldwood_plank: 0.5, x: 2, y: -1, z: 'a' })) === '{"goldwood_plank":0.5}', 'carry loads only real fractions')
}

console.log(`plot-bom: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
