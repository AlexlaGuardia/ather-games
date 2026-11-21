// plot-cols-bp.test (BETA M54 leftovers): blueprints carry columns; a column caps a wall joint cleanly.
// npx tsx src/app/shimmer/open/ather/plot-cols-bp.test.ts
import { COL_T, COL_CAP, trimmedRect, colBoxes, type Cols } from './plot-cols'
import { extractBlueprint, parseHouse, placeBlueprint, houseProblems } from './plot-blueprint'
import { edgeRect, WALL_T, WALL_H, type Walls } from './plot-walls'
import { levelBase } from './plot-floors'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const box = (i0: number, j0: number, i1: number, j1: number): Record<string, { mat: 'goldwood' }> => {
  const w: Record<string, { mat: 'goldwood' }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  return w
}

// ── (1) blueprints carry columns ──
{
  const walls: Walls = box(10, 20, 14, 23)                       // a 4 x 3 house at (10..14, 20..23)
  const cols: Cols = { '10,20': { mat: 'brick' }, '14,23': { mat: 'stucco', tint: '#4c6b97' }, '12,20': { mat: 'goldwood', draft: true }, '30,30': { mat: 'brick' } }
  const upCols: Cols = { '11,21': { mat: 'brick' } }
  const bp = extractBlueprint(walls, {}, 'gable', 'h,10,20', 'glade-hazel', 'Test', 1, [{ walls: box(10, 20, 14, 23), cols: upCols }], cols)!
  ok(!!bp.cols && Object.keys(bp.cols).sort().join('|') === '0,0|4,3', `the blueprint keeps the house's built columns, re-based (${Object.keys(bp.cols ?? {}).join('|')})`)
  ok(!bp.cols?.['2,0'] && !bp.cols?.['20,10'], 'a draft column and one outside the footprint stay behind')
  ok(bp.cols?.['4,3']?.tint === '#4c6b97', 'a painted column keeps its paint')
  ok(bp.upper?.[0].cols?.['1,1']?.mat === 'brick', 'an upper floor\'s column comes along, re-based')
  const rt = parseHouse(JSON.parse(JSON.stringify(bp)))
  ok(!!rt && rt.cols?.['0,0']?.mat === 'brick' && rt.upper?.[0].cols?.['1,1']?.mat === 'brick', 'save + load keeps them (ground and upper)')
  ok(houseProblems({ ...bp, cols: { '9,9': { mat: 'brick' } } }).some(p => p.startsWith('cols:')), 'a column outside the footprint is refused by the loader')
  ok(houseProblems({ ...bp, cols: { '1,1': { mat: 'lava' } } }).some(p => p.startsWith('cols:')), 'a malformed column is refused')
  const old = parseHouse(JSON.parse(JSON.stringify({ ...bp, cols: undefined, upper: undefined })))
  ok(!!old && !old.cols, 'a blueprint saved before columns still loads (no columns)')
  // placed on a lot: a solid box at each column, a storey tall; the upper one a storey up
  const pad = { x: 100, z: 50, yaw: 0, y: 2 }, pl = placeBlueprint(bp, pad), at = pl.toWorld(0, 0), up = pl.toWorld(1, 1)
  const cb = pl.boxes.find(b => Math.abs((b.x0 + b.x1) / 2 - at.x) < 1e-6 && Math.abs((b.z0 + b.z1) / 2 - at.z) < 1e-6 && b.x1 - b.x0 >= COL_T - 1e-6)
  ok(!!cb && Math.abs(cb.y1 - (2 + WALL_H)) < 1e-9 && cb.y0 < 2, 'placed: a column is solid at its corner, a storey tall')
  const ub = pl.boxes.find(b => Math.abs((b.x0 + b.x1) / 2 - up.x) < 1e-6 && Math.abs((b.z0 + b.z1) / 2 - up.z) < 1e-6 && Math.abs(b.y1 - (2 + levelBase(1) + WALL_H)) < 1e-9)
  ok(!!ub, 'placed: the upper column stands on floor 2')
  const turned = placeBlueprint(bp, { ...pad, yaw: Math.PI / 4 }), t0 = turned.toWorld(0, 0)
  const tb = turned.boxes.find(b => Math.abs((b.x0 + b.x1) / 2 - t0.x) < 1e-6 && Math.abs((b.z0 + b.z1) / 2 - t0.z) < 1e-6 && Math.abs(b.y1 - (2 + WALL_H)) < 1e-9)
  ok(!!tb && Math.abs(tb.x1 - tb.x0 - COL_T * Math.SQRT2) < 1e-6, `turned 45 degrees, the column box grows to cover the turned square (${tb ? (tb.x1 - tb.x0).toFixed(3) : '-'} m), no more`)
  // and the (fixed) wall height: blueprint walls are WALL_H tall, not the old 3.2
  const wallSample = pl.boxes.filter(b => b.x1 - b.x0 < COL_T - 0.05 && b.y0 < 2)   // the ground walls' small samples (not the columns)
  ok(wallSample.length > 0 && wallSample.every(b => Math.abs(b.y1 - (2 + WALL_H)) < 1e-9 || b.y0 > 2), `blueprint ground walls collide to the full wall height (${wallSample[0]?.y1.toFixed(2)})`)
}

// ── (2) a column caps a wall joint ──
{
  const cols: Cols = { '0,0': { mat: 'brick' } }
  const a = trimmedRect('h,0,0', cols), full = edgeRect('h,0,0')
  ok(Math.abs(a.x0 - COL_T / 2) < 1e-9 && a.x1 === full.x1, `a wall ending at a column stops at the column's face (x0 ${a.x0}, face ${COL_T / 2}; the far end untouched)`)
  const v = trimmedRect('v,0,0', cols)
  ok(Math.abs(v.z0 - COL_T / 2) < 1e-9 && v.x0 === -WALL_T / 2, 'the other wall of the L stops at the face too')
  const v2 = trimmedRect('v,0,-1', cols)
  ok(Math.abs(v2.z1 - -COL_T / 2) < 1e-9, 'a wall coming in from the other side stops at the near face')
  // the wall's footprint never reaches into the column's square: nothing inside it to show through
  const inside = (r: { x0: number; x1: number; z0: number; z1: number }) => r.x0 < COL_T / 2 - 1e-9 && r.x1 > -COL_T / 2 + 1e-9 && r.z0 < COL_T / 2 - 1e-9 && r.z1 > -COL_T / 2 + 1e-9
  ok(![a, v, v2].some(inside), 'no trimmed wall overlaps the column square')
  ok(inside(full), '(control: untrimmed, the wall runs into the column)')
  ok(trimmedRect('h,3,0', cols).x0 === edgeRect('h,3,0').x0, 'a wall with no column at its ends is drawn whole')
  ok(COL_CAP > 0.02 && COL_CAP < 0.2, `the column stands ${COL_CAP} m proud of the wall top (its top never shares the wall's plane)`)
  ok(colBoxes(cols, 0)[0].y1 === WALL_H, 'the solid column is still exactly a storey (the cap is a look, not a ledge)')
}

console.log(`plot-cols-bp: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
