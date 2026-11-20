// M41 slice 3: the cloud voids on the maps (plate.ts paints W.voided). Run: npx tsx src/app/shimmer/open/ather/plate-voids.test.ts
import { atherPlatePixels, platePixelSteps, VOID_RGB, VOID_LIP_RGB } from './plate'
import type { Wilds } from './wilds'
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
// a 200 m tile, 4 m cells; a void stripe 24 m wide down x in [-12, 12)
const nx = 51, nz = 51, cell = 4, cx = nx - 1
const voided = new Uint8Array(cx * (nz - 1))
for (let j = 0; j < nz - 1; j++) for (let i = 0; i < cx; i++) { const x = -100 + (i + 0.5) * cell; if (x > -12 && x < 12) voided[j * cx + i] = 1 }
const base = { meta: { name: 't', cell, nx, nz, sizeX: 200, sizeZ: 200, waterY: 0 }, heightAt: () => 5, biomeAt: () => 2, trees: [], crystals: [] }
const W = { ...base, voided } as unknown as Wilds, W0 = base as unknown as Wilds
const P = atherPlatePixels(W), Q = atherPlatePixels(W0)
const at = (R: typeof P, x: number, z: number) => { const i = Math.floor((x + 100) / 2), j = Math.floor((z + 100) / 2), o = (j * R.w + i) * 4; return [R.px[o], R.px[o + 1], R.px[o + 2]] }
const near = (c: number[], t: [number, number, number], tol = 30) => c.every((v, k) => Math.abs(v - t[k]) <= tol)
ok(near(at(P, 0, 0), VOID_RGB), `void centre is the void dark (${at(P, 0, 0)})`)
ok(near(at(P, -11, 0), VOID_LIP_RGB), `void edge is the pale lip (${at(P, -11, 0)})`)
ok(!near(at(P, 40, 0), VOID_RGB) && at(P, 40, 0).join() === at(Q, 40, 0).join(), 'land outside the void unchanged')
ok(at(P, 0, 0).join() !== at(Q, 0, 0).join(), 'without voids the same spot is land')
ok(atherPlatePixels(W0).px.every((v, k) => v === Q.px[k]), 'no voided field: plate identical (deterministic, untouched)')
// M44 part 3: the sliced plate (minimap) yields many times and lands on the same pixels as the all-at-once plate
{ const g = platePixelSteps(W); let n = 0, r = g.next(); while (!r.done) { n++; r = g.next() }
  ok(n >= 10 && r.value.px.every((v, k) => v === P.px[k]), `sliced plate: ${n} slices, identical pixels`) }
console.log(`plate-voids: ${pass} pass, ${fails.length} fail`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
