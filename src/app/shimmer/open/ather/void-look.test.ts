// The void look (Alex 11-23): the haze sits over void cells only, above the floor, thinning upward, feathered at the rim.
// Run: npx tsx src/app/shimmer/open/ather/void-look.test.ts
import { hazeGeometry, HAZE_LAYERS, VOID_FLOOR } from './void-look'
import { VOID_FLOOR_ABOVE_WATER } from './wilds-voids'
import type { Wilds } from './wilds'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// a 200 m tile, 4 m cells; a void stripe 24 m wide down x in [-12, 12)
const nx = 51, nz = 51, cell = 4, cx = nx - 1
const voided = new Uint8Array(cx * (nz - 1))
for (let j = 0; j < nz - 1; j++) for (let i = 0; i < cx; i++) { const x = -100 + (i + 0.5) * cell; if (x > -12 && x < 12) voided[j * cx + i] = 1 }
const meta = { name: 't', cell, nx, nz, sizeX: 200, sizeZ: 200, waterY: 0 }
const W = { meta, voided } as unknown as Wilds
ok(hazeGeometry({ meta } as unknown as Wilds) === null, 'a tile with no void has no haze')
ok(hazeGeometry({ meta, voided: new Uint8Array(cx * (nz - 1)) } as unknown as Wilds) === null, 'an all-land voided field has no haze')
const H = hazeGeometry(W)!
ok(!!H && H.cells > 0, `haze built (${H?.cells} cells)`)
const pos = H.geo.getAttribute('position').array as Float32Array, aV = H.geo.getAttribute('aV').array as Float32Array, aK = H.geo.getAttribute('aK').array as Float32Array
const floor = meta.waterY + VOID_FLOOR_ABOVE_WATER
let outside = 0, low = 0, wrongY = 0, rimFed = 0, centreSolid = 0
for (let n = 0; n < aV.length; n++) {
  const x = pos[n * 3], y = pos[n * 3 + 1]
  if (Math.abs(x) > 12 + 8 + 1e-6) outside++                     // one 8 m haze step past the void at most
  if (y - floor < 0.3) low++                                      // M58: nothing coplanar with the void floor
  if (Math.abs(y - (floor + HAZE_LAYERS[aK[n]].y)) > 1e-4) wrongY++
  if (Math.abs(x) >= 16 && aV[n] > 0) rimFed++                   // past the void's cells the haze is fully faded
  if (Math.abs(x) <= 4 && aV[n] === 1) centreSolid++
}
ok(outside === 0, `haze stays over the void (${outside} vertices outside)`)
ok(low === 0, `the lowest haze floats above the floor (${low} too low)`)
ok(wrongY === 0, `each layer at its height (${wrongY} off)`)
ok(rimFed === 0, `the rim feathers to nothing (${rimFed} rim vertices with haze)`)
ok(centreSolid > 0, 'the void centre carries full haze')
ok(HAZE_LAYERS.every((l, k) => k === 0 || (l.y > HAZE_LAYERS[k - 1].y && l.a < HAZE_LAYERS[k - 1].a)), 'the fog thins upward')
ok(HAZE_LAYERS.every(l => l.fleck > 0 && l.fleck < 0.15), 'glimmers stay sparse (under 15% of cells per layer)')
const lum = 0.2126 * VOID_FLOOR.r + 0.7152 * VOID_FLOOR.g + 0.0722 * VOID_FLOOR.b
ok(lum < 0.01 && VOID_FLOOR.b >= VOID_FLOOR.g, `the floor is matte near-black with a violet lean (lum ${lum.toFixed(4)})`)
console.log(`void-look: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
