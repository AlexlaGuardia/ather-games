// Run: npx tsx src/app/shimmer/open/ather/plot-floors.test.ts
// Plot floors (ather/plot-floors.ts, BETA M47 slice 1). The pins: an old save is ONE level, unchanged; levels round-trip
// through JSON save/load; a wall on level k must stand on a wall or a room cell of level k-1 (a floating wall is refused);
// the slab costs like a floor (no roof bill) and the whole stack builds in one go, spending every level's draft; the roof
// is the top level's; an upper level stands one storey up with a slab the walker can stand on; blueprints carry levels.
import { planRun, runKeys, adoptWalls, adoptPaid, findRooms, type Walls } from './plot-walls'
import { levelsOf, levelOf, withLevel, levelCount, adoptUpper, standsOn, canStack, floating, topLevel, slabCells, upperBoxes, levelBase, STOREY, SLAB_T, type Stacked } from './plot-floors'
import { billOfAll, buildAll, AMOUNTS } from './plot-bom'
import { extractBlueprint, parseHouse } from './plot-blueprint'
import { newInv, give, countOf } from '../shared/inventory'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const box = (x0: number, z0: number, w: number, d: number, draft = true): Walls => {
  let ws: Walls = {}
  for (const [a, b] of [[{ i: x0, j: z0 }, { i: x0 + w, j: z0 }], [{ i: x0, j: z0 + d }, { i: x0 + w, j: z0 + d }], [{ i: x0, j: z0 }, { i: x0, j: z0 + d }], [{ i: x0 + w, j: z0 }, { i: x0 + w, j: z0 + d }]]) ws = planRun(ws, runKeys(a, b), 'goldwood')
  if (!draft) ws = Object.fromEntries(Object.entries(ws).map(([k, v]) => [k, { mat: v.mat }]))
  return ws
}
const bag = (n: number) => { let inv = newInv(); inv = give(inv, 'goldwood_plank', n).inv; inv = give(inv, 'stone_brick', n).inv; return inv }

// an old save is one level
{ const old: Stacked = { walls: box(0, 0, 4, 3, false) }
  ok(levelCount(old) === 1 && levelsOf(old).length === 1 && levelOf(old, 0).walls === old.walls, 'an old save (no upper) is ONE level, the same walls')
  ok(adoptUpper(undefined).length === 0 && adoptUpper(null).length === 0 && adoptUpper('x').length === 0, 'no upper in the save: no levels above')
  ok(topLevel(old) === 0 && floating(old).length === 0 && upperBoxes(old, 0).length === 0, 'one level: roof on level 0, nothing floats, no upper solids')
  ok(JSON.stringify(withLevel(old, 0, levelOf(old, 0))) === JSON.stringify({ ...old, floors: undefined, paid: undefined }), 'writing level 0 back changes nothing') }

// the support rule
const g0 = box(0, 0, 4, 3, false)
ok(standsOn(g0, 'h,0,0') && standsOn(g0, 'v,4,1'), 'a wall stands on the wall below')
ok(standsOn(g0, 'h,1,1') && standsOn(g0, 'v,2,2'), 'a wall stands over a cell of a room below')
ok(!standsOn(g0, 'h,10,10') && !standsOn(g0, 'h,0,5'), 'a wall over open ground floats')
ok(!canStack(g0, ['h,1,1', 'h,10,10']).ok && canStack(g0, ['h,1,1', 'h,2,1']).ok, 'canStack refuses a run that has a floating piece')
ok(!canStack({}, ['h,0,0']).ok && !canStack(undefined, ['h,0,0']).ok, 'nothing below, nothing to stand on')
// a draft room below also holds the floor above (plan on plan)
ok(standsOn(box(0, 0, 4, 3, true), 'h,1,1'), 'a planned room below supports a planned floor above')

// a two-storey house, built
const up1 = box(0, 0, 4, 3)                 // a floor-2 room right over the ground room
let w: Stacked = { walls: box(0, 0, 4, 3), upper: [{ walls: up1 }] }
ok(levelCount(w) === 2 && topLevel(w) === 1 && floating(w).length === 0, 'two levels, the roof belongs to level 1, nothing floats')
{ const b = billOfAll(w, bag(200)); const pl = (id: string) => b.lines.find(l => l.id === id)?.n ?? 0
  // ground: 14 wall + 12 floor planks + 12 roof bricks; upper: 14 wall + 12 slab planks, NO roof bricks
  ok(pl('goldwood_plank') === 14 + 12 + 14 + 12 && pl('stone_brick') === 12, `bill: planks 52, bricks 12 (ground roof only); got ${JSON.stringify(b.lines.map(l => [l.id, l.n]))}`)
  ok(b.pieces === 28 && b.rooms === 2 && b.ok, 'the list counts both levels\' pieces and rooms') }
{ const r = buildAll(w, bag(10)); ok(!r.ok, 'a short bag builds nothing') }
{ const inv = bag(200), r = buildAll(w, inv)
  ok(r.ok, 'Build spends both levels')
  if (r.ok) {
    const lv = levelsOf(r.works)
    ok(Object.values(lv[0].walls).every(x => !x.draft) && Object.values(lv[1].walls).every(x => !x.draft), 'every draft on both levels stands')
    ok(Object.keys(lv[0].paid ?? {}).length === 1 && Object.keys(lv[1].paid ?? {}).length === 1, 'both rooms are paid')
    ok(countOf(r.inv, 'goldwood_plank') === 200 - 52 && countOf(r.inv, 'stone_brick') === 200 - 12, 'spent exactly the list (52 planks, 12 bricks)')
    ok(buildAll(r.works, r.inv).ok === false, 'nothing left to build afterwards')
    // slab + solids
    ok(slabCells(lv[1]).length === 12 && slabCells({ walls: lv[1].walls }).length === 0, 'the slab covers the built room\'s 12 cells (none while it is only a plan)')
    const bx = upperBoxes(r.works, 0), slab = bx.filter(b => b.y1 === levelBase(1))
    ok(slab.length === 12 && slab.every(b => Math.abs(b.y1 - b.y0 - SLAB_T) < 1e-9), `12 slab boxes, ${SLAB_T} m thick, top at one storey (${levelBase(1)})`)
    ok(Math.abs(STOREY - 3.4) < 1e-9 && bx.length === 12 + 14, 'plus the 14 upper wall boxes')
  }
}
// erasing the support floats the floor above: floating() sees it
{ const g = withLevel(w, 0, { walls: {} })
  ok(floating(g).length === 14, 'with the ground floor gone, all 14 upper pieces float (the erase handler refuses on this)') }
// the roof is the top level's
ok(topLevel({ walls: g0, upper: [{ walls: {} }] }) === 0, 'an empty upper level is not a level')

// save / load round trip
{ const rt = JSON.parse(JSON.stringify(w)) as Stacked
  const up = adoptUpper(rt.upper)
  ok(up.length === 1 && Object.keys(up[0].walls).length === 14 && Object.values(up[0].walls).every(x => x.draft), 'levels round-trip through JSON: pieces and draft flags kept')
  const r = buildAll(w, bag(200)); if (r.ok) { const back = adoptUpper(JSON.parse(JSON.stringify(r.works)).upper); ok(Object.keys(back[0].paid ?? {}).length === 1, 'the upper level\'s paid rooms round-trip too') }
  ok(adoptUpper([{ walls: { 'h,0,0': { mat: 'nope' } } }, 5]).length === 0, 'malformed levels are dropped')
  ok(adoptUpper(Array(9).fill({ walls: g0 })).length === 2, 'at most 3 levels in all (2 above the ground)') }
ok(findRooms(up1).length === 1 && AMOUNTS.floorPerM2 === 1, 'sanity: one room, 1 plank per m²')

// blueprints carry levels
{ const bp = extractBlueprint(g0, undefined, 'gable', 'h,0,0', 'glade-x', 'X', 1, [{ walls: box(0, 0, 4, 3, false) }])
  ok(!!bp && bp.upper?.length === 1 && Object.keys(bp.upper[0].walls).length === 14, 'a blueprint extracted with a level above carries it')
  const one = extractBlueprint(g0, undefined, 'gable', 'h,0,0', 'glade-x', 'X', 1)
  ok(!!one && one.upper === undefined, 'a single-storey blueprint has no upper key (same shape as before)')
  const back = bp ? parseHouse(JSON.parse(JSON.stringify(bp))) : null
  ok(!!back && back.upper?.length === 1 && Object.keys(back.upper[0].walls).length === 14, 'a blueprint with levels round-trips through parse')
  ok(!!one && parseHouse(JSON.parse(JSON.stringify(one)))?.upper === undefined, 'an old blueprint parses with no upper') }
void adoptWalls; void adoptPaid
console.log(`plot-floors: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
