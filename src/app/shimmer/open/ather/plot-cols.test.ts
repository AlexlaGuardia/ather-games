// plot-cols.test (BETA M54): columns on corners. npx tsx src/app/shimmer/open/ather/plot-cols.test.ts
import { COL_T, adoptCols, colBoxes, toggleCol, colStandsOn, colNeeds, draftCols, standCols, paintColumn, colAt, type Cols } from './plot-cols'
import { WALL_T, WALL_H, type Walls } from './plot-walls'
import { billOfAll, buildAll, PER_COL, AMOUNTS } from './plot-bom'
import { withLevel, levelOf, floating, upperBoxes, adoptUpper, type Stacked } from './plot-floors'
import { newInv, give, countOf } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

ok(Math.abs(COL_T - 2 * WALL_T) < 1e-9, 'a column is twice a wall thick')
ok(Math.abs(PER_COL - 2 * AMOUNTS.wallPerM) < 1e-9, 'a column costs 2 m of its wall')

// toggle: empty corner -> draft; draft -> gone; built -> down with a refund; not held -> refused
{
  const a = toggleCol(undefined, 2, 3, 'stucco', true, PER_COL)
  ok(a.ok && a.cols['2,3']?.draft === true && a.cols['2,3'].mat === 'stucco', 'a tap on an empty corner plans a column')
  const b = a.ok ? toggleCol(a.cols, 2, 3, 'stucco', true, PER_COL) : null
  ok(!!b && b.ok && !b.cols['2,3'] && !b.refund, 'a tap on a draft takes it off the plan, nothing back')
  const built: Cols = { '2,3': { mat: 'brick' } }
  const c = toggleCol(built, 2, 3, 'stucco', true, PER_COL)
  ok(c.ok && !c.cols['2,3'] && c.refund?.id === 'stone_brick' && c.refund.n === Math.ceil(PER_COL), 'a built column comes down with its cost back')
  ok(!toggleCol(undefined, 0, 0, 'goldwood', false, PER_COL).ok, 'ground you do not hold is refused')
}

// solids: one box per BUILT column, 0.6 m square, a storey tall from the base
{
  const bx = colBoxes({ '1,1': { mat: 'goldwood' }, '5,5': { mat: 'goldwood', draft: true } }, 2)
  ok(bx.length === 1 && Math.abs(bx[0].x1 - bx[0].x0 - COL_T) < 1e-9 && Math.abs(bx[0].z1 - bx[0].z0 - COL_T) < 1e-9 && Math.abs(bx[0].y1 - (2 + WALL_H)) < 1e-9, 'a built column is a 0.6 m square box a storey tall; a draft is not solid')
}

// adopt: junk dropped, tint only on stucco
{
  const a = adoptCols({ '1,2': { mat: 'stucco', tint: '#AABBCC' }, '3,4': { mat: 'brick', tint: '#ff0000' }, 'x': { mat: 'brick' }, '5,6': { mat: 'gold' }, '7,8': { mat: 'goldwood', draft: true } })
  ok(Object.keys(a).sort().join() === '1,2,3,4,7,8' && a['1,2'].tint === '#aabbcc' && !a['3,4'].tint && a['7,8'].draft === true, `adoptCols keeps the well-formed (${Object.keys(a)})`)
}

// paint: stucco takes it, brick refuses
{
  const c: Cols = { '0,0': { mat: 'stucco' }, '1,0': { mat: 'brick' } }
  const p = paintColumn(c, '0,0', '#336699'); ok('cols' in p && p.cols['0,0'].tint === '#336699', 'a stucco column takes paint')
  ok('why' in paintColumn(c, '1,0', '#336699'), 'a brick column keeps its colour')
  ok(colAt(c, 0.2, -0.3) === '0,0' && colAt(c, 0.7, 0) === '1,0' && colAt(c, 0.45, 0.45) === null, 'a tap near the corner finds the column')
}

// support up a floor: a column below, a wall ending at the corner, or a room touching it
{
  const box = (i0: number, j0: number, i1: number, j1: number): Walls => {
    const w: Record<string, { mat: 'goldwood' }> = {}
    for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
    for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
    return w
  }
  const below = { walls: box(0, 0, 4, 4), cols: { '9,9': { mat: 'goldwood' as const } } }
  ok(colStandsOn(below, '0,0') && colStandsOn(below, '2,2') && colStandsOn(below, '9,9'), 'stands on a wall end, inside a room, on a column below')
  ok(!colStandsOn(below, '7,7'), 'floats over open ground')
  // a stack whose upper column floats is reported
  const w: Stacked = withLevel(withLevel({}, 0, { walls: below.walls }), 1, { walls: {}, cols: { '7,7': { mat: 'goldwood' } } })
  ok(floating(w).includes('1:c7,7'), `floating() reports an upper column with nothing under it (${floating(w)})`)
  const up = upperBoxes(withLevel(withLevel({}, 0, { walls: below.walls }), 1, { walls: {}, cols: { '2,2': { mat: 'goldwood' } } }), 0)
  ok(up.some(b => Math.abs(b.x1 - b.x0 - COL_T) < 1e-9), 'an upper column is solid')
  // a level that holds only columns survives a save round-trip
  const rt = adoptUpper(JSON.parse(JSON.stringify([{ walls: {}, cols: { '2,2': { mat: 'goldwood' } } }])))
  ok(rt.length === 1 && rt[0].cols?.['2,2']?.mat === 'goldwood', 'an upper level with only a column is kept on load')
}

// the bill and Build: drafts are on the list at PER_COL each, Build stands them and spends exactly that
{
  const w: Stacked = { walls: {}, cols: { '1,1': { mat: 'goldwood', draft: true }, '2,1': { mat: 'goldwood', draft: true }, '3,1': { mat: 'brick', draft: true } } }
  ok(draftCols(w.cols) === 3 && colNeeds(w.cols, PER_COL).length === 2, 'two materials on the list')
  const inv = give(give(newInv(0), 'goldwood_plank', 20).inv, 'stone_brick', 20).inv
  const b = billOfAll(w, inv)
  const n = (id: string) => b.lines.find(l => l.id === id)?.n
  ok(b.ok && n('goldwood_plank') === Math.ceil(2 * PER_COL) && n('stone_brick') === Math.ceil(PER_COL), `the bill: ${JSON.stringify(b.lines.map(l => [l.id, l.n]))}`)
  const r = buildAll(w, inv)
  ok(r.ok && Object.values(levelOf(r.works, 0).cols ?? {}).every(c => !c.draft) && countOf(r.inv, 'goldwood_plank') === 20 - Math.ceil(2 * PER_COL) && countOf(r.inv, 'stone_brick') === 20 - Math.ceil(PER_COL), 'Build stands them and spends exactly the list')
  ok(Object.keys(standCols(w.cols)).length === 3, 'standCols keeps every column')
  ok(!buildAll(w, newInv(0)).ok, 'Build refuses with an empty bag')
}

console.log(`plot-cols: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
