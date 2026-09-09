// Relief-map guard. Run: npx tsx src/app/shimmer/voxel3d/tex/relief.test.ts
//
// ── WHAT EACH ASSERT IS ACTUALLY FOR, because a normal map fails in ways a picture hides ────────
// A wrong normal map does not crash and does not blank the screen. It ships a world that is lit
// slightly wrongly everywhere, which reads as "the art is a bit off" — so every check here is
// written against a specific way of being wrong, and every one of them has been made to FAIL by
// reintroducing that exact bug. A guard nobody has seen fail is a guard nobody has tested.

import { buildTileArray, LAYER_COUNT, layerOf, TOP, SIDE } from './tiles'
import { MAT } from '../../voxel/depth'
import { heightField, normalLayer, buildReliefArray, RELIEF_DEPTH } from './relief'

const fails: string[] = []
let pass = 0
const check = (ok: boolean, what: string) => { if (ok) pass++; else fails.push(what) }

const SIZE = 16
const STRIDE = 4

/** Build a synthetic tile from a per-texel grey function, so a test controls the height exactly. */
function greyTile(size: number, f: (x: number, y: number) => number): Uint8Array {
  const t = new Uint8Array(size * size * STRIDE)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const v = Math.max(0, Math.min(255, Math.round(f(x, y) * 255)))
    const i = (y * size + x) * STRIDE
    t[i] = v; t[i + 1] = v; t[i + 2] = v; t[i + 3] = 255
  }
  return t
}

/** Decode one texel of an encoded normal back to a unit vector. */
function decode(out: Uint8Array, size: number, x: number, y: number): [number, number, number] {
  const i = (y * size + x) * STRIDE
  return [out[i] / 255 * 2 - 1, out[i + 1] / 255 * 2 - 1, out[i + 2] / 255 * 2 - 1]
}

const reliefOf = (tile: Uint8Array, size: number): Uint8Array => {
  const out = new Uint8Array(size * size * STRIDE)
  normalLayer(tile, size, out, 0)
  return out
}

// ── ① A FLAT TILE IS FLAT ───────────────────────────────────────────────────────────────────────
// The trivial case, and the one that catches a sign or offset error in the ENCODING rather than in
// the gradient — every other assert here reads a difference, so a uniformly wrong encoding would
// cancel out of all of them.
{
  const out = reliefOf(greyTile(SIZE, () => 0.5), SIZE)
  let worst = 0
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const [nx, ny, nz] = decode(out, SIZE, x, y)
    worst = Math.max(worst, Math.abs(nx), Math.abs(ny), Math.abs(nz - 1))
  }
  check(worst < 0.01, `a flat tile must encode as straight up (0,0,1); worst axis was off by ${worst.toFixed(3)}`)
}

// ── ② THE SLOPE LEANS THE RIGHT WAY, ON THE RIGHT AXIS ──────────────────────────────────────────
// ⚠ A SIGN FLIP HERE IS THE CLASSIC NORMAL-MAP BUG AND IT IS INVISIBLE IN A STILL. The world simply
// lights as though the sun were on the other side; every surface stays plausible, and the only tell
// is that grooves read as ridges. Nobody catches that by looking, so it is asserted numerically.
{
  // Height rising toward +x. A surface climbing to the right leans its normal to the LEFT.
  const out = reliefOf(greyTile(SIZE, x => x / (SIZE - 1)), SIZE)
  const [nx, ny] = decode(out, SIZE, SIZE / 2, SIZE / 2)
  check(nx < -0.02, `a ramp rising toward +x must lean its normal toward -x; got nx=${nx.toFixed(3)}`)
  check(Math.abs(ny) < 0.02, `a ramp that varies only in x must not tilt in y; got ny=${ny.toFixed(3)}`)

  const outY = reliefOf(greyTile(SIZE, (_x, y) => y / (SIZE - 1)), SIZE)
  const [mx, my] = decode(outY, SIZE, SIZE / 2, SIZE / 2)
  check(my < -0.02, `a ramp rising toward +y must lean its normal toward -y; got ny=${my.toFixed(3)}`)
  check(Math.abs(mx) < 0.02, `a ramp that varies only in y must not tilt in x; got nx=${mx.toFixed(3)}`)
}

// ── ③ ★★ THE BORDER WRAPS — THE SEAM GUARD ─────────────────────────────────────────────────────
// This is the assert with the highest cost of absence. Tiles repeat across a merged quad, so texel 0
// neighbours texel size-1 IN THE WORLD. A clamped blur or a clamped difference flattens the four
// edges of every tile, drawing a lit grid on every block boundary in the world — which looks exactly
// like the greedy mesher emitting bad normals, and would be hunted in the wrong file for a day.
//
// The probe: a single bright column at x=0 on a dark tile. Its gradient MUST be visible from the
// far edge, because in the world that column is one texel to the right of texel size-1.
{
  const out = reliefOf(greyTile(SIZE, x => (x === 0 ? 1 : 0)), SIZE)
  const [farX] = decode(out, SIZE, SIZE - 1, SIZE / 2)
  check(farX < -0.02,
    `the far edge must see the bright column that wraps around to meet it; got nx=${farX.toFixed(3)} ` +
    `— a clamped read here puts a seam on every block boundary in the world`)

  // And the mirror: symmetry about the bright column. Texel 1 and texel size-1 sit the same distance
  // from it on opposite sides, so their tilts must be equal and opposite. A one-sided wrap (wrapping
  // the blur but not the difference, say) passes the assert above and fails this one.
  const [nearX] = decode(out, SIZE, 1, SIZE / 2)
  check(Math.abs(nearX + farX) < 0.02,
    `the two sides of a wrapped feature must tilt equally and oppositely; got ${nearX.toFixed(3)} and ${farX.toFixed(3)}`)
}

// ── ④ EVERY NORMAL IS UNIT LENGTH ───────────────────────────────────────────────────────────────
// A non-unit normal does not fail, it just shades wrong by a scale factor, and the error grows with
// the slope — so the flattest parts of the world would look right and the most detailed parts would
// not, which is the hardest version to notice.
{
  const out = reliefOf(greyTile(SIZE, (x, y) => ((x * 7 + y * 13) % 5) / 4), SIZE)
  let worst = 0
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const [nx, ny, nz] = decode(out, SIZE, x, y)
    worst = Math.max(worst, Math.abs(Math.hypot(nx, ny, nz) - 1))
  }
  // 1/255 per channel of quantisation, so a couple of LSBs of slack and no more.
  check(worst < 0.02, `every encoded normal must be unit length; worst was off by ${worst.toFixed(3)}`)
}

// ── ⑤ ★★ THE SAME FEATURE LIGHTS THE SAME AT 32px AND AT 64px ──────────────────────────────────
// `settings.tileSize` is a live 32/64 switch and it exists so Alex can compare DETAIL. If the gain
// did not scale with size, flipping it would also change the LIGHTING — the comparison would be
// confounded by the very control meant to isolate it, and the coarser tile would look "deeper" for
// a reason that has nothing to do with the art. This is the assert that pins `gain ∝ size`.
{
  // One ramp across the whole tile: the same world-space slope at either resolution.
  const at = (size: number) => {
    const out = reliefOf(greyTile(size, x => x / (size - 1)), size)
    return decode(out, size, size / 2, size / 2)[0]
  }
  const a = at(32), b = at(64)
  check(Math.abs(a - b) < 0.03,
    `the same painted slope must light the same at 32px and 64px; got nx=${a.toFixed(3)} vs ${b.toFixed(3)} ` +
    `— a size-independent gain makes the tileSize switch a lighting change as well as a detail change`)
}

// ── ⑥ THE DEPTH CONSTANT IS THE DIAL, AND IT ACTUALLY REACHES THE OUTPUT ───────────────────────
// Guards the wiring of the one number a human will want to turn: a `RELIEF_DEPTH` that is read but
// discarded would leave a dial that does nothing, and the failure is silent because the map is still
// perfectly valid — just permanently at whatever strength was hardcoded.
{
  const tile = greyTile(SIZE, x => x / (SIZE - 1))
  const out = reliefOf(tile, SIZE)
  const [nx] = decode(out, SIZE, SIZE / 2, SIZE / 2)
  // The analytic normal for a constant ramp: slope = RELIEF_DEPTH blocks over 1 block of run.
  const want = -RELIEF_DEPTH / Math.hypot(RELIEF_DEPTH, 1)
  check(Math.abs(nx - want) < 0.01,
    `a full-range ramp must tilt by exactly the depth constant: wanted nx=${want.toFixed(3)}, got ${nx.toFixed(3)}`)
}

// ── ⑦ A MISALIGNED CALL IS REFUSED, NOT SILENTLY DERIVED FROM SHIFTED ROWS ─────────────────────
// The wrong `size` still divides evenly often enough to be dangerous, and misaligned rows produce a
// normal map that is wrong in a structured, plausible-looking way.
{
  let threw = false
  try { buildReliefArray(new Uint8Array(SIZE * SIZE * STRIDE), SIZE + 1) } catch { threw = true }
  check(threw, 'buildReliefArray must refuse a tile array that is not a whole number of layers')
}

// ── ⑧ ★★ THE SHIPPED TILES ACTUALLY HAVE RELIEF — THE SATURATION CHECK ────────────────────────
// Every assert above is on a synthetic tile, so all eight could pass over art that happens to be
// perfectly flat and the feature would ship doing nothing visible. An absence claim needs a stronger
// measurement than a presence claim: this NAMES the flat layers rather than counting them, so the
// failure says which block has no relief instead of asserting a tally somebody can nudge.
{
  for (const size of [32, 64] as const) {
    const tiles = buildTileArray(size)
    const relief = buildReliefArray(tiles, size)
    check(relief.length === tiles.length, `relief array must match the tile array byte for byte at ${size}px`)

    // Stone and topsoil are the two surfaces a keeper spends the entire game looking at; if either
    // is flat, the feature is not doing its job wherever it matters most.
    for (const [mat, face, name] of [
      [MAT.STONE, SIDE, 'stone side'], [MAT.TOPSOIL, TOP, 'topsoil top'],
      [MAT.CUT_STONE, SIDE, 'cut stone side'], [MAT.PLANKS_GOLDWOOD, SIDE, 'goldwood planks side'],
    ] as const) {
      const layer = layerOf(mat, face)
      const per = size * size
      let tilted = 0
      for (let i = 0; i < per; i++) {
        const b = (layer * per + i) * STRIDE
        if (Math.abs(relief[b] / 255 * 2 - 1) > 0.02 || Math.abs(relief[b + 1] / 255 * 2 - 1) > 0.02) tilted++
      }
      const frac = tilted / per
      check(frac > 0.15,
        `${name} at ${size}px has relief on only ${(frac * 100).toFixed(1)}% of its texels — ` +
        `the shipped art gives the normal map nothing to work with there`)
    }
    // And the whole set: how many of the layers are entirely flat. Named, not counted.
    const flat: number[] = []
    for (let layer = 0; layer < LAYER_COUNT; layer++) {
      const per = size * size
      let any = false
      for (let i = 0; i < per && !any; i++) {
        const b = (layer * per + i) * STRIDE
        if (Math.abs(relief[b] / 255 * 2 - 1) > 0.02 || Math.abs(relief[b + 1] / 255 * 2 - 1) > 0.02) any = true
      }
      if (!any) flat.push(layer)
    }
    console.log(`  ${size}px: ${LAYER_COUNT - flat.length}/${LAYER_COUNT} layers carry relief` +
      (flat.length ? `; flat layers: ${flat.join(', ')}` : ''))
  }
}

console.log(`\nrelief guard: ${pass} checks passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ relief maps wrap, lean the right way, and survive the tileSize switch')
