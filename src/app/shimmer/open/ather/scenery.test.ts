// BETA M153 s1a: the palette and how a placed piece stands and blocks. Run: npx tsx src/app/shimmer/open/ather/scenery.test.ts
import { readFileSync } from 'fs'
import { SCENERY, SCENERY_BY, SCENERY_GROUPS, BUSHES, PROP_SIZE, sceneryPlaced, sceneryBoxes, isSolid } from './scenery'
import { FLORA_LOOKS } from '../../world/flora-placements'
import { PROP_MODELS } from '../../world/prop-models'
import { FURNITURE_ORDER } from './furniture'
import { cleanProps, type Prop } from '../../world/builder-props'
import { parseGladeLayer, gladeLayerGround, gladeLayerEmpty } from './glade-layer'
import { gladeVertex, GLADE_N } from '../../world/glade-builder'
import { gladeZoneGround } from './glade-cluster'
let fails = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (!c) fails++ }
const P = (k: string, o: Partial<Prop> = {}): Prop => ({ id: 'p1', k, x: 10, z: 20, q: 0, s: 1, ...o })
const flat = () => 3

// the palette is the real lists
ok(SCENERY.filter(s => s.group === 'Trees').length === Object.keys(FLORA_LOOKS).length && SCENERY.filter(s => s.group === 'Bushes').length === 3 && SCENERY.filter(s => s.group === 'Crystals').length === 7, 'trees, 3 bushes, crystal bodies')
ok(Object.keys(PROP_MODELS).every(id => SCENERY_BY.has(`prop:${id}`) && !!PROP_SIZE[id]) && FURNITURE_ORDER.every(id => SCENERY_BY.has(`piece:${id}`)), 'every prop model (sized) and every furniture piece')
ok(SCENERY_BY.size === SCENERY.length && SCENERY.every(s => SCENERY_GROUPS.includes(s.group) && s.label && s.h > 0 && s.w > 0 && s.d > 0), 'one per kind, sized')
ok(cleanProps({ props: SCENERY.map((s, i) => P(s.k, { id: `p${i}` })) }).length === SCENERY.length, 'the store accepts every palette kind')
// sizes = the model files (POSITION accessor bounds + the node's own offset)
const size = (url: string) => {
  const b = readFileSync(`public${url}`), j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as { nodes: { mesh?: number; translation?: number[]; rotation?: number[] }[]; meshes: { primitives: { attributes: { POSITION: number } }[] }[]; accessors: { min: number[]; max: number[] }[] }
  const lo = [9, 9, 9], hi = [-9, -9, -9]
  for (const n of j.nodes) if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) { const a = j.accessors[p.attributes.POSITION], t = n.translation ?? [0, 0, 0]; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a.min[i] + t[i]); hi[i] = Math.max(hi[i], a.max[i] + t[i]) } }
  return hi.map((v, i) => v - lo[i])
}
for (const [id, m] of Object.entries(PROP_MODELS)) { const [w, h, d] = size(m.url), z = PROP_SIZE[id]; ok(!!z && Math.abs(w / h - z.w) < 0.02 && Math.abs(d / h - z.d) < 0.02, `${id}: footprint matches its model (${(w / h).toFixed(2)} x ${(d / h).toFixed(2)})`) }
for (const [id, z] of Object.entries(BUSHES)) { const [w, h, d] = size(`/models/flora/${id}.glb`); ok(Math.abs(w - z.w) < 0.03 && Math.abs(h - z.h) < 0.03 && Math.abs(d - z.d) < 0.06, `${id}: size matches its model (${w.toFixed(2)} ${d.toFixed(2)} ${h.toFixed(2)})`) }

// standing
ok(sceneryPlaced([P('tree:grove'), P('tree:gone'), P('bush:bloom-bush', { x: 99 })], x => (x > 50 ? NaN : 3)).map(p => `${p.k}@${p.y}`).join() === 'tree:grove@3', 'on the ground; an unknown kind or off the land is not drawn')
const spot = gladeVertex(GLADE_N >> 1, GLADE_N >> 1); let vx = 0
for (let k = 0; k < GLADE_N * GLADE_N; k++) { const v = gladeVertex(k % GLADE_N, Math.floor(k / GLADE_N)); if ([0, 4, -4].every(a => [0, 4, -4].every(b => Number.isFinite(gladeZoneGround(v.x + a, v.z + b))))) { vx = k; Object.assign(spot, v); break } }
const j = { v: 1, tiles: { glade: { [vx]: 30 } }, water: {}, falls: {}, props: [P('tree:grove', { x: spot.x + 1, z: spot.z + 0.5 })] }
const L = parseGladeLayer(j), L0 = parseGladeLayer({ ...j, tiles: {} }), y1 = sceneryPlaced(L.props!, gladeLayerGround(L.edits))[0].y, y0 = sceneryPlaced(L0.props!, gladeLayerGround(L0.edits))[0].y
ok(Math.abs(y1 - y0 - 3 * 0.75) < 1e-6, `a terrain edit lifts it on the drawn triangle (+${(y1 - y0).toFixed(3)}, triLerp 2.25)`)
ok(!('props' in parseGladeLayer({ v: 1, tiles: {} })) && !gladeLayerEmpty(L0) && gladeLayerEmpty(parseGladeLayer({})), 'a layer with no props has no key; one with only props is not empty')

// blocking
const boxes = (p: Prop) => sceneryBoxes(sceneryPlaced([p], flat))
ok(isSolid(P('tree:grove')) && !isSolid(P('bush:bloom-bush')) && isSolid(P('prop:chest')) && !isSolid(P('piece:goldwood_stool')) && isSolid(P('crystal:raw')), 'trunks + big props block, bushes and stools do not')
ok(boxes(P('bush:bloom-bush')).length === 0 && boxes(P('bush:bloom-bush', { solid: true })).length === 1 && boxes(P('tree:grove', { solid: false })).length === 0, 'the toggle wins both ways')
const t1 = boxes(P('tree:grove'))[0], t2 = boxes(P('tree:grove', { s: 2, q: 0.5 }))[0], K = SCENERY_BY.get('tree:grove')!
ok(t1.x1 - t1.x0 < K.w * 0.3 && Math.abs((t1.x0 + t1.x1) / 2 - 10) < 1e-9 && t1.y0 === 2.5, 'a tree blocks with its trunk, not its crown')
ok(Math.abs((t2.x1 - t2.x0) - 2 * (t1.x1 - t1.x0)) < 1e-9 && Math.abs((t2.y1 - 3) - 2 * (t1.y1 - 3)) < 1e-9, 'scale scales the box')
const b0 = boxes(P('prop:alchemy_station'))[0], b1 = boxes(P('prop:alchemy_station', { q: 1 }))[0]
ok(Math.abs((b0.x1 - b0.x0) - (b1.z1 - b1.z0)) < 1e-9 && b0.x1 - b0.x0 > b0.z1 - b0.z0, 'a quarter turn turns the footprint')
const panel = SCENERY.find(s => s.panel && s.solid)!
ok(boxes(P(panel.k)).length === 1 && boxes(P(panel.k, { q: 0.5 })).length > 1, 'a wall panel off the axes is a chain')
console.log(fails ? `\n${fails} FAILED` : '\nall pass'); process.exit(fails ? 1 : 0)
