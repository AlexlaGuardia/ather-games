// BETA M153 s1a: the layer's props (pure) + the store's plan with them. Run: npx tsx src/app/shimmer/world/builder-props.test.ts
import { readFileSync } from 'fs'
import { cleanProps, propsCanon, newPropId, addProp, removeProp, changeProp, snapXZ, turnBy, scaleBy, nextOf, propsToStore, propsOfStore, PROPS_KEY, PROPS_MAX, PROP_SNAPS, type Prop } from './builder-props'
import { cleanLayer, sameLayer, layerSize, planPublish, planRollback, emptyIndex, draftState, EMPTY_LAYER, type Layer } from './builder'
import { EditHistory, mergeEdits, type Edits } from '../open/ather/wilds-edits'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const P = (id: string, o: Partial<Prop> = {}): Prop => ({ id, k: 'tree:grove', x: 1, z: 2, q: 0, s: 1, ...o })
const J = JSON.stringify

// the cleaner
const junk = cleanProps({ props: [P('p1'), P('p1', { x: 9 }), null, 7, 'x', [], P('../p'), P('p2', { k: 'tree:../../etc' }), P('p3', { x: NaN }), P('p4', { z: 1e9 }), P('p5', { s: 99 }), P('p6', { s: -1 }), P('p7', { q: -1 }), P('p8', { q: 9 }), P('p9', { solid: 'yes' as never }), P('pa', { solid: false }), { ...P('pb'), evil: 1 }, { ...P('pc'), s: undefined, q: undefined }] })
ok(junk.map(p => p.id).join() === 'p1,p5,p6,p7,p8,p9,pa,pb,pc', `junk dropped, one per id (${junk.map(p => p.id)})`)
ok(junk[0].x === 1 && junk[1].s === 2 && junk[2].s === 0.5 && junk[3].q === 3 && junk[4].q === 1, 'first of an id wins; scale clamped 0.5..2; turn wrapped')
ok(!('solid' in junk[5]) && junk[6].solid === false && !('evil' in junk[7]) && junk[8].s === 1 && junk[8].q === 0, 'a bad toggle is dropped, a good one kept, unknown keys dropped, defaults')
ok(cleanProps(null).length === 0 && cleanProps({ props: 'no' }).length === 0 && cleanProps({ props: {} }).length === 0, 'no list = none')
ok(cleanProps({ props: Array.from({ length: PROPS_MAX + 50 }, (_, i) => P(`p${(i + 1).toString(36)}`)) }).length === PROPS_MAX, `capped at ${PROPS_MAX}`)
ok(J(cleanProps({ props: junk })) === J(junk), 'cleaning is stable')

// the layer: absent when empty, byte-identical
for (const j of [{ v: 1, tiles: {}, water: {}, falls: {} }, { tiles: { glade: { 5: 30 } }, props: [] }, { tiles: {}, props: [null] }]) ok(!('props' in cleanLayer(j)), 'no props = no key')
const live = readFileSync(new URL('./glade-edits.json', import.meta.url), 'utf-8')
const liveLayer = cleanLayer(JSON.parse(live))
if (!JSON.parse(live).props) ok(J(liveLayer) + '\n' === live, 'the live Glade layer (no props) round-trips byte-identical')
const A: Layer = { ...EMPTY_LAYER, props: [P('p1'), P('p2', { k: 'prop:chest', x: 4 })] }
ok(J(cleanLayer(JSON.parse(J(A)))) === J(A), 'a layer with props round-trips')
ok(sameLayer(A, { ...EMPTY_LAYER, props: [...A.props!].reverse() }) && !sameLayer(A, EMPTY_LAYER), 'sameLayer: order does not matter, presence does')
for (const d of [{ x: 9 }, { z: 9 }, { q: 1 }, { s: 1.5 }, { k: 'bush:bloom-bush' }, { solid: false }]) ok(!sameLayer(A, { ...EMPTY_LAYER, props: [P('p1', d), A.props![1]] }), `sameLayer sees ${J(d)}`)
ok(layerSize(A).props === 2 && !('props' in layerSize(EMPTY_LAYER)), 'layerSize counts them, absent when none')
ok(draftState(A, EMPTY_LAYER) === 'unpublished changes' && J(propsCanon(undefined)) === '[]', 'draft state')

// publish + roll back carry them
const T = '2026-11-25T12:00:00.000Z', pub = planPublish(emptyIndex('glade'), A, liveLayer, T, 'trees')
ok(pub.writes.map(w => w.kind).join() === 'version,version,live,index', 'first publish: the old live as v1, then v2, live, index')
const lw = pub.writes.find(w => w.kind === 'live'); ok(lw?.kind === 'live' && lw.layer.props?.length === 2, 'live gets the props')
const rb = planRollback(pub.index, 1, liveLayer, T)!
ok(rb.writes.every(w => w.kind === 'index' || !w.layer.props) && rb.writes.map(w => w.kind).join() === 'version,live,draft,index', 'roll back: no props in version, live or draft')
ok(rb.index.versions.at(-1)!.from === 1 && rb.index.live === 3, 'the history only grows')

// editing
ok(newPropId([]) === 'p1' && newPropId([P('pz'), P('p2')]) === 'p10', 'ids only grow')
const one = addProp([], { k: 'tree:pale', x: 1.23456, z: 2, q: 5, s: 3 })!
ok(one.length === 1 && one[0].x === 1.235 && one[0].q === 1 && one[0].s === 2, 'add cleans')
ok(addProp(Array.from({ length: PROPS_MAX }, (_, i) => P(`p${i}`)), P('')) === null && addProp([], { ...P(''), k: 'nope' }) === null, 'refused: full, bad kind')
const mv = changeProp(A.props!, 'p1', { x: 7, solid: false })
ok(mv[0].x === 7 && mv[0].solid === false && A.props![0].x === 1 && removeProp(A.props!, 'p1').length === 1, 'change + remove never mutate')
ok(snapXZ(1.3, 1) === 1 && snapXZ(1.3, 0.5) === 1.5 && snapXZ(1.3, 0.25) === 1.25 && snapXZ(1.3337, 0) === 1.334 && J(snapXZ(-0.2, 1)) === '0', 'snap')
ok(turnBy(3, 90) === 0 && turnBy(0, 45) === 0.5 && turnBy(0, -90) === 3 && scaleBy(1, -1) === 1.05 && scaleBy(2, -1) === 2 && scaleBy(0.5, 1) === 0.5, 'turn + scale steps')
ok([1, 0.5, 0.25, 0].map(s => nextOf(PROP_SNAPS, s as never)).join() === '0.5,0.25,0,1', 'G walks 1, 0.5, 0.25, free')

// one undo history with the brushes
const store: Edits = {}, h = new EditHistory()
const set = (ps: Prop[]) => { h.begin(store, [PROPS_KEY]); store[PROPS_KEY] = propsToStore(ps); h.commit() }
set(one); h.begin(store, ['glade']); mergeEdits(store, { glade: { '5': 30 } }); h.commit(); set(changeProp(propsOfStore(store[PROPS_KEY]), 'p1', { x: 50 }))
ok(propsOfStore(store[PROPS_KEY])[0].x === 50, 'placed, sculpted, moved')
ok(h.undo(store).join() === PROPS_KEY && propsOfStore(store[PROPS_KEY])[0].x === 1.235, 'undo 1: the move')
ok(h.undo(store).join() === 'glade' && !store.glade?.['5'], 'undo 2: the stroke')
h.undo(store); ok(propsOfStore(store[PROPS_KEY]).length === 0, 'undo 3: the placing')
h.redo(store); h.redo(store); h.redo(store); ok(propsOfStore(store[PROPS_KEY])[0].x === 50 && store.glade['5'] === 30, 'redo all three')
console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
