// The rinning catch oracle. Run: npx tsx src/app/shimmer/engine/rin-catch.test.ts
//
// ★ THE FIRST SECTION IS THE IMPORTANT ONE: it reads CANON and fails if this build's ladder has
// drifted from it. Every other assert here is about weighting, which is Jin's to tune; the names,
// the tiers and the XP are Magii's and a hand-copied table is a table that goes stale silently.
// Same argument as `npm run canon`'s ten gates, applied to a table that has no gate yet.

import { readFileSync } from 'node:fs'
import { RIN_TIERS, rinCatch, ceilingFor, population, PATIENCE_FULL_MS, type RinWater } from './rin-catch'
import { RIN_POND, RIN_STREAM, RIN_LAKE } from '../voxel/rin-water'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

/** A deterministic 0..1 stream, so a weighting assert measures the rule and not the noise. */
function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}
// ⚠ A `function`, NOT `const water = (...) => ({ ... })`, AND THAT IS NOT STYLE. This file is
// semicolon-free like the rest of the tree, and an arrow whose body is a PARENTHESISED OBJECT
// followed by a bare `{` block — which every section below opens with — parses as one expression:
// tsc reported `'=>' expected` at the block, and pointed the other four errors at the arrow itself.
// ★ THE DAMAGE WAS NOT LOCAL. A parse error in one test file makes `tsc` abandon the PROJECT, so
// the run came back with five errors instead of the fifteen known ones — and a diff-against-baseline
// reads that as "everything changed" while a careless glance reads it as "the errors went away".
// `tsx` runs the file perfectly, so the suite was green throughout. A declaration has no such
// ambiguity and needs no semicolon to fix it.
function water(kind: RinWater['kind'], depth: number, lively = false): RinWater {
  return { kind, depth, lively }
}

// ── 1. ★★ THE LADDER STILL MATCHES CANON ────────────────────────────────────────────────────────
{
  const SKILLING = '/root/athernyx/CANON/game/shimmer-skilling.md'
  let src = ''
  try { src = readFileSync(SKILLING, 'utf8') } catch { /* handled below */ }
  ok(src.length > 0, `canon is readable at ${SKILLING} — without it every assert in this section is vacuous`)

  if (src) {
    const skill4 = src.slice(src.indexOf('## Skill 4: Rinning'), src.indexOf('## Skill 5'))
    ok(skill4.length > 500, 'the Rinning section was located in canon (else the greps below match nothing and pass)')

    // The XP table is the tightest thing to bind to: four rows, four numbers, unambiguous.
    const xpRows = [...skill4.matchAll(/\|\s*Catch ([^|]+?)\s*\|\s*(\d+)\s*\|/g)]
      .map(m => ({ who: m[1], xp: Number(m[2]) }))
    ok(xpRows.length === 4, `canon lists four XP rows (found ${xpRows.length})`)
    const canonXp = xpRows.map(r => r.xp).sort((a, b) => a - b)
    const buildXp = RIN_TIERS.map(t => t.xp).sort((a, b) => a - b)
    ok(JSON.stringify(canonXp) === JSON.stringify(buildXp),
      `★★ the XP ladder matches canon — canon ${JSON.stringify(canonXp)} vs build ${JSON.stringify(buildXp)}`)

    // Every rinn this build can hand out must be named in canon's own tables. Matched loosely
    // (canon writes "Glowfin", the item id is `glowfin_scale`) because the ID convention is the
    // build's business and the NAME is canon's.
    const lower = skill4.toLowerCase()
    const missing = RIN_TIERS.flatMap(t => t.items)
      .filter(id => !lower.includes(id.replace(/_scale$/, '').replace(/_/g, ' ')))
    ok(missing.length === 0, `★★ every catchable rinn is named in canon (unnamed: ${missing.join(', ') || 'none'})`)

    // And the level bands, which are the half that is easy to confuse with the per-spot minLevel in
    // `world/resources.ts` — the file's own header warns about exactly this pair.
    const bands = [...skill4.matchAll(/\*\*Tier (\d) — Levels? (\d+)/g)].map(m => ({ tier: Number(m[1]), min: Number(m[2]) }))
    ok(bands.length === 4, `canon heads four tiers with a level band (found ${bands.length})`)
    const bandMismatch = bands.filter(b => RIN_TIERS.find(t => t.tier === b.tier)?.minLevel !== b.min)
    ok(bandMismatch.length === 0,
      `★★ tier level bands match canon (mismatched: ${bandMismatch.map(b => `T${b.tier} canon ${b.min}`).join(', ') || 'none'})`)
  }
}

// ── 2. THE SPOT IS A CEILING AND THE LEVEL IS A KEY — two limits, neither substituting ──────────
{
  ok(ceilingFor(water(RIN_POND, 3)) === 1, 'a pond holds tier 1 and nothing else')
  ok(ceilingFor(water(RIN_STREAM, 3)) === 2, 'a stream reaches tier 2')
  ok(ceilingFor(water(RIN_LAKE, 12)) === 4, 'the deepest basin water reaches tier 4')
  ok(ceilingFor(water(RIN_LAKE, 0)) === 2, "a basin's own shallow edge does not")

  // ★ The claim the ceiling exists FOR: a maxed keeper cannot farm a wish out of a puddle.
  const rng = lcg(7)
  let best = 0
  for (let i = 0; i < 20000; i++) best = Math.max(best, rinCatch(water(RIN_POND, 3, true), 10, 10 * PATIENCE_FULL_MS, rng).tier)
  ok(best === 1, `★★ a level-10 keeper with infinite patience still only pulls tier 1 from a pond (best was ${best})`)

  // ...and the mirror: deep water a low-level keeper cannot yet land.
  const rng2 = lcg(11)
  let best2 = 0
  for (let i = 0; i < 20000; i++) best2 = Math.max(best2, rinCatch(water(RIN_LAKE, 12, true), 1, 10 * PATIENCE_FULL_MS, rng2).tier)
  ok(best2 === 1, `★★ a level-1 keeper at the best water in the world still only lands tier 1 (best was ${best2})`)
}

// ── 3. PATIENCE AND POPULATION LEAN THE ROLL, AND ONLY LEAN IT ──────────────────────────────────
{
  const deep = water(RIN_LAKE, 10, true)
  const mean = (patienceMs: number, seed: number) => {
    const rng = lcg(seed)
    let sum = 0
    for (let i = 0; i < 40000; i++) sum += rinCatch(deep, 10, patienceMs, rng).tier
    return sum / 40000
  }
  const impatient = mean(0, 3), patient = mean(PATIENCE_FULL_MS, 3)
  ok(patient > impatient, `★ waiting improves the catch (${impatient.toFixed(3)} → ${patient.toFixed(3)})`)

  // ⚠ THE ASSERT THAT KEEPS IT A LEAN. If patience ever GATES, an impatient cast in perfect water
  // stops producing anything above the floor and rinning becomes a timer with a fishing rod on it.
  ok(impatient > 1.05, `★★ and impatience is not a wall — a hurried cast in deep water still beats tier 1 sometimes (${impatient.toFixed(3)})`)

  const quiet = population(water(RIN_LAKE, 10, false)), alive = population(water(RIN_LAKE, 10, true))
  ok(alive > quiet, `lively water holds more (${quiet.toFixed(2)} → ${alive.toFixed(2)})`)
  ok(quiet > 0, '★ and quiet water is never empty — rin-water.ts: "quiet water is fishable water, it is just quiet"')

  // Depth only varies where it was measured to vary. A pond reading differently would mean the
  // ladder had quietly started trusting a constant.
  ok(population(water(RIN_POND, 3)) === population(water(RIN_POND, 3)), 'pond population is stable')
  ok(population(water(RIN_LAKE, 12)) > population(water(RIN_LAKE, 0)), 'basin depth reads as more life')
}

// ── 4. A CAST NEVER LANDS NOTHING ───────────────────────────────────────────────────────────────
{
  // Canon spends two sentences refusing punishments in this skill; an empty catch is a punishment.
  const rng = lcg(99)
  let empty = 0, checked = 0
  for (const w of [water(RIN_POND, 3), water(RIN_STREAM, 1), water(RIN_LAKE, 0), water(RIN_LAKE, 12, true)]) {
    for (let lvl = 1; lvl <= 10; lvl++) {
      for (let i = 0; i < 2000; i++) {
        const r = rinCatch(w, lvl, rng() * PATIENCE_FULL_MS * 2, rng)
        checked++
        if (!r.itemId || !(r.xp > 0)) empty++
      }
    }
  }
  ok(checked > 50000 && empty === 0, `★★ every cast lands a named rinn with XP (${empty} of ${checked} did not)`)

  // Every item id the roll can produce must be one this build actually knows about, or the catch
  // is a silent no-op in the keeper's bag. Guarded here rather than at the call site because the
  // ladder is the thing that decides the ids.
  const ids = new Set(RIN_TIERS.flatMap(t => t.items))
  ok(ids.size === 7, `canon's seven rinn are all present (${ids.size})`)
}

console.log(fails.length ? `❌ ${fails.length} failed:\n  ${fails.join('\n  ')}` : `✅ the ladder is canon's and the water decides — ${pass} passed`)
process.exit(fails.length ? 1 : 0)
