// Creature-size oracle. Run: npx tsx src/app/shimmer/sprites/creature-size.test.ts
//
// ── ★★ WHAT THIS FILE REFUSES TO DO ──────────────────────────────────────────────────────────────
// It does not restate the ten numbers. A guard that says `fox === 0.5` passes for exactly as long as
// nobody rules anything and tells you nothing when they do — it is the hand-kept mirror wearing a
// test's name, and this repo has the scars. What it asserts instead is the RELATIONS canon states in
// its own words, so the day Magii moves every value the guard still means something: if the new
// table breaks shins < knees < chin, the ruling contradicts the prose and somebody should know.

import { SIZES, creatureHeight, BASE_FORM_MAX, UNSIZED_FALLBACK, PENDING_SIZES } from './creature-size'
import { SPECIES_IDS } from './registry'
import { EYE_STAND } from '../voxel3d/locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const h = (id: string) => SIZES[id]?.height ?? NaN

// ── 1. ★★ COVERAGE — the eleventh species fails here on the day it is painted ────────────────────
// `registry.ts` already derives which ids are creatures from the directory, so this borrows a list
// that cannot itself go stale rather than keeping a second one. Exact both ways: a species with no
// size is a body drawn at the fallback, and a size for a species that no longer exists is a rename
// nobody followed.
{
  const sized = Object.keys(SIZES).sort()
  const known = [...SPECIES_IDS].sort()
  for (const id of known) ok(id in SIZES, `species '${id}' is registered but has no size`)
  for (const id of sized) ok(known.includes(id), `size table names '${id}', which is not a registered species`)
  ok(sized.length === known.length, `${sized.length} sizes for ${known.length} species`)
  console.log(`   coverage · ${sized.length} species sized`)
}

// ── 2. ★★★ CANON'S OWN MEASURING STICK ──────────────────────────────────────────────────────────
// Three of Bonn's spirits are measured against HER OWN BODY at three unambiguous contact points: a
// Manalotl at her heel, a Dewbear at her shins, a Vulnyx at her knees. A strict ordering canon
// asserts directly, in one measuring stick — the single strongest claim in this file.
//
// ⚠⚠ THIS ASSERT USED TO RUN THE OTHER WAY AND IT WAS GREEN THE WHOLE TIME. It read `fox < axolotl`,
// from a misreading of "a cool damp head under her chin" as a standing height, and it PASSED —
// because the table and the guard were derived from the same bad reading of the same single quote.
// A copy agreeing with its original is not evidence about either. It could not have failed for the
// right reason, and it would have made anyone who checked more confident. Only a SECOND quote of a
// different shape ("Brook flowed quiet at Bonn's heel") could break the tie, and it did.
{
  ok(h('axolotl') < h('water-bear'), `Manalotl (heel, ${h('axolotl')}) must be shorter than Dewbear (shins, ${h('water-bear')})`)
  ok(h('water-bear') < h('fox'), `Dewbear (shins, ${h('water-bear')}) must be shorter than Vulnyx (knees, ${h('fox')})`)
}

// ── 3. THE SMALL END, likewise from the prose, not from my arithmetic ────────────────────────────
// "A mote of living green light" < "the size of a thumb" < a frog that kisses a knuckle and sits on
// a well-lip < a rabbit dexterous enough to work a latch.
{
  ok(h('firefly') < h('hummingbird'), `Luminara (a mote, ${h('firefly')}) must be smaller than Hovari (a thumb, ${h('hummingbird')})`)
  ok(h('hummingbird') < h('frog'), `Hovari (a thumb, ${h('hummingbird')}) must be smaller than Croakling (a knuckle, ${h('frog')})`)
  ok(h('frog') < h('rabbit'), `Croakling (${h('frog')}) must be smaller than Lepara, who works latches (${h('rabbit')})`)
  // ★ A SECOND SHIN-BUMPER. "Ember bumped his shins" puts the Lepara at the same contact point as the
  // Dewbear, so canon constrains them to each other and not just to the ordering above.
  ok(Math.abs(h('rabbit') - h('water-bear')) < 0.15,
    `Lepara (${h('rabbit')}) and Dewbear (${h('water-bear')}) both bump shins and must not be a size class apart`)
}

// ── 4. ★★ ALEX'S ACTUAL ASK, AS A GUARD ─────────────────────────────────────────────────────────
// *"firefly shouldn't be human-scale."* Stated against `locomotion.ts`'s own eye height rather than
// against the number 1.62, so the claim tracks the walker if the walker ever changes. Every base
// form is smaller than a person; canon's largest reading is a kneeling chin and the rest are hands
// and knuckles. ⚠ This must NOT be relaxed for an AWAKENED form — those are vast by canon and are
// not in this table.
{
  ok(BASE_FORM_MAX < EYE_STAND, `BASE_FORM_MAX ${BASE_FORM_MAX} must be under a keeper's eye height ${EYE_STAND}`)
  for (const id of SPECIES_IDS) {
    ok(h(id) > 0, `'${id}' has a non-positive height ${h(id)}`)
    ok(h(id) <= BASE_FORM_MAX, `'${id}' at ${h(id)}m is taller than a base form may be (${BASE_FORM_MAX})`)
    ok(h(id) < EYE_STAND, `'${id}' at ${h(id)}m stands eye-to-eye with the keeper`)
  }
  // The specific body Alex named. A firefly is a mote; a tenth of a metre is already generous.
  ok(h('firefly') < 0.1, `Luminara at ${h('firefly')}m is not a mote`)
  console.log(`   scale · tallest ${Math.max(...SPECIES_IDS.map(h))}m, smallest ${Math.min(...SPECIES_IDS.map(h))}m, keeper eye ${EYE_STAND}m`)
}

// ── 5. ★ EVERY NUMBER SHOWS ITS WORKING ─────────────────────────────────────────────────────────
// The point of this table is that it is a canon READING. An entry with no quote is a number someone
// chose, which is the thing the boundary bars, so it fails here rather than in a book six months on.
{
  for (const id of SPECIES_IDS) {
    const s = SIZES[id]
    ok(!!s && s.source.trim().length > 20, `'${id}' has no canon source for its size`)
    // ⚠ THE SHAPES CANON ACTUALLY CITES BY, not "contains a bracket". The first version of this
    // assert took any parenthesis, so stripping a quote down to "—— knees ... (bk11:71)" sailed
    // through — it was testing for punctuation. Found by mutation, which is the only way this class
    // of weak assert ever surfaces.
    ok(!!s && /(bk\d+:\d+|otto-\d|tess-\d|benji-\d|[a-z-]+\.md:?\d*)/.test(s.source),
      `'${id}' cites no book or canon file — a quote with no source is hearsay`)
    // And it must be a QUOTE, not a paraphrase: the reading has to be checkable against the page.
    ok(!!s && /"/.test(s.source), `'${id}' cites a source but quotes nothing from it`)
  }
}

// ── 6. ★★ THE EXEMPTION EXPIRES BY ITSELF ───────────────────────────────────────────────────────
// Two species are pending because canon genuinely has not settled them. Naming them HERE rather than
// counting them means the day Magii rules one, flipping `pending` to false turns this red and the
// author has to come and delete the row deliberately. A bare count would let a THIRD pending entry
// slip in behind a ruling. (PATTERNS: write the exemption so it expires.)
{
  // ⚠ EMPTY SINCE THE 2026-08-27 RULING, AND THE ASSERT IS NOT NOW DECORATION. It still has an input
  // that makes it fire: a new species, or a re-opened row, marked pending without anyone updating
  // this list. That is the case it was written for — the exemption expires by itself either way.
  const EXPECTED_PENDING: string[] = []
  ok(PENDING_SIZES.length === EXPECTED_PENDING.length && EXPECTED_PENDING.every(id => PENDING_SIZES.includes(id)),
    `pending set is [${PENDING_SIZES}], expected [${EXPECTED_PENDING}] — if canon ruled one, delete it from BOTH`)
  for (const id of PENDING_SIZES) {
    ok(/PENDING:/.test(SIZES[id]!.source), `'${id}' is pending but its source never says what is missing`)
  }
  // And a settled entry must not be quietly carrying a PENDING note.
  for (const id of SPECIES_IDS) {
    if (SIZES[id]!.pending) continue
    ok(!/PENDING:/.test(SIZES[id]!.source), `'${id}' is marked settled but its source still says PENDING`)
  }
  console.log(`   canon · ${SPECIES_IDS.length - PENDING_SIZES.length} read off the books, ${PENDING_SIZES.length} awaiting Magii (${PENDING_SIZES})`)
}

// ── 7. ⚠ SAVED DATA REACHES THIS FUNCTION ───────────────────────────────────────────────────────
// The mist ledger and keeper saves are localStorage and a player can edit them, so an id here is
// untrusted input. `registry.ts` was bitten by exactly this: on a plain object literal
// `SIZES['__proto__']` is `Object.prototype`, truthy, and `?.height` is `undefined` — a body scaled
// by NaN, which draws nothing and reports nothing.
{
  for (const evil of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    const got = creatureHeight(evil)
    ok(got === UNSIZED_FALLBACK, `creatureHeight('${evil}') = ${got}, expected the fallback ${UNSIZED_FALLBACK}`)
    // ★★ AND THE TABLE ITSELF, WHICH IS THE HALF THAT WAS ACTUALLY AT RISK. `creatureHeight` was
    // never exposed — its `?.height ?? fallback` chain swallows `Object.prototype` on the way past,
    // so removing the null prototype changed nothing there and this section's first draft called
    // that a passing safety test. It was measuring the wrong subject. Every OTHER reader indexes
    // `SIZES` directly (this oracle does it twice), and those get a live `Object.prototype` with no
    // `height` and no `source`. Assert the table, not the one accessor that happens to be immune.
    ok(SIZES[evil] === undefined, `SIZES['${evil}'] is not undefined — the null prototype is gone`)
  }
  ok(creatureHeight('no-such-spirit') === UNSIZED_FALLBACK, 'an unknown species must take the fallback')
  // ⚠ `null` REACHES THIS FOR REAL: `plot-ring-pass`'s `speciesOf(slot.id)` is `string | null` for a
  // slot whose spirit has left the roster. It must answer the fallback, never NaN — a body scaled by
  // NaN vanishes silently, which is the failure mode nobody files a bug about.
  ok(creatureHeight(null) === UNSIZED_FALLBACK, 'a null species must take the fallback, not NaN')
  ok(creatureHeight(undefined) === UNSIZED_FALLBACK, 'an undefined species must take the fallback, not NaN')
  // ⚠ And the fallback must itself be modest — the whole bug was an unknown body drawn human-tall.
  ok(UNSIZED_FALLBACK < EYE_STAND, `the fallback ${UNSIZED_FALLBACK} is human-scale, which is the bug this file exists to end`)
}

if (fails.length) { console.error(`❌ ${fails.length} failed:`); for (const f of fails) console.error('   · ' + f); process.exit(1) }
console.log(`✅ ten spirits, sized from the books — ${pass} passed`)
