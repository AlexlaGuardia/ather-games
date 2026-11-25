// BETA M83 s2b: the Glade builder layer in the game (pure). Run: npx tsx src/app/shimmer/open/ather/glade-layer.test.ts
import * as THREE from 'three'
import { parseGladeLayer, gladeLayerGround, gladeLift, liftGeometry, gladePonds, gladeFrame, gladeWet, NO_GLADE_LAYER, type GladeLayer } from './glade-layer'
import { gladeZoneGround, GLADE_FRAME } from './glade-cluster'
import { PLOT_CELL, PLOT_HALF, plotVertexHeight } from './plot'
import { MOONWELL, shoreRadius } from './moonwell'
import { POOL_Y, poolEdge, poolSheet } from './moonwell-water'
import { poolRim, RIM_TOP } from './moonwell-rim'
import { GLADE_N, GLADE_CELL, GLADE_SIZE, GLADE_TILE_CENTER, sampleGladeBase } from '../../world/glade-builder'
let fails = 0, passes = 0
const ok = (c: boolean, m: string) => { console.log(`${c ? '✓' : '✗'} ${m}`); if (c) passes++; else fails++ }
const near = (a: number, b: number, e = 1e-4) => Math.abs(a - b) < e

const vk = (x: number, z: number) => { const i = (x - GLADE_TILE_CENTER.x + GLADE_SIZE / 2) / GLADE_CELL, j = (z - GLADE_TILE_CENTER.z + GLADE_SIZE / 2) / GLADE_CELL; return j * GLADE_N + i }

// parsing: junk and an empty file are no layer; a published tile comes through
ok(parseGladeLayer(null).edits === null && parseGladeLayer('x').water === null, 'junk = no layer')
ok(parseGladeLayer({ v: 1, tiles: {}, water: {}, falls: {} }).edits === null, 'the empty published file = no layer')
ok(parseGladeLayer({ tiles: { other: { 5: 3 } } }).edits === null, "another tile's edits are not the Glade's")
const K0 = vk(0, 0)   // Greg's island centre, on the tile's grid
ok(Number.isInteger(K0), 'Greg\'s island centre (0,0) sits on a tile vertex (the grids line up)')
const L = parseGladeLayer({ v: 1, tiles: { glade: { [K0]: 50 } }, water: {}, falls: {} })
ok(L.edits?.[K0] === 50, 'a published hill vertex comes through')

// the walker's ground
ok(gladeLayerGround(null) === gladeZoneGround, 'no edits = gladeZoneGround itself')
const G = gladeLayerGround(L.edits), base0 = gladeZoneGround(0, 0)
ok(Number.isFinite(base0) && near(G(0, 0), base0 + 5), `a +5 m hill at (0,0): the keeper stands on ${G(0, 0).toFixed(2)} (base ${base0.toFixed(2)})`)
ok(near(G(2, 0), gladeZoneGround(2, 0) + 2.5), 'half a cell off the vertex: half the hill (on the edge)')
ok(near(G(40, 40), gladeZoneGround(40, 40)), 'far from the edit: untouched')
const B = sampleGladeBase(gladeZoneGround)
let voidK = -1; for (let k = 0; k < B.voidV.length; k++) if (B.voidV[k]) { voidK = k; break }
const vx = GLADE_TILE_CENTER.x - GLADE_SIZE / 2 + (voidK % GLADE_N) * GLADE_CELL, vz = GLADE_TILE_CENTER.z - GLADE_SIZE / 2 + Math.floor(voidK / GLADE_N) * GLADE_CELL
ok(!Number.isFinite(gladeLayerGround({ [voidK]: 100 })(vx, vz)), 'an edit over the void adds no land (still NaN)')

// the meshes: liftGeometry at world xz, with a mate island's place mapped exactly as three places it
const lift = gladeLift(L.edits)!
ok([[0, 0], [40, 40], [-60, 112], [-200, 200]].every(([x, z]) => gladeLift(null)(x, z) === 0) && gladeLift(null)(-124, 112) < -1.5, 'no edits = nothing to lift but the Moonwell bowl (M157)')
const g1 = new THREE.BufferGeometry(); g1.setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 0, 2, 1, 0, 40, 1, 40], 3))
liftGeometry(g1, lift)
const p1 = g1.getAttribute('position')
ok(near(p1.getY(0), 6) && near(p1.getY(1), 3.5) && near(p1.getY(2), 1), 'an unplaced mesh lifts by the delta at its own xz')
// a mate's island: local (lx, lz) placed by rotation-y then offset; pick the local point that lands on (0,0)
const place = { x: 30, z: -20, rot: 0.7 }
const m = new THREE.Matrix4().makeRotationY(place.rot).setPosition(place.x, 0, place.z), inv = m.clone().invert()
const loc = new THREE.Vector3(0, 0, 0).applyMatrix4(inv)
const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute([loc.x, 0, loc.z, 0, 0, 0], 3))
liftGeometry(g2, lift, place)
const p2 = g2.getAttribute('position')
ok(near(p2.getY(0), 5, 1e-3), 'a placed + turned island lifts where it actually stands in the world (three\'s rotation-y)')
ok(near(p2.getY(1), lift(place.x, place.z)), "the island's own origin lifts by the delta at its place, not at (0,0)")

// painted water
const land = (() => { for (let j = 0; j < GLADE_N - 1; j++) for (let i = 0; i < GLADE_N - 1; i++) { const k = j * (GLADE_N - 1) + i; if (!B.voided[k]) return { k, i, j } } return null })()!
const lo = Math.min(B.h[land.j * GLADE_N + land.i], B.h[land.j * GLADE_N + land.i + 1], B.h[(land.j + 1) * GLADE_N + land.i], B.h[(land.j + 1) * GLADE_N + land.i + 1])
const wet = gladePonds({ edits: null, water: { [land.k]: Math.round((lo + 1) * 10) } })
ok(wet.length === 1 && wet[0].i === land.i && wet[0].j === land.j, 'water painted 1 m over a land cell is a pond cell')
ok(gladePonds({ edits: null, water: { [land.k]: Math.round((lo - 1) * 10) } }).length === 0, 'water under the ground is dry')
let voidCell = -1; for (let k = 0; k < B.voided.length; k++) if (B.voided[k]) { voidCell = k; break }
ok(gladePonds({ edits: null, water: { [voidCell]: 100 } }).length === 0, 'no water hangs over the void')
ok(gladePonds(NO_GLADE_LAYER).length === 0, 'no layer = no water')

// ── M157: drawn ground = walker, over the pond + its shore + a ring of the garden, unsculpted and with a sculpted layer ──
{
  const X0 = -148, X1 = -88, Z0 = 76, Z1 = 144, C = PLOT_CELL, HALF = PLOT_HALF
  const island = (lift: (x: number, z: number) => number) => {   // plot-scene's mesh triangles round the pond, lifted as the game lifts them
    const pos: number[] = []
    for (let x = X0; x < X1; x += C) for (let z = Z0; z < Z1; z += C) {
      const v = (a: number, b: number) => [a, plotVertexHeight((a + HALF) / C, (b + HALF) / C), b]
      pos.push(...v(x, z), ...v(x + C, z + C), ...v(x + C, z), ...v(x, z), ...v(x, z + C), ...v(x + C, z + C))
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    const m = new THREE.Mesh(liftGeometry(g, lift), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); m.updateMatrixWorld()
    const rc = new THREE.Raycaster()
    return (x: number, z: number) => { rc.set(new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0)); return rc.intersectObject(m)[0].point.y }
  }
  const worst = (edits: Record<string, number> | null) => {
    const draw = island(gladeLift(edits)), walk = gladeLayerGround(edits)
    let w = 0; for (let x = X0 + 0.7; x < X1; x += 1.3) for (let z = Z0 + 0.6; z < Z1; z += 1.3) w = Math.max(w, Math.abs(draw(x, z) - walk(x, z)))
    return w
  }
  const rough: Record<string, number> = {}; for (let x = X0; x <= X1; x += C) for (let z = Z0; z <= Z1; z += C) rough[vk(x, z)] = ((x * 7 + z * 13) % 37) - 10
  ok(worst(null) < 0.01, `M157: unsculpted, drawn = walked over the pond (worst ${worst(null).toFixed(4)} m)`)
  ok(worst(rough) < 0.01, `M157: sculpted rough, drawn = walked over the pond (worst ${worst(rough).toFixed(4)} m)`)
  const base = gladeLayerGround(null)
  ok(base(MOONWELL.x, MOONWELL.z) < POOL_Y - 1.5, `M157: unsculpted, the pond is a bowl (${base(MOONWELL.x, MOONWELL.z).toFixed(2)}) under the water (${POOL_Y})`)
  let dry = 0; for (let x = X0; x < X1; x += 1) for (let z = Z0; z < Z1; z += 1) if (Math.hypot(x - MOONWELL.x, z - MOONWELL.z) < shoreRadius(x, z) && base(x, z) >= POOL_Y) dry++
  ok(dry === 0, 'M157: unsculpted, the whole ellipse is under the water')
  const e0 = poolEdge(base); let lip = 0
  for (const p of e0) lip = Math.max(lip, POOL_Y - base(p.x, p.z))
  ok(lip < 0.18 && e0.every(p => p.r < shoreRadius(p.x, p.z) + 4.1), `M157: the sheet's edge meets the bank (worst gap ${lip.toFixed(3)} m)`)
  // M165: the rim is stones now; the assert's meaning is the same (nothing floats or is buried): every stone's top edge is 14 cm .. RIM_TOP over ITS ground
  const gr = gladeLayerGround(rough), rim = poolRim(gr)
  const hs = rim.tops.map(q => q.h - gr(q.x, q.z))
  ok(hs.length > 300 && hs.every(h => h > 0.14 && h < RIM_TOP), `M157: the rim lies on the sculpted ground (${Math.min(...hs).toFixed(3)}..${Math.max(...hs).toFixed(3)})`)
  const S = poolSheet(base).pos; ok(S.every((v, k) => k % 3 !== 1 || Math.abs(v - POOL_Y) < 1e-5), 'M157: the sheet is level at POOL_Y')
  // a mate's island turned a quarter splits its cells the other way: the walker reads that island's triangles too
  const mt = GLADE_FRAME.mates.find(m => Math.abs(Math.sin(m.rot)) > 0.5)!, hump = { [vk(mt.x, mt.z)]: 40 }
  const at = gladeLayerGround(hump), up = (dx: number, dz: number) => at(mt.x + dx, mt.z + dz) - gladeZoneGround(mt.x + dx, mt.z + dz)
  ok(near(up(1, 1), 2, 1e-3) && near(up(-1, 1), 3, 1e-3), `M157: a quarter-turned island is walked on its own triangles (${up(1, 1).toFixed(2)}, ${up(-1, 1).toFixed(2)})`)
}

// M160: no generated tree stands in the layer's water
{
  const all = GLADE_FRAME.meadow!.trees, list = (l: GladeLayer) => gladeFrame(l).meadow!.trees
  ok(gladeFrame(NO_GLADE_LAYER) === GLADE_FRAME && gladeFrame({ edits: { [K0]: 50 }, water: null }) === GLADE_FRAME, 'M160: no painted water = the very same frame, the same trees')
  const k = all.findIndex(t => t.x > -120 && t.x < -90 && t.z > 190 && t.z < 215), T = all[k], g = gladeZoneGround(T.x, T.z)
  const cell = (x: number, z: number) => Math.floor((z - GLADE_TILE_CENTER.z + GLADE_SIZE / 2) / GLADE_CELL) * (GLADE_N - 1) + Math.floor((x - GLADE_TILE_CENTER.x + GLADE_SIZE / 2) / GLADE_CELL)
  const paint = (level: number) => { const water: Record<string, number> = {}; for (const dx of [-4, 0, 4]) for (const dz of [-4, 0, 4]) water[cell(T.x + dx, T.z + dz)] = Math.round(level * 10); return { edits: null, water } }
  const wet = paint(g + 1), L1 = list(wet)
  ok(!L1.includes(T) && L1.length < all.length, `M160: a tree under 1 m of painted water is out of the list (${all.length - L1.length})`)
  ok(gladeFrame(wet) === gladeFrame(wet), 'M160: one frame per layer (no rebuild each render)')
  ok(L1.every((t, n) => t === all[gladeFrame(wet).meadow!.treeNo![n]]), 'M160: the rest are the same trees, in order, each with its own number (its tint)')
  ok(all.every(t => L1.includes(t) || gladeWet(wet)(t.x, t.z) || Math.hypot(t.x - T.x, t.z - T.z) < 9), 'M160: only trees by that water are gone')
  ok(GLADE_FRAME.meadow!.trees === all && all.length > 300 && all.includes(T), 'M160: the full list is not touched')
  ok(list(paint(g - 1)).includes(T), 'M160: the water lowered under its ground: the tree is back')
  const lift: Record<string, number> = {}; for (let dx = -12; dx <= 12; dx += 4) for (let dz = -12; dz <= 12; dz += 4) lift[vk(Math.round(T.x / 4) * 4 + dx, Math.round(T.z / 4) * 4 + dz)] = 30
  ok(list({ ...wet, edits: lift }).includes(T), 'M160: the ground raised out of the water: the tree is back')
  const x0 = Math.floor((T.x - GLADE_TILE_CENTER.x + GLADE_SIZE / 2) / GLADE_CELL) * GLADE_CELL + GLADE_TILE_CENTER.x - GLADE_SIZE / 2, z0 = Math.floor((T.z - GLADE_TILE_CENTER.z + GLADE_SIZE / 2) / GLADE_CELL) * GLADE_CELL + GLADE_TILE_CENTER.z - GLADE_SIZE / 2
  const bank: GladeLayer = { ...wet, edits: { [vk(x0 + 4, z0)]: 30, [vk(x0, z0 + 4)]: 30, [vk(x0 + 4, z0 + 4)]: 30 } }   // the cell keeps one low, wet corner
  ok(gladePonds(bank).some(c => c.j * (GLADE_N - 1) + c.i === cell(T.x, T.z)) && list(bank).includes(T), 'M160: a wet cell whose ground at the tree is over the water keeps the tree')
  // the pool's plane: the sheet's inside and outside, and ground over it
  const w0 = gladeWet(NO_GLADE_LAYER), r = shoreRadius(MOONWELL.x + 1, MOONWELL.z)
  ok(w0(MOONWELL.x, MOONWELL.z) && !w0(MOONWELL.x + r + 6, MOONWELL.z), 'M160: wet in the Moonwell, dry past its shore')
  const dry: Record<string, number> = {}; for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) dry[vk(Math.round(MOONWELL.x / 4) * 4 + dx, Math.round(MOONWELL.z / 4) * 4 + dz)] = 60
  ok(!gladeWet({ edits: dry, water: null })(MOONWELL.x, MOONWELL.z), 'M160: an islet raised out of the pool is dry')
}

console.log(`\n${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
