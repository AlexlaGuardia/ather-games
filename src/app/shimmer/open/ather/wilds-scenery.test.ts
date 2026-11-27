// BETA M85 s1: SCENERY MODE on the Wilds (World Builder). The data path end to end, pure: the palette the Wilds take, the outcrop scale,
// draft save / load round-trip, Publish carries the pieces to the live layer, the game reads them back, and the solid ones register
// collision boxes (and the page wires those boxes into the walker + the Hollows). Run: npx tsx src/app/shimmer/open/ather/wilds-scenery.test.ts
import { readFileSync } from 'fs'
import { SCENERY, paletteOf, placeableOn, wildsPublishedProps, sceneryPlaced, sceneryBoxes, isSolid } from './scenery'
import { cleanProp, cleanProps, scaleBy, propsToStore, propsOfStore, OUTCROP_KINDS, OUTCROP_SCALE_MAX, SCALE_MAX, type Prop } from '../../world/builder-props'
import { cleanLayer, sameLayer, planPublish, emptyIndex, EMPTY_LAYER, type Layer } from '../../world/builder'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const P = (id: string, k: string, o: Partial<Prop> = {}): Prop => ({ id, k, x: 100, z: -40, q: 0, s: 1, ...o })

// 1. the palette
const W = paletteOf('wilds'), G = paletteOf('glade')
ok(G.length === SCENERY.length, `the Glade keeps every kind (${G.length})`)
ok(W.length > 40 && W.every(s => (s.group !== 'Nodes' || s.k === 'node:tensacia') && s.group !== 'Rooms' && !s.floats), `the Wilds take ${W.length} kinds: no nodes but Tensacia (M135 s1), no rooms, nothing floating`)
ok(W.filter(s => s.group === 'Nodes').map(s => s.k).join() === 'node:tensacia', 'M135 s1: the one node the Wilds take is Tensacia (Alex places its coves)')
for (const k of ['filler:rock-large', 'filler:rock-medium', 'filler:fence', 'filler:sign', 'filler:log-fallen', 'filler:stump']) ok(placeableOn('wilds', k), `the Wilds take ${k}`)
ok(W.some(s => s.group === 'Crystals') && W.some(s => s.group === 'Trees') && W.some(s => s.group === 'Props') && W.some(s => s.group === 'Furniture'), 'crystals, trees, props, furniture are in the Wilds kit')
ok(!placeableOn('wilds', 'filler:lily-pads') && !placeableOn('wilds', 'room:cooking') && !placeableOn('wilds', SCENERY.find(s => s.group === 'Nodes')!.k), 'lily pads, a room, a node: Glade only')
ok(!placeableOn('wilds', 'filler:nope') && !placeableOn('glade', 'filler:nope'), 'an unknown kind is placeable nowhere')

// 2. outcrops: the big rocks scale to 10, everything else stops at 2
ok(OUTCROP_KINDS.every(k => SCENERY.some(s => s.k === k)), 'every outcrop kind is a real palette kind')
ok(cleanProp(P('p1', 'filler:rock-large', { s: 8 }))!.s === 8 && cleanProp(P('p1', 'filler:rock-large', { s: 40 }))!.s === OUTCROP_SCALE_MAX, 'a large rock keeps scale 8; 40 clamps to 10')
ok(cleanProp(P('p1', 'filler:fence', { s: 8 }))!.s === SCALE_MAX && cleanProp(P('p1', 'tree:grove', { s: 8 }))!.s === SCALE_MAX, 'a fence / a tree still stop at 2')
ok(scaleBy(2, -1, 'filler:rock-large') === 2.25 && scaleBy(2.25, 1, 'filler:rock-large') === 2 && scaleBy(10, -1, 'filler:rock-large') === 10 && scaleBy(2, -1, 'filler:fence') === 2 && scaleBy(1, -1) === 1.05, 'wheel: 0.25 a notch above 2 for an outcrop, capped at 10; others at 2')

// 3. the draft: store + save + load round-trip
const pieces: Prop[] = [P('p1', 'filler:rock-large', { s: 6, q: 0.5 }), P('p2', 'filler:fence', { x: 120, z: -40, q: 1 }), P('p3', 'filler:sign', { x: 110, z: -30 }), P('p4', 'filler:flowers-white', { x: 140, z: -60 }), P('p5', 'crystal:' + (SCENERY.find(s => s.group === 'Crystals')!.k.slice(8)), { x: 90, z: -50, s: 1.5 })]
const store = propsToStore(pieces)
ok(JSON.stringify(propsOfStore(store)) === JSON.stringify(pieces), 'the editor store holds the pieces as they were')
const draft: Layer = { ...EMPTY_LAYER, tiles: { 'first-wilds': { 12: 3 } }, props: pieces }
const loaded = cleanLayer(JSON.parse(JSON.stringify(draft)))
ok(sameLayer(draft, loaded) && loaded.props!.length === 5 && loaded.props!.find(p => p.id === 'p1')!.s === 6, 'draft save -> reload: the same layer, the outcrop keeps scale 6')
const moved = cleanLayer(JSON.parse(JSON.stringify({ ...draft, props: pieces.map(p => (p.id === 'p1' ? { ...p, x: 130, q: 1.5, s: 9 } : p)) })))
ok(!sameLayer(draft, moved) && moved.props!.find(p => p.id === 'p1')!.x === 130 && moved.props!.find(p => p.id === 'p1')!.s === 9, 'a moved / turned / scaled piece survives the reload')

// 4. Publish carries the pieces to the live layer, and the game reads them back
const plan = planPublish(emptyIndex('wilds'), loaded, EMPTY_LAYER, '2026-11-27T00:00:00Z', 'm85 test')
const live = plan.writes.find(w => w.kind === 'live') as { kind: 'live'; layer: Layer }
ok(!!live && live.layer.props?.length === 5, 'Publish writes the pieces into the live layer')
const servedJson = JSON.parse(JSON.stringify(live.layer)) as { props?: unknown }   // the route passes the file through untouched
const read = wildsPublishedProps(servedJson.props)
ok(read.length === 5 && read.every((p, i) => p.id === pieces[i].id && p.k === pieces[i].k), 'the game reads every published piece back')
ok(wildsPublishedProps([...pieces, P('p9', 'filler:lily-pads'), P('p8', 'room:cooking'), { junk: 1 }]).length === 5 && wildsPublishedProps(null).length === 0 && wildsPublishedProps('x').length === 0, 'Glade-only kinds and junk in the live file are never drawn on the Wilds')
ok(cleanProps({ props: pieces }).length === 5, 'cleanProps agrees')

// 5. collision: the solid pieces register boxes, at their spot, scaled; the flowers do not
const ground = (x: number, z: number) => 4 + x * 0.01 + z * 0.0
const placed = sceneryPlaced(read, ground)
ok(placed.length === 5 && placed.every(p => Math.abs(p.y - ground(p.x, p.z)) < 1e-9), 'every piece stands on the ground under it')
const boxes = sceneryBoxes(placed)
const inBox = (x: number, z: number) => boxes.filter(b => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1)
ok(inBox(100, -40).length > 0 && inBox(120, -40).length > 0 && inBox(110, -30).length > 0 && inBox(90, -50).length > 0, 'the rock, the fence, the sign, the crystal each block their spot')
ok(inBox(140, -60).length === 0 && !isSolid(read.find(p => p.id === 'p4')!), 'the flowers do not block')
const rock = inBox(100, -40)[0]
ok(Math.abs((rock.x1 - rock.x0) - 1.75 * 6) < 1e-6 && Math.abs(rock.y1 - (ground(100, -40) + 1.65 * 6)) < 1e-6, `the outcrop's box scales with it (${(rock.x1 - rock.x0).toFixed(2)} m wide, top ${rock.y1.toFixed(2)})`)
ok(sceneryBoxes(sceneryPlaced([{ ...read[0], solid: false }], ground)).length === 0, "the owner's B toggle (solid: false) takes the box away")

// 6. the page wires it: the walker's world and the Hollows' obstacles both take the scenery boxes, and the scene draws them
const page = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8')
ok(/sceneryPlaced\(wildsPublishedProps\(propsJsonLive\(\)\), ww\.heightAt\)/.test(page), 'page: the Wilds read the published props over the live ground')
ok(/withZoneParts\(withPieces\(ww\.shape\), \[\.\.\.zonePartBoxes\(wildsParts\), \.\.\.wildsSceneryBoxes\]\)/.test(page), 'page: the walker collides with the scenery boxes')
ok(/setWildsPartBoxes\(\[\.\.\.zonePartBoxes\(wildsParts\), \.\.\.wildsSceneryBoxes\]\)/.test(page), 'page: Hollows steer round them, shots stop on them')
ok(/zone\.kind === 'wilds' && wildsDecor\.length > 0 && <SceneryView items=\{wildsDecor\} \/>/.test(page) && /wildsDecor = useMemo\(\(\) => wildsScenery\.filter\(p => !isNode\(p\)\)/.test(page), 'page: the Wilds scene draws them (M135: all but the nodes)')
ok(/zone\.kind === 'wilds' && wildsOwnNodes\.trees\.length > 0 && <GladeNodesView nodes=\{wildsOwnNodes\}/.test(page) && /<ForestryFX ww=\{wildsTrees\}/.test(page), 'page: M135 a placed Wilds node is drawn as a tree and aimed by ForestryFX')
ok(/const atNode = [^\n]*zoneRef0\.current === 'wilds' && wildsNodeIds\.current\.has\(id\)/.test(page) && /const own = gladeOwn\(ch\.w\.id\)/.test(page), 'page: M135 a placed Wilds node can be worked IN the Wilds, and its yield lands on Wilds ground')
const ed = readFileSync(new URL('../../dev/editors/TerrainEditor.tsx', import.meta.url), 'utf8')
ok(/const canPlace = glade \|\| map === 'wilds'/.test(ed) && /usePlace\(placing, propList, setPropList, setStatus, water, glade \? 'glade' : 'wilds'\)/.test(ed), 'editor: Scenery mode opens on the Wilds with the Wilds palette')
console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
