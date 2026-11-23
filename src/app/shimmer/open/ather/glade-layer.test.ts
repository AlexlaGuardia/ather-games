// BETA M83 s2b: the Glade builder layer in the game (pure). Run: npx tsx src/app/shimmer/open/ather/glade-layer.test.ts
import * as THREE from 'three'
import { parseGladeLayer, gladeLayerGround, gladeLift, liftGeometry, gladePonds, NO_GLADE_LAYER } from './glade-layer'
import { gladeZoneGround } from './glade-cluster'
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
ok(near(G(2, 0), gladeZoneGround(2, 0) + 2.5), 'half a cell off the vertex: half the hill (bilinear)')
ok(near(G(40, 40), gladeZoneGround(40, 40)), 'far from the edit: untouched')
const B = sampleGladeBase(gladeZoneGround)
let voidK = -1; for (let k = 0; k < B.voidV.length; k++) if (B.voidV[k]) { voidK = k; break }
const vx = GLADE_TILE_CENTER.x - GLADE_SIZE / 2 + (voidK % GLADE_N) * GLADE_CELL, vz = GLADE_TILE_CENTER.z - GLADE_SIZE / 2 + Math.floor(voidK / GLADE_N) * GLADE_CELL
ok(!Number.isFinite(gladeLayerGround({ [voidK]: 100 })(vx, vz)), 'an edit over the void adds no land (still NaN)')

// the meshes: liftGeometry at world xz, with a mate island's place mapped exactly as three places it
const lift = gladeLift(L.edits)!
ok(gladeLift(null) === null, 'no edits = nothing to lift')
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

console.log(`\n${passes} passed, ${fails} failed`)
process.exit(fails ? 1 : 0)
