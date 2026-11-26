// npx tsx src/app/shimmer/open/ather/m198-glade-friend-ground.test.ts   (BETA M198, Alex 11-26 'open those squares')
// The friends' gardens in the Glade own a little more than the start corner, so the Stonery pad Alex put past Otto's old
// edge (world x -334) and Yarrow's house past Tess's (world z 334) stand on walkable ground. The mist walls move out with
// the ground; a spot on ground nobody holds is still refused.
import { readFileSync } from 'fs'
import { join } from 'path'
import { GLADE_FRAME, GLADE_OWNED, GLADE_FRIEND_GROUND, GLADE_GARDENS, gladePeople } from './glade-cluster'
import { mistWalls, STARTING_SQUARES, squareAt, sqId, parseSq } from './plot'
import { mateWalls } from './cluster'
import { toLocal } from './meadow'
import { setGladePeople } from './glade-people'
import { gladePlaces } from './glade-places'
import { placeProblems } from './glade-people-check'
import { parseGladeLayer, type GladeLayer } from './glade-layer'
import { GLADE_LOTS } from './moonwell-glade'
import { setGladeBlueprint } from './glade-lots'
import { parseHouse } from './plot-blueprint'
import { putPlace, type Prop } from '../../world/builder-props'
let n = 0, bad = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL', m) } }
const root = join(__dirname, '../../../../..')
for (const l of GLADE_LOTS) setGladeBlueprint(l.id, parseHouse(JSON.parse(readFileSync(join(root, 'world/house-blueprints', `glade-${l.id}.json`), 'utf8'))))

// ── the ground: start corner + the opened squares, each touching what is held
const mate = (id: 'otto' | 'tess' | 'bonn') => GLADE_FRAME.mates.find(m => m.quarter === GLADE_GARDENS.find(g => g.id === id)!.quarter)!
ok(GLADE_FRIEND_GROUND.otto.join() === '0,11,1,11' && GLADE_FRIEND_GROUND.tess.join() === '1,11,2,11' && GLADE_FRIEND_GROUND.bonn.length === 0, 'the opened squares: Otto 0,11 + 1,11, Tess 1,11 + 2,11, Bonn none')
for (const id of ['otto', 'tess', 'bonn'] as const) {
  const m = mate(id), want = [...STARTING_SQUARES, ...GLADE_FRIEND_GROUND[id]].sort().join(' ')
  ok([...m.owned].sort().join(' ') === want, `${id} holds the corner + their opened squares, nothing else`)
  const held = new Set(STARTING_SQUARES as string[])
  for (const q of GLADE_FRIEND_GROUND[id]) { const { i, j } = parseSq(q); ok([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => held.has(sqId(i + a, j + b)) || GLADE_FRIEND_GROUND[id].includes(sqId(i + a, j + b))) && !held.has(q), `${id} ${q} joins the ground they hold`) }
}
// the spots Alex placed sit in an opened square of the right friend
const sqOf = (id: 'otto' | 'tess', x: number, z: number) => { const m = mate(id), l = toLocal(m.x, m.z, m.rot, x, z), s = squareAt(l.x, l.z); return s && sqId(s.i, s.j) }
ok(sqOf('otto', -346, 125.5) === '1,11' && sqOf('tess', -318, 345.5) === '2,11', 'Stonery in Otto 1,11, Yarrow in Tess 2,11')

// ── the walls: the old edges are gone where the ground opened, the new edge stands one square out
const walls = [...mistWalls(GLADE_OWNED), ...mateWalls(GLADE_FRAME)]
const crosses = (ax: number, az: number, bx: number, bz: number) => walls.some(w => {
  for (let k = 0; k <= 200; k++) { const x = ax + (bx - ax) * k / 200, z = az + (bz - az) * k / 200; if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return true }
  return false
})
for (const z of [112, 125, 140]) ok(!crosses(-325, z, -350, z), `walk west across Otto's old x -334 at z ${z}`)
ok(!crosses(-345, 115, -345, 145), "walk Otto's opened two squares end to end (no wall at z 130)")
for (const z of [115, 125, 140]) ok(crosses(-350, z, -360, z), `Otto's new edge at x -354 still walls (z ${z})`)
for (const x of [-330, -318, -300]) ok(!crosses(x, 325, x, 350), `walk south across Tess's old z 334 at x ${x}`)
ok(!crosses(-330, 345, -300, 345), "walk Tess's opened two squares end to end (no wall at x -314)")
for (const x of [-330, -318, -300]) ok(crosses(x, 350, x, 360), `Tess's new edge at z 354 still walls (x ${x})`)
ok(crosses(-300, 345, -285, 345), "Tess's ground past 1,11 (her 0,11, world x past -294) is still hers to open")

// ── the Glade publish check: Alex's placements pass, a spot on ground nobody holds is still refused
const raw = JSON.parse(readFileSync(join(__dirname, '../../world/glade-edits.json'), 'utf8')), live = parseGladeLayer(raw)
const base = (live.props ?? []).filter(p => !p.k.startsWith('room:') && !p.k.startsWith('spot:yarrow') && !p.k.startsWith('spot:sax'))
const stone = (x: number, z: number): Prop => ({ id: 'pzz1', k: 'room:stonemason', x, z, q: 1.3344, s: 1 })
const yarrow = (x: number, z: number) => putPlace([], 'yarrow', { x, z, q: 3.91 })
const sax = putPlace([], 'sax', { x: -337, z: 130.5, q: 0.3309 })
const check = (add: Prop[]) => {
  const props = [...base, ...add], L: GladeLayer = { ...live, props }
  setGladePeople(props); const nb = gladePeople().find(p => p.who === 'newborn')!, r = placeProblems(L, gladePlaces(), nb); setGladePeople([]); return r
}
const reach = (r: string[], who: RegExp) => r.filter(s => who.test(s) && /reach/.test(s))
const good = check([stone(-346, 125.5), ...yarrow(-318, 345.5), ...sax])
ok(reach(good, /Stonery/).length === 0, `Stonery at Alex's spot is reached on foot: ${good}`)
ok(reach(good, /Yarrow/).length === 0, `Yarrow's door at Alex's spot is reached on foot: ${good}`)
ok(reach(good, /Sax/).length === 0, `Sax still passes: ${good}`)
// Otto's 1,10 / Tess's 2,10: one square past the opened ground, held by nobody
const far = check([stone(-366, 125.5), ...yarrow(-318, 365.5), ...sax])
ok(reach(far, /Stonery/).length === 1, `a Stonery past Otto's new edge is still refused: ${far}`)
ok(reach(far, /Yarrow/).length === 1, `a Yarrow house past Tess's new edge is still refused: ${far}`)

console.log(`${n - bad}/${n} m198-glade-friend-ground${bad ? ' FAIL' : ''}`); process.exit(bad ? 1 : 0)
