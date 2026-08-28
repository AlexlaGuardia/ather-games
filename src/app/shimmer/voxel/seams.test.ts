// Seam oracle. Run: npx tsx src/app/shimmer/voxel/seams.test.ts
//
// The ore stage's failures are all "the world looks fine but the game is wrong": a tier that spawns
// at the wrong depth breaks progression silently, an element split that drifts turns a 4-way choice
// into a 2-way one, and ore replacing soil instead of rock puts crystals in the topsoil where
// nobody would ever dig. None of that shows in a screenshot.

import { Section, AIR } from './section'
import { columnHeight } from './height'
import { materialAt, MAT, DEFAULT_DEPTH } from './depth'
import { carveStack, DEFAULT_CARVE } from './carve'
import { placeSeams, sampleBand, SEAM, SEAM_BATCHES } from './seams'
import { readFileSync } from 'node:fs'
import { codeOnly } from '../testing/guard'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337, CHUNK = 64, S = 16, H = 256
const D = DEFAULT_DEPTH
const surf = (x: number, z: number) => columnHeight(x, z, SEED)
const ORE_IDS = Object.values(SEAM) as number[]
const ELEMENTS = [SEAM.ELEMENT_VIOLET, SEAM.ELEMENT_STORM, SEAM.ELEMENT_EARTH, SEAM.ELEMENT_WATER]

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
  placeSeams(a, ox, 0, oz, CHUNK, SEED, 'pre')
  if (carve) carveStack(a, ox, 0, oz, CHUNK, SEED, DEFAULT_CARVE, surf, D.seaLevel)
  placeSeams(a, ox, 0, oz, CHUNK, SEED, 'post')
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
  const raw = med(census[SEAM.RAW_MANA] || [])
  const elem = med(ELEMENTS.flatMap(e => census[e] || []))
  const pure = med(census[SEAM.PURE_CORE] || [])
  const ather = med(census[SEAM.ATHER_CRYSTAL] || [])
  ok(raw > elem, `★ raw mana sits above element crystal (${raw} vs ${elem})`)
  ok(elem > pure, `★ element crystal sits above pure core (${elem} vs ${pure})`)
  ok(pure > ather, `★ pure core sits above ather crystal (${pure} vs ${ather})`)
  ok(total(SEAM.RAW_MANA) > total(SEAM.PURE_CORE), 'tier 1 is more common than tier 3')
  ok(total(SEAM.PURE_CORE) > 0 && total(SEAM.ATHER_CRYSTAL) > 0, 'the deep tiers actually generate')
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
  const raw = rate(SEAM.RAW_MANA), pure = rate(SEAM.PURE_CORE)
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
  ok(SEAM_BATCHES.some(b => b.phase === 'pre'), 'a pre-carve batch exists')
  ok(SEAM_BATCHES.filter(b => b.phase === 'pre').every(b => b.id.startsWith('ather')), 'only ather crystal is pre-carve')
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
    placeSeams(st, ox, 0, oz, CHUNK, SEED, 'pre')
    for (const sec of st) for (const v of sec.data) {
      if (v === SEAM.ATHER_CRYSTAL) pre++
      else if (ORE_IDS.includes(v)) post++
    }
  }
  ok(post === 0, `the pre phase places no post-phase ore (${post} leaked)`)
  ok(pre > 0, `the pre phase actually places ather crystal (${pre} voxels over 20 stacks)`)
}

// ── ★★★ THE RETIRED VOCABULARY CANNOT COME BACK, AND THE GUARD IS BLIND TO ITS OWN PROSE ─────
// Canon: there is no ore in the Ather. `ore.ts` was renamed to this file on 2026-08-28 and every
// identifier with it. The word survived for months because **nothing broke** — the same shape as a
// pool key naming a model the pool does not run — and `npm run canon` cannot catch it: that gate
// reports vocabulary only for nouns canon has listed as fully RETIRED, and "ore" was never
// retired, it simply never existed. A word that was always wrong has no gate.
//
// ⚠⚠ THE TRAP THIS GUARD HAD TO AVOID IS THE ONE THAT BIT `CROP_DEFS`: **documenting a banned word
// creates an instance of it.** Every file that explains this rename must SAY "ore", including the
// paragraph you are reading. A naive source grep would find its own documentation and report the
// explanation as the violation. So it reads `codeOnly()`, which blanks comments AND string bodies —
// the guard literally cannot see prose, which is why the prose can be as thorough as it likes.
{
  const files = ['seams.ts', 'column.ts', 'registry.ts', 'dens.ts', 'boulders.ts', 'depth.ts',
                 'territory.ts', 'holds.ts']
  // ⚠ ASSERT THE READER CAN SEE ITS SUBJECT FIRST. A missing file would make every check below
  // pass over an empty string — "I found no drift" and "I could not look" must not share a result.
  // ⚠⚠ AND A FILE IT CANNOT OPEN MUST FAIL, NOT THROW. `readFileSync` on a renamed or moved file
  // raises ENOENT, and a crash is NEITHER A PASS NOR A FAIL — it exits non-zero with no assert
  // named, which under a sweep that judges by exit code is indistinguishable from a real defect
  // and under a runner that catches it could read as a skip. This file is a list of OTHER files'
  // names, so it goes stale the moment one of them is renamed, which is the exact thing that just
  // happened to `ore.ts`. Say which one and keep going.
  const seen: Record<string, string> = {}
  for (const f of files) {
    let raw = ''
    try { raw = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8') }
    catch { fails.push(`${f} could not be read — this guard's file list is stale, not clean`); continue }
    ok(raw.length > 500, `${f} read (${raw.length} bytes)`)
    seen[f] = codeOnly(raw)
  }
  ok(seen['seams.ts'].includes('SEAM_BATCHES'), 'the stripper blanked the code as well as the prose')
  ok(!seen['seams.ts'].includes('there is no ore in the Ather'),
     'prose survived codeOnly — this guard would flag its own documentation')

  // The identifiers, as whole words. `\b` matters: `SEAM_BATCHES` must not be read as `ORE`, and
  // `before` must not be read as `ore`.
  for (const f of files) {
    if (seen[f] === undefined) continue   // already filed above as unreadable
    for (const bad of [/\bORE\b/, /\bisOre\b/, /\bplaceOre\b/, /\bOreBatch\b/, /\bPreOre\b/, /\bPostOre\b/]) {
      ok(!bad.test(seen[f]), `${f} carries the retired identifier ${bad.source} — the world has no ore`)
    }
  }

  // ── ★★ AND THE OTHER RESERVED WORD, ASSERTED AS A PROPERTY RATHER THAN A CROSS-REFERENCE ────
  // `shimmer-storyline.md:23` reserves "stronghold" for the Wilds; the main-map three are HOLDS.
  // `territory.ts` used to carry a sentence saying `holds.ts:1` still had it wrong. That file was
  // fixed and the sentence was not, so it sent readers to repair something already repaired — a
  // claim about another file's text with no way to fail. This is its replacement: it asserts the
  // PROPERTY, on both headers at once, and goes red instead of stale.
  // ⚠ FIRST LINE ONLY, ON PURPOSE. Both headers quote "stronghold" below, correctly, while
  // explaining the ban — and `story-path.ts:10` quotes it verbatim by design. The first line is
  // the file's own claim about what these things ARE, which is the only place it can be a lie.
  for (const f of ['holds.ts', 'territory.ts']) {
    const first = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').split('\n')[0]
    ok(!/stronghold/i.test(first),
       `${f}:1 calls the story-node three "strongholds" — canon reserves that word for the Wilds`)
  }
}

console.log(`\nseams: ${pass} passed, ${fails.length} failed`)
for (const f of fails) console.log('  ✗ ' + f)
if (fails.length) process.exit(1)
console.log('✅ the ladder is buried correctly')
