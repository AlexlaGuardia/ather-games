// plot-decks.test (BETA M56 (a)): free floors (patios) + balconies. npx tsx src/app/shimmer/open/ather/plot-decks.test.ts
import { DECK_T, DECK_SLAB_T, CANTILEVER, MAX_DECK_DRAG, deckRect, adoptDecks, directSupport, supported, planDecks, eraseDecks, deckNeeds, deckBoxes, deckFloating, standDecks, type Decks } from './plot-decks'
import { SLAB_T, STOREY, withLevel, upperBoxes, floating, canStack, adoptUpper, type Stacked } from './plot-floors'
import { billOfAll, buildAll } from './plot-bom'
import { findRooms, FLOOR_PATS, type Walls } from './plot-walls'
import { terrainWorld } from '../terrain-world'
import { createLoco, tickLocomotion, type LocoInput } from '../shared/locomotion'
import { newInv, give, countOf } from '../shared/inventory'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const input = (o: Partial<LocoInput> = {}): LocoInput => ({ mvX: 0, mvZ: 0, fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, jumpKey: false, crouchKey: false, dt: 1 / 60, ...o })
const box = (i0: number, j0: number, i1: number, j1: number): Walls => {
  const w: Record<string, { mat: 'goldwood' }> = {}
  for (let i = i0; i < i1; i++) { w[`h,${i},${j0}`] = { mat: 'goldwood' }; w[`h,${i},${j1}`] = { mat: 'goldwood' } }
  for (let j = j0; j < j1; j++) { w[`v,${i0},${j}`] = { mat: 'goldwood' }; w[`v,${i1},${j}`] = { mat: 'goldwood' } }
  return w
}
const any = () => null

ok(DECK_SLAB_T === SLAB_T, 'the deck slab mirror agrees with plot-floors')
ok(DECK_T > 0 && DECK_T <= 0.5, `a patio (${DECK_T} m) is a step up, under the 0.5 m step rule`)
ok(deckRect([0, 0], [2, 1]).length === 6 && deckRect([2, 1], [0, 0]).length === 6, 'a drag covers its rectangle either way round')
ok(deckRect([0, 0], [50, 0]).length === MAX_DECK_DRAG, `a side is capped at ${MAX_DECK_DRAG} m`)

// ── plan / BOM / build / erase ──
{
  const a = planDecks({}, deckRect([0, 0], [3, 2]), 'tile', '#B9B2A6', any)
  ok(a.ok && a.n === 12 && Object.values(a.decks).every(d => d.draft && d.pat === 'tile' && d.col === '#b9b2a6'), 'a drag plans 12 m² of tile, free to draw')
  ok(a.ok && deckNeeds(a.decks)[0]?.id === 'stone_brick' && deckNeeds(a.decks)[0].n === 12, 'a tile floor lists 1 stone brick per m² (a room floor\'s rate)')
  ok(!planDecks({}, [[0, 0]], 'planks', 'nope', any).ok, 'a bad colour is refused')
  ok(!planDecks({}, [[0, 0], [5, 5]], 'planks', '#d2a157', (i) => (i === 5 ? 'Build on ground you hold.' : null)).ok, 'one bad cell refuses the whole drag')
  if (a.ok) {
    ok(!planDecks(a.decks, [[0, 0]], 'planks', '#d2a157', any).ok, 'drawing over floor already down is refused')
    const w: Stacked = { walls: {}, decks: a.decks }, inv = give(newInv(0), 'stone_brick', 20).inv
    const b = billOfAll(w, inv)
    ok(b.ok && b.lines.length === 1 && b.lines[0].id === 'stone_brick' && b.lines[0].n === 12, `the plan's list: ${JSON.stringify(b.lines.map(l => [l.id, l.n]))}`)
    const r = buildAll(w, inv)
    ok(r.ok && Object.values((r.works as Stacked).decks ?? {}).every(d => !d.draft) && countOf(r.inv, 'stone_brick') === 8, 'Build lays it and spends exactly the list')
    if (r.ok) {
      const e = eraseDecks((r.works as Stacked).decks, [[0, 0], [1, 0]], r.inv)
      ok(e.up === 2 && countOf(e.inv, 'stone_brick') === 10 && Object.keys(e.decks).length === 10, 'taking 2 built m² up gives their 2 bricks back')
      ok(billOfAll(r.works as Stacked, newInv(0)).empty, 'a built floor costs nothing more')
    }
    const e2 = eraseDecks(a.decks, [[0, 0]], newInv(0)); ok(e2.up === 1 && countOf(e2.inv, 'stone_brick') === 0, 'a planned cell just goes (nothing spent, nothing back)')
  }
  const ad = adoptDecks(JSON.parse(JSON.stringify({ '1,2': { pat: 'herringbone', col: '#C08A4E' }, '3,4': { pat: 'lava', col: '#ffffff' }, 'x': { pat: 'tile', col: '#ffffff' }, '5,6': { pat: 'tile', col: '#ffffff', draft: true } })))
  ok(Object.keys(ad).sort().join('|') === '1,2|5,6' && ad['5,6'].draft === true && ad['1,2'].col === '#c08a4e', 'adoptDecks keeps the well-formed')
  const up = adoptUpper(JSON.parse(JSON.stringify([{ walls: {}, decks: { '0,0': { pat: 'planks', col: '#d2a157' } } }])))
  ok(up.length === 1 && !!up[0].decks?.['0,0'], 'an upper level holding only a balcony survives save + load')
}

// ── the support rule (balconies) ──
const room = box(0, 0, 6, 6)                         // a 6 x 6 room on the ground: cells 0..5
{
  const d = directSupport({ walls: room }), s = supported({ walls: room })
  ok(d(2, 2), 'a cell over a room below is held directly')
  ok(d(2, -1) && !d(2, -2), 'the cell just outside the north wall is held directly (the wall runs under its edge); the next is not')
  ok(directSupport({ walls: { 'h,2,0': { mat: 'goldwood' } } })(2, -1), 'a lone wall along an edge holds that cell too')
  ok(s(2, -1) && s(2, -2) && !s(2, -3), `with ${CANTILEVER} cell of cantilever a balcony reaches 2 m off a wall line: (2,-2) ok, (2,-3) refused`)
  ok(s(-1, -1) && !s(-2, -2) && !s(-1, -3), 'round the corner: the cell diagonal to the corner is one step from a wall-held cell; two steps is refused')
  const lone: Walls = { 'h,10,10': { mat: 'goldwood' } }
  ok(supported({ walls: lone })(10, 9) && supported({ walls: lone })(10, 8) && !supported({ walls: lone })(10, 7), 'off a lone wall: the cell on it, one more out, not two')
  ok(!directSupport({ walls: { 'h,10,10': { mat: 'goldwood', kind: 'rail' } } })(10, 9), 'a railing holds no balcony up')
  ok(directSupport({ walls: {}, cols: { '20,20': { mat: 'brick' } } })(19, 19) && directSupport({ walls: {}, cols: { '20,20': { mat: 'brick' } } })(20, 20), 'a column holds the four cells round its corner')
  ok(!supported({ walls: {}, cols: { '20,20': { mat: 'brick' } } })(22, 20), 'and not three cells away')
}
// a house: room below + room above; a 6 x 2 balcony off the north wall upstairs; an unsupported one refused
{
  const key = findRooms(room)[0].key
  const base: Stacked = withLevel(withLevel({}, 0, { walls: room, paid: { [key]: 36 } }), 1, { walls: room, paid: { [key]: 36 } })
  const s = supported({ walls: room })
  const why = (i: number, j: number) => (s(i, j) ? null : 'Nothing holds that up.')
  const good = planDecks({}, deckRect([0, -1], [5, -1]), 'planks', '#d2a157', why)
  ok(good.ok && good.n === 6, 'a 1 m balcony along the north wall is allowed')
  const deep2 = planDecks({}, deckRect([0, -2], [5, -1]), 'planks', '#d2a157', why), deep3 = planDecks({}, deckRect([0, -3], [5, -1]), 'planks', '#d2a157', why)
  ok(deep2.ok && !deep3.ok, 'a 2 m-deep balcony off that wall is allowed, 3 m deep is refused')
  const far = planDecks({}, deckRect([20, 20], [22, 22]), 'planks', '#d2a157', why)
  ok(!far.ok, 'an unsupported floor in mid-air is refused')
  // built, the walker stands on it at floor 2
  const house = withLevel(base, 1, { walls: room, paid: { [key]: 36 }, decks: good.ok ? standDecks(good.decks) : {} })
  ok(floating(house).length === 0, 'the house with its balcony stands')
  const bx = upperBoxes(house, 0)
  const slab = bx.filter(b => b.z1 === 0 && b.z0 === -1 && Math.abs(b.y1 - STOREY) < 1e-9)
  ok(slab.length === 6, `the balcony is 6 solid slab cells at floor 2 (${slab.length})`)
  const world = terrainWorld({ ground: () => 0, solids: () => bx, water: () => [] })
  const lc = createLoco(2.5, STOREY + 0.05, -0.5)
  for (let t = 0; t < 60 * 2; t++) tickLocomotion(lc, input(), world)
  ok(Math.abs(lc.py - STOREY) < 0.05, `a keeper stands on the balcony (feet ${lc.py.toFixed(2)}, floor ${STOREY})`)
  // control: the same spot with no balcony falls to the ground
  const bare = terrainWorld({ ground: () => 0, solids: () => upperBoxes(base, 0), water: () => [] })
  const fall = createLoco(2.5, STOREY + 0.05, -0.5)
  for (let t = 0; t < 60 * 2; t++) tickLocomotion(fall, input(), bare)
  ok(fall.py < 0.5, `(control: no balcony, the keeper falls to the ground, feet ${fall.py.toFixed(2)})`)
  // a railing on the balcony's outer edge stands on the balcony (railings go on by hand)
  const fl = new Set(Object.keys(house.upper?.[0].decks ?? {}))
  ok(canStack(room, ['h,2,-1'], fl).ok && !canStack(room, ['h,2,-1']).ok, 'a railing on the outer edge stands on the balcony (and would not without it)')
  // take the wall below down: the balcony floats, so the erase is refused
  const noNorth: Walls = { ...room }; for (let i = 0; i < 6; i++) delete (noNorth as Record<string, unknown>)[`h,${i},0`]
  const after = withLevel(house, 0, { walls: noNorth, paid: {} })
  ok(floating(after).some(f => f.startsWith('1:d')), 'taking the room below away leaves the balcony floating (the erase is refused)')
  ok(deckFloating({ walls: room }, house.upper?.[0].decks).length === 0, 'deckFloating is empty while it is held')
}
// ── the ground: a patio is a step up the walker takes ──
{
  const decks: Decks = Object.fromEntries(deckRect([0, 0], [3, 3]).map(([i, j]) => [`${i},${j}`, { pat: 'flagstone' as const, col: FLOOR_PATS.flagstone.color }]))
  const bx = deckBoxes(decks, 0, true)
  ok(bx.length === 16 && bx.every(b => Math.abs(b.y1 - DECK_T) < 1e-9), `a 4 x 4 patio = 16 boxes, top at ${DECK_T}`)
  ok(deckBoxes({ '0,0': { pat: 'planks', col: '#d2a157', draft: true } }, 0, true).length === 0, 'a planned patio is not solid')
  const world = terrainWorld({ ground: () => 0, solids: () => bx, water: () => [] })
  const lc = createLoco(2, 0, 6)
  for (let t = 0; t < 30; t++) tickLocomotion(lc, input(), world)
  for (let t = 0; t < 60 * 4 && lc.pz > 2; t++) tickLocomotion(lc, input({ mvZ: -1 }), world)
  for (let t = 0; t < 20; t++) tickLocomotion(lc, input(), world)
  ok(Math.abs(lc.py - DECK_T) < 0.03 && lc.pz < 3 && lc.pz > 0, `walking onto the patio steps up onto it (feet ${lc.py.toFixed(2)}, z ${lc.pz.toFixed(2)})`)
}

console.log(`plot-decks: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
