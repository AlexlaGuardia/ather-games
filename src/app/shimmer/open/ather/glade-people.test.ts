// npx tsx src/app/shimmer/open/ather/glade-people.test.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { cleanProps, cleanProp, putWho, removeProp, addProp, propsCanon, pieceCount, qOfYaw, yawOfQ, PROPS_MAX, WHO, type Prop } from '../../world/builder-props'
import { EMPTY_LAYER, cleanLayer } from '../../world/builder'
import { setGladePeople, gladePeopleVersion, whenGladePeopleKnown, gladePeopleAnswered, gladePeopleKnown } from './glade-people'
import { gladePeople, gladeKeepers, gladeClusterSpot, gregInGlade, gladeNewbornSpot } from './glade-cluster'
import { gregSpot, gladeSpots, lotSpots, GLADE, GLADE_ID } from './moonwell-glade'
import { folkSpots } from './folk-spots'
import { tourStops } from './greg-tour'
import { gladeOverlay } from '../../dev/editors/builder-pois'
import { parseGladeLayer, fetchGladeLayer } from './glade-layer'
import { SCENERY, sceneryPlaced } from './scenery'
import { gladeHomeBoxes } from './glade-home'
import { GLADE as RELIEF } from './relief'
import { peopleProblems } from './glade-people-check'
const GLADE_Y = RELIEF.y
let bad = 0, n = 0
const ok = (c: boolean, m: string) => { n++; if (!c) { bad++; console.log('FAIL', m) } }
const J = JSON.stringify, near = (a: number, b: number) => Math.abs(a - b) < 1e-3, ang = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-3
const code = J(gladePeople())
ok(gladePeople().length === WHO.length && gladePeople().every(p => p && !p.moved && Number.isFinite(p.x)), 'ten people, none moved')
const main = async () => {
// ── the store
ok(cleanProp({ k: 'who:greg', x: 1, z: 2, id: 'p9' })?.id === 'wgreg', 'the id is theirs, whatever came')
for (const k of ['who:gregx', 'who:', 'who:moonwell:greg', 'who:Greg']) ok(cleanProp({ id: 'wgreg', k, x: 1, z: 2, q: 0, s: 1 }) === null, `junk ${k}`)
ok(cleanProp({ id: 'wgreg', k: 'who:greg', x: NaN, z: 2, q: 0, s: 1 }) === null, 'junk x')
ok(cleanProps({ props: [{ id: 'a', k: 'who:bonn', x: 1, z: 1, q: 0, s: 1 }, { id: 'b', k: 'who:bonn', x: 2, z: 2, q: 0, s: 1 }] }).length === 1, 'one each')
ok(J(cleanProp({ id: 'w', k: 'who:bonn', x: 1, z: 1, q: 5, s: 2, solid: true, w: 3, turned: true })) === J({ id: 'wbonn', k: 'who:bonn', x: 1, z: 1, q: 1, s: 1 }), 'true size, no toggle, turned only on the newborn spot')
ok(addProp([], { k: 'who:greg', x: 0, z: 0, q: 0, s: 1 }) === null, 'never added as a piece')
let ps: Prop[] = putWho([], 'greg', { x: -80, z: 100, q: 1 }); ps = putWho(ps, 'greg', { x: -81, z: 100, q: 1 })
ok(ps.length === 1 && ps[0].x === -81 && pieceCount(ps) === 0, 'moved again = the one piece')
const full = Array.from({ length: PROPS_MAX }, (_, i) => ({ id: `p${(i + 1).toString(36)}`, k: 'bush:x', x: 0, z: 0, q: 0, s: 1 }))
ok(cleanProps({ props: [...full, ...ps] }).some(p => p.id === 'wgreg'), 'a full map still carries people')
ok(J(cleanLayer({ ...EMPTY_LAYER, props: removeProp(ps, 'wgreg') })) === J(EMPTY_LAYER), 'put back = the layer without the list')
ok(J(propsCanon(putWho([], 'newborn', { x: 1, z: 1, q: 0 }))) !== J(propsCanon(putWho([], 'newborn', { x: 1, z: 1, q: 0, turned: true }))), 'a turn is a change')
ok(ang(yawOfQ(qOfYaw(2.4)), 2.4) && ang(yawOfQ(qOfYaw(-1)), -1), 'yaw <-> q')
ok(sceneryPlaced(ps, () => 0).length === 0, 'never scenery')
// v16 byte-identical
const raw = JSON.parse(readFileSync(join(__dirname, '../../world/glade-edits.json'), 'utf8'))
if (!J(raw).includes('who:')) ok(J(cleanLayer(cleanLayer(raw))) === J(cleanLayer(raw)) && !J(cleanLayer(raw)).includes('who:'), 'the live layer gains nothing')
// ── the resolver: every reader, one answer
const v0 = gladePeopleVersion()
const at: [typeof WHO[number], number, number, number][] = [['greg', -80, 100, 1], ['bonn', -90, 110, 0.5], ['yarrow', -85, 95, 2], ['fennel', -70, 100, 3]]
let mv: Prop[] = []; for (const [w, x, z, q] of at) mv = putWho(mv, w, { x, z, q })
setGladePeople(mv)
ok(gladePeopleVersion() === v0 + 1, 'version moves'); setGladePeople([...mv]); ok(gladePeopleVersion() === v0 + 1, 'same list = same version')
const g = gregSpot(); ok(g.x === -80 && g.z === 100 && ang(g.yaw, -Math.PI / 2) && gregInGlade().x === -80, 'greg')
ok(gladeKeepers().find(k => k.id === 'bonn')!.x === -90 && J(gladeKeepers().find(k => k.id === 'otto')) === J(JSON.parse(code).map((p: any) => p).filter((p: any) => p.who === 'otto').map((p: any) => ({ id: 'otto', name: p.name, x: p.x, z: p.z, yaw: p.yaw }))[0]), 'bonn moved, otto exactly where he was')
ok(gladeClusterSpot(`${GLADE_ID}:yarrow`)!.x === -85 && folkSpots(GLADE, [`${GLADE_ID}:yarrow`, `${GLADE_ID}:fennel`]).map(s => s.x).join() === '-85,-70', 'moglins + fennel through folkSpots')
ok(gladeSpots([`${GLADE_ID}:fennel`])[0].x === -70 && lotSpots([`${GLADE_ID}:fennel`])[0].x === -75, 'the lot keeps its own spot (jars)')
ok(!!tourStops().find(s => s.id === 'folk:fennel' && s.look.x === -70), 'the tour')
const pois = gladeOverlay().pois; ok(pois.some(p => p.name === 'Gregory' && p.x === -80) && pois.some(p => p.name === 'Yarrow' && p.x === -85), 'the builder overlay')
// the newborn rule
const face = (s: { x: number; z: number; yaw: number }, p: { x: number; z: number }) => { const d = Math.hypot(p.x - s.x, p.z - s.z); return near(-Math.sin(s.yaw), (p.x - s.x) / d) && near(-Math.cos(s.yaw), (p.z - s.z) / d) }
let nb = gladeNewbornSpot(); ok(near(Math.hypot(nb.x - g.x, nb.z - g.z), 5) && face(nb, g), 'unplaced: 5 m in front of Greg, wherever he is, facing him')
setGladePeople(putWho(mv, 'newborn', { x: -75, z: 92, q: 0 })); nb = gladeNewbornSpot()
ok(nb.x === -75 && face(nb, g), 'placed, not turned: still faces Greg')
setGladePeople(putWho(mv, 'newborn', { x: -75, z: 92, q: 0, turned: true })); nb = gladeNewbornSpot()
ok(near(-Math.sin(nb.yaw), 0) && near(-Math.cos(nb.yaw), 1), 'turned: looks where the piece looks (+z)')
setGladePeople([]); ok(J(gladePeople()) === code, 'nothing placed = the code exactly')
// ── refusals, the live layer as ground
const layer = { ...parseGladeLayer(raw) }
const say = (l: typeof layer, m: Prop[]) => { setGladePeople(m); const r = peopleProblems({ ...l, props: [...(l.props ?? []), ...m] }, gladePeople()); setGladePeople([]); return r }
ok(say(layer, []).length === 0, `v16: everyone stands well (${say(layer, [])})`)
ok(say(layer, mv.filter(p => p.k !== 'who:fennel')).length === 0, `good moves pass (${say(layer, mv.filter(p => p.k !== 'who:fennel'))})`)
ok(J(say(layer, putWho([], 'bonn', { x: 350, z: 350, q: 0 }))) === J(['Bonn is in the void']), 'void: who and why')
const wetAt = (() => { return { x: -118, z: 110 } })()
ok(say(layer, putWho([], 'tess', { ...wetAt, q: 0 }))[0]?.startsWith('Tess is in the water') ?? false, `pool water ${say(layer, putWho([], 'tess', { ...wetAt, q: 0 }))}`)
const box = gladeHomeBoxes(() => GLADE_Y, -300, -300, 300, 300).sort((a, b) => (b.y1 - b.y0) - (a.y1 - a.y0))[0], home = say(layer, putWho([], 'otto', { x: (box.x0 + box.x1) / 2, z: (box.z0 + box.z1) / 2, q: 0 }))
ok(home[0] === 'Otto is inside something solid', `greg's house wall: ${home}`)
const solid: Prop = { id: 'pzz', k: 'node:goldwood', x: -80, z: 100, q: 0, s: 1 }
ok(J(say({ ...layer, props: [solid] }, putWho([], 'hazel', { x: -80, z: 100, q: 0 }))) === J(['Hazel is inside something solid']), `in a trunk ${say({ ...layer, props: [solid] }, putWho([], 'hazel', { x: -80, z: 100, q: 0 }))}`)
// a ring of fences round Hazel: shut in
const ring: Prop[] = []; let id = 1
for (let s = -3; s <= 3; s++) for (const [x, z, q] of [[s, -4, 0], [s, 4, 0], [-4, s, 1], [4, s, 1]]) ring.push({ id: `pq${(id++).toString(36)}`, k: 'fence:x', x: -80 + x, z: 100 + z, q, s: 2 })
const FK = SCENERY.find(s => s.k.endsWith(':fence'))!.k
const big = ring.map(p => ({ ...p, k: FK }))
const t = Date.now(), shut = say({ ...layer, props: big }, putWho([], 'hazel', { x: -80, z: 100, q: 0 }))
ok(J(shut) === J(['Hazel cannot be reached on foot from the newborn spot']), `shut in: ${shut}`)
ok(Date.now() - t < 15000, 'the search ends')
const gate = big.filter(p => !(p.z === 104 && Math.abs(p.x + 80) < 2.6))
ok(say({ ...layer, props: gate }, putWho([], 'hazel', { x: -80, z: 100, q: 0 })).length === 0, 'a gap in the fence lets them out')
const nbIn = say({ ...layer, props: big }, putWho([], 'newborn', { x: -80, z: 100, q: 0 })); ok(nbIn.length === 9, `a shut-in newborn spot names all nine (${nbIn.length})`)
// ── the game's fetch
let fired = 0; whenGladePeopleKnown(() => fired++); ok(!gladePeopleKnown() && fired === 0, 'waits')
globalThis.fetch = (async () => ({ ok: true, json: async () => ({ ...raw, props: mv }) })) as any
await fetchGladeLayer(); ok(fired === 1 && gregSpot().x === -80, 'the fetch sets them, then whoever waited goes on')
globalThis.fetch = (async () => { throw new Error('x') }) as any
await fetchGladeLayer(); ok(gregSpot().x === -80, 'a failed read keeps what is known')
globalThis.fetch = (async () => ({ ok: true, json: async () => raw })) as any
await fetchGladeLayer(); ok(J(gladePeople()) === code, 'roll back = the code spots')
gladePeopleAnswered()
console.log(`${n - bad}/${n} glade-people`); if (bad) process.exit(1)
}
void main()
