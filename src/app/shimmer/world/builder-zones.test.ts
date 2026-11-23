// BETA M84 s1 + M114: building zones (pure). Run: npx tsx src/app/shimmer/world/builder-zones.test.ts
import { flattenZone, zoneWeight, normRect, bigEnough, overlapping, zoneAt, cleanZones, cleanTag, zoneLabel, zoneOverlay, newZoneId, ZONE_BLEND_M, type Zone } from './builder-zones'
import { cleanLayer, sameLayer, layerSize, type Layer } from './builder'
import { mergeEdits, type Edits, type BrushTile } from '../open/ather/wilds-edits'
import { choicesFor, gladeHomes, shopChoices, supplierChoices } from '../dev/editors/zone-choices'
import { FRONT_SHOPS } from '../open/business/doors'
import { GOODS } from '../open/trade'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }

// a 1-tile world: 101 x 101 vertices, 2 m cells, centre (0,0); base ground = a slope h = 0.1 x + 5
const T: BrushTile = { name: 't', ox: 0, oz: 0, nx: 101, nz: 101, cell: 2, sizeX: 200, sizeZ: 200 }
const base = (x: number) => 0.1 * x + 5
const vx = (k: number) => -100 + (k % 101) * 2, vz = (k: number) => -100 + Math.floor(k / 101) * 2
const edits: Edits = { t: { [String(50 * 101 + 50)]: 30 } }   // a 3 m bump at the centre (an earlier stroke)
const hAt = (x: number, z: number) => { const i = Math.round((x + 100) / 2), j = Math.round((z + 100) / 2); return base(x) + (edits.t?.[String(j * 101 + i)] ?? 0) / 10 }
const before = JSON.stringify(edits)

// rect + weight
const r = normRect(10, 20, -10, -20)
ok(r.x0 === -10 && r.x1 === 10 && r.z0 === -20 && r.z1 === 20 && bigEnough(r) && !bigEnough(normRect(0, 0, 3, 30)), 'normRect sorts corners; a drag under 4 m on a side is a click')
ok(zoneWeight(r, 0, 0) === 1 && zoneWeight(r, 10, 20) === 1 && zoneWeight(r, 10 + ZONE_BLEND_M, 0) === 0 && zoneWeight(r, 14, 0) > 0 && zoneWeight(r, 14, 0) < 1, 'weight: 1 inside, blends to 0 at the margin')

// flatten to h = 6
const { d, prev } = flattenZone([T], hAt, edits, r, 6)
mergeEdits(edits, d)
let inside = 0, insideBad = 0
for (const [k] of Object.entries(edits.t)) { const x = vx(+k), z = vz(+k); if (x >= -10 && x <= 10 && z >= -20 && z <= 20) { inside++; if (Math.abs(hAt(x, z) - 6) > 0.051) insideBad++ } }
ok(inside > 200 && insideBad === 0, `flatten: every vertex inside is at 6 m (${inside} inside, ${insideBad} off)`)
ok(Math.abs(hAt(-30, 0) - base(-30)) < 1e-9 && Math.abs(hAt(40, 40) - base(40)) < 1e-9, 'beyond the blend the ground is untouched')
const mid = hAt(14, 0)   // 4 m out: between the flat (6) and the land (6.4)
ok(mid > 6 && mid < base(14), `the edge blends (${mid.toFixed(2)} between 6 and ${base(14).toFixed(2)})`)
ok(prev.t[String(50 * 101 + 50)] === 30 && Object.keys(prev.t).length === Object.keys(d.t).length, 'prev keeps the old delta of every changed vertex (the 3 m bump too)')

// delete = write prev back: byte-identical to before
mergeEdits(edits, prev)
ok(JSON.stringify(edits) === before, 'delete restores the ground exactly (incl. the earlier bump)')

// overlap / select
const z1: Zone = { id: 'a', ...r, h: 6, tag: null, prev }
ok(overlapping([z1], normRect(12, 0, 30, 10)) === z1, 'a zone inside another one\'s blend margin is refused')
ok(overlapping([z1], normRect(10 + 2 * ZONE_BLEND_M + 1, 0, 60, 10)) === null, 'clear of both margins: allowed')
ok(zoneAt([z1], 0, 0) === z1 && zoneAt([z1], 12, 0) === null, 'a click inside the rectangle selects it, the blend does not')
ok(newZoneId([{ ...z1, id: newZoneId([], 5) }], 5) !== newZoneId([], 5), 'zone ids never collide')

// tags + labels
ok(zoneLabel({ tag: null }) === 'zone (untagged)' && zoneLabel({ tag: { kind: 'home', ref: 'g', name: 'Gregory' } }) === 'Home: Gregory' && zoneLabel({ tag: { kind: 'other' } }) === 'Other (locked)', 'labels')
ok(cleanTag({ kind: 'other', ref: 'x', name: 'y' })!.ref === undefined && cleanTag({ kind: 'villa' }) === null && cleanTag({ kind: 'shop', ref: 'smithy', name: 'The Smithy' })!.name === 'The Smithy', 'cleanTag: other has no ref; unknown kinds dropped')
const ov = zoneOverlay([{ ...z1, tag: { kind: 'shop', ref: 'smithy', name: 'The Smithy' } }])
ok(ov.pois[0].name === 'Shop: The Smithy' && ov.pois[0].x === 0 && ov.roads[0].pts.length === 5, 'overlay: a marker at the centre named by the tag + the closed rectangle')

// the layer round trip (what Save / the route keeps)
const tagged: Zone = { ...z1, tag: { kind: 'home', ref: 'greg', name: 'Gregory' } }
const L: Layer = { v: 1, tiles: { t: { '5': 10 } }, water: {}, falls: {}, zones: [tagged] }
const back = cleanLayer(JSON.parse(JSON.stringify(L)))
ok(back.zones?.length === 1 && back.zones[0].tag?.name === 'Gregory' && JSON.stringify(back.zones[0].prev) === JSON.stringify(prev), 'cleanLayer keeps a zone, its tag and its prev')
ok(!('zones' in cleanLayer({ v: 1, tiles: {}, water: {}, falls: {} })), 'no zones = no key (pre-M84 layers byte-identical)')
ok(cleanZones({ zones: [{ id: 'x', x0: 0, z0: 0, x1: 'a', z1: 1, h: 1, prev: {} }, { id: 'y', x0: 0, z0: 0, x1: 9, z1: 9, h: 1, prev: { t: { '1': 9.5 } } }, 7] }).length === 0, 'junk zones dropped (bad number, fractional prev, not an object)')
ok(!sameLayer(L, { ...L, zones: [{ ...tagged, tag: { kind: 'other' } }] }) && sameLayer(L, back), 'a re-tag is an unpublished change; the round trip is the same layer')
ok(layerSize(L).zones === 1, 'layerSize counts zones')
ok(!sameLayer(L, { ...L, zones: [{ ...tagged, tag: { ...tagged.tag!, front: 'e' } }] }), 'M114 s3: a new front edge is an unpublished change')

// the dropdowns: existing data only
const homes = gladeHomes()
ok(homes.some(c => c.name === 'Gregory') && homes.some(c => c.name === 'Hazel') && homes.length >= 6, `Glade homes: Gregory + the friends + the Glade's Moglins (${homes.map(c => c.name).join(', ')})`)
ok(shopChoices().length === Object.keys(FRONT_SHOPS).length && shopChoices().every(c => FRONT_SHOPS[c.ref]?.name === c.name), 'shops = the canon storefronts, their own names')
ok(supplierChoices().every(c => GOODS[c.ref as keyof typeof GOODS]?.name === c.name), 'suppliers = the trade goods, their own names (stand-in, flagged)')
ok(choicesFor('other', 'glade', null).length === 0, 'Other has no list')

console.log(fails ? `\n${fails} FAILED` : '\nall pass')
process.exit(fails ? 1 : 0)
