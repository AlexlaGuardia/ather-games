// Footing oracle. Run: npx tsx src/app/shimmer/voxel/footing.test.ts
//
// The point of this file is the LAST block. The unit asserts prove the search behaves; the survey
// proves it MATTERS — it samples the real meet ring around the three real holds on the real
// generator and reports how much of it is actually unfightable today. A helper that never fires on
// live ground is decoration, and nothing in the unit asserts could tell you that.

import { footingSpan, flatFightSpot, DEFAULT_FOOTING, type FootingCfg } from './footing'
import { HOLDS } from './holds'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

const SEED = 1337
const CFG = DEFAULT_FOOTING

// ── 1. The metric reads the ground, and it is not constant ────────────────────────────────────────
// ⚠ A span function that returned 0 everywhere would satisfy every "is it flat" assert in this file,
// so the FIRST thing to prove is that it discriminates at all.
{
  const spans = new Set<number>()
  for (let i = 0; i < 400; i++) spans.add(footingSpan(i * 37, i * 91, SEED, CFG.radius))
  ok(spans.size > 3, `footingSpan is nearly constant across 400 samples (${spans.size} distinct) — it is not reading the ground`)
  ok(!spans.has(NaN), 'footingSpan returned NaN somewhere')
  ok([...spans].every(v => v >= 0), 'footingSpan returned a negative span')
}

// ── 2. radius 0 is a single column, so its span is always 0 ───────────────────────────────────────
ok(footingSpan(500, -500, SEED, 0) === 0, 'a zero-radius footprint should span 0 — it is one column')

// ── 3. Already-good ground is returned UNMOVED ────────────────────────────────────────────────────
{
  let checked = 0
  for (let i = 0; i < 3000 && checked < 25; i++) {
    const x = i * 53, z = -i * 29
    if (footingSpan(x, z, SEED, CFG.radius) > CFG.maxSpan) continue
    checked++
    const f = flatFightSpot(x, z, SEED, CFG)
    ok(f.moved === 0 && f.ok && f.x === x && f.z === z, `flat ground at ${x},${z} was moved (${f.moved})`)
  }
  ok(checked > 0, 'found no already-flat sample to test — the fixture cannot see its subject')
}

// ── 4. When it MOVES, the new spot is genuinely flat — re-measured, not taken on trust ────────────
// ★ The cheapest wrong implementation returns the input and claims ok:true. This is what refuses it.
{
  let moves = 0
  for (let i = 0; i < 6000 && moves < 25; i++) {
    const x = i * 71 + 11, z = i * 43 - 7
    const f = flatFightSpot(x, z, SEED, CFG)
    if (f.moved === 0) continue
    moves++
    const actual = footingSpan(f.x, f.z, SEED, CFG.radius)
    ok(actual <= CFG.maxSpan, `moved to ${f.x},${f.z} but it spans ${actual} > ${CFG.maxSpan}`)
    ok(actual === f.span, `reported span ${f.span} but the ground measures ${actual}`)
    ok(f.moved <= Math.hypot(CFG.search, CFG.search) + 1e-9, `moved ${f.moved}, past the search bound ${CFG.search}`)
  }
  ok(moves > 0, 'nothing ever moved across 6000 samples — the search never fires, so nothing below is tested')
}

// ── 5. NEAREST acceptable, not flattest — the tuning decision, asserted ───────────────────────────
// A spot that clears the bar at ring 1 must win over a flatter one further out. Proven by construction:
// whatever it returns, no strictly nearer point may also clear the bar.
{
  let tested = 0
  for (let i = 0; i < 6000 && tested < 15; i++) {
    const x = i * 97 + 5, z = i * 61 + 3
    const f = flatFightSpot(x, z, SEED, CFG)
    if (!f.ok || f.moved === 0) continue
    tested++
    let nearerPasses: string | null = null
    for (let dz = -CFG.search; dz <= CFG.search; dz++) {
      for (let dx = -CFG.search; dx <= CFG.search; dx++) {
        const d = Math.hypot(dx, dz)
        if (d >= f.moved || d === 0) continue
        if (footingSpan(x + dx, z + dz, SEED, CFG.radius) <= CFG.maxSpan) nearerPasses = `${x + dx},${z + dz} at ${d.toFixed(2)}`
      }
    }
    ok(nearerPasses === null, `took a spot ${f.moved.toFixed(2)} away when ${nearerPasses} also clears the bar and is nearer`)
  }
  ok(tested > 0, 'never exercised the nearest-wins rule')
}

// ── 6. Fails OPEN: search 0 on bad ground returns the original, never throws ──────────────────────
{
  const tight: FootingCfg = { radius: 3, maxSpan: 0, search: 0 }
  let found = false
  for (let i = 0; i < 4000 && !found; i++) {
    const x = i * 83, z = i * 17
    if (footingSpan(x, z, SEED, 3) <= 0) continue
    found = true
    const f = flatFightSpot(x, z, SEED, tight)
    ok(!f.ok && f.x === x && f.z === z && f.moved === 0, 'a hopeless search must return the ORIGINAL point with ok:false')
  }
  ok(found, 'could not find lumpy ground to test the fail-open path')
}

// ── 7. Deterministic — a foe must not jitter between frames ───────────────────────────────────────
{
  let same = true
  for (let i = 0; i < 200; i++) {
    const x = i * 137, z = i * 211
    const a = flatFightSpot(x, z, SEED, CFG), b = flatFightSpot(x, z, SEED, CFG)
    if (a.x !== b.x || a.z !== b.z || a.ok !== b.ok) same = false
  }
  ok(same, 'flatFightSpot is not deterministic — the same request gave two answers')
}

// ── 7b. ★ THE LIVE PROBE IS ACTUALLY HONOURED — and this is the assert the module needs most ─────
// The cheapest wrong implementation of `heightAt` is to accept it and quietly keep reading
// `columnHeight`. EVERY other assert in this file passes under that bug, because they all use the
// generator. So these two are the only thing standing between the seam and a decorative parameter.
{
  // A constant probe means perfectly level ground everywhere, whatever the generator thinks.
  const flatEverywhere = () => 7
  let allZero = true
  for (let i = 0; i < 300; i++) {
    if (footingSpan(i * 61, i * 83, SEED, CFG.radius, undefined, flatEverywhere) !== 0) allZero = false
  }
  ok(allZero, 'footingSpan ignored `heightAt` — a constant probe must span 0 everywhere')

  // And the probe must reach the SEARCH RING, not just the first read. A half-wired version that
  // probes the origin and then scans the ring with columnHeight is a real and easy bug.
  const originLumpy = (hx: number, hz: number) => (hx === 1000 && hz === 500 ? 0 : (hx === 1002 && hz === 500 ? 40 : 0))
  // Ground is level (0) everywhere except a spike at 1002,500 — so a ring centred on 1000,500 that
  // includes the spike is lumpy, and stepping AWAY from it is the only cure.
  const f = flatFightSpot(1000, 500, SEED, { radius: 3, maxSpan: 2, search: 3 }, undefined, originLumpy)
  ok(f.ok, 'a probe-defined world with a clear escape should be rescued')
  ok(f.moved > 0, 'origin ring contains a 40-block spike; it must move')
  ok(footingSpan(f.x, f.z, SEED, 3, undefined, originLumpy) <= 2, 'moved to a spot the PROBE still calls lumpy — the ring is not using the probe')
}

// ── 8. ★ THE SURVEY: does this fire on the ground patrols ACTUALLY meet you on? ───────────────────
// PATROL_MEET is 22 blocks outside the curtain wall (`VoxelWorld.tsx`), and a patrol spawns on a ring
// at that reach, angled toward the keeper. Walk the whole ring of each real hold and measure.
{
  const MEET = 22
  let total = 0, bad = 0, rescued = 0, stranded = 0
  for (const h of HOLDS) {
    const rad = h.half + MEET
    for (let deg = 0; deg < 360; deg += 3) {
      const a = (deg / 180) * Math.PI
      const x = Math.round(h.x + Math.cos(a) * rad), z = Math.round(h.z + Math.sin(a) * rad)
      total++
      if (footingSpan(x, z, SEED, CFG.radius) <= CFG.maxSpan) continue
      bad++
      if (flatFightSpot(x, z, SEED, CFG).ok) rescued++; else stranded++
    }
  }
  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`
  console.log(`   survey · ${total} meet points on 3 holds · unfightable ${bad} (${pct(bad)}) · rescued ${rescued} (${pct(rescued)}) · still stranded ${stranded} (${pct(stranded)})`)
  ok(total > 300, 'survey sampled too few points to mean anything')
  // ⚠ NOT asserting bad > 0. If the road is already level everywhere this helper is unnecessary and
  // the honest outcome is a survey that says so out loud, not a red test demanding lumpy ground.
  ok(rescued + stranded === bad, 'survey arithmetic does not close')
  ok(bad === 0 || rescued > 0, 'the search rescued NOTHING on real ground — it is decoration here')
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ a floor to fight on — ${pass} passed`)
