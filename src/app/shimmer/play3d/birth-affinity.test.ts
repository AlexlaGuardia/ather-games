// ── The birth-rune LEAN and its readout — headless oracle ───────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/birth-affinity.test.ts
//
// `npm run canon` already diffs each rune's lean CATEGORY against the essence table in
// `shimmer-birth-rune.md` — that gate owns the canon half and this file does not restate it.
// What nothing covered until now is the half a PLAYER meets: whether the lean each rune resolves to
// can actually be READ. The lean shipped as a background mechanic and was invisible in-game for its
// whole life; the moment it gets a panel, "every rune renders something true" becomes a claim, and a
// claim with no check is the thing this repo keeps finding six weeks later.
//
// ⚠ THE FAILURE THIS EXISTS TO CATCH IS A BLANK, AND A BLANK IS THE HARD KIND. `leanEffects` diffs
// against neutral, so a magnitude retuned to its neutral value drops silently out of the list; zero
// the last one and the panel renders NOTHING while every other test in the repo stays green. The
// same goes for `essenceOf`: it is a rewrite, and a rewrite whose pattern over-matches returns a
// shorter string rather than an error. Neither failure looks like a failure.

import { RUNES } from './birth/runes.data'
import { birthAffinity, essenceOf, leanEffects, NEUTRAL_AFFINITY, type AffinityLean, attunementResist, combineResist, SELF_ATTUNEMENT_RESIST } from './birth-affinity'

let pass = 0, fail = 0
const chk = (label: string, ok: boolean) => { ok ? pass++ : (fail++, console.log(`  FAIL: ${label}`)) }

// ── 1. every rune a keeper can be BORN to has a readable lean ──────────────────────────────────
// The roster is read from the birth screen's own data, never a list kept here — a hand-copied roster
// is the mirror that agrees with itself while a rune is added to the game and not to the test.
{
  chk('the birth roster is non-empty (the fixture can actually see its subject)', RUNES.length > 0)

  const noLean: string[] = []
  const noEssence: string[] = []
  const eaten: string[] = []
  for (const r of RUNES) {
    const aff = birthAffinity(r.id)
    if (leanEffects(aff).length === 0) noLean.push(r.id)
    if (essenceOf(aff).length === 0) noEssence.push(r.id)
    // The strip must remove a TAIL, never the sentence. If it ever returns something drastically
    // shorter than the label it was handed, the pattern has begun eating content.
    if (aff.label.length > 0 && essenceOf(aff).length < aff.label.length * 0.4) eaten.push(r.id)
  }
  chk(`every birth rune grants a lean the panel can show${noLean.length ? ` — SILENT: ${noLean.join(', ')}` : ''}`,
    noLean.length === 0)
  chk(`every birth rune has an essence line${noEssence.length ? ` — BLANK: ${noEssence.join(', ')}` : ''}`,
    noEssence.length === 0)
  chk(`the essence strip removes a tail, not the sentence${eaten.length ? ` — EATEN: ${eaten.join(', ')}` : ''}`,
    eaten.length === 0)
}

// ── 2. the strip is a TAIL strip, pinned by example ────────────────────────────────────────────
// Asserted on a literal rather than on live data, because the live data all currently has the same
// shape — a test that only ever sees one shape cannot tell a correct pattern from a lucky one.
{
  const mk = (label: string) => ({ ...NEUTRAL_AFFINITY, label })
  chk('strips a trailing parenthetical', essenceOf(mk('Stone — you hold your ground (+shield)')) === 'Stone — you hold your ground')
  chk('leaves a label that has no tail alone', essenceOf(mk('Stone — you hold your ground')) === 'Stone — you hold your ground')
  chk('keeps a parenthetical that is NOT the tail', essenceOf(mk('Mist (the quiet one) — a presence (+harvest yield)')) === 'Mist (the quiet one) — a presence')
  chk('an empty label stays empty rather than throwing', essenceOf(mk('')) === '')
}

// ── 3. effects are DERIVED from the diff, so a second grant needs no new code ───────────────────
{
  const two = { ...NEUTRAL_AFFINITY, hpBonus: 10, speedMult: 1.5, lean: 'vitality' as AffinityLean, label: 'x' }
  const out = leanEffects(two)
  chk('a lean that moves two stats lists both', out.length === 2)
  chk('...and phrases a flat bonus as a flat bonus', out.some((e) => e === '+10 max health'))
  chk('...and a multiplier as a percentage', out.some((e) => e === '+50% move speed'))

  chk('a NEGATIVE lean is signed correctly, not silently dropped',
    leanEffects({ ...NEUTRAL_AFFINITY, hpBonus: -10, label: 'x' })[0] === '-10 max health')
}

// ── 4. the no-rune path renders nothing rather than an empty confident row ──────────────────────
{
  chk('no birth rune resolves to neutral', birthAffinity(null) === NEUTRAL_AFFINITY)
  chk('an unknown rune id resolves to neutral, never a crash', birthAffinity('not-a-rune') === NEUTRAL_AFFINITY)
  chk('★ neutral lists no effects, so the panel refuses to draw a lean nobody has',
    leanEffects(NEUTRAL_AFFINITY).length === 0)
  chk('★ and neutral has no essence line to show either', essenceOf(NEUTRAL_AFFINITY) === '')
}

// ── 5. FACET 4 — attunement resistance (canon v3, 2026-08-26) ──────────────────────────────────
{
  const R = SELF_ATTUNEMENT_RESIST
  chk('your own attunement resists', attunementResist('star', 'star') === R)
  chk('★ and NOTHING else does — canon opens no weakness matrix',
    RUNES.every((a) => RUNES.every((b) => a.id === b.id || attunementResist(a.id, b.id) === 0)))
  // ⛔ The counter-wheel canon explicitly refuses. A wheel would show up as a NEGATIVE return — a
  // hit that costs MORE because of who you are. This asserts the return is a resistance or nothing,
  // across the whole 20x20 grid, so a wheel cannot be added here without going red.
  chk('⛔ no pairing ever returns a PENALTY — a counter-wheel cannot hide in this function',
    RUNES.every((a) => RUNES.every((b) => attunementResist(a.id, b.id) >= 0)))
  chk('modest, never immunity (canon: Veyra can still burn)', R > 0 && R < 1)

  // The untyped source, which today is EVERY source. Fail-open is the correct direction: an
  // unlabelled hit must never be mistaken for the keeper's own attunement.
  chk('an untyped hit resists nothing', attunementResist('star', undefined) === 0 && attunementResist('star', null) === 0)
  chk('a keeper with no birth rune resists nothing', attunementResist(null, 'star') === 0)

  // ★ THE CEILING IS ARITHMETIC, NOT A COMMENT. Bulwark + attunement added would be 0.80 and a
  // third source would cross 1.0 into healing-from-damage; folded, it approaches 1 and only reaches
  // it if something is already a total immunity.
  chk('two resistances fold below total immunity', combineResist(0.55, R) < 1 && combineResist(0.55, R) > 0.55)
  chk('...and stay below it however many stack',
    [0.55, R, 0.45, 0.35, 0.6].reduce(combineResist, 0) < 1)
  chk('...while a genuine 1.0 is still allowed through', combineResist(1, 0) === 1)
  chk('folding is order-independent', combineResist(0.3, 0.7) === combineResist(0.7, 0.3))

  // ⚠ THE STATE OF THE WORLD, PRINTED RATHER THAN ASSUMED. Nothing in the shipped game deals
  // elemental damage, so every assert above is about a rule that CANNOT FIRE in play yet. Saying so
  // here is what stops "attunement resistance: done" from being read as "keepers resist their
  // element in game". It lights up when world enemies cast (focus row #294).
  console.log('  ⚠ attunement resistance is UNREACHABLE IN PLAY: no damage source declares a rune yet')
  console.log('    (play3d hurtPlayer = drone + Wren reflect, both untyped · voxel = pressure(), never wounds)')
}

console.log(`\nbirth-affinity oracle: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
