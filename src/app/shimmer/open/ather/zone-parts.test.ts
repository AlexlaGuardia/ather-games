// BETA M84 s3: published zone builds in the game (pure). Run: npx tsx src/app/shimmer/open/ather/zone-parts.test.ts
import { publishedZones, zoneParts, zonePartBoxes, withZoneParts } from './zone-parts'
import { FURNITURE } from './furniture'
import type { Shape } from '../terrain-world'
import { parseGladeLayer, gladeLayerEmpty } from './glade-layer'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const near = (a: number, b: number) => Math.abs(a - b) < 1e-6

// a live layer as the builder publishes it: one zone at (100, -40)..(112, -30), ground 3 m, with a wide slab, a bench on it, a wall
const layer = {
  v: 1, tiles: {}, water: {}, falls: {},
  zones: [
    { id: 'za', x0: 100, z0: -40, x1: 112, z1: -30, h: 3, tag: { kind: 'other' }, prev: {}, build: [
      { id: 'p1', item: 'goldwood_slab_wide', x: 4, z: 4, q: 0 },
      { id: 'p2', item: 'goldwood_bench', x: 4, z: 4, q: 0 },
      { id: 'p3', item: 'goldwood_panel_wide', x: 8, z: 2, q: 0.5 },
      { id: 'p4', item: 'goldwood_stool', x: 10, z: 8, q: 0 },
      { id: 'px', item: 'not_a_thing', x: 1, z: 1, q: 0 },
    ] },
    { id: 'zb', x0: 0, z0: 0, x1: 10, z1: 10, h: 1, tag: null, prev: {} },   // no build: not a published build
  ],
}
const wallItem = 'goldwood_panel_wide'
const zs = publishedZones(layer)
ok(zs.length === 1 && zs[0].id === 'za', 'only zones WITH a build are published builds')
ok(zs[0].build!.length === 4, 'junk parts dropped (unknown item), real ones kept')
ok(zs[0].tag?.kind === 'other', 'the tag rides along in the published data')
ok(publishedZones(null).length === 0 && publishedZones({ zones: 'x' }).length === 0, 'junk layer = no zones')

const ground = (x: number, z: number) => (x >= 90 && x <= 130 ? 3 : NaN)
const parts = zoneParts(zs, ground)
const by = (id: string) => parts.find(p => p.key === `za:${id}`)!
ok(parts.length === 4, 'every part drawn')
ok(near(by('p1').x, 104) && near(by('p1').z, -36), 'zone-local -> world (x0 + x, z0 + z)')
ok(near(by('p1').y, 3), 'a slab stands on the ground')
ok(near(by('p2').y, 3 + FURNITURE.goldwood_slab_wide.h), 'a bench ON the slab stands on the slab top (player rule)')
ok(near(by('p4').y, 3), 'a stool off the slab stands on the ground')
ok(by('p3').q === 0.5, 'the turn is kept')
ok(zoneParts(zs, () => NaN).length === 0, 'no ground (void) = no part')

const boxes = zonePartBoxes(parts)
ok(!boxes.some(b => b.x0 <= 110 && b.x1 >= 110 && b.z0 <= -32 && b.z1 >= -32), 'the stool (not solid) has no box')
const bench = boxes.filter(b => b.x0 <= 104 && b.x1 >= 104 && b.z0 <= -36 && b.z1 >= -36 && b.y1 > 3 + FURNITURE.goldwood_slab_wide.h + 0.1)
ok(bench.length === 1 && near(bench[0].y1, 3 + FURNITURE.goldwood_slab_wide.h + FURNITURE.goldwood_bench.h), 'the bench box tops out at slab + bench')
const wallBoxes = boxes.filter(b => b.x0 >= 100 && b.x1 <= 112 && Math.abs((b.x0 + b.x1) / 2 - 108) < FURNITURE[wallItem].w && Math.abs((b.z0 + b.z1) / 2 + 38) < FURNITURE[wallItem].w)
ok(wallBoxes.length > 1, `a 45 deg wall panel blocks as a chain of boxes (${wallBoxes.length})`)

// the shape: the walker meets the bench; elsewhere the base answers unchanged (the same array)
const baseBox = [{ x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 }]
const shape: Shape = { ground, solids: () => baseBox, water: () => [] }
const s = withZoneParts(shape, boxes)
const q = s.solids(103.9, 3, -36.1, 104.1, 4, -35.9)
ok(q.length === 3 && q[0] === baseBox[0] && q.some(b => near(b.y1, 3 + FURNITURE.goldwood_slab_wide.h + FURNITURE.goldwood_bench.h)), 'the walker query at the bench returns base + the slab + the bench')
ok(s.solids(50, 0, 50, 51, 9, 51) === baseBox, 'away from the zone the base answer is returned as is')
ok(withZoneParts(shape, []) === shape, 'no parts = the same shape')
ok(s.ground === shape.ground, 'ground untouched')

// the Glade's live layer carries them to the game (glade-layer.ts parseGladeLayer)
const gl = parseGladeLayer(layer)
ok(gl.zones?.length === 1 && gl.zones[0].build?.length === 4, 'the Glade layer parse keeps the published zone builds')
ok(!gladeLayerEmpty(gl) && parseGladeLayer({ v: 1, tiles: {}, water: {}, falls: {} }).zones === undefined, 'a layer with only a build is not empty; none = no zones key')

console.log(fails ? `\n${fails} FAIL` : '\nall pass')
process.exit(fails ? 1 : 0)
