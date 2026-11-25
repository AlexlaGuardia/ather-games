// npx tsx src/app/shimmer/open/ather/glade-places.test.ts   (BETA M153 s1c-2)
import { readFileSync } from 'fs'
import { join } from 'path'
import { PLACES, PROPS_MAX, addProp, cleanProp, cleanProps, isStanding, pieceCount, placeId, putPlace, putWho, propsCanon, qOfYaw, removeProp, yawOfQ, type Place, type Prop } from '../../world/builder-props'
import { EMPTY_LAYER, cleanLayer } from '../../world/builder'
import { setGladePeople, gladePeopleVersion } from './glade-people'
import { gladePlaces, placeDoor, placeSolids, placeY } from './glade-places'
import { PAD_FALL, PLACE_SIZE, inRect, padGround, padLevel, plinthBoxes, rectsOverlap, toRect, fromRect } from './glade-pads'
import { gladePeople, GLADE_GATE, GLADE_FRAME, GLADE_OWNED, gladeZoneGround } from './glade-cluster'
import { GLADE_ID, GLADE_LOTS, LOT_D, LOT_W, gladeJetty, gladeSpots, lotAt, lotSpots, onLot } from './moonwell-glade'
import { HOME_R, gladeHome, gladeHomeBoxes, gladeHomeY } from './glade-home'
import { doorSpot, gladeBlueprint, gladeLotBoxes, lotPad, setGladeBlueprint, yarrowCrate, stationBoxes, STATIONS } from './glade-lots'
import { teachJars } from './yarrow-teach'
import { parseHouse } from './plot-blueprint'
import { parseGladeLayer, gladeFrame, type GladeLayer } from './glade-layer'
import { gladeShapeOf, peopleProblems, placeProblems } from './glade-people-check'
import { gladeStructures } from './obstacles'
import { withPieces } from './dynamic-solids'
import { plotShape } from './plot'
import { gladeOverlay } from '../../dev/editors/builder-pois'
import { SCENERY, sceneryPlaced } from './scenery'
import { folkSpots } from './folk-spots'
import { GLADE as RELIEF } from './relief'
import { GLADE } from './moonwell-glade'
let bad = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL', m) } }
const ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 2e-4
const J = JSON.stringify, near = (a: number, b: number, e = 1e-3) => Math.abs(a - b) < e, root = join(__dirname, '../../../../..')
for (const l of GLADE_LOTS) ok((setGladeBlueprint(l.id, parseHouse(JSON.parse(readFileSync(join(root, 'world/house-blueprints', `glade-${l.id}.json`), 'utf8')))), !!gladeBlueprint(l.id)), `${l.id} stands its house`)
const raw = JSON.parse(readFileSync(join(__dirname, '../../world/glade-edits.json'), 'utf8')), v16 = parseGladeLayer(raw)
const flat = (x: number, z: number) => (void x, void z, RELIEF.y), code = J(gladePlaces()), codeBoxes = J(gladeLotBoxes(RELIEF.y)), codeHome = J(gladeHomeBoxes(flat, -999, -999, 999, 999))
const move = (id: Place, x: number, z: number, yaw = 0, ps: Prop[] = []) => putPlace(ps, id, { x, z, q: qOfYaw(yaw) })
const set = <T>(ps: Prop[], f: () => T): T => { setGladePeople(ps); const r = f(); setGladePeople([]); return r }

// ── the store
ok(cleanProp({ id: 'p1', k: 'spot:home', x: 1, z: 2, q: 5, s: 2, solid: true, w: 4, turned: true }) !== null && J(cleanProp({ id: 'p1', k: 'spot:home', x: 1, z: 2, q: 5, s: 2, solid: true, w: 4, turned: true })) === J({ id: 'hhome', k: 'spot:home', x: 1, z: 2, q: 1, s: 1 }), 'its own id, true size, nothing else')
for (const k of ['spot:', 'spot:pool', 'spot:gate', 'spot:Home', 'spot:jetty']) ok(cleanProp({ id: 'hhome', k, x: 1, z: 1, q: 0, s: 1 }) === null, `junk ${k}`)
ok(cleanProp({ id: 'hhome', k: 'spot:home', x: Infinity, z: 0 }) === null, 'junk x')
ok(cleanProps({ props: [{ id: 'a', k: 'spot:sax', x: 1, z: 1 }, { id: 'b', k: 'spot:sax', x: 2, z: 2 }] }).length === 1 && addProp([], { k: 'spot:sax', x: 0, z: 0, q: 0, s: 1 }) === null, 'one each, never added')
const full = Array.from({ length: PROPS_MAX }, (_, i) => ({ id: `p${(i + 1).toString(36)}`, k: 'bush:x', x: 0, z: 0, q: 0, s: 1 }))
ok(cleanProps({ props: [...full, ...move('sax', 1, 1)] }).some(p => p.id === 'hsax') && pieceCount(move('sax', 1, 1)) === 0 && isStanding({ k: 'spot:sax' }) && isStanding({ k: 'who:greg' }) && !isStanding({ k: 'tree:x' }), 'outside the cap')
ok(J(cleanLayer({ ...EMPTY_LAYER, props: removeProp(move('sax', 1, 1), 'hsax') })) === J(EMPTY_LAYER) && J(propsCanon(move('sax', 1, 1))) !== J(propsCanon(move('sax', 1, 1, 1))), 'put back = the layer as it was; a turn is a change')
ok(J(cleanLayer(cleanLayer(raw))) === J(cleanLayer(raw)) && (J(raw).includes('spot:') || !J(cleanLayer(raw)).includes('spot:')), 'the live layer gains nothing')
ok(sceneryPlaced(move('sax', 1, 1), flat).length === 0, 'never scenery')

// ── sizes and geometry
ok(GLADE_LOTS.every(l => PLACE_SIZE[l.id as Place].w === LOT_W && PLACE_SIZE[l.id as Place].d === LOT_D) && near(PLACE_SIZE.home.w, HOME_R * 2), 'sizes agree')
{ const t = teachJars({ x: 0, z: 0, yaw: 0 }).crate; ok(t.w === PLACE_SIZE.jars.w && t.d === PLACE_SIZE.jars.d, 'the crate too') }
const R = { x: 3, z: -2, yaw: 0.7, w: 6, d: 2 }, q = fromRect(R, 2, -0.5), b = toRect(R, q.x, q.z); ok(near(b.u, 2) && near(b.v, -0.5) && inRect(R, q.x, q.z) && !inRect(R, ...Object.values(fromRect(R, 3.2, 0)) as [number, number]), 'a turned rect, there and back')
ok(rectsOverlap(R, { ...R, x: 4 }) && !rectsOverlap({ ...R, yaw: 0 }, { ...R, yaw: 0, x: 9 }) && !rectsOverlap({ x: 0, z: 0, yaw: Math.PI / 4, w: 4, d: 4 }, { x: 3, z: 3, yaw: Math.PI / 4, w: 4, d: 4 }) && rectsOverlap({ x: 0, z: 0, yaw: 0, w: 4, d: 4 }, { x: 3, z: 3, yaw: 0, w: 4, d: 4 }), 'separating axes, turned or not')
const slope = (x: number) => 2 + 0.1 * x, lv = padLevel({ x: 0, z: 0, yaw: 0, w: 10, d: 4 }, slope); ok(near(lv.top, 2.5) && near(lv.low, 1.5), 'the highest ground under it')
const pb = plinthBoxes({ x: 0, z: 0, yaw: 0.6, w: 10, d: 4 }, 2.5, 1.5), area = pb.reduce((t, r) => t + (r.x1 - r.x0) * (r.z1 - r.z0), 0); ok(Math.abs(area - 40) < 0.6 && pb.every(r => r.y1 === 2.5 && r.y0 === 1), `the plinth covers the pad, its top level (${area.toFixed(2)})`)
ok(plinthBoxes(R, 2, 2).length === 0, 'level ground needs no plinth')

// ── the code's spots: nothing moved, nothing changed
ok(gladePlaces().length === PLACES.length && gladePlaces().every(p => !p.moved) && gladePlaces().every(p => p.place !== 'home' ? true : near(p.x, gladeHome().x)), 'seven, none moved')
ok(J(gladeLotBoxes(RELIEF.y, gladeZoneGround)) === codeBoxes, 'asked with the land, an unmoved Glade is box for box the same')
ok(padGround(v16.props, flat) === flat && gladeFrame(v16) !== undefined, 'no house moved = the land itself')
ok(gladePlaces().filter(p => p.place !== 'jars').every(p => Number.isFinite(placeY(p.place, gladeZoneGround))), 'heights')

// ── the resolver: every reader, one answer (asked once before, so a kept list has to notice)
const ds = withPieces({ ...plotShape(GLADE_OWNED, []), ground: flat }, () => null, true); ok(gladeStructures(-64, 56, -56, 64).length === 0 && ds.solids(-68, 0, 52, -52, 6, 68).length === 0, 'empty before')
const ver = gladePeopleVersion()
let mv = move('fennel', -60, 60, 1.2); mv = move('home', -60, 130, 2, mv); mv = move('jars', -90, 110, 0.4, mv)
setGladePeople(mv); ok(gladePeopleVersion() === ver + 1, 'a house moves the version'); setGladePeople([...mv]); ok(gladePeopleVersion() === ver + 1, 'the same list does not')
const L = lotAt('fennel')!; ok(L.x === -60 && L.z === 60 && ang(L.yaw, 1.2) && L.w === LOT_W && lotAt('sax')!.x !== -60, 'the lot')
const o = onLot('fennel', 4), p0 = lotPad('fennel', 0); ok(near(o.x, -60 - Math.sin(L.yaw) * 4) && p0.x === -60, 'its points and its pad')
const door = lotSpots([`${GLADE_ID}:fennel`])[0], want = doorSpot(gladeBlueprint('fennel')!, p0); ok(near(door.x, want.x) && near(door.z, want.z) && ang(door.yaw, L.yaw + Math.PI), 'the door goes with the house, and looks out of its front')
ok(near(gladeSpots([`${GLADE_ID}:fennel`])[0].x, want.x) && near(folkSpots(GLADE, [`${GLADE_ID}:fennel`])[0].z, want.z), 'Fennel, never moved himself, stands at his door')
setGladePeople(putWho(mv, 'fennel', { x: -70, z: 100, q: 0 })); ok(gladeSpots([`${GLADE_ID}:fennel`])[0].x === -70, 'a Fennel Alex moved does not follow the house'); setGladePeople(mv)
ok(gladeHome().x === -60 && ang(gladeHome().yaw, 2) && gladeHomeBoxes(flat, -62, 128, -58, 132).length === 2 && gladeHomeBoxes(flat, -101, 82, -96, 87).length === 0, "Greg's home")
ok(near(yarrowCrate()!.crate.x, -90) && near(yarrowCrate()!.crate.z, 110) && ang(yarrowCrate()!.crate.yaw, 0.4) && Math.hypot(yarrowCrate()!.jars[0].x + 90, yarrowCrate()!.jars[0].z - 110) < 0.3, 'the crate and its jars')
ok(placeSolids('jars', flat).every(x => x.x0 < -90 && x.x1 > -90 && x.y1 > RELIEF.y + 0.5), 'the crate blocks')
const hit = (x: number, z: number, d = 8) => ds.solids(x - d, 0, z - d, x + d, 6, z + d).length
ok(hit(-60, 60) > 20 && hit(-60, 130) >= 2 && hit(-90, 110, 0.3) >= 1, 'the walker bumps all three where they are now')
const oldL = JSON.parse(code).find((p: any) => p.place === 'fennel'); ok(ds.solids(oldL.x - 4, 0, oldL.z - 3, oldL.x + 4, 6, oldL.z + 3).length === 0, 'and nothing where the house was')
ok(gladeStructures(-64, 56, -56, 64).length > 10, "Greg's walk goes round it")
ok(gladeOverlay().pois.some(p => p.kind === 'lot' && p.name.startsWith('fennel') && p.x === -60), 'the builder overlay')
setGladePeople(move('yarrow', -60, 60, 0)); { const s = lotSpots(['moonwell:yarrow'])[0], c = yarrowCrate()!; ok(Math.hypot(c.crate.x - s.x, c.crate.z - s.z) < 1.2 && gladePlaces().find(p => p.place === 'jars')!.moved === false, "unmoved, the crate stays by Yarrow's door, wherever the house went") }
const bp0 = gladeBlueprint('sax'); setGladeBlueprint('sax', null); setGladePeople(move('sax', -60, 60, 0))
ok(stationBoxes(0).some(x => x._lot === 'sax' && Math.hypot((x.x0 + x.x1) / 2 + 60, (x.z0 + x.z1) / 2 - 60) < 7) && STATIONS.sax.length > 0 && placeSolids('sax', flat).length > 3, 'a lot without its house moves its station instead'); setGladeBlueprint('sax', bp0)
// on a slope
const hill = (x: number, z: number) => (void z, 2 + 0.1 * (x + 60)); setGladePeople(move('fennel', -60, 60, 0))
ok(near(placeY('fennel', hill), 2 + 0.675) && near(padGround(move('fennel', -60, 60, 0), hill)(-64, 60), 2.675) && near(padGround(move('fennel', -60, 60, 0), hill)(-64, 70), 1.6), 'level on the highest ground; who stands on the pad stands on the pad, beyond it on the land')
const hs = withPieces({ ...plotShape(GLADE_OWNED, []), ground: hill }, () => null, true).solids(-66, 0, 58, -65, 9, 62); ok(hs.some(x => near(x.y1, 2.675) && x.y0 < 1.4), 'the plinth is solid')
setGladePeople([]); setGladePeople(move('home', -60, 60)); ok(near(gladeHomeY(hill), 2 + 0.19), 'the home too'); setGladePeople([])
ok(J(gladePlaces()) === code && J(gladeLotBoxes(RELIEF.y)) === codeBoxes && J(gladeHomeBoxes(flat, -999, -999, 999, 999)) === codeHome, 'put back = the code exactly')
// the valley's trees
{ const l0: GladeLayer = { edits: null, water: null }, trees = GLADE_FRAME.meadow!.trees, t = trees[100], l1 = { ...l0, props: move('sax', t.x + 2, t.z) }, a = gladeFrame(l0).meadow!.trees, c = gladeFrame(l1).meadow!.trees
  ok(a.includes(t) && !c.includes(t) && c.length < a.length && gladeFrame({ ...l0 }).meadow!.trees.length === a.length, `no tree through a moved house, the rest stay (${a.length} -> ${c.length})`) }

// ── refusals, the live layer as ground
const say = (m: Prop[], l: GladeLayer = v16) => { const L2 = { ...l, props: [...(l.props ?? []), ...m] }; return set(m, () => { const who = gladePeople(); return { h: placeProblems(L2, gladePlaces(), who.find(w => w.who === 'newborn')!), p: peopleProblems(L2, who) } }) }
const t0 = Date.now(), r0 = say([]); ok(r0.h.length === 0 && r0.p.length === 0, `v16: every door is reached (${[...r0.h, ...r0.p]})`); console.log(`  v16 answered in ${Date.now() - t0} ms`)
// a stretch of Greg's garden that is dry, level and empty
export const FREE = { x: -100, z: 140 }
const good = say(move('sax', FREE.x, FREE.z, 0.3)); ok(good.h.length === 0 && good.p.length === 0, `a good move passes (${[...good.h, ...good.p]})`)
const one = (m: Prop[], re: RegExp, l?: GladeLayer) => { const r = say(m, l).h; ok(r.length >= 1 && re.test(r[0]), `${re}: ${r.join(' | ') || 'nothing'}`) }
one(move('sax', 350, 350), /^Sax's house is in the void$/)
one(move('home', RELIEF.pondX, RELIEF.pondZ), /^Greg's home is in the Moonwell$/)
{ const j = gladeJetty(); one(move('jars', j.x0, j.z0), /^Yarrow's jars is in the Moonwell$/) }
one(move('sax', GLADE_GATE.x + 4, GLADE_GATE.z), /^Sax's house (is in the gate|is in the void|is on a slope)/)
one(move('sax', lotAt('hazel')!.x + 3, lotAt('hazel')!.z), /^Sax's house stands in Hazel's house$|^Hazel's house stands in Sax's house$/)
one(move('home', lotAt('hazel')!.x, lotAt('hazel')!.z), /^Greg's home stands in Hazel's house$/)
{ const bx = placeSolids('hazel', flat)[0]; one(move('jars', (bx.x0 + bx.x1) / 2, (bx.z0 + bx.z1) / 2), /^Yarrow's jars stands in Hazel's house$/) }
const FK = SCENERY.find(s => s.k.endsWith(':fence'))!.k
{ const w = set(move('sax', FREE.x, FREE.z), () => placeSolids('sax', gladeZoneGround))[0]; one(move('sax', FREE.x, FREE.z), /^Sax's house stands in a solid piece$/, { ...v16, props: [...(v16.props ?? []), { id: 'pzz', k: FK, x: (w.x0 + w.x1) / 2, z: (w.z0 + w.z1) / 2, q: 0, s: 1 }] }) }
{ // a ring of fences round Greg's moved home
  const ring: Prop[] = []; let id = 1; for (let s = -5; s <= 5; s++) for (const [x, z, q2] of [[s, -5, 0], [s, 5, 0], [-5, s, 1], [5, s, 1]]) ring.push({ id: `pq${(id++).toString(36)}`, k: FK, x: FREE.x + x, z: FREE.z + z, q: q2, s: 2 })
  one(move('home', FREE.x, FREE.z), /^Greg's home has a door nobody can reach on foot$/, { ...v16, props: [...(v16.props ?? []), ...ring] })
  const d = set([], () => placeDoor('home')); one([], /^Greg's home has a door nobody can stand at$/, { ...v16, props: [...(v16.props ?? []), { id: 'pzz', k: 'node:goldwood', x: d.x, z: d.z, q: 0, s: 1 }] }) }
{ // any spot of the live Glade whose pad falls too far
  const g = gladeShapeOf(v16).ground; let found: { x: number; z: number } | null = null
  for (let x = -140; x < -20 && !found; x += 6) for (let z = 40; z < 180 && !found; z += 6) { const r = padLevel({ x, z, yaw: 0, ...PLACE_SIZE.sax }, g); if (r.top - r.low > PAD_FALL + 0.3 && placeProblemsAt(x, z).some(s => /slope/.test(s))) found = { x, z } }
  ok(!!found, 'too steep is refused somewhere in the live Glade'); if (found) one(move('sax', found.x, found.z), /^Sax's house is on a slope \(the ground falls [\d.]+ m under it, 1\.5 at most\)$/) }
function placeProblemsAt(x: number, z: number) { const m = move('sax', x, z); return set(m, () => placeProblems({ ...v16, props: m }, gladePlaces().filter(p => p.place === 'sax'))) }
{ // the owner's painted water
  let wetAt: { x: number; z: number } | null = null; for (let x = -300; x < 300 && !wetAt; x += 20) for (let z = -300; z < 300 && !wetAt; z += 20) if (placeProblemsAt(x, z).some(s => /in the water/.test(s))) wetAt = { x, z }
  ok(!!wetAt, 'painted water is refused'); if (wetAt) one(move('sax', wetAt.x, wetAt.z), /^Sax's house is in the water$/) }
{ const m = putWho(move('sax', FREE.x, FREE.z), 'bonn', { x: 0, z: 0, q: 0 }), bx = set(m, () => placeSolids('sax', gladeZoneGround))[2]; const r = say(putWho(m, 'bonn', { x: (bx.x0 + bx.x1) / 2, z: (bx.z0 + bx.z1) / 2, q: 0 })); ok(r.p.some(s => s === 'Bonn is inside something solid'), `a person in a moved wall: ${r.p}`) }
{ const me = set([], () => gladePeople().find(p => p.who === 'greg')!); const r = say(move('home', me.x, me.z)); ok(r.p.some(s => s === 'Gregory is inside something solid'), `a home put on Greg: ${r.p}`) }
{ const r = say(putWho([], 'newborn', { x: 350, z: 350, q: 0 })); ok(r.h.length === 0 && J(r.p) === J(['Newborn spot is in the void']), `a wrong newborn spot is one line, not six doors: ${[...r.h, ...r.p]}`) }
ok(placeId('home') === 'hhome' && ang(yawOfQ(qOfYaw(1.1)), 1.1), 'turns')
console.log(`${n - bad}/${n} glade-places`); if (bad) process.exit(1)
