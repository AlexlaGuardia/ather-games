// BETA M138 + M142: cancel / edit a plan, and the plan-mode grid. Run: npx tsx src/app/shimmer/open/ather/plan-draft.test.ts
import { cancelPlan, hasDraft, draftsByLevel, planSpot, draftKeys } from './plan-draft'
import { gridLines, gridSig, raisedCells, isSquareEdge, GRID_UP, GRID_STRONG } from './plan-grid'
import { findRooms, planRun, runKeys, type Walls } from './plot-walls'
import { billOfAll, buildAll } from './plot-bom'
import { newInv, give } from '../shared/inventory'
import { GRID_HALF, GROUND_Y, SQ, STARTING_SQUARES, sqId } from './plot'
import { levelBase } from './plot-floors'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify
const box = (x0: number, z0: number, n: number, mat = 'goldwood'): Walls => { const o: Record<string, any> = {}; for (let x = x0; x < x0 + n; x++) { o[`h,${x},${z0}`] = { mat }; o[`h,${x},${z0 + n}`] = { mat } } for (let z = z0; z < z0 + n; z++) { o[`v,${x0},${z}`] = { mat }; o[`v,${x0 + n},${z}`] = { mat } } return o }
const draft = (m: Walls): Walls => Object.fromEntries(Object.entries(m).map(([k, w]) => [k, { ...w, draft: true as const }]))
const house = { ...box(0, 0, 4), 'h,1,0': { mat: 'goldwood' as const, kind: 'door' as const, paid: 1.5 }, 'v,0,1': { mat: 'stucco' as const, tint: '#b5543c', paid: 1.6 } }
const built = { v: 1, rooms: [], chests: [], pieces: [{ id: 'p1', item: 'x' }], walls: house, floors: { '0,0': { pat: 'planks', col: '#ffffff' } }, paid: { [findRooms(house)[0].key]: 16 }, cols: { '0,0': { mat: 'goldwood' } }, stairs: { '1,1': { mat: 'goldwood', dir: 0 } }, decks: { '9,9': { pat: 'planks', col: '#aaaaaa' } }, upper: [{ walls: box(0, 0, 4), paid: { [findRooms(box(0, 0, 4))[0].key]: 16 } }], wallCarry: { goldwood_plank: 0.5 }, roof: 'hip' } as any
// nothing planned = the very same save
ok(!hasDraft(built) && cancelPlan(built) === built && planSpot(built, 0) === null, 'nothing planned: cancel is the same object')
// a plan of every kind on every level
const plan = { ...built, walls: { ...built.walls, ...draft(box(4, 0, 4)), ...draft({ 'v,2,1': { mat: 'goldwood' } } as any) }, cols: { ...built.cols, '8,8': { mat: 'goldwood', draft: true } }, stairs: { ...built.stairs, '5,1': { mat: 'goldwood', dir: 1, draft: true } }, decks: { ...built.decks, '10,9': { pat: 'planks', col: '#aaaaaa', draft: true } }, pieces: [...built.pieces, { id: 'p2', item: 'slab', draft: true }],
  upper: [{ ...built.upper[0], walls: { ...built.upper[0].walls, 'v,1,1': { mat: 'goldwood', kind: 'rail', draft: true } } }, { walls: draft(box(0, 0, 2)) }] } as any
// (box(4,0,4) shares no edge with the house but its west wall: those keys stay the draft's only where the house has none)
for (const k of Object.keys(house)) plan.walls[k] = (house as any)[k]
ok(hasDraft(plan) && draftsByLevel(plan).length === 3 && draftsByLevel(plan).every(n => n > 0), `drafts on every level (${draftsByLevel(plan)})`)
const back = cancelPlan(plan)
ok(J(back) === J({ ...built, upper: built.upper }), 'cancel = the save as it was before the plan, to the byte')
ok(!hasDraft(back) && plan.walls['v,2,1'].draft, 'the old works object is not changed')
ok(J(back.paid) === J(built.paid) && back.upper.length === 1, 'paid rooms stand, the planned storey is gone')
// cancel then Build asks nothing; plan again and it costs what it did
let inv = newInv(); inv = give(inv, 'goldwood_plank', 64).inv
ok(billOfAll(back, inv, null).empty && !buildAll(back, inv, null).ok, 'nothing left to pay')
const one = { walls: planRun({}, runKeys({ i: 0, j: 0 }, { i: 4, j: 0 }), 'goldwood') } as any
const edited = { walls: { ...one.walls } } as any; for (const k of draftKeys(edited.walls, ['h,3,0'])) delete edited.walls[k]
const c4 = billOfAll(one, inv, null).lines[0].n, c3 = billOfAll(edited, inv, null).lines[0].n
ok(c4 === 6 && c3 === 5, `edit one metre out: ${c4} -> ${c3} planks`)
const b = buildAll(edited, inv, null); ok(b.ok && Object.keys((b as any).works.walls).length === 3, 'Build builds the edited plan')
ok(J(draftKeys(plan.walls, ['h,0,0', 'v,2,1', 'h,99,99'])) === J(['v,2,1']), 'an edit only takes out planned pieces')
// where Edit goes
ok(planSpot(plan, 1)!.level === 1 && planSpot(plan, 1)!.x === 1 && planSpot(plan, 1)!.z === 1.5, 'Edit stays on this floor when it has a plan, over it')
const up = { ...built, upper: [...built.upper, { walls: draft(box(0, 0, 2)) }] } as any; ok(planSpot(up, 0)!.level === 2, 'else it goes to the floor that has one')
// ── M142 ──
const own = new Set(STARTING_SQUARES), plain = gridLines(own, 0, new Map())
const each = (L: typeof plain) => Array.from({ length: L.segments }, (_, s) => L.pos.slice(s * 6, s * 6 + 6))
const inOwned = (x: number, z: number) => { const e = 1e-3; return [[e, e], [-e, e], [e, -e], [-e, -e]].some(([dx, dz]) => own.has(sqId(Math.floor((x + dx + GRID_HALF) / SQ), Math.floor((z + dz + GRID_HALF) / SQ)))) }
ok(each(plain).every(s => inOwned((s[0] + s[3]) / 2, (s[2] + s[5]) / 2) && inOwned(s[0], s[2]) && inOwned(s[3], s[5])), 'every line on owned ground, none on the mist')
ok(each(plain).every(s => Number.isInteger(s[0]) && Number.isInteger(s[2])), 'lines on whole metres')
const len = each(plain).reduce((a, s) => a + Math.abs(s[3] - s[0]) + Math.abs(s[5] - s[2]), 0), sq = own.size, want = (() => { const E = new Set<string>(); for (const id of own) { const [i, j] = id.split(',').map(Number); for (let a = 0; a < SQ; a++) for (let l = 0; l <= SQ; l++) { E.add(`v${i * SQ + l},${j * SQ + a}`); E.add(`h${i * SQ + a},${j * SQ + l}`) } } return E.size })()
ok(len === want, `every metre edge once: ${len} of ${want} (${sq} squares)`)
ok(plain.segments < want / 10, `merged: ${plain.segments} segments`)
const strong = each(plain).filter((_, n) => plain.alpha[n * 2] === GRID_STRONG); ok(strong.length > 0 && strong.every(s => isSquareEdge(s[0] === s[3] ? s[0] : s[2])) && isSquareEdge(-GRID_HALF) && !isSquareEdge(-GRID_HALF + 1), 'strong lines = garden-square edges')
ok(plain.alpha.every((a, n) => (a === GRID_STRONG) === isSquareEdge(plain.pos[(n - n % 2) * 3] === plain.pos[(n - n % 2) * 3 + 3] ? plain.pos[n * 3] : plain.pos[n * 3 + 2])), 'no faint line on a square edge')
ok(each(plain).every(s => s[1] === GROUND_Y + GRID_UP) && each(gridLines(own, 2, new Map())).every(s => s[1] === GROUND_Y + levelBase(2) + GRID_UP), 'on the plan level')
// a raised house lifts its own cells' lines
const lifted = { ...built, foundCells: Object.fromEntries(Array.from({ length: 16 }, (_, n) => [`${n % 4},${n >> 2}`, 1.2])) } as any, r = raisedCells(lifted, 0)
ok(r.get('2,2') === 1.2 && !r.has('8,8'), 'raised cells = the house')
{ const all = new Set<string>(); for (let j = 0; j < 15; j++) for (let i = 0; i < 15; i++) all.add(sqId(i, j)); const g = each(gridLines(all, 0, r)); const at = (x0: number, z: number) => g.find(s => s[2] === z && s[5] === z && s[0] <= x0 && s[3] > x0)![1] - GROUND_Y - GRID_UP
  ok(Math.abs(at(2, 2) - 1.2) < 1e-9 && Math.abs(at(8, 2)) < 1e-9 && Math.abs(at(2, 4) - 1.2) < 1e-9, 'lines ride the raised floor, its rim too') }
ok(gridSig(own, 0, r) === gridSig(new Set([...own].reverse()), 0, new Map([...r].reverse())) && gridSig(own, 0, r) !== gridSig(own, 1, r) && gridSig(own, 0, r) !== gridSig(own, 0, new Map()), 'rebuilt only when ground, level or raised floors change')
console.log(`plan-draft: ${pass} passed, ${fails.length} failed`); for (const f of fails) console.log('  x ' + f); if (fails.length) process.exit(1)
