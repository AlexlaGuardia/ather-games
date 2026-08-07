// Carver oracle. Run: npx tsx src/app/shimmer/voxel/carve.test.ts
//
// ★ THE SEAM TEST IS THE ONE THAT MATTERS, and phase 3 already taught us why the obvious version is
// worthless. Its region seams "agreed" across 27 green asserts because gate numbers were hashed from
// the shared border — they agreed BY CONSTRUCTION while the map was still a set of ruler-straight
// highways. Numbers agreeing is not country connecting. So the seam check below does not compare
// parameters: it generates two neighbouring stacks INDEPENDENTLY, in isolation, and then walks the
// shared boundary plane asserting the rock matches voxel for voxel. A tunnel crossing that plane has
// to be continuous, or a player walks into a wall in the middle of a passage.

import { Section, AIR } from './section'
import { columnHeight } from './height'
import { materialAt, MAT, DEFAULT_DEPTH } from './depth'
import { carveStack, carveSection, carveStartsAt, carveScanRadius, DEFAULT_CARVE } from './carve'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337, CHUNK = 64, S = 16, H = 256
const CV = DEFAULT_CARVE
const D = DEFAULT_DEPTH
const surf = (x: number, z: number) => columnHeight(x, z, SEED)

/** A full-height stack at (ox, oz), filled by the depth rule and then carved — generated in isolation. */
function stackAt(ox: number, oz: number, carve = true): Section[] {
  const a: Section[] = []
  for (let i = 0; i < H / S; i++) {
    const sec = new Section(S), oy = i * S
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = surf(ox + x, oz + z)
      for (let y = 0; y < S; y++) sec.set(x, y, z, materialAt(ox + x, oy + y, oz + z, SEED, h))
    }
    a.push(sec)
  }
  if (carve) carveStack(a, ox, 0, oz, CHUNK, SEED, CV, surf, D.seaLevel)
  return a
}
const at = (st: Section[], x: number, y: number, z: number) => st[(y / S) | 0].get(x, y - ((y / S) | 0) * S, z)

// ── 1. determinism and order-independence ────────────────────────────────────────────────────
{
  const a = stackAt(512, 768), b = stackAt(512, 768)
  let diff = 0
  for (let i = 0; i < a.length; i++) for (let k = 0; k < a[i].data.length; k++) if (a[i].data[k] !== b[i].data[k]) diff++
  ok(diff === 0, `two independent generations of the same stack are identical (${diff} voxels differ)`)

  // Generating a distant stack first must not change this one — the property the whole scheme rests on.
  stackAt(-4096, 4096); stackAt(99, 99)
  const c = stackAt(512, 768)
  let d2 = 0
  for (let i = 0; i < a.length; i++) for (let k = 0; k < a[i].data.length; k++) if (a[i].data[k] !== c[i].data[k]) d2++
  ok(d2 === 0, 'carving is independent of generation order')
}

// ── 2. ★ THE SEAM — chunking must not change the world ───────────────────────────────────────
// ⚠ THE OBVIOUS VERSION OF THIS TEST IS WRONG AND I WROTE IT FIRST. Comparing the last column of
// one stack against the first column of its neighbour and demanding they match asserts nothing
// about seams — those are two DIFFERENT world columns, and air beside rock is just the wall of a
// tunnel. It failed with 92 "violations" that were all correct terrain.
//
// The property that actually matters: **the same world voxel, generated from two differently
// ALIGNED stacks, must come out identical.** If it does, then how the world is diced into chunks is
// invisible to the result, which is the entire no-coordination guarantee. Stacks at ox and ox+S-1
// overlap in exactly one column: local x=S-1 of the first is local x=0 of the second.
{
  let mismatch = 0, air = 0, checked = 0
  for (const [bx, bz] of [[512, 768], [1024, 256], [-320, 640], [64, 64], [4096, -2048]] as const) {
    const a = stackAt(bx, bz)                 // world x bx .. bx+S-1
    const b = stackAt(bx + S - 1, bz)         // world x bx+S-1 .. bx+2S-2  → overlaps at bx+S-1
    for (let y = 1; y < H - 8; y++) {
      for (let z = 0; z < S; z++) {
        const va = at(a, S - 1, y, z)         // world (bx+S-1, y, bz+z)
        const vb = at(b, 0, y, z)             // the SAME world voxel
        checked++
        if (va === AIR) air++
        if (va !== vb) mismatch++
      }
    }
  }
  ok(checked > 15000, 'the seam check actually sampled the shared column')
  ok(air > 0, `the shared column really is carved somewhere (${air} air voxels — a seam test over solid rock proves nothing)`)
  ok(mismatch === 0, `★ the same world voxel is identical from either stack alignment (${mismatch} disagreements)`)
}

// ── 3. structural guarantees — the floor of the world survives ───────────────────────────────
{
  let bed = 0, low = 0
  for (const [ox, oz] of [[512, 768], [0, 0], [-256, 128]] as const) {
    const st = stackAt(ox, oz)
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      if (at(st, x, 0, z) !== MAT.BEDROCK) bed++
      for (let y = 1; y < CV.floorGuard; y++) if (at(st, x, y, z) === AIR && materialAt(ox + x, y, oz + z, SEED, surf(ox + x, oz + z)) !== AIR) low++
    }
  }
  ok(bed === 0, `bedrock at y=0 is never carved (${bed} violations)`)
  ok(low === 0, `nothing below floorGuard=${CV.floorGuard} is carved (${low} violations)`)
}

// ── 4. lakes are not drained ─────────────────────────────────────────────────────────────────
{
  let drained = 0, wet = 0
  // Sites are SEARCHED, not hardcoded: fixed coordinates died on the valley-floor retune, were
  // re-picked, then died again on the un-slice warp retune. Any terrain change moves coastlines;
  // a search over the same pure surface tracks them for free (same fix as trees.test's SITES).
  const SUBMERGED: [number, number][] = []
  for (let i = 0; SUBMERGED.length < 4 && i < 8000; i++) {
    const ox = ((i * 331) % 6000 - 3000) & ~(S - 1), oz = ((i * 887) % 6000 - 3000) & ~(S - 1)
    if (surf(ox + S / 2, oz + S / 2) <= D.seaLevel - 2) SUBMERGED.push([ox, oz])
  }
  for (const [ox, oz] of SUBMERGED) {
    const st = stackAt(ox, oz)
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = surf(ox + x, oz + z)
      if (h > D.seaLevel) continue
      wet++
      // The two voxels just under a submerged surface must stay solid, or the water above escapes.
      for (let y = Math.max(1, h - 2); y <= h; y++) if (at(st, x, y, z) === AIR) { drained++; break }
    }
  }
  ok(wet > 0, 'the drain check found submerged columns to test')
  ok(drained === 0, `no carve opens the floor under standing water (${drained} of ${wet} submerged columns)`)
}

// ── 5. the scan radius must cover the declared reach ─────────────────────────────────────────
// If a tunnel can travel further than the scan looks, it gets clipped invisibly mid-passage. This
// is the contract that makes the whole no-coordination scheme safe.
{
  ok(carveScanRadius(CHUNK, CV) * CHUNK >= CV.maxReach, 'the scan box covers maxReach')
  let over = 0
  for (let cx = 0; cx < 40; cx++) for (let cz = 0; cz < 40; cz++)
    for (const st of carveStartsAt(SEED, cx, cz, CHUNK, CV)) {
      if (st.x < cx * CHUNK || st.x >= (cx + 1) * CHUNK) over++      // origin must be inside its owner
      if (st.z < cz * CHUNK || st.z >= (cz + 1) * CHUNK) over++
      if (st.y < CV.yMin || st.y > CV.yMax) over++
    }
  ok(over === 0, `every carve origin lies inside the chunk that owns it (${over} escapes)`)
}

// ── 6. carveSection is carveStack of one ─────────────────────────────────────────────────────
{
  const ox = 512, oy = 96, oz = 768
  const mk = () => { const sec = new Section(S)
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const h = surf(ox + x, oz + z)
      for (let y = 0; y < S; y++) sec.set(x, y, z, materialAt(ox + x, oy + y, oz + z, SEED, h)) }
    return sec }
  const a = mk(), b = mk()
  carveSection(a, ox, oy, oz, CHUNK, SEED, CV, surf, D.seaLevel)
  carveStack([b], ox, oy, oz, CHUNK, SEED, CV, surf, D.seaLevel)
  let diff = 0
  for (let k = 0; k < a.data.length; k++) if (a.data[k] !== b.data[k]) diff++
  ok(diff === 0, 'carveSection agrees with carveStack of one')
}

// ── 7. caves are actually there, and are not swiss cheese ────────────────────────────────────
{
  let air = 0, solid = 0
  for (const [ox, oz] of [[512, 768], [1024, 256], [-320, 640]] as const) {
    const carved = stackAt(ox, oz), raw = stackAt(ox, oz, false)
    for (let i = 0; i < carved.length; i++) for (let k = 0; k < carved[i].data.length; k++) {
      if (raw[i].data[k] !== AIR) { solid++; if (carved[i].data[k] === AIR) air++ }
    }
  }
  const frac = air / solid
  ok(frac > 0.01, `carvers actually open rock (${(frac * 100).toFixed(2)}%)`)
  ok(frac < 0.25, `the underground is not swiss cheese (${(frac * 100).toFixed(2)}%)`)
}

// ── 8. ★ NO SURFACE BREACH — carvers must not punch pit traps ────────────────────────────────
// Found by Alex PLAYING it: "there's a gap where the character can fall right off the map."
// Measured over 40,960 columns, 1% had AIR at the surface voxel and a handful opened shafts 40+
// deep. A cave mouth is a fine thing to want; an invisible one-voxel hole with a 40-block drop is
// not a mouth, it is this bug wearing one. Entrances should be a deliberate widened feature later.
{
  let breached = 0, checked = 0
  for (const [ox, oz] of [[512, 768], [1024, 256], [-320, 640], [64, 64], [4096, -2048], [-1408, -1024]] as const) {
    const st = stackAt(ox, oz)
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = surf(ox + x, oz + z)
      if (h < 1 || h >= H - 1) continue
      checked++
      if (at(st, x, h, z) === AIR) breached++
      // and the clearance band below it must be intact too, or you fall in one step later
      for (let d = 1; d < CV.surfaceClearance; d++) if (at(st, x, h - d, z) === AIR) breached++
    }
  }
  ok(checked > 1000, 'the surface-breach check sampled real columns')
  ok(breached === 0, `★ carvers never open the surface or its clearance band (${breached} breaches)`)
}

console.log(`\ncarvers: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the tunnels connect')
