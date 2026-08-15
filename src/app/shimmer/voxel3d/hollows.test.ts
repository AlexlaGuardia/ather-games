// Hollows oracle. Run: npx tsx src/app/shimmer/voxel3d/hollows.test.ts
//
// The one assert that is CANON, not tuning: a Hollow may never body on healthy ground — grey is
// drain, darkness is only the condition, and "spawns where it's dark" is the 2026-06-16 failure
// the ruling names explicitly. The rest pins behaviour a playtest would misread as vibes: the
// drift is slower than a runner, the gun can actually hit one, dawn always wins.

import { hollowEligible, hollowStep, segmentDist, hollowCap, packSize, packWalk, hollowNight,
         HOLLOW_SPEED, HOLLOW_HOVER, HOLLOW_STEP_UP, PACK_MAX, PACK_STEP, NIGHT_SKY_MAX, GUTTER_SKY,
         HOLLOW_FORMS, FORM_ORDER, pickForm, pushOutOfBodies, hollowTouching,
         type HollowState, type HollowForm , UNIMPAIRED, type Impair } from './hollows'
import { greyness } from '../voxel/biome'
import { columnHeight } from '../voxel/height'
import { packLight } from '../voxel/light'
import { RUN_SPEED, DRAINED_SPEED } from './locomotion'

let pass = 0
const fails: string[] = []
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m) }

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
  ok(hollowTouching(mk('caster', 5, 0), 0, 0, UNIMPAIRED) && !hollowTouching(mk('warden', 5, 0), 0, 0, UNIMPAIRED), '★ the caster drains at a range the warden cannot reach')
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
    ok(hollowTouching(at(f, 0.2), 0, 0, UNIMPAIRED), `${f} drains at point-blank`)
    ok(!hollowTouching(at(f, 0.2), 0, 0, DISARM), `★ disarmed, ${f} lays no drain even on contact`)
  }

  // 6. ★★ THE ONE THAT MAKES THE STATUS TRIANGLE WORTH HAVING — blinding does DIFFERENT work per
  //    form, because the forms already differ on `reach`. It takes the caster's whole seven-metre
  //    form away and barely touches the warden's. If this ever fails, statuses have flattened into
  //    a fourth healthbar, which is the failure HOLLOW_FORMS' own header warns about.
  {
    const far = 4                                       // inside the caster's 7.5 reach, outside every other
    ok(hollowTouching(at('caster', far), 0, 0, UNIMPAIRED), 'a caster drains from four metres')
    ok(!hollowTouching(at('caster', far), 0, 0, BLIND),
      '★ blinded, the caster cannot reach past contact — its whole form is the range')
    // ...while the walkers keep a working attack, because they had no range to lose.
    ok(hollowTouching(at('warden', 0.3), 0, 0, BLIND),
      '★ a blinded warden still drains what it blunders into — blinding is not disarming')
  }

  // 7. A GUTTERING BODY IS ALREADY LEAVING — the host refuses to status one, and the touch gates
  //    on gutter regardless of what the bag says. Belt and braces on the same claim.
  {
    const dying = at('warden', 0.3); dying.gutter = 1
    ok(!hollowTouching(dying, 0, 0, UNIMPAIRED), 'a guttered body drains nothing, status or not')
  }
}

