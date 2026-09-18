// The river's lean on the bank flora. Run: npx tsx src/app/shimmer/voxel3d/bank-lean.test.ts
//
// Two halves: the pure field (`bankLeanAt`) and the map that carries it to the shader
// (`createLeanMap`). The failure this guards: the lean exists in a function, the map is built,
// and the shader reads zeros — because the origin was off by a texel, the margin swallowed the
// bank, or the packing lost the sign. So the map is decoded here the way the shader decodes it.
import { bankLeanAt, riverFlowAt, riverField, riverness, SHORE_RN } from '../voxel/height'
import { createLeanMap, LEAN_TEXEL } from './flora-mesh'

const SEED = 1337
let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ── 1. the field ───────────────────────────────────────────────────────────────────────────────
{
  let bank = 0, leaning = 0, badRamp = 0, offRiverNonZero = 0, wetMismatch = 0
  for (let z = 2016; z < 2064; z += 2) for (let x = 256; x < 448; x += 2) {
    const rn = riverness(riverField(x, z, SEED))
    const [lx, lz] = bankLeanAt(x, z, SEED)
    const mag = Math.hypot(lx, lz)
    if (rn <= 0) { if (mag !== 0) offRiverNonZero++; continue }
    if (rn >= SHORE_RN) {
      // In the water: same heading as the flow, at full strength.
      const [fx, fz] = riverFlowAt(x, z, SEED)
      const fm = Math.hypot(fx, fz)
      if (fm > 0 && (Math.abs(fx / fm - lx) > 1e-6 || Math.abs(fz / fm - lz) > 1e-6)) wetMismatch++
      continue
    }
    bank++
    if (mag === 0) continue
    leaning++
    if (Math.abs(mag - rn / SHORE_RN) > 1e-6) badRamp++
  }
  ok(bank > 100, `the bank ribbon is sampled (${bank} cells)`)
  ok(leaning / Math.max(1, bank) > 0.9, `★★ the bank leans — ${leaning}/${bank} cells carry a vector`)
  ok(badRamp === 0, `★ magnitude ramps with riverness up to the waterline (${badRamp} off)`)
  ok(offRiverNonZero === 0, `★ the meadow is untouched (${offRiverNonZero} leaned off the river)`)
  ok(wetMismatch === 0, `★ in the water the lean is the flow's heading at full strength (${wetMismatch} differ)`)
}

// ── 2. the map, decoded as the shader decodes it ───────────────────────────────────────────────
{
  const map = createLeanMap()
  const cols: { x0: number; z0: number }[] = []
  for (let cz = 2016; cz < 2064; cz += 16) for (let cx = 256; cx < 448; cx += 16) cols.push({ x0: cx, z0: cz })
  const live = map.fill(cols, SEED)
  ok(live > 50, `★★ the map carries the bank (${live} live texels)`)
  const W = map.size.x / LEAN_TEXEL, H = map.size.y / LEAN_TEXEL
  const data = map.texture.image.data as Uint8Array
  ok(map.origin.x === 256 - LEAN_TEXEL && map.origin.y === 2016 - LEAN_TEXEL, `the origin is one texel outside the loaded window (${map.origin.x}, ${map.origin.y})`)
  // Decode every interior texel and compare with the field at the texel centre.
  let worst = 0, checked = 0, ring = 0, ringBad = 0
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const o = (j * W + i) * 4
    const dx = (data[o] - 128) / 127, dz = (data[o + 1] - 128) / 127
    const edge = i === 0 || j === 0 || i === W - 1 || j === H - 1
    if (edge) { ring++; if (dx !== 0 || dz !== 0) ringBad++; continue }
    const [lx, lz] = bankLeanAt(map.origin.x + (i + 0.5) * LEAN_TEXEL, map.origin.y + (j + 0.5) * LEAN_TEXEL, SEED)
    worst = Math.max(worst, Math.abs(dx - lx), Math.abs(dz - lz))
    checked++
  }
  ok(checked > 1000, `interior texels checked (${checked})`)
  ok(worst <= 1 / 127 + 1e-9, `★★★ every texel decodes to the field within one quantum (worst ${worst.toFixed(4)})`)
  ok(ring > 0 && ringBad === 0, `★ the margin ring is zero, so the clamp reads still (${ringBad}/${ring} bad)`)
  // The shader's frame: a plant at world (x, z) samples (x - origin) / size — a bank cell lands inside.
  const px = 300, pz = 2030
  const u = (px - map.origin.x) / map.size.x, v = (pz - map.origin.y) / map.size.y
  ok(u > 0 && u < 1 && v > 0 && v < 1, `a bank plant samples inside the map (${u.toFixed(3)}, ${v.toFixed(3)})`)
  // Growing the window re-allocates and re-origins without leaking the old frame.
  cols.push({ x0: 448, z0: 2064 })
  map.fill(cols, SEED)
  ok(map.size.x > W * LEAN_TEXEL, `the map grows with the window (${map.size.x} > ${W * LEAN_TEXEL})`)
  // A space without rivers (Glade, plot) clears the map: every texel back to 128.
  ok(map.clear() === 0, 'clear() reports no live texels')
  const cleared = map.texture.image.data as Uint8Array
  let nonZero = 0
  for (let i = 0; i < cleared.length; i += 4) if (cleared[i] !== 128 || cleared[i + 1] !== 128) nonZero++
  ok(nonZero === 0, `★ a cleared map leans nothing (${nonZero} texels still set) — the Glade island must not read the Wilds' river`)
  map.dispose()
}

console.log(`bank lean: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  FAIL', f)
if (fails.length) process.exit(1)
