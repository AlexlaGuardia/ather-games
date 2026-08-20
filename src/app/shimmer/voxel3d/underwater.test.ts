// Underwater-view oracle. Run: npx tsx src/app/shimmer/voxel3d/underwater.test.ts
//
// Four things are held still here, and three of them are claims someone would "simplify" away:
//
//  1. The predicate reads the EYE and is BLIND to the body. `locomotion`'s `submerged` is chest+feet
//     and the eye is 0.62 above the chest, so the two disagree for the whole of treading. §1 is
//     arranged so that a rewrite taking a body height or a `submerged` flag cannot pass it.
//  2. `unknown` is a THIRD ANSWER, not a false. Both of the world's cell probes answer "not water"
//     for an unloaded column, so a boolean predicate blinks the water off at the frontier. §2.
//  3. Underwater REPLACES the medium rather than thickening it. Gloom and mist multiply; water
//     lerps to an absolute and lands last, so a pond is the same pond at midnight under a canopy
//     as at noon in a meadow. §4 asserts that dominance directly, against hostile inputs.
//  4. The wash fires ONCE per crossing, in both directions, and can never touch dry-land fog. §3/§5.

import {
  submersion, fogUnder, domeVeil, stepUnder, newUnderState,
  UNDER, WATER_RECESS, SUBMERGE_BAND, type Cell,
} from './underwater'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps

// ── §1 the eye, not the body ────────────────────────────────────────────────────────────────
// The rendered surface of the cell y=10 sits at 10 + 1 - 0.1 = 10.9. Everything below is geometry
// off that one number, so if WATER_RECESS ever stops matching the water shader these all move.
const SURF = 10 + 1 - WATER_RECESS
ok(near(submersion(SURF, 'water', 'other')!, 0), 'exactly at the surface is NOT submerged')
ok(near(submersion(SURF + 0.05, 'water', 'other')!, 0), 'eye above the surface inside a water cell is not submerged — the cell boundary is not the water')
ok(near(submersion(SURF - SUBMERGE_BAND, 'water', 'other')!, 1), 'a full band below the surface is fully submerged')
ok(near(submersion(SURF - SUBMERGE_BAND / 2, 'water', 'other')!, 0.5), 'the band ramps linearly')
ok(submersion(SURF - 0.01, 'water', 'other')! > 0, 'a hair under the surface has begun')
ok(submersion(10.5, 'water', 'water')! === 1, 'water over your head is submerged outright, no ramp')
ok(submersion(10.99, 'water', 'water')! === 1, 'water over your head wins even in the top tenth of the cell')
ok(submersion(10.5, 'other', 'water')! === 0, 'standing in air under an overhang of water is not submerged')

// The body/eye gap this whole module exists for: locomotion calls you `submerged` from
// chest (feet+1.0) and feet (feet+0.2), while the eye rides at feet+1.62.
// Water fills cells 9 and 10; the rendered surface is 10.9. Feet at 9.3 put chest (10.3) and feet
// (9.5) both inside water cells, so locomotion sets `submerged` — while the eye at 10.92 is two
// centimetres ABOVE the water it is nominally inside. That sliver is not a curiosity: it is where
// treading lives, and treading is how you swim to a bank and hop out.
const feet = 9.3
const EYE_STAND = 1.62
const eye = feet + EYE_STAND
ok(Math.floor(feet + 1.0) === 10 && Math.floor(feet + 0.2) === 9,
  'fixture: chest and feet both read a water cell — locomotion says submerged')
ok(Math.floor(eye) === 10, 'fixture: and the EYE is inside that same water cell')
ok(eye > SURF, 'fixture: but above the water surface the shader actually draws')
ok(submersion(eye, 'water', 'other') === 0,
  'THE POINT: body submerged, eye above the surface, view stays dry — `submerged` would have tinted here')

// ── §2 unknown is a third answer ─────────────────────────────────────────────────────────────
ok(submersion(10.5, 'unknown', 'unknown') === null, 'an unloaded column answers null, not 0')
ok(submersion(10.5, 'unknown', 'water') === null, 'unknown at the eye wins regardless of what is above')
ok(submersion(10.5, 'other', 'unknown') === 0, 'a KNOWN dry eye is a real 0 even with unknown above')
const held = newUnderState()
stepUnder(held, 1, 1)                       // fully under
const depth = held.t
stepUnder(held, null, 0.5)
ok(held.t === depth, 'null HOLDS the view — the water does not blink off at the frontier')
ok(submersion(10.5, 'water', 'unknown') !== null,
  'a known-water eye still answers even if the cell above cannot be read (falls to the ramp)')
// Holding `t` is right; holding the WASH is not — a frozen flash would park a bright ring on
// screen for as long as the frontier stayed unloaded.
const flashing = newUnderState()
for (let i = 0; i < 12; i++) stepUnder(flashing, 1, 1 / 60)   // mid-wash
ok(flashing.surge > 0, 'fixture: the wash is lit')
const litAt = flashing.surge
stepUnder(flashing, null, 1 / 30)
ok(flashing.surge < litAt, 'a hold still DRAINS the wash — only the depth is held, never the flash')

// ── §3 the crossing wash ─────────────────────────────────────────────────────────────────────
const s = newUnderState()
ok(s.surge === 0 && s.t === 0, 'a fresh state is dry and quiet')
let fired = 0
for (let i = 0; i < 30; i++) { const b = s.surge; stepUnder(s, 1, 1 / 60); if (s.surge > b) fired++ }
ok(fired === 1, `the wash fires exactly once going under (fired ${fired})`)
ok(s.t > 0.99, 'and the view settles fully under')
for (let i = 0; i < 200; i++) stepUnder(s, 1, 1 / 60)
ok(near(s.surge, 0, 1e-6), 'the wash decays to nothing while you hold a depth')
let firedOut = 0
for (let i = 0; i < 30; i++) { const b = s.surge; stepUnder(s, 0, 1 / 60); if (s.surge > b) firedOut++ }
ok(firedOut === 1, `the wash fires again coming OUT — a surface crossing is an event in both directions (fired ${firedOut})`)
// Treading: the target flickers across the band with the ripple. The wash must not machine-gun.
const tread = newUnderState()
let chatter = 0
for (let i = 0; i < 120; i++) {
  const b = tread.surge
  stepUnder(tread, i % 2 ? 0.55 : 0.45, 1 / 60)
  if (tread.surge > b) chatter++
}
ok(chatter <= 1, `a rippling surface does not machine-gun the wash (fired ${chatter}) — it keys on the EASED value, not the target`)

// ── §4 water REPLACES the medium — the dominance assert ──────────────────────────────────────
// Hostile inputs: the thickest air the game can make (a mist patch inside the Thicket at night)
// and the thinnest (open meadow at noon). Underwater, both must land on the same water.
const thick = fogUnder(8, 30, 1)
const thin = fogUnder(80, 200, 1)
ok(near(thick.near, UNDER.fogNear) && near(thick.far, UNDER.fogFar), 'at full submersion fog IS the water, whatever the air was')
ok(near(thin.near, thick.near) && near(thin.far, thick.far),
  'a pond at noon in a meadow and the same pond at midnight under canopy are the SAME pond — water does not inherit its neighbours')
const half = fogUnder(80, 200, 0.5)
ok(half.far > UNDER.fogFar && half.far < 200, 'half submerged is between the two media, not at either')
ok(fogUnder(80, 200, 0).far === 200 && fogUnder(80, 200, 0).near === 80, 'dry land is untouched')

// ── §5 the wash cannot reach dry land ────────────────────────────────────────────────────────
ok(fogUnder(80, 200, 0, 1).far === 200, 'a full wash at t=0 moves NOTHING — the cue rides on the lerp, it cannot fog a meadow')
// ⚠ THE LINE ABOVE IS GUARDED BY AN EARLY RETURN AND SO PROVES LESS THAN IT LOOKS. It passed a
// mutation that ungated the wash entirely, because `fogUnder` short-circuits at exactly t===0 and
// never reaches the term under test. The claim only has teeth just OFF zero — a toe in the water
// with a full wash lit must not collapse the far plane the way full submersion would.
const dipped = fogUnder(80, 200, 0.02, 1).far
const dippedCalm = fogUnder(80, 200, 0.02, 0).far
ok(dipped > dippedCalm * 0.97,
  'the wash scales WITH the dip that caused it — barely under, it barely pulls (ungated, this squeezes the far plane by 45% while you are essentially dry)')
ok(fogUnder(80, 200, 1, 1).far < fogUnder(80, 200, 1, 0).far, 'and it does squeeze the far plane while submerged')
ok(fogUnder(80, 200, 1, 1).far > 0, 'the wash never collapses the far plane to zero')

// ── §6 the dome ──────────────────────────────────────────────────────────────────────────────
// The sky dome is `fog: false`, so fog alone leaves a bright blue sky over an arm's-length world.
ok(domeVeil(1) === 1, 'fully under, the dome is fully veiled — otherwise fog closes in under an open blue sky and reads as a render bug')
ok(domeVeil(0) === 0, 'dry land keeps its sky')
ok(domeVeil(2) === 1 && domeVeil(-1) === 0, 'the veil is clamped')

// ── §7 the dial stays inside its own claims ──────────────────────────────────────────────────
ok(UNDER.fogNear < 1, 'fogNear is near-zero: this is a TINT on every pixel, not a distance haze — the reason no post pass is needed')
ok(UNDER.hemiLift > 0, 'skylight is LIFTED underwater, never cut — canon rules the Ather\'s waters luminescent, and cutting light is what made mist read as a dust storm')
ok(UNDER.sunCut > 0 && UNDER.sunCut < 1, 'direct sun is softened, not killed — a surface scatters it')
ok(SUBMERGE_BAND < 0.5, 'the band is a meniscus, not a fade')
ok(WATER_RECESS === 0.1, 'WATER_RECESS tracks mesh-bridge.ts `transformed.y -= 0.1` — if that shader changes, the tint stops matching the water you can see')

const cells: Cell[] = ['water', 'other', 'unknown']
ok(cells.length === 3, 'Cell has three states — a boolean here is the frontier-blink bug')

console.log(fails.length ? `❌ underwater: ${pass} pass, ${fails.length} FAIL\n  ${fails.join('\n  ')}`
  : `✅ underwater: ${pass} asserts pass`)
process.exit(fails.length ? 1 : 0)
