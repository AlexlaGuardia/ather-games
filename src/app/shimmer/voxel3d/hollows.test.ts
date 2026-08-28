// Hollows oracle. Run: npx tsx src/app/shimmer/voxel3d/hollows.test.ts
//
// The one assert that is CANON, not tuning: a Hollow may never body on healthy ground — grey is
// drain, darkness is only the condition, and "spawns where it's dark" is the 2026-06-16 failure
// the ruling names explicitly. The rest pins behaviour a playtest would misread as vibes: the
// drift is slower than a runner, the gun can actually hit one, dawn always wins.

import { hollowEligible, hollowStep, segmentDist, hollowCap, packSize, packWalk, hollowNight,
         HOLLOW_SPEED, HOLLOW_HOVER, HOLLOW_STEP_UP, PACK_MAX, PACK_STEP, NIGHT_SKY_MAX, GUTTER_SKY,
         HOLLOW_FORMS, FORM_ORDER, pickForm, pushOutOfBodies, hollowTouching,
         type HollowState, type HollowForm , UNIMPAIRED, type Impair,
         hollowStrike, keeperLooking, SEEN_ENTER,
         HOLLOW_GROUND_UP, HOLLOW_GROUND_DOWN, HOLLOW_REACH_Y_MAX, HOLLOW_REACH_Y_MIN, reachY } from './hollows'
import { topSolidNear } from './ground-probe'
import { WORLD_SEED } from './world-seed'
import { treeStartsAt, growTreeCells, DEFAULT_TREES } from '../voxel/trees'
import { greyness } from '../voxel/biome'
import { columnHeight } from '../voxel/height'
import { packLight } from '../voxel/light'
import { RUN_SPEED, DRAINED_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

// ★ EVERY ASSERT WRITTEN BEFORE 2026-08-28 MEANT "the keeper is level with the body" — the touch
// had no height term at all, so elevation could not be expressed. These two name that assumption
// instead of hiding it behind a repeated literal, and the elevation asserts sit in their own block
// below where they can be read as being about elevation.
const touchingLevel = (h: HollowState, px: number, pz: number, imp: Impair) =>
  hollowTouching(h, px, h.y, pz, imp)
const strikeLevel = (h: HollowState, dt: number, px: number, pz: number, imp: Impair, looking: boolean) =>
  hollowStrike(h, dt, px, h.y, pz, imp, looking)

const SEED = 1337

// ── 1. ★ the canon predicate: drained + dark + dry, all three, no exceptions ────────────────────
// "Dark" is the light field's word now: an open surface spot is packLight(sky 15, block 0), and
// the day factor decides what that sky is worth. Block light is an ABSOLUTE veto — the lantern.
{
  const openNight = packLight(15, 0)
  let healthy = 0, greyN = 0, dayVeto = 0, wetVeto = 0, litVeto = 0, duskMismatch = 0
  for (let i = 0; i < 40000; i++) {
    const x = (i * 613) % 8000 - 4000, z = (i * 227) % 8000 - 4000
    const h = columnHeight(x, z, SEED)
    const elig = hollowEligible(x, z, SEED, openNight, 0, h, 140)
    if (elig) {
      greyN++
      if (greyness(x, z, SEED) < 0.5) healthy++                          // the forbidden case
    }
    if (hollowEligible(x, z, SEED, openNight, 1, h, 140)) dayVeto++       // noon vetoes everywhere
    if (hollowEligible(x, z, SEED, openNight, 0.5, h, 140)) dayVeto++     // 15·0.5 = 7.5 > 7: still day
    if (hollowEligible(x, z, SEED, openNight, 0, 139, 140)) wetVeto++     // water vetoes everywhere
    // ★ the strategy layer: ONE point of block light — a lantern's far rim — vetoes at midnight.
    if (hollowEligible(x, z, SEED, packLight(15, 1), 0, h, 140)) litVeto++
    // ★ MC 1.18's internal-sky rule: deep dusk (15·0.4 = 6 ≤ 7) is already the tide's hour.
    if (hollowEligible(x, z, SEED, openNight, 0.4, h, 140) !== elig) duskMismatch++
  }
  ok(greyN > 50, `eligible ground exists at night (${greyN})`)
  ok(healthy === 0, `★ a Hollow NEVER bodies on healthy ground (${healthy} violations — this is canon, not tuning)`)
  ok(dayVeto === 0, `daylight vetoes everywhere (${dayVeto})`)
  ok(wetVeto === 0, `water vetoes everywhere (${wetVeto})`)
  ok(litVeto === 0, `★ tended light holds grey off — block light 1 vetoes at midnight (${litVeto})`)
  ok(duskMismatch === 0, `deep dusk spawns exactly where midnight does (${duskMismatch})`)
  ok(hollowNight(0.4) && !hollowNight(0.5), 'the night window opens at 15·day ≤ 7, MC verbatim')
  ok(GUTTER_SKY > NIGHT_SKY_MAX, 'gutter sits above the spawn line — hysteresis, no dusk flap')
}

// ── 1b. the cycle's tuning: cap scales with loaded world, packs are 1–4 on a triangular walk ────
{
  ok(hollowCap(0) === 2, 'an empty load still allows a pair (floor)')
  ok(hollowCap(113) === 11, `a full load radius carries 11 (${hollowCap(113)}) — MC would carry 27`)
  ok(hollowCap(1e6) === 12, 'the cap never becomes a horde (ceiling)')
  let mono = true
  for (let c = 1; c < 400; c++) if (hollowCap(c) < hollowCap(c - 1)) mono = false
  ok(mono, 'more loaded world never means fewer Hollows allowed')
  ok(packSize(0) === 1 && packSize(0.999) === PACK_MAX, 'pack size spans 1..PACK_MAX')
  let rollsOk = true
  for (let i = 0; i < 100; i++) { const s = packSize(i / 100); if (s < 1 || s > PACK_MAX) rollsOk = false }
  ok(rollsOk, 'every roll lands in 1..PACK_MAX')
  let r = 0.17
  const rand = () => { r = (r * 9301 + 0.2113) % 1; return r }
  const offs = packWalk(PACK_MAX, rand)
  ok(offs.length === PACK_MAX - 1, 'the anchor is not an offset — k-1 mates')
  // The walk accumulates ±PACK_STEP triangular steps: mate i is bounded by i steps.
  ok(offs.every((o, i) => Math.hypot(o.dx, o.dz) <= (i + 1) * PACK_STEP * Math.SQRT2 + 1e-9),
    'the walk is bounded by its steps')
  // Triangular concentrates: over many packs, the mean first-step distance sits well under the max.
  let sum = 0, n = 0
  for (let i = 0; i < 400; i++) { const w = packWalk(2, rand); sum += Math.hypot(w[0].dx, w[0].dz); n++ }
  ok(sum / n < PACK_STEP, `mates huddle near the anchor (mean first step ${(sum / n).toFixed(2)} < ${PACK_STEP})`)
}

// ── 2. the drift: toward the keeper, slower than a runner, riding the ground line ───────────────
{
  // The pure chaser, so this stays a test of the DRIFT and not of one form's standoff.
  const SPD = HOLLOW_FORMS.stalker.speed
  const st: HollowState = { id: 'h', x: 0, y: 10, z: 0, form: 'stalker', hp: 30, gutter: 0, phase: 0 }
  const flat = (_x: number, _z: number) => 8
  const before = Math.hypot(20 - st.x, 15 - st.z)
  for (let i = 0; i < 60; i++) hollowStep(st, 1 / 60, 20, 15, flat, i / 60, UNIMPAIRED)
  const after = Math.hypot(20 - st.x, 15 - st.z)
  ok(after < before, 'the Hollow closes distance')
  ok(before - after <= SPD * 1.05, `it drifts at its speed, not faster (${(before - after).toFixed(2)} in 1s)`)
  ok(FORM_ORDER.every(f => RUN_SPEED > HOLLOW_FORMS[f].speed), 'running away always works — from EVERY form')
  // ★ A STALKER WALKS (Alex 2026-08-14) — feet on the ground line, no hover, no bob. This assert
  // used to add HOLLOW_HOVER and was the only thing in the suite that noticed the change.
  ok(Math.abs(st.y - (8 + 1)) < 0.6, `a walker rides the ground line itself (y=${st.y.toFixed(2)})`)
  const stG: HollowState = { id: 'h', x: 0, y: 10, z: 0, form: 'stalker', hp: 30, gutter: 0.9, phase: 0 }
  const b2 = stG.x
  hollowStep(stG, 1 / 60, 100, 0, flat, 0, UNIMPAIRED)
  ok(stG.x - b2 < SPD / 60 * 0.2, 'a guttering Hollow loses its will first')
}

// ── 3. the gun can actually hit one ─────────────────────────────────────────────────────────────
{
  ok(segmentDist(0, 0, 0, 1, 0, 0, 10, 5, 0.5, 0) < 0.6, 'a round passing close registers')
  ok(segmentDist(0, 0, 0, 1, 0, 0, 10, 20, 0, 0) > 9, 'a body beyond the segment does not')
  ok(segmentDist(0, 0, 0, 1, 0, 0, 0.9, 5, 0, 0) > 4, 'a short segment cannot hit a distant body — no tunnelling in reverse')
}

// ── ★ THE THREE FORMS — a triangle, not one enemy with three healthbars ─────────────────────
{
  const forms = FORM_ORDER.map((f) => HOLLOW_FORMS[f])
  const [warden, stalker, caster] = forms

  // Each form has to OWN an axis, or they are reskins. These are the three habits the night is
  // meant to break, one per body.
  // NOT "the slowest of the three" — the caster is slower still, because it never chases. The
  // warden's claim is that it is the toughest thing that DOES come for you.
  ok(warden.hp === Math.max(...forms.map(f => f.hp)) && warden.speed < stalker.speed, '★ the warden is the toughest, and lumbers — the wall you go around')
  ok(stalker.speed === Math.max(...forms.map(f => f.speed)) && stalker.hp < warden.hp / 2, '★ the stalker is the fastest and among the frailest — the reason not to stand still')
  ok(caster.reach > 3 * Math.max(warden.reach, stalker.reach), '★ the caster reaches furthest by a mile — the reason to keep moving')

  // ★ THE CANON BOUND, HELD FROM THE OTHER SIDE. locomotion.ts asserts a drained keeper outruns
  // HOLLOW_SPEED; this asserts no FORM sneaks above it. Adding a fourth fast form is exactly the
  // change that would break "a keeper who runs, escapes" without touching either old number.
  ok(forms.every(f => f.speed < DRAINED_SPEED), '★ no form out-glides a drained keeper — menace, not a wall')

  // A body is what makes a guard a guard.
  ok(warden.body === Math.max(...forms.map(f => f.body)) && caster.body === 0, 'the warden has the largest body; the caster has none at all')

  // Weighted spawn: every form must be reachable, and the roll must not fall off either end.
  const counts: Record<string, number> = { warden: 0, stalker: 0, caster: 0 }
  for (let i = 0; i < 900; i++) counts[pickForm(i / 900)]++
  ok(FORM_ORDER.every(f => counts[f] > 0), 'every form can actually spawn')
  ok(counts.stalker > counts.caster, 'the common form is the commonest')
  ok(pickForm(0) === 'warden' && pickForm(1) === 'caster' && pickForm(1.7) === 'caster', 'the roll is total at both ends')

  const mk = (form: HollowForm, x: number, z: number): HollowState =>
    ({ id: 'h', x, y: 11, z, form, hp: HOLLOW_FORMS[form].hp, gutter: 0, phase: 0 })

  // ★ THE CASTER HOLDS ITS LINE FROM BOTH SIDES. Closing only would leave it standing on the
  // keeper, which is the one range its whole form exists to deny.
  const c = mk('caster', 40, 0)
  // 30s: 33.5 units to walk at 1.5/s. A loop too short to finish the walk asserts nothing.
  for (let i = 0; i < 1800; i++) hollowStep(c, 1 / 60, 0, 0, () => 10, 0, UNIMPAIRED)
  const held = Math.hypot(c.x, c.z)
  ok(Math.abs(held - HOLLOW_FORMS.caster.standoff) < 0.6, `the caster closes to its standoff and stops (${held.toFixed(1)})`)
  c.x = 1; c.z = 0
  for (let i = 0; i < 600; i++) hollowStep(c, 1 / 60, 0, 0, () => 10, 0, UNIMPAIRED)
  ok(Math.hypot(c.x, c.z) > 3, `★ ...and BACKS OFF when the keeper walks in (${Math.hypot(c.x, c.z).toFixed(1)})`)
  // The melee forms are unaffected by the same code path — one movement function, not two.
  const w = mk('warden', 40, 0)
  for (let i = 0; i < 1800; i++) hollowStep(w, 1 / 60, 0, 0, () => 10, 0, UNIMPAIRED)
  ok(Math.hypot(w.x, w.z) < 0.6, `the warden still comes all the way in (${Math.hypot(w.x, w.z).toFixed(2)})`)

  // ── bodies ────────────────────────────────────────────────────────────────────────────────
  const open = () => true
  const wall = mk('warden', 0, 0)
  const out = pushOutOfBodies(0.2, 0, 0.3, [wall], open)
  ok(Math.hypot(out.x - wall.x, out.z - wall.z) >= HOLLOW_FORMS.warden.body + 0.3 - 1e-9, '★ a keeper inside a warden is pushed clear of it')
  const centred = pushOutOfBodies(0, 0, 0.3, [wall], open)
  ok(Number.isFinite(centred.x) && Number.isFinite(centred.z) && Math.hypot(centred.x, centred.z) > 1, 'dead centre still resolves — no divide-by-zero, no NaN')
  ok((() => {
    const r = pushOutOfBodies(9, 9, 0.3, [wall], open); return r.x === 9 && r.z === 9
  })(), 'a keeper standing clear is left exactly alone')
  ok((() => { const r = pushOutOfBodies(0.1, 0, 0.3, [mk('caster', 0, 0)], open); return r.x === 0.1 })(), '★ the caster is incorporeal — reach is its body, there is nothing to bump')
  // ★ It must REFUSE a push it cannot make safely.
  ok((() => { const r = pushOutOfBodies(0.2, 0, 0.3, [wall], () => false); return r.x === 0.2 && r.z === 0 })(), '★ a push that would extrude the keeper into terrain is refused, not forced')
  ok((() => {
    const g = mk('warden', 0, 0); g.gutter = 1
    const r = pushOutOfBodies(0.2, 0, 0.3, [g], open); return r.x === 0.2
  })(), 'a guttered body stops blocking')
  ok((() => {
    const d = mk('warden', 0, 0); d.hp = 0
    const r = pushOutOfBodies(0.2, 0, 0.3, [d], open); return r.x === 0.2
  })(), 'so does a dispersed one')

  // Reach is per-form: the caster drains from where the warden cannot.
  ok(touchingLevel(mk('caster', 5, 0), 0, 0, UNIMPAIRED) && !touchingLevel(mk('warden', 5, 0), 0, 0, UNIMPAIRED), '★ the caster drains at a range the warden cannot reach')
}

// ⚠⚠ THE "PUT THE REPORT LAST" RULE FAILED TWICE, SO IT IS NO LONGER A RULE (2026-08-15).
//
// This block used to be an `if (fails.length) { … process.exit(1) }` sitting right here, under a
// comment reading *"THE REPORT MUST BE THE LAST THING IN THE FILE"* — written on 2026-08-11 after
// exactly this went wrong once. It then went wrong AGAIN: the walk/hover block (08-14) and the
// status block (08-15) were both appended BELOW it, so ~30 asserts were tallied into `pass` and
// announced by a bare `console.log('✅ …')` that checks nothing. **Both blocks reported a green run
// under mutations that broke them** — caught only because a mutation's pass COUNT dropped while its
// verdict stayed ✅.
//
// ★ A CONVENTION THAT DEPENDS ON EVERY FUTURE EDITOR READING A COMMENT IS NOT A FIX; it is the same
// bug with a note attached, and the note was already there. The report now rides `process.on('exit')`,
// so it has NO position to be stranded above — append anywhere, forever, and the verdict still sees
// every assert. Setting `process.exitCode` (rather than calling `process.exit`) is what makes that
// legal inside an exit handler.
//
// Same family as the `.output` liveness probe and the vacuous-assert finds: an oracle that cannot
// fail is worse than no oracle, because it is trusted.
process.on('exit', () => {
  if (fails.length) {
    console.error(`❌ ${fails.length} failed (${pass} passed)`)
    for (const f of fails) console.error('  - ' + f)
    process.exitCode = 1
  } else {
    console.log(`✅ the dark has a body, and it obeys the ruling — ${pass} passed`)
  }
})
// ── ★ THE WALK/HOVER SPLIT (Alex 2026-08-14: goopy bipedal creatures; only the ranged form floats) ──
// The form table carried the melee/ranged split from the day it was written (`body`, `standoff`,
// `reach`); locomotion applied one universal hover over the top of it. These asserts are what stop
// that from silently coming back, and what stop a "tidy-up" from welding `hover` to `body === 0`.
{
  const flat = (_x: number, _z: number) => 8
  ok(HOLLOW_FORMS.warden.hover === 0 && HOLLOW_FORMS.stalker.hover === 0,
    'the melee forms have feet')
  ok(HOLLOW_FORMS.caster.hover > 0, 'the caster is the one that floats')
  ok(FORM_ORDER.filter((f) => HOLLOW_FORMS[f].hover > 0).length === 1,
    'exactly ONE form floats — if this grows, a wall stops meaning anything')

  // A floater sits its hover above the ground; a walker sits ON it.
  const cast: HollowState = { id: 'h', x: 0, y: 20, z: 0, form: 'caster', hp: 14, gutter: 0, phase: 0 }
  for (let i = 0; i < 240; i++) hollowStep(cast, 1 / 60, 0.2, 0, flat, i / 60, UNIMPAIRED)
  ok(Math.abs(cast.y - (8 + 1 + HOLLOW_HOVER)) < 0.4, `a caster holds its hover (y=${cast.y.toFixed(2)})`)

  // ── terrain: a two-high face stops a walker, and a one-high kerb does not.
  //    `wall` is a step at x >= 4 — the shape a Stonewall will have once terrain writes real voxels.
  const wall = (x: number, _z: number) => (x >= 4 ? 8 + HOLLOW_STEP_UP + 1 : 8)
  const kerb = (x: number, _z: number) => (x >= 4 ? 8 + HOLLOW_STEP_UP : 8)
  const walkerAt = (x: number): HollowState => ({ id: 'h', x, y: 9, z: 0, form: 'stalker', hp: 18, gutter: 0, phase: 0 })

  const blocked = walkerAt(0)
  for (let i = 0; i < 600; i++) hollowStep(blocked, 1 / 60, 20, 0, wall, i / 60, UNIMPAIRED)
  ok(blocked.x < 4, `a two-high face stops a walker dead (reached x=${blocked.x.toFixed(2)})`)

  const stepped = walkerAt(0)
  for (let i = 0; i < 600; i++) hollowStep(stepped, 1 / 60, 20, 0, kerb, i / 60, UNIMPAIRED)
  ok(stepped.x > 4, `...but a one-block kerb is stepped (reached x=${stepped.x.toFixed(2)})`)

  // ...and the caster ignores the same face entirely. This pairing IS the design: the wall answers
  // the two that walk, and the one that outranges walls is the reason you cannot just build a box.
  const flyer: HollowState = { id: 'h', x: 0, y: 9, z: 0, form: 'caster', hp: 14, gutter: 0, phase: 0 }
  for (let i = 0; i < 900; i++) hollowStep(flyer, 1 / 60, 20, 0, wall, i / 60, UNIMPAIRED)
  ok(flyer.x > 4, `a caster crosses a wall a walker cannot (reached x=${flyer.x.toFixed(2)})`)

  // ── wall-sliding: blocked head-on, a walker still makes progress ALONG the face rather than
  //    freezing nose-first against it. Not pathfinding — it cannot solve a U — but a body at a wall
  //    should look like it is trying.
  const slider = walkerAt(3.5)
  const z0 = slider.z
  for (let i = 0; i < 300; i++) hollowStep(slider, 1 / 60, 20, 12, wall, i / 60, UNIMPAIRED)
  ok(slider.x < 4 && Math.abs(slider.z - z0) > 1,
    `blocked head-on, a walker slides along the face (dz=${(slider.z - z0).toFixed(2)})`)
}

// ── ★ STATUSES REACH THE BODY (2026-08-15, the last dark archetype) ──────────────────────────
// ★ THE CLASS THESE GUARD IS "THE CAST LANDED AND NOTHING HAPPENED". Applying a status is
// bookkeeping the status module already tests; what has never been assertable is whether a Hollow
// ASKS. Every one of these fails if `hollowStep`/`hollowTouching` stop reading their flags, which
// is precisely the silent no-op `cast-dispatch`'s honesty rule outlaws one layer up — and which no
// refusal can catch, because the cast genuinely was accepted.
{
  const flat = () => 10
  const at = (form: HollowForm, x: number, z = 0): HollowState =>
    ({ id: 'h', x, y: 11, z, form, hp: HOLLOW_FORMS[form].hp, gutter: 0, phase: 0.4 })
  const run = (h: HollowState, imp: Impair, frames = 300, px = 0, pz = 0) => {
    for (let i = 0; i < frames; i++) hollowStep(h, 1 / 60, px, pz, flat, i / 60, imp)
    return h
  }
  const ROOT: Impair = { rooted: true, blinded: false, disarmed: false }
  const BLIND: Impair = { rooted: false, blinded: true, disarmed: false }
  const DISARM: Impair = { rooted: false, blinded: false, disarmed: true }

  // 1. ROOTED STOPS THE DRIFT — the headline, and the one a player will notice first.
  {
    const free = run(at('stalker', 12), UNIMPAIRED)
    const held = run(at('stalker', 12), ROOT)
    ok(free.x < 11, `unrooted, a stalker closes (x=${free.x.toFixed(2)})`)
    ok(held.x === 12, `★ rooted, it does not move at all (x=${held.x.toFixed(2)})`)
  }

  // 2. ...BUT IT IS STILL ALIVE. Freezing the whole step would hang the body mid-air, which reads
  //    as the game stalling rather than as the cast landing. Height still eases toward the ground.
  {
    const held = at('stalker', 12); held.y = 40
    run(held, ROOT, 120)
    ok(held.y < 20, `★ a rooted body still settles to the ground — clamped, not switched off (y=${held.y.toFixed(1)})`)
  }

  // 3. BLINDED GOES THE WRONG WAY — it must not merely stop, or blind and root are one cast with
  //    two names. Measured as: it ends up FURTHER from the keeper than it started.
  {
    const lost = run(at('stalker', 12), BLIND)
    ok(Math.hypot(lost.x, lost.z) > 12,
      `★ blinded, it wanders AWAY rather than freezing (d=${Math.hypot(lost.x, lost.z).toFixed(2)})`)
  }

  // 4. ★ A BLINDED PACK SCATTERS. The wrong heading comes from each body's own `phase`, so two
  //    Hollows blinded together must not wheel off in formation — that would read as the whole
  //    pack turning to face something, which is the opposite of blinded.
  {
    const a = at('stalker', 12); a.phase = 0.4
    const b = at('stalker', 12); b.phase = 3.1
    run(a, BLIND); run(b, BLIND)
    ok(Math.hypot(a.x - b.x, a.z - b.z) > 2,
      `★ two blinded bodies scatter, they do not march (apart=${Math.hypot(a.x - b.x, a.z - b.z).toFixed(2)})`)
  }

  // 5. DISARMED STOPS THE TOUCH, at point-blank, for every form. This is the drain that made the
  //    night cost something; a status that claims to jam it must actually jam it.
  for (const f of FORM_ORDER) {
    ok(touchingLevel(at(f, 0.2), 0, 0, UNIMPAIRED), `${f} drains at point-blank`)
    ok(!touchingLevel(at(f, 0.2), 0, 0, DISARM), `★ disarmed, ${f} lays no drain even on contact`)
  }

  // 6. ★★ THE ONE THAT MAKES THE STATUS TRIANGLE WORTH HAVING — blinding does DIFFERENT work per
  //    form, because the forms already differ on `reach`. It takes the caster's whole seven-metre
  //    form away and barely touches the warden's. If this ever fails, statuses have flattened into
  //    a fourth healthbar, which is the failure HOLLOW_FORMS' own header warns about.
  {
    const far = 4                                       // inside the caster's 7.5 reach, outside every other
    ok(touchingLevel(at('caster', far), 0, 0, UNIMPAIRED), 'a caster drains from four metres')
    ok(!touchingLevel(at('caster', far), 0, 0, BLIND),
      '★ blinded, the caster cannot reach past contact — its whole form is the range')
    // ...while the walkers keep a working attack, because they had no range to lose.
    ok(touchingLevel(at('warden', 0.3), 0, 0, BLIND),
      '★ a blinded warden still drains what it blunders into — blinding is not disarming')
  }

  // 7. A GUTTERING BODY IS ALREADY LEAVING — the host refuses to status one, and the touch gates
  //    on gutter regardless of what the bag says. Belt and braces on the same claim.
  {
    const dying = at('warden', 0.3); dying.gutter = 1
    ok(!touchingLevel(dying, 0, 0, UNIMPAIRED), 'a guttered body drains nothing, status or not')
  }
}

// ── ★★★ 9. THE THREE ATTACK FAMILIES (2026-08-26, Alex) ────────────────────────────────────────
// The forms were a triangle of MOVEMENT with one shared verb — every one of them drained, and they
// differed only in reach and duration. These asserts are what stop them collapsing back into that.
{
  const mk = (form: HollowForm, x = 0, z = 0): HollowState =>
    ({ id: 'h', x, y: 10, z, form, hp: HOLLOW_FORMS[form].hp, gutter: 0, phase: 0 })
  const FWD_X = 1, FWD_Z = 0            // the keeper faces +x
  const flat = () => 9

  // ── the triangle is a TRIANGLE, on the attack axis too ──
  {
    const kinds = new Set(FORM_ORDER.map(f => HOLLOW_FORMS[f].attack))
    ok(kinds.size === FORM_ORDER.length, `each form attacks differently — kinds: ${[...kinds].join(', ')}`)
    // ⚠ Named, not counted. A count going red says "something converged" and invites raising it.
    const wounders = FORM_ORDER.filter(f => HOLLOW_FORMS[f].damage > 0)
    const sappers = FORM_ORDER.filter(f => HOLLOW_FORMS[f].sap > 0)
    ok(sappers.join() === 'caster', `ONLY the caster saps mana — sappers: ${sappers.join(', ') || 'none'}`)
    ok(!wounders.includes('caster'), `the caster NEVER wounds — wounders: ${wounders.join(', ')}`)
    ok(wounders.length > 0, 'something wounds, or Alex\'s ruling did not reach the table')
    // ⛔ Only the caster is ranged. This is the pairing that keeps a wall meaningful to the walkers.
    const ranged = FORM_ORDER.filter(f => HOLLOW_FORMS[f].standoff > 0 || HOLLOW_FORMS[f].reach > 2)
    ok(ranged.join() === 'caster', `ONLY the caster reaches from range — ranged: ${ranged.join(', ')}`)
  }

  // ── ★★ THE BLIND SPOT: the whole of the stalker's design ──
  {
    // Behind the keeper (keeper faces +x, body sits at -x) → it may strike.
    // ⚠ INSIDE `reach` (stalker 0.80). At -1 it was simply out of range and the assert was
    // measuring the fixture, not the blind spot — the empty-window trap in miniature.
    const behind = mk('stalker', -0.5, 0)
    ok(!keeperLooking(behind, 0, 0, FWD_X, FWD_Z), 'a body behind you is not seen')
    const hit = strikeLevel(behind, 1, 0, 0, UNIMPAIRED, false)
    ok(!!hit && hit.hp > 0, '★ a stalker in your blind spot strikes, and it wounds')

    // In front → it must not, however long it waits.
    const front = mk('stalker', 0.6, 0)
    ok(keeperLooking(front, 0, 0, FWD_X, FWD_Z), 'a body in front of you IS seen')
    let landed = 0
    for (let i = 0; i < 600; i++) if (strikeLevel(front, 1 / 60, 0, 0, UNIMPAIRED, true)) landed++
    ok(landed === 0, `★★ a stalker CANNOT strike while you look at it — landed ${landed} over 10s`)

    // ⚠⚠ AND IT MUST NOT BANK THE COOLDOWN — A STRIKE MUST BE LOADED FIRST OR THIS PROVES NOTHING.
    // The first version of this assert ran the stare on a FRESH body, whose cooldown had never been
    // set: it could not distinguish "the clock ran down while it waited" from "there was never a
    // clock", so moving the decrement behind the blind-spot gate left it GREEN. Mutation-caught.
    // Now: land one strike to load the clock, hold a stare for LONGER than the cooldown, and the
    // clock must have run to zero in that time.
    const banked = mk('stalker', -0.5, 0)
    ok(!!strikeLevel(banked, 1 / 60, 0, 0, UNIMPAIRED, false), 'fixture: the first strike lands and loads the clock')
    ok((banked.strikeCd ?? 0) > 0, 'fixture: ...and the clock is genuinely loaded, or the test below is vacuous')
    const stareFor = HOLLOW_FORMS.stalker.strikeCd + 0.5
    for (let i = 0; i < Math.ceil(stareFor * 60); i++) strikeLevel(banked, 1 / 60, 0, 0, UNIMPAIRED, true)
    ok((banked.strikeCd ?? 1) === 0, '★★ the cooldown runs DOWN while it waits out of sight — it cannot bank a punish for turning around')
  }

  // ── the stalker BREAKS OFF while watched, and closes when not ──
  {
    // ⚠ BOTH START AT 6 AND RUN 10 FRAMES, so neither clamps. The first version ran a full second
    // from 3 and compared distances TRAVELLED — but the advance stops on arrival at `stop`, so it
    // was measuring "how far until it got there" against "how far it ran", and reported the flee as
    // faster when it is not. Measure the thing the claim is about: the per-frame speed.
    const seenBody = mk('stalker', 6, 0)
    const d0 = Math.hypot(seenBody.x, seenBody.z)
    for (let i = 0; i < 10; i++) hollowStep(seenBody, 1 / 60, 0, 0, flat, i / 60, UNIMPAIRED, FWD_X, FWD_Z)
    const fled = Math.hypot(seenBody.x, seenBody.z) - d0
    ok(fled > 0, '★ a watched stalker withdraws')

    const unseen = mk('stalker', -6, 0)
    const u0 = Math.hypot(unseen.x, unseen.z)
    for (let i = 0; i < 10; i++) hollowStep(unseen, 1 / 60, 0, 0, flat, i / 60, UNIMPAIRED, FWD_X, FWD_Z)
    const chased = u0 - Math.hypot(unseen.x, unseen.z)
    ok(chased > 0, '...and an unwatched one closes')

    // ⚠ IT FLEES SLOWER THAN IT CHASES. A stalker that withdrew at full speed would be unkillable by
    // anyone who saw it; the form punishes NOT looking and must never punish looking.
    ok(fled < chased, `withdrawal is slower than the advance (${fled.toFixed(3)} vs ${chased.toFixed(3)})`)
  }

  // ── the OTHER two do not care that you can see them ──
  {
    for (const f of ['warden', 'caster'] as const) {
      const body = mk(f, f === 'caster' ? 5 : 0.8, 0)
      const d0 = Math.hypot(body.x, body.z)
      for (let i = 0; i < 60; i++) hollowStep(body, 1 / 60, 0, 0, flat, i / 60, UNIMPAIRED, FWD_X, FWD_Z)
      const moved = Math.hypot(body.x, body.z)
      ok(moved <= d0 + 0.05, `a ${f} does not flee from being looked at (${d0.toFixed(2)} → ${moved.toFixed(2)})`)
      ok(!!strikeLevel(mk(f, f === 'caster' ? 5 : 0.8, 0), 9, 0, 0, UNIMPAIRED, true),
        `...and a ${f} strikes you while you watch it`)
    }
  }

  // ── ★ A BLINDED STALKER KEEPS COMING — it cannot know it is being watched ──
  {
    // ⚠ THE CLAIM IS THAT IT CANNOT KNOW, NOT THAT IT CLOSES. A blinded body already has its heading
    // rotated by a fixed per-body angle (the existing blinded tell — "sends it the wrong way rather
    // than nowhere"), so asserting it closes on the keeper tests the BLIND behaviour and would go
    // red for a completely correct reason. What must hold is that it never enters the flee state:
    // something that cannot see you cannot know it is being watched, so the stare stops working.
    const blind = mk('stalker', 3, 0)
    for (let i = 0; i < 60; i++) {
      hollowStep(blind, 1 / 60, 0, 0, flat, i / 60, { rooted: false, blinded: true, disarmed: false }, FWD_X, FWD_Z)
      if (blind.seen) break
    }
    ok(blind.seen === false, '★ a BLINDED stalker never enters the flee state — it cannot know you are looking')
    // And the sighted control, so the assert above is not vacuous: unblinded, in the cone, it flees.
    const sighted = mk('stalker', 3, 0)
    hollowStep(sighted, 1 / 60, 0, 0, flat, 0, UNIMPAIRED, FWD_X, FWD_Z)
    ok(sighted.seen === true, '...while a sighted one in the same spot knows perfectly well')
  }

  // ── hysteresis: no flicker on the cone boundary ──
  {
    // A body parked exactly on the enter threshold, nudged by a hair each frame, must not flip
    // every frame — a stalker that stutters between advancing and withdrawing reads as a bug.
    const ang = Math.acos(SEEN_ENTER)
    let flips = 0, prev: boolean | undefined
    const body = mk('stalker')
    for (let i = 0; i < 200; i++) {
      const a = ang + Math.sin(i) * 0.004        // jitter across the boundary
      body.x = Math.cos(a) * 4; body.z = Math.sin(a) * 4
      const now = keeperLooking(body, 0, 0, FWD_X, FWD_Z)
      body.seen = now
      if (prev !== undefined && now !== prev) flips++
      prev = now
    }
    ok(flips <= 2, `★ the seen/unseen latch does not flicker on the boundary — ${flips} flips over 200 frames`)
  }

  // ── disarmed stops a strike, per the status port's own rule ──
  ok(!strikeLevel(mk('warden', 0.8, 0), 9, 0, 0, { rooted: false, blinded: false, disarmed: true }, false),
    'a disarmed body cannot strike — the status removes the OPTION')
}


// ── ★★★ THE SKY HOLLOWS (Alex, 2026-08-28: "they are 20 blocks above just hovering mid air.. ────
//        but that doesnt stop them from damaging me")
//
// ⚠⚠ WHY 469 LINES OF THIS FILE COULD NOT SEE IT, WHICH IS THE REAL LESSON. Every fixture above
// hands `hollowStep` a FLAT ground function — `() => 8`, `() => 10`, a kerb, a wall. None of them
// is a function of the probe's own height, and the defect was precisely that the host's ground
// probe TAKES the body's height as an argument. A stub that ignores the argument cannot ratchet,
// so the oracle was not wrong about anything it asserted; it had simply never been shown the
// composition where the bug lives. Both halves were internally consistent about different things.
//
// ★ SO THIS BLOCK IMPORTS THE REAL `topSolidNear` AND BINDS IT THE WAY `VoxelWorld` BINDS IT.
// Restating the window scan here would be a mirror of a private value: it would agree with the
// original the day it was written and drift silently afterwards.
{
  const GROUND = 64, LEAF_LO = 70, LEAF_HI = 76
  // A trunk-and-canopy column, which is all a forest needs to be for this defect: leaves are not
  // AIR, so anything that scans upward finds a second surface with a hole under it.
  const solid = (_x: number, y: number, _z: number) =>
    y <= GROUND || (y >= LEAF_LO && y <= LEAF_HI)

  // Bound exactly as the host binds it: the hint is the body's OWN y, read live every call.
  const probeFor = (h: HollowState, up: number, down: number) =>
    (x: number, z: number) => topSolidNear(solid, x, z, h.y, up, down, 255, () => GROUND)

  const walkUnderCanopy = (up: number, down: number) => {
    const h: HollowState = { id: 'h', x: 6, y: GROUND + 1, z: 0,
      form: 'warden', hp: HOLLOW_FORMS.warden.hp, gutter: 0, phase: 0 }
    const ground = probeFor(h, up, down)
    for (let i = 0; i < 600; i++) hollowStep(h, 1 / 60, 0, 0, ground, i / 60, UNIMPAIRED)
    return h
  }

  // ★★ THE POSITIVE CONTROL COMES FIRST, AND IT IS NOT DECORATION. If the old symmetric window did
  // NOT climb in this harness, the harness would be proving nothing — no canopy in reach, a body
  // that never moves, a step that never re-grounds. Asserting that the bug reproduces is what makes
  // the green below mean something. (Ask of any guard: is there an input that makes this fail?)
  const ratcheted = walkUnderCanopy(HOLLOW_GROUND_DOWN, HOLLOW_GROUND_DOWN)
  ok(ratcheted.y > LEAF_HI,
    `fixture: the old symmetric window DOES climb the canopy — reproduces at y ${ratcheted.y.toFixed(1)}, ground ${GROUND}`)

  const fixed = walkUnderCanopy(HOLLOW_GROUND_UP, HOLLOW_GROUND_DOWN)
  ok(Math.abs(fixed.y - (GROUND + 1)) < 0.5,
    `★★★ a warden under a canopy stands on the GROUND, not in the branches — y ${fixed.y.toFixed(2)}, ground line ${GROUND + 1}`)

  // ★ THE UP-SPAN IS DERIVED FROM THE CLIMB, NOT PICKED. If someone raises the step-up, the probe
  // must follow it, or a Hollow becomes unable to see ground it is allowed to climb onto. This
  // assert is what makes that relationship expire instead of rot.
  ok(HOLLOW_GROUND_UP === HOLLOW_STEP_UP,
    '★ the ground probe looks up exactly as far as a walker can climb — one derivation, not two numbers')

  // And the reason the down half stays generous: a caster hovers, and a walker that has just
  // stepped off a ledge is above its own floor. A short down-window drops both onto the fallback.
  ok(HOLLOW_GROUND_DOWN > HOLLOW_HOVER + HOLLOW_STEP_UP,
    '★ the down half still clears a hovering body and a one-block drop')

  // ── the height term on the touch ──
  const at = (form: HollowForm, x: number, y: number): HollowState =>
    ({ id: 'h', x, y, z: 0, form, hp: HOLLOW_FORMS[form].hp, gutter: 0, phase: 0 })
  const FEET = GROUND + 1                     // where the keeper actually stands

  // The reported harm, both forms, from the height the ratchet actually reached.
  ok(!hollowTouching(at('warden', 0.4, LEAF_HI + 1), 0, FEET, 0, UNIMPAIRED),
    '★★★ a warden in the canopy cannot drain a keeper on the ground — the infinite cylinder is closed')
  ok(!hollowTouching(at('caster', 3, LEAF_HI + 1), 0, FEET, 0, UNIMPAIRED),
    '★★★ nor can a caster, whose 7.5 reach is what made the missing height term bite')

  // ⚠ THE REGRESSION THIS FIX IS MOST LIKELY TO CAUSE is "why did nothing happen" — a height term
  // tighter than the caster's own hover would make the form unable to touch someone standing
  // inside it. That is what the derived floor exists for, so it gets its own assert.
  ok(hollowTouching(at('caster', 3, FEET + HOLLOW_HOVER), 0, FEET, 0, UNIMPAIRED),
    '★★ a caster hovering over the ground the keeper stands on still drains her')
  ok(hollowTouching(at('warden', 0.4, FEET), 0, FEET, 0, UNIMPAIRED),
    'a warden toe to toe still drains')
  // ★★ AND THE FLOOR'S REAL JOB IS THE BLINDED CASTER, which is the only body whose horizontal
  // reach collapses BELOW its own hover. Without the floor, blinding a caster would make it unable
  // to touch a keeper standing directly underneath it — quietly deleting the "a blind thing you are
  // standing inside has found you by accident" rule the reach collapse is documented to preserve.
  // ⚠ The two clamp asserts above restate the constants; this one is the behaviour, and it is the
  // one that fails when the floor is lowered.
  ok(hollowTouching(at('caster', 0.3, FEET + HOLLOW_HOVER), 0, FEET, 0,
      { rooted: false, blinded: true, disarmed: false }),
    '★★ a BLINDED caster hovering directly over the keeper still drains — the floor clears its own hover')
  ok(hollowTouching(at('warden', 0.4, FEET + 1), 0, FEET, 0, UNIMPAIRED),
    '★ and one off a kerb — a step it could climb is a step it can reach across')

  // The clamp keeps the form triangle meaningful vertically: the caster reaches further up than the
  // warden, and neither reaches as far up as the caster reaches sideways.
  ok(reachY(HOLLOW_FORMS.caster.reach) === HOLLOW_REACH_Y_MAX,
    "★ the caster's vertical reach is capped — 7.5 sideways is a form, 7.5 upward is a different creature")
  ok(reachY(HOLLOW_FORMS.warden.reach) === HOLLOW_REACH_Y_MIN,
    '★ the warden gets the floor, so terrain it cannot climb is terrain it cannot drain across')
  ok(reachY(HOLLOW_FORMS.caster.reach) > reachY(HOLLOW_FORMS.warden.reach),
    '★ and the triangle survives the clamp — the ranged form still outreaches the melee one upward')
}

// ── ★★★ THE SAME DEFECT, AGAINST THE REAL GENERATOR (2026-08-28) ──────────────────────────────
// The block above proves the mechanism on a synthetic slab. A slab I built myself can only ever
// show that the arithmetic works the way I think it does — it cannot say whether ATHER trees are
// tall enough, dense enough, or overhung enough for a warden to actually climb one. That is a
// claim about the shipped world, and only the shipped world's generator can answer it.
//
// ★ So this drives `hollowStep` through the REAL `topSolidNear`, over REAL `columnHeight` terrain,
// under a REAL tree from `growTreeCells`, at the REAL `WORLD_SEED`. Measured when it was written:
// a warden under a crown at ground 114 settled at y 127 with the old symmetric window — THIRTEEN
// blocks in the air, which is what Alex was shot at by.
//
// ⚠ THE FIXTURE HUNTS ITS OWN SUBJECT AND FAILS LOUDLY IF IT CANNOT FIND ONE. A hardcoded tree
// would drift the day worldgen moves and then measure an empty column forever — an assert that can
// only ever return "fine" is decoration. If the Ather ever stops growing overhung canopies this
// goes red and asks to be re-read, rather than quietly passing on nothing.
{
  const SEED = WORLD_SEED
  // The subject is not "a tree" — it is a column with LEAVES OVERHEAD AND AIR BENEATH, which is the
  // only shape that ratchets. A trunk you are standing against is not it (you cannot climb into it).
  let found: { gx: number; gz: number; ground: number; leafLo: number; leafHi: number;
               solid: (x: number, y: number, z: number) => boolean } | null = null
  scan:
  for (let cx = -30; cx <= 30 && !found; cx++) for (let cz = -30; cz <= 30; cz++) {
    for (const s of treeStartsAt(SEED, cx, cz, 32, DEFAULT_TREES)) {
      const g = columnHeight(s.x, s.z, SEED)
      const cells = growTreeCells(s, g, DEFAULT_TREES)
      const set = new Set(cells.map(c => `${c.x},${c.y},${c.z}`))
      const byCol = new Map<string, number[]>()
      for (const c of cells) {
        const k = `${c.x},${c.z}`
        if (!byCol.has(k)) byCol.set(k, [])
        byCol.get(k)!.push(c.y)
      }
      for (const [k, ys] of byCol) {
        const [x, z] = k.split(',').map(Number)
        if (x === s.x && z === s.z) continue                    // the trunk, not an overhang
        const gc = columnHeight(x, z, SEED)
        const lo = Math.min(...ys), hi = Math.max(...ys)
        if (lo - gc < 2) continue                               // no air to stand in
        found = { gx: x, gz: z, ground: gc, leafLo: lo, leafHi: hi,
          solid: (px, py, pz) => py <= columnHeight(px, pz, SEED) || set.has(`${px},${py},${pz}`) }
        break scan
      }
    }
  }

  ok(found !== null,
    '★ fixture: the Ather still grows a canopy with air under it — if this fails the guard below is measuring nothing')

  if (found) {
    const f = found
    const walk = (up: number, down: number) => {
      const h: HollowState = { id: 'h', x: f.gx, y: f.ground + 1, z: f.gz,
        form: 'warden', hp: HOLLOW_FORMS.warden.hp, gutter: 0, phase: 0 }
      const ground = (x: number, z: number) =>
        topSolidNear(f.solid, x, z, h.y, up, down, 255, (xi, zi) => columnHeight(xi, zi, SEED))
      // The keeper stands a third of a block off, so the body has somewhere to be without walking
      // out from under the crown — the defect is about standing in a forest, not about pathing.
      for (let i = 0; i < 900; i++) hollowStep(h, 1 / 60, f.gx + 0.3, f.gz, ground, i / 60, UNIMPAIRED)
      return h.y
    }

    // The positive control again, and here it is load-bearing twice over: it proves the harness can
    // reproduce the bug AND that this particular real column is one that ratchets.
    const before = walk(HOLLOW_GROUND_DOWN, HOLLOW_GROUND_DOWN)
    ok(before > f.leafLo,
      `fixture: the old symmetric window climbs a REAL Ather canopy — y ${before.toFixed(1)} over ground ${f.ground}, leaves ${f.leafLo}..${f.leafHi}`)

    const after = walk(HOLLOW_GROUND_UP, HOLLOW_GROUND_DOWN)
    ok(Math.abs(after - (f.ground + 1)) < 0.5,
      `★★★ in the real world a warden under a real crown stands on the real ground — y ${after.toFixed(2)}, ground line ${f.ground + 1}`)
  }
}
