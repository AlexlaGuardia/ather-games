// BETA M169 s2: doors, windows and openings in the one building catalog. Sizes = athernyx concept-1672 building + textures
// NOTES (Magii 246c2cc / 9c9e688). Run: npx tsx src/app/shimmer/open/ather/build-cuts.test.ts
import { buildCatalog, buildBoxes, buildSolids, pieceIcon, opens, CUT, CREATIVE_OPEN, type PieceBox } from './build-catalog'
import { FURNITURE } from './furniture'
import { SCENERY_BY, sceneryBoxes } from './scenery'
import { planPiece, pieceBoxes, toggleOpen, nearWork, loadWorks, saveWorks, KEEP_CLEAR, type Works } from './rooms'
import { buildAll, plannedNeeds } from './plot-bom'
import { plotFootprints, footBlocked } from './obstacles'
import { newInv, give, countOf } from '../shared/inventory'
import { STARTING_SQUARES, squareAt, sqId } from './plot'
let pass = 0; const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const J = JSON.stringify, near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e
const same = (a: readonly string[], b: readonly string[]) => J(a) === J(b)
const CUTS = ['door', 'window', 'round_window', 'shutters', 'arch', 'doorway', 'half_wall', 'wall_end', 'wall_corner']

// ── the catalog: each piece in its sub-category (Alex's list), plain nouns ──
const cat = Object.fromEntries(buildCatalog().map(g => [g.sub, g.ids]))
ok(same(cat.Doors, ['door']), `Doors = the door (${cat.Doors})`)
ok(same(cat.Windows, ['window', 'round_window', 'shutters']), `Windows (${cat.Windows})`)
ok(same(cat['Openings + trim'], ['arch', 'doorway', 'half_wall', 'wall_end', 'wall_corner']), `Openings + trim (${cat['Openings + trim']})`)
ok(same(CUTS.map(id => FURNITURE[id].name), ['Door', 'Window', 'Round window', 'Shutters', 'Arch', 'Doorway', 'Half wall', 'Wall end', 'Wall corner']), 'plain nouns')
for (const id of CUTS) ok(SCENERY_BY.get(`piece:${id}`)?.group === 'Build' && SCENERY_BY.get(`piece:${id}`)?.sub === FURNITURE[id].build, `${id}: in Creative's Build, same sub-category`)

// ── sizes: the wall panel grid (0.3 m thick, 4.8 m tall, 1 or 2 m long) and Magii's cuts ──
for (const id of ['door', 'window', 'round_window', 'shutters', 'arch', 'doorway']) { const f = FURNITURE[id]
  ok(f.d === FURNITURE.goldwood_panel.d && f.h === FURNITURE.goldwood_panel.h && (f.w === 1 || f.w === 2), `${id}: a wall panel of its own (${f.w} x ${f.d} x ${f.h})`) }
ok(FURNITURE.door.w === 2 && CUT.doorH === 2.2, 'the door = the build\'s 2 m x 2.2 m doorway')
const box = (id: string, open = false) => buildBoxes(FURNITURE[id], open)!
const spanX = (bs: PieceBox[]) => [Math.min(...bs.map(b => b.p[0] - b.s[0] / 2)), Math.max(...bs.map(b => b.p[0] + b.s[0] / 2))]
const leaves = (open: boolean) => box('door', open).filter(b => b.c === '#b98a44')
{ const sh = leaves(false), [x0, x1] = spanX(sh)
  ok(sh.length === 2 && sh.every(b => near(b.s[0], 0.94) && near(b.s[1], 2.14) && near(b.s[2], 0.06)), 'two leaves, 0.94 x 2.14 x 0.06')
  ok(near(x0, -0.94) && near(x1, 0.94), `shut, they fill the doorway inside its 0.06 m frame (${x0}..${x1})`)
  const op = leaves(true); ok(op.length === 2 && op.every(b => near(b.s[2], 0.94) && b.p[2] - b.s[2] / 2 >= 0.15 - 1e-9), 'open, each turned a quarter, outward (+z), clear of the wall') }
const pane = (id: string) => box(id).filter(b => b.c === '#bfe6f2')
{ const p = pane('window'); ok(p.length === 1 && near(p[0].p[1] - p[0].s[1] / 2, 1.0) && near(p[0].p[1] + p[0].s[1] / 2, 2.2), 'window: the pane band 1.0 to 2.2 m') }
{ const p = pane('round_window'), lo = Math.min(...p.map(b => b.p[1] - b.s[1] / 2)), hi = Math.max(...p.map(b => b.p[1] + b.s[1] / 2)), wide = Math.max(...p.map(b => b.s[0]))
  ok(near(lo, 1.15) && near(hi, 2.05) && wide <= 0.9 + 1e-9 && wide > 0.8, `round window: 0.9 m across at 1.6 m (${lo.toFixed(2)}..${hi.toFixed(2)}, widest ${wide.toFixed(2)})`)
  ok(p.every(b => near(Math.abs(b.p[1] - 1.6) ** 2 + (b.s[0] / 2) ** 2, 0.45 ** 2, 1e-9)), 'round window: every strip\'s corner on the circle') }
{ const sh = (open: boolean) => box('shutters', open).filter(b => b.c === '#b98a44'), s0 = sh(false), s1 = sh(true)
  ok(s0.length === 2 && s0.every(b => near(b.s[0], 0.49) && near(b.s[1], 1.2)), 'shutters: a pair, 0.5 x 1.2 m')
  ok(J(spanX(s0)) === J([-0.495, 0.495]) && near(spanX(s1)[0], -0.995) && near(spanX(s1)[1], 0.995), 'shut over the pane; open = folded back, each on 0.5 m of the next wall piece') }
ok(FURNITURE.half_wall.h === 1.0, 'half wall = the railing\'s 1.0 m')
ok(J(box('door')) !== J(box('door', true)) && J(box('window')) === J(box('window', true)), 'only an opening piece changes when open')

// ── what blocks: a shut door does, an open one does not; a doorway / arch never; a window is a wall ──
ok(J(buildSolids(FURNITURE.door, false)) === J([{ x: 0, z: 0, w: 2, d: 0.3, h: 4.8 }]) && J(buildSolids(FURNITURE.door, true)) === '[]', 'door: shut = the whole doorway, open = nothing')
ok(!FURNITURE.doorway.solid && !FURNITURE.arch.solid && J(buildSolids(FURNITURE.arch)) === '[]', 'doorway + arch: walk through')
ok(buildSolids(FURNITURE.wall_corner)!.length === 2 && buildSolids(FURNITURE.goldwood_bench) === null, 'a corner blocks as its two arms; furniture keeps the old rule')
ok(CUTS.every(id => opens(FURNITURE[id]) === (id === 'door' || id === 'shutters')), 'only the door and the shutters open')

// ── on a test plot: plan, pay, build, E open / shut, walk, reload ──
const own = new Set(STARTING_SQUARES), held = (x: number, z: number) => { const s = squareAt(x, z); return !!s && own.has(sqId(s.i, s.j)) }
let X = 0, Z = 0
find: for (let z = -150; z < 150; z++) for (let x = -150; x < 150; x++) if ([[-6, -6], [8, -6], [-6, 6], [8, 6], [0, 0]].every(([a, b]) => held(x + a, z + b)) && KEEP_CLEAR.every(c => Math.hypot(c.x - x, c.z - z) > c.r + 7)) { X = x; Z = z; break find }
const base = (): Works => ({ v: 1, rooms: [], chests: [], pieces: [] })
const plan = (w: Works, item: string, dx: number, dz: number, q = 0) => { const r = planPiece(w, own, item, X + dx, Z + dz, q); if ('why' in r) throw new Error(`${item}: ${r.why}`); return r.works }
// a wall line: panel | window | door (2 m) | shutters | panel, flush on the 1 m grid
let w = plan(base(), 'goldwood_panel', -2, 0); w = plan(w, 'window', -1, 0); w = plan(w, 'door', 0.5, 0); w = plan(w, 'shutters', 2, 0); w = plan(w, 'goldwood_panel', 3, 0)
w = plan(w, 'round_window', -2, 4); w = plan(w, 'arch', 0.5, 4); w = plan(w, 'doorway', 3.5, 4); w = plan(w, 'half_wall', 5, 4); w = plan(w, 'wall_end', 5.7, 4); w = plan(w, 'wall_corner', -4, 6)
ok(w.planned!.length === 11, 'a door and windows sit IN a run of panels, end to end (no clash at the joints)')
const bill = Object.fromEntries(plannedNeeds(w.planned).map(c => [c.id, c.n]))
ok(bill.goldwood_plank === 2 + 2 + 5 + 3 + 2 + 2 + 3 + 1 + 1 + 4 && bill.crystal_pane === 3 && bill.stone_brick === 3, `the bill (${J(bill)})`)
const inv = Object.entries(bill).reduce((i, [id, n]) => give(i, id, n).inv, newInv())
{ const less = Object.entries({ ...bill, crystal_pane: 2 }).reduce((i, [id, n]) => give(i, id, n).inv, newInv()); ok(!buildAll(w, less, null).ok, 'one pane short: no Build') }
const r = buildAll(w, inv, null); ok(r.ok && r.works.pieces.length === 11 && countOf(r.inv, 'goldwood_plank') === 0 && countOf(r.inv, 'crystal_pane') === 0, 'Build pays exactly that, all 11 stand')
w = r.ok ? r.works : w
const door = w.pieces.find(p => p.item === 'door')!, inBox = (wk: Works, x: number, z: number) => pieceBoxes(wk).some(b => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1)
ok(!door.open && inBox(w, door.x, door.z) && inBox(w, door.x + 0.6, door.z), 'built shut: the doorway blocks')
ok(nearWork(w, door.x, door.z + 1.2)?.kind === 'piece', 'E reaches the door from in front')
const t1 = toggleOpen(w, door.id, { x: door.x, z: door.z + 1.5 }); ok(!!t1 && 'works' in t1 && t1.works.pieces.find(p => p.id === door.id)!.open === true, 'E opens it')
const wo = (t1 as { works: Works }).works
ok(!inBox(wo, door.x, door.z) && !inBox(wo, door.x + 0.6, door.z) && !inBox(wo, door.x - 0.6, door.z), 'open: the doorway is clear')
ok(inBox(wo, X - 1, Z) && inBox(wo, X + 2, Z) && inBox(wo, X - 2, Z), 'the window, the shutters and the panel either side still block')
const st = toggleOpen(wo, door.id, { x: door.x, z: door.z }); ok(!!st && 'why' in st, 'shutting refuses while the keeper stands in the doorway')
const t2 = toggleOpen(wo, door.id, { x: door.x, z: door.z + 2 }); ok(!!t2 && 'works' in t2 && !('open' in t2.works.pieces.find(p => p.id === door.id)!) && inBox(t2.works, door.x, door.z), 'E again shuts it: blocks again, no flag left')
const shu = w.pieces.find(p => p.item === 'shutters')!, ts = toggleOpen(w, shu.id, { x: shu.x, z: shu.z + 0.5 })
ok(!!ts && 'works' in ts && ts.works.pieces.find(p => p.id === shu.id)!.open === true && inBox(ts.works, shu.x, shu.z), 'shutters open next to the wall (no doorway rule), the window still blocks')
ok(toggleOpen(w, w.pieces.find(p => p.item === 'window')!.id) === null, 'a plain window does not open')
const arch = w.pieces.find(p => p.item === 'arch')!, dw = w.pieces.find(p => p.item === 'doorway')!, cor = w.pieces.find(p => p.item === 'wall_corner')!
ok(!inBox(w, arch.x, arch.z) && !inBox(w, dw.x, dw.z), 'the arch and the doorway let the keeper through')
ok(inBox(w, cor.x, cor.z - 0.4) && inBox(w, cor.x - 0.4, cor.z + 0.3) && !inBox(w, cor.x + 0.2, cor.z + 0.2), 'the corner blocks on its two arms, not in the crook')
// a door turned 45 deg blocks as a thin chain, not its fat axis box
{ const w45 = plan(base(), 'door', 0, -4, 0.5), b = toggleOpen({ ...w45, pieces: w45.planned!, planned: undefined }, w45.planned![0].id)
  const shut45: Works = { ...w45, pieces: w45.planned!, planned: undefined }, p = shut45.pieces[0]
  ok(inBox(shut45, p.x, p.z) && !inBox(shut45, p.x - 0.42, p.z + 0.42), 'a turned shut door blocks its line only, not its fat axis box')
  ok(!!b && 'works' in b && !inBox(b.works, p.x, p.z), 'turned and open: clear') }
// the spirits' paths (M117 s1): an open door is no obstacle, a shut one is
{ const fShut = plotFootprints(w.pieces), fOpen = plotFootprints(wo.pieces)
  ok(footBlocked(fShut, door.x, door.z, 0.3) && !footBlocked(fOpen, door.x, door.z, 0.3), 'a spirit: a shut door is in her way, an open one is not')
  ok(!footBlocked(fShut, arch.x, arch.z, 0.3) && !footBlocked(fShut, dw.x, dw.z, 0.3), 'a spirit walks through an arch and a doorway') }
// Creative: no E there, so a door stands open and never blocks; a window is a wall
{ const at = (k: string) => sceneryBoxes([{ id: 'a', k, x: 0, z: 0, q: 0, s: 1, y: 0 }] as any)
  ok(CREATIVE_OPEN && at('piece:door').length === 0 && at('piece:arch').length === 0 && at('piece:window').length === 1 && at('piece:wall_corner').length === 2, 'Creative: the door is open (no box), the window is a wall, the corner its two arms') }
// reload: the open flag is saved with the plot
{ const store: Record<string, string> = {}; (globalThis as any).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v }, removeItem() {}, key: () => null, length: 0 }
  saveWorks(wo); const back = loadWorks(); ok(back.pieces.find(p => p.id === door.id)?.open === true && !inBox(back, door.x, door.z), 'reload: still open, still clear')
  saveWorks(w); ok(!loadWorks().pieces.find(p => p.id === door.id)?.open && inBox(loadWorks(), door.x, door.z), 'reload: shut stays shut') }
// icons: one per piece, from its own boxes, no two alike
{ const ics = CUTS.map(id => pieceIcon(id).map(f => f.d).join())
  ok(CUTS.every((id, k) => ics[k].length > 0 && pieceIcon(id).length === box(id).length * 3), 'every cut piece has its icon, a face per side per box')
  ok(new Set(ics).size === CUTS.length, 'no two icons alike') }

console.log(`build-cuts: ${pass} pass, ${fails.length} fail`)
if (fails.length) { for (const f of fails) console.log('  FAIL', f); process.exit(1) }
