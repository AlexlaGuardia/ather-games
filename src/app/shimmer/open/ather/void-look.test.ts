// The void look (Alex 11-23; v2 06:4x): a fog column fills the pit from above its floor to just under the rim, thinning upward,
// feathered at the lip.
// Run: npx tsx src/app/shimmer/open/ather/void-look.test.ts
import { hazeGeometry, HAZE_LAYERS, VOID_FLOOR, layerY } from './void-look'
import { VOID_DEPTH, VOID_HALF, VOID_FADE } from './wilds-voids'
import type { Wilds } from './wilds'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// a 200 m tile, 4 m cells; land at 20 m; a void stripe 24 m wide down x in [-12, 12), carved as wilds-voids does (v2: a pit
// VOID_DEPTH deep, the lip rolling over across VOID_FADE)
const nx = 51, nz = 51, cell = 4, cx = nx - 1, LAND = 20
const voided = new Uint8Array(cx * (nz - 1))
for (let j = 0; j < nz - 1; j++) for (let i = 0; i < cx; i++) { const x = -100 + (i + 0.5) * cell; if (x > -12 && x < 12) voided[j * cx + i] = 1 }
const sm = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c) }
const wOf = (x: number) => { const d = Math.abs(x); return d <= VOID_HALF ? 1 : d >= VOID_HALF + VOID_FADE ? 0 : 1 - sm((d - VOID_HALF) / VOID_FADE) }
const h = new Float32Array(nx * nz), voidDrop = new Float32Array(nx * nz)
for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const d = VOID_DEPTH * wOf(-100 + i * cell); voidDrop[j * nx + i] = d; h[j * nx + i] = LAND - d }
const meta = { name: 't', cell, nx, nz, sizeX: 200, sizeZ: 200, waterY: 0 }
const W = { meta, voided, h, voidDrop } as unknown as Wilds
ok(hazeGeometry({ meta } as unknown as Wilds) === null, 'a tile with no void has no haze')
ok(hazeGeometry({ meta, voided: new Uint8Array(cx * (nz - 1)), h: new Float32Array(nx * nz), voidDrop: new Float32Array(nx * nz) } as unknown as Wilds) === null, 'a tile with no pit carved has no haze')
const H = hazeGeometry(W)!
ok(!!H && H.cells > 0, `haze built (${H?.cells} cells)`)
const pos = H.geo.getAttribute('position').array as Float32Array, aV = H.geo.getAttribute('aV').array as Float32Array, aK = H.geo.getAttribute('aK').array as Float32Array
const floor = LAND - VOID_DEPTH
let outside = 0, low = 0, wrongY = 0, rimFed = 0, centreSolid = 0, topOver = 0, topY = -Infinity
for (let n = 0; n < aV.length; n++) {
  const x = pos[n * 3], y = pos[n * 3 + 1]
  if (Math.abs(x) > VOID_HALF + VOID_FADE + 8 + 1e-6) outside++   // one 8 m haze step past the lip at most
  if (y - floor < 0.3) low++                                      // M58: nothing coplanar with the pit floor
  if (Math.abs(y - (floor + layerY(aK[n], VOID_DEPTH))) > 1e-4) wrongY++   // every layer flat across the floor AND over the cliff
  if (Math.abs(x) >= VOID_HALF + VOID_FADE && aV[n] > 0) rimFed++  // past the lip (no carve) the haze is fully faded
  if (Math.abs(x) <= 4 && aV[n] === 1) centreSolid++
  if (y > LAND - 2) topOver++                                     // the column stays under the rim
  topY = Math.max(topY, y)
}
ok(outside === 0, `haze stays over the pit (${outside} vertices outside)`)
ok(low === 0, `the lowest haze floats above the floor (${low} too low)`)
ok(wrongY === 0, `each layer at its height (${wrongY} off)`)
ok(rimFed === 0, `the rim feathers to nothing (${rimFed} rim vertices with haze)`)
ok(centreSolid > 0, 'the void centre carries full haze')
ok(topOver === 0 && topY > LAND - VOID_DEPTH * 0.3, `the fog column fills the pit to just under the rim (top layer ${(topY - floor).toFixed(1)} m over a ${VOID_DEPTH} m floor)`)
ok(HAZE_LAYERS.every((l, k) => k === 0 || (l.f > HAZE_LAYERS[k - 1].f && l.a < HAZE_LAYERS[k - 1].a)), 'the fog thins upward')
const straightDown = 1 - HAZE_LAYERS.reduce((t, l) => t * (1 - l.a), 1)
ok(straightDown > 0.95, `from the rim, straight down the column is near-black (${(straightDown * 100).toFixed(1)}% black-over)`)
ok(HAZE_LAYERS.every((l, k) => k === 0 || l.fleck <= HAZE_LAYERS[k - 1].fleck), 'the glimmers sit deepest')
ok(HAZE_LAYERS.every(l => l.fleck > 0 && l.fleck < 0.15), 'glimmers stay sparse (under 15% of cells per layer)')
const lum = 0.2126 * VOID_FLOOR.r + 0.7152 * VOID_FLOOR.g + 0.0722 * VOID_FLOOR.b
ok(lum < 0.01 && VOID_FLOOR.b >= VOID_FLOOR.g, `the floor is matte near-black with a violet lean (lum ${lum.toFixed(4)})`)
console.log(`void-look: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
