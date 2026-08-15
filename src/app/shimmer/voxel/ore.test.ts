// Ore oracle. Run: npx tsx src/app/shimmer/voxel/ore.test.ts
//
// The ore stage's failures are all "the world looks fine but the game is wrong": a tier that spawns
// at the wrong depth breaks progression silently, an element split that drifts turns a 4-way choice
// into a 2-way one, and ore replacing soil instead of rock puts crystals in the topsoil where
// nobody would ever dig. None of that shows in a screenshot.

import { Section, AIR } from './section'
import { columnHeight } from './height'
import { materialAt, MAT, DEFAULT_DEPTH } from './depth'
import { carveStack, DEFAULT_CARVE } from './carve'
import { placeOre, sampleBand, ORE, ORE_BATCHES } from './ore'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337, CHUNK = 64, S = 16, H = 256
const D = DEFAULT_DEPTH
const surf = (x: number, z: number) => columnHeight(x, z, SEED)
const ORE_IDS = Object.values(ORE) as number[]
const ELEMENTS = [ORE.ELEMENT_VIOLET, ORE.ELEMENT_STORM, ORE.ELEMENT_EARTH, ORE.ELEMENT_WATER]

/** Full pipeline for one stack: host rock → pre-carve ore → carvers → post-carve ore. */
function gen(ox: number, oz: number, carve = true): Section[] {
  const a: Section[] = []
  for (let i = 0; i < H / S; i++) {
    const sec = new Section(S), oy = i * S
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const h = surf(ox + x, oz + z)
      for (let y = 0; y < S; y++) sec.set(x, y, z, materialAt(ox + x, oy + y, oz + z, SEED, h))
    }
    a.push(sec)
  }
  placeOre(a, ox, 0, oz, CHUNK, SEED, 'pre')
  if (carve) carveStack(a, ox, 0, oz, CHUNK, SEED, DEFAULT_CARVE, surf, D.seaLevel)
  placeOre(a, ox, 0, oz, CHUNK, SEED, 'post')
  return a
}

const SITES: [number, number][] = []
for (let i = 0; i < 90; i++) SITES.push([(i * 197) % 3000, (i * 331) % 3000])

// Census once — every distribution check reads from this.
const census: Record<number, number[]> = {}
const exposed: Record<number, number> = {}
for (const [ox, oz] of SITES) {
  const st = gen(ox, oz)
  for (let s = 0; s < st.length; s++) for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
    const v = st[s].get(x, y, z)
    if (!ORE_IDS.includes(v)) continue
    ;(census[v] = census[v] || []).push(s * S + y)
    const n = (dx: number, dy: number, dz: number) => {
      const nx = x + dx, ny = y + dy, nz = z + dz
      if (nx < 0 || nx >= S || nz < 0 || nz >= S) return false
      if (ny < 0 || ny >= S) return false
      return st[s].get(nx, ny, nz) === AIR
    }
    if (n(-1,0,0) || n(1,0,0) || n(0,-1,0) || n(0,1,0) || n(0,0,-1) || n(0,0,1)) exposed[v] = (exposed[v] || 0) + 1
  }
}
const med = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const total = (m: number) => (census[m] || []).length

// ── 1. determinism and order-independence ────────────────────────────────────────────────────
{
  const a = gen(512, 768), b = gen(512, 768)
  let diff = 0
  for (let i = 0; i < a.length; i++) for (let k = 0; k < a[i].data.length; k++) if (a[i].data[k] !== b[i].data[k]) diff++
  ok(diff === 0, `ore placement is deterministic (${diff} voxels differ)`)
  gen(-8192, 8192)
  const c = gen(512, 768)
  let d2 = 0
  for (let i = 0; i < a.length; i++) for (let k = 0; k < a[i].data.length; k++) if (a[i].data[k] !== c[i].data[k]) d2++
  ok(d2 === 0, 'ore placement is independent of generation order')
}

// ── 2. ★ the tier ladder must descend ────────────────────────────────────────────────────────
// This is the progression itself. If two tiers swap depths, the Prospecting ladder inverts and
// nothing in the game says so.
{
  const raw = med(census[ORE.RAW_MANA] || [])
  const elem = med(ELEMENTS.flatMap(e => census[e] || []))
  const pure = med(census[ORE.PURE_CORE] || [])
  const ather = med(census[ORE.ATHER_CRYSTAL] || [])
  ok(raw > elem, `★ raw mana sits above element crystal (${raw} vs ${elem})`)
  ok(elem > pure, `★ element crystal sits above pure core (${elem} vs ${pure})`)
  ok(pure > ather, `★ pure core sits above ather crystal (${pure} vs ${ather})`)
  ok(total(ORE.RAW_MANA) > total(ORE.PURE_CORE), 'tier 1 is more common than tier 3')
  ok(total(ORE.PURE_CORE) > 0 && total(ORE.ATHER_CRYSTAL) > 0, 'the deep tiers actually generate')
}

// ── 3. the four elements stay a four-way choice ──────────────────────────────────────────────
{
  const counts = ELEMENTS.map(total)
  const sum = counts.reduce((a, b) => a + b, 0)
  ok(sum > 500, `enough element crystal to judge the split (${sum} voxels)`)
  const worst = Math.max(...counts.map(c => Math.abs(c / sum - 0.25)))
  ok(worst < 0.09, `the four elements are near-evenly split (worst deviation ${(worst * 100).toFixed(1)}pp of 25%)`)
  ok(Math.min(...counts) > 0, 'every element actually appears')
}

// ── 4. ★ air-exposure discard is a per-tier READABILITY knob ─────────────────────────────────
// raw mana has discard 0 and should litter cave walls; pure core has discard 0.7 and should be
// something you tunnel for. If these converge, the knob is not wired.
{
  const rate = (m: number) => (exposed[m] || 0) / Math.max(1, total(m))
  const raw = rate(ORE.RAW_MANA), pure = rate(ORE.PURE_CORE)
  ok(raw > 0.01, `raw mana is genuinely visible in cave walls (${(raw * 100).toFixed(1)}%)`)
  ok(raw > pure * 2, `★ raw mana is far more exposed than pure core (${(raw * 100).toFixed(1)}% vs ${(pure * 100).toFixed(1)}%) — the discard knob is live`)
}

// ── 5. ore replaces ROCK, and only rock ──────────────────────────────────────────────────────
// Ore in topsoil is ore nobody finds by mining; ore replacing the cloud floor is a hole in the floor.
{
  let bad = 0
  for (const [ox, oz] of SITES.slice(0, 25)) {
    const plain: number[] = []
    for (let i = 0; i < H / S; i++) { const oy = i * S
      for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++)
        plain.push(materialAt(ox + x, oy + y, oz + z, SEED, surf(ox + x, oz + z))) }
    const st = gen(ox, oz, false)   // no carving, so any change is ore
    let k = 0
    for (let i = 0; i < st.length; i++) for (let y = 0; y < S; y++) for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      const before = plain[k++], after = st[i].get(x, y, z)
      if (before === after) continue
      if (!ORE_IDS.includes(after)) { bad++; continue }
      if (before !== MAT.STONE && before !== MAT.DEEP_STONE) bad++   // only rock may become ore
    }
  }
  ok(bad === 0, `ore only ever replaces stone or deep stone (${bad} violations)`)
}

// ── 6. the trapezoid provider ────────────────────────────────────────────────────────────────
{
  const draw = (b: { min: number; max: number; plateau: number }, n: number) => {
    let s = 12345
    const g = () => { s ^= s << 13; s |= 0; s ^= s >>> 17; s ^= s << 5; s |= 0; return (s >>> 0) / 4294967296 }
    return Array.from({ length: n }, () => sampleBand(b, g))
  }
  const uni = draw({ min: 0, max: 100, plateau: 100 }, 20000)
  const tri = draw({ min: 0, max: 100, plateau: 0 }, 20000)
  ok(Math.min(...uni) >= 0 && Math.max(...uni) <= 100, 'uniform band stays inside its range')
  ok(Math.min(...tri) >= 0 && Math.max(...tri) <= 100, 'triangular band stays inside its range')
  // A triangle concentrates near the midpoint; a uniform does not. This is the whole reason the
  // primitive exists, so it gets asserted rather than assumed.
  const mid = (a: number[]) => a.filter(v => v > 40 && v < 60).length / a.length
  ok(mid(tri) > mid(uni) * 1.5, `plateau=0 concentrates at the midpoint (${(mid(tri) * 100).toFixed(0)}% vs uniform ${(mid(uni) * 100).toFixed(0)}%)`)
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
  ok(Math.abs(mean(tri) - 50) < 3, 'the triangle is centred')
  ok(Math.abs(mean(uni) - 50) < 3, 'the uniform is centred')
  ok(sampleBand({ min: 7, max: 7, plateau: 0 }, () => 0.5) === 7, 'a zero-width band is its own value')
}

// ── 7. phases are separate, and tier 4 is pre-carve ──────────────────────────────────────────
{
  ok(ORE_BATCHES.some(b => b.phase === 'pre'), 'a pre-carve batch exists')
  ok(ORE_BATCHES.filter(b => b.phase === 'pre').every(b => b.id.startsWith('ather')), 'only ather crystal is pre-carve')
  // Placing the 'pre' phase must not place any 'post' ore.
  // ⚠ Sampled across several sites on purpose. Tier 4 is rare by design — ~1.4 attempts per 64-wide
  // chunk, of which a 16x16 stack covers 6% of the area — so a SINGLE stack legitimately containing
  // none is the common case, not a bug. Asserting on one stack failed here and the code was right.
  let post = 0, pre = 0
  for (const [ox, oz] of SITES.slice(0, 20)) {
    const st: Section[] = []
    for (let i = 0; i < H / S; i++) { const sec = new Section(S), oy = i * S
      for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) { const h = surf(ox + x, oz + z)
        for (let y = 0; y < S; y++) sec.set(x, y, z, materialAt(ox + x, oy + y, oz + z, SEED, h)) }
      st.push(sec) }
    placeOre(st, ox, 0, oz, CHUNK, SEED, 'pre')
    for (const sec of st) for (const v of sec.data) {
      if (v === ORE.ATHER_CRYSTAL) pre++
      else if (ORE_IDS.includes(v)) post++
    }
  }
  ok(post === 0, `the pre phase places no post-phase ore (${post} leaked)`)
  ok(pre > 0, `the pre phase actually places ather crystal (${pre} voxels over 20 stacks)`)
}

console.log(`\nore: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the ladder is buried correctly')
