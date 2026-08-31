// ── Tremor Sense — headless oracle ──────────────────────────────────────────────────────────────
// Run: npx tsx src/app/shimmer/play3d/tremor-sense.test.ts
//
// What this file is actually guarding, in order of how expensive it would be to lose:
//
//   1. THE CANON PREDICATE — a hovering body is never felt. It is the only thing separating this
//      move from a wallhack, it is invisible on screen until the wrong form appears in a readout,
//      and it is one `continue` away from being deleted by someone tidying.
//   2. THE DERIVATION — `SENSE_RADIUS` really is `hollows.PLAYER_EXCLUSION`. `tremor-sense.ts` is
//      pure and cannot import the voxel world, so the two numbers are a HAND-KEPT MIRROR, and this
//      house has been bitten hard by a mirror whose copy and original agreed while both were wrong.
//      This file is the only place both are visible at once, so it is the only place the mirror can
//      be checked. ⚠ It compares them; it does not restate either.
//   3. THE BLOCKER THAT LIFTED — the move was `unbuilt` for 'no perception layer' long after the
//      world grew one. The assert below pins BUILT to the continued existence of a hunting body, so
//      neither half of that claim can rot again without going red.
//   4. THE BEARING — a sign flip in a compass looks plausible in both directions, so left/right/
//      ahead/behind are asserted as four separate facts, not as one round trip through atan2.

import { readFileSync } from 'node:fs'
import { castForMove, isBuilt } from './cast'
import { SENSE_RADIUS, senseGround, bearingOf, ringTick, type SensedBody } from './tremor-sense'
import { HOLLOW_FORMS, PLAYER_EXCLUSION, FORM_ORDER } from '../voxel3d/hollows'

let ok = 0, bad = 0
const chk = (n: string, c: boolean, x = '') => { c ? ok++ : (bad++, console.error('  FAIL:', n, x)) }
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps

function body(x: number, z: number, over: Partial<SensedBody> = {}): SensedBody {
  return { x, y: 129, z, hover: 0, present: true, ...over }
}

// ── 1. the move is built, and it is built BECAUSE there is something to feel ────────────────────
{
  const spec = castForMove('tremor-sense')
  chk('Tremor Sense is built', isBuilt('tremor-sense'), spec.why ?? '')
  chk('...as a worn stance, like every other canon passive',
    spec.archetype === 'stance')
  chk('...and it senses, which is the only thing that makes it this move',
    spec.senseRadius > 0)
  chk('...for free — canon states no cost, and the drain belongs to the shell pair',
    spec.manaCost === 0 && spec.regenMult === 1)

  // ★ The anti-rot assert. The old `unbuilt` reason ("needs a perception layer") expired silently
  // when the world grew real bodies. This ties the verdict to the premise instead of to a date: if
  // every form were ever put in the air, or the roster emptied, there is nothing to feel through
  // the ground and BUILT would be the stale claim. Then this fires and someone re-reads the move.
  const walkers = FORM_ORDER.filter((f) => HOLLOW_FORMS[f].hover === 0)
  chk('the premise BUILT rests on: the world still has bodies that stand on the ground',
    walkers.length > 0, FORM_ORDER.map((f) => `${f}:${HOLLOW_FORMS[f].hover}`).join(' '))

  // ⚠ Not decoration: every OTHER move must stay at the neutral value, or a host reading
  // `spec.senseRadius` unconditionally would quietly hand a sense to something that has none.
  const strays = ['barrier', 'bulwark', 'iron-skin', 'moisture-gathering', 'stonewall', 'mend']
    .filter((id) => castForMove(id).senseRadius !== 0)
  chk('no other move senses anything', strays.length === 0, strays.join())
}

// ── 2. the derivation, checked rather than described ────────────────────────────────────────────
{
  chk('SENSE_RADIUS is the night\'s own exclusion ring, not a taste number',
    SENSE_RADIUS === PLAYER_EXCLUSION, `sense ${SENSE_RADIUS} vs exclusion ${PLAYER_EXCLUSION}`)
  chk('...and the built spec uses it rather than a second copy of the number',
    castForMove('tremor-sense').senseRadius === PLAYER_EXCLUSION)
}

// ── 3. THE CANON PREDICATE: bound to the ground ─────────────────────────────────────────────────
{
  const walker = body(5, 0)
  const floater = body(5, 0, { hover: 1.15 })

  chk('a body standing on the ground is felt',
    senseGround([walker], 0, 0, SENSE_RADIUS).length === 1)
  chk('★ a body that hovers is NOT felt — it leaves no footstep and no weight',
    senseGround([floater], 0, 0, SENSE_RADIUS).length === 0)
  chk('...and it is invisible even standing on top of the keeper, so no distance saves it',
    senseGround([body(0, 0, { hover: 1.15 })], 0, 0, SENSE_RADIUS).length === 0)
  chk('the two differ ONLY by hover — same position, opposite verdicts',
    senseGround([walker], 0, 0, SENSE_RADIUS).length !== senseGround([floater], 0, 0, SENSE_RADIUS).length)

  // ★★ The real-world consequence, asserted against the shipped roster rather than restated.
  // If a form is ever moved on or off the floor, this is where the design change surfaces.
  const felt = FORM_ORDER.filter((f) => senseGround([body(5, 0, { hover: HOLLOW_FORMS[f].hover })], 0, 0, SENSE_RADIUS).length === 1)
  chk('the stalker — the ambusher — is felt, which IS canon\'s "ambush becomes impossible"',
    felt.includes('stalker'))
  chk('the warden — the wall — is felt', felt.includes('warden'))
  chk('★ the caster — the only form that floats — is NOT felt, so the move never solves the night',
    !felt.includes('caster'), felt.join())

  // A body mid-disperse is standing on nothing.
  chk('an absent body is not felt', senseGround([body(5, 0, { present: false })], 0, 0, SENSE_RADIUS).length === 0)
}

// ── 4. the ring ─────────────────────────────────────────────────────────────────────────────────
{
  chk('a body at exactly the exclusion ring IS felt — that equality is the point of the number',
    senseGround([body(SENSE_RADIUS, 0)], 0, 0, SENSE_RADIUS).length === 1)
  chk('...and one a hair outside is not',
    senseGround([body(SENSE_RADIUS + 0.001, 0)], 0, 0, SENSE_RADIUS).length === 0)
  chk('the ring is round, not square — a diagonal at the same Chebyshev distance is outside',
    senseGround([body(SENSE_RADIUS, SENSE_RADIUS)], 0, 0, SENSE_RADIUS).length === 0)
  chk('distance is measured from the KEEPER, not the origin',
    senseGround([body(100, 0)], 90, 0, SENSE_RADIUS).length === 1 &&
    senseGround([body(100, 0)], 0, 0, SENSE_RADIUS).length === 0)
  chk('height is deliberately ignored — the ground beneath you is the whole medium',
    senseGround([body(5, 0, { y: 40 })], 0, 0, SENSE_RADIUS).length === 1)

  // Not wearing it. The neutral value, so a host calls this unconditionally.
  chk('radius 0 feels nothing, however close', senseGround([body(1, 0)], 0, 0, 0).length === 0)
  chk('a negative radius feels nothing rather than throwing', senseGround([body(1, 0)], 0, 0, -5).length === 0)
  chk('NaN radius feels nothing — it must not compare its way to true',
    senseGround([body(1, 0)], 0, 0, Number.NaN).length === 0)
}

// ── 5. contacts: nearest first, and no identity leaks ───────────────────────────────────────────
{
  const cs = senseGround([body(10, 0), body(2, 0), body(6, 0)], 0, 0, SENSE_RADIUS)
  chk('contacts come back nearest first', cs.map((c) => c.dist).join() === '2,6,10')
  chk('a contact carries where, and only where',
    cs.length > 0 && Object.keys(cs[0]).sort().join() === 'dist,x,z')
  chk('...and the position is the body\'s, not the keeper\'s', cs[0].x === 2 && cs[0].z === 0)
  chk('nothing in range is an empty list, never null', Array.isArray(senseGround([], 0, 0, SENSE_RADIUS)))
}

// ── 6. bearing — four separate facts, because a sign flip is plausible in both directions ───────
{
  const at = (x: number, z: number) => ({ x, z, dist: Math.hypot(x, z) })

  // ★★★ THE CONVENTION IS DERIVED FROM THE WORLD, NOT RESTATED — AND THE FIRST VERSION OF THIS
  // BLOCK WAS MIRRORED AND FOUR-ASSERTS GREEN. It hardcoded "+x is the keeper's right", which is
  // simply a thing I decided. The host's facing is `hollowFwd` = `camera.getWorldDirection()`, so
  // the real answer comes from three.js: screen-right is `cross(fwd, up)`, which for `up = +y` and
  // a flat facing is `(-fz, 0, fx)`. Deriving it here means the day the host's facing convention
  // changes, this goes red instead of quietly pointing a keeper away from the stalker.
  const rightOf = (fx: number, fz: number) => ({ x: -fz, z: fx })
  const along = (d: { x: number; z: number }, k = 5) => at(d.x * k, d.z * k)

  // Two facings, because a single one cannot tell a correct formula from one that happens to agree
  // on that axis. +z and the three.js default −z pull the mirrored form in opposite directions.
  for (const [fx, fz, name] of [[0, 1, 'facing +z'], [0, -1, 'facing −z (three.js default)']] as const) {
    const R = rightOf(fx, fz)
    chk(`${name}: dead ahead is 0`, near(bearingOf(at(fx * 5, fz * 5), 0, 0, fx, fz), 0))
    chk(`${name}: directly behind is PI`,
      near(Math.abs(bearingOf(at(-fx * 5, -fz * 5), 0, 0, fx, fz)), Math.PI))
    chk(`★ ${name}: cross(fwd, up) — the keeper's actual right — is +PI/2`,
      near(bearingOf(along(R), 0, 0, fx, fz), Math.PI / 2),
      `right=(${R.x},${R.z}) got ${bearingOf(along(R), 0, 0, fx, fz).toFixed(3)}`)
    chk(`★ ${name}: and their actual left is -PI/2`,
      near(bearingOf(along(R, -5), 0, 0, fx, fz), -Math.PI / 2))
  }
  chk('left and right are opposite signs, not the same magnitude twice',
    bearingOf(along(rightOf(0, 1), -5), 0, 0, 0, 1) < 0 && bearingOf(along(rightOf(0, 1)), 0, 0, 0, 1) > 0)
  chk('turning the keeper turns the bearing — it is relative to FACING, not to north',
    near(bearingOf(at(5, 0), 0, 0, 1, 0), 0))
  chk('facing need not be normalised',
    near(bearingOf(along(rightOf(0, 17)), 0, 0, 0, 17), Math.PI / 2))
  chk('bearing is wrapped to (-PI, PI], never 3PI/2',
    Math.abs(bearingOf(at(-1, -5), 0, 0, 0, 1)) <= Math.PI)
  chk('a zero-length facing gives 0, not NaN — NaN vanishes a HUD element with no error',
    bearingOf(at(5, 0), 0, 0, 0, 0) === 0)
  // Offset the KEEPER, not the contact: from (10,0) facing +z, a contact at (5,0) lies 5 along
  // −x, and −x is `cross(+z, up)` — the keeper's right. Derived, so it moves with the convention.
  chk('bearing is taken from the KEEPER\'s position, not the origin',
    near(bearingOf(at(5, 0), 10, 0, 0, 1), Math.PI / 2) &&
    near(bearingOf(at(5, 0), 0, 0, 0, 1), -Math.PI / 2))
}

// ── 7. the ring's geometry — a tick on the wrong side of a circle looks entirely plausible ──────
{
  const T = (b: number, d = 0, r = SENSE_RADIUS) => ringTick(b, d, r)
  const up = T(0), down = T(Math.PI), right = T(Math.PI / 2), left = T(-Math.PI / 2)

  chk('dead ahead draws at the TOP (SVG y grows downward, so ahead is negative y)',
    near(up.x1, 0) && up.y1 < 0)
  chk('directly behind draws at the BOTTOM — the one bearing that matters',
    near(down.x1, 0) && down.y1 > 0)
  chk('right of the keeper draws to the RIGHT', right.x1 > 0 && near(right.y1, 0))
  chk('left of the keeper draws to the LEFT', left.x1 < 0 && near(left.y1, 0))
  chk('ahead and behind are opposite, not the same point twice', up.y1 < 0 && down.y1 > 0)
  chk('left and right are opposite, not the same point twice', left.x1 < 0 && right.x1 > 0)

  chk('every tick starts ON the ring (r = 1)', [up, down, left, right]
    .every((t) => near(Math.hypot(t.x1, t.y1), 1)))
  chk('...and points OUTWARD, never inward', [up, down, left, right]
    .every((t) => Math.hypot(t.x2, t.y2) > Math.hypot(t.x1, t.y1)))

  chk('a contact at the keeper\'s feet is the loudest', near(T(0, 0).opacity, 1))
  chk('...and one on the rim is dimmest', T(0, SENSE_RADIUS).opacity < T(0, 0).opacity)
  chk('★ but the rim is still VISIBLE — a sense that fades to nothing announces nothing',
    T(0, SENSE_RADIUS).opacity > 0.25)
  chk('opacity falls monotonically with distance',
    T(0, 0).opacity > T(0, 8).opacity && T(0, 8).opacity > T(0, 16).opacity && T(0, 16).opacity > T(0, 24).opacity)
  chk('nearer ticks are longer', Math.hypot(T(0, 0).x2, T(0, 0).y2) > Math.hypot(T(0, 24).x2, T(0, 24).y2))
  chk('a contact past the rim clamps rather than inverting the tick',
    T(0, 999).opacity > 0 && Math.hypot(T(0, 999).x2, T(0, 999).y2) > 1)
  chk('a zero radius does not divide its way to NaN',
    Number.isFinite(T(0, 5, 0).opacity) && Number.isFinite(T(0, 5, 0).x2))
}

// ── 8. THE WIRING — the assert that makes "built" a fact instead of a claim ─────────────────────
// ★★★ THIS IS THE MOST IMPORTANT FILE IN THIS ORACLE AND IT IS NOT ABOUT GEOMETRY. `cast.ts`'s
// honesty rule says a move the sim cannot run must be `unbuilt` WITH a reason, because *"a silent
// no-op is how the old ward/restore/surge tags read as 'cast does nothing, must be a bug.'"*
// Tremor Sense's ONLY effect is `senseRadius`. So in a host that never reads that field the move is
// worn, costs nothing, shows nothing and does nothing — built in the data and absent from the game.
// Nothing in a unit test of pure functions can see that, which is exactly how the last claim about
// this move rotted for weeks. So this section reads the HOST'S SOURCE and ties the two together.
{
  const src = readFileSync(new URL('./Shimmer3D.tsx', import.meta.url), 'utf8')
  const hud = readFileSync(new URL('./TremorRing.tsx', import.meta.url), 'utf8')
  const built = isBuilt('tremor-sense') && castForMove('tremor-sense').senseRadius > 0

  chk('★ if the move is BUILT, a host resolves the sense — otherwise it is a silent no-op',
    !built || /senseGround\(/.test(src))
  chk('★ ...and a host DRAWS it, or the keeper feels nothing they can act on',
    !built || /<TremorSenseHud\b/.test(src))
  // ⚠⚠ COUNTED, NOT MERELY PRESENT — AND THIS ASSERT WAS DECORATION UNTIL A MUTATION SAID SO.
  // It first read "does any site read `.senseRadius`", which stayed green when the LOAD path was
  // hardcoded to a literal, because the OTHER site still matched. One `\w+?.senseRadius` anywhere in
  // a 7500-line file proves nothing about the site you broke. `resist` is the reference count: it is
  // set at every place a stance is applied (the load path and `syncStance`), so the sense must be
  // read from the spec exactly that many times. A field wired at one of two sites is correct until
  // the player changes stance and then silently stops meaning anything — a power that quietly stops
  // working, with no error and no symptom but itself.
  const fromSpec = src.match(/senseRadiusRef\.current = \w+\?\.senseRadius \?\? 0/g)?.length ?? 0
  const anySet = src.match(/senseRadiusRef\.current = /g)?.length ?? 0
  const resistSites = src.match(/resistRef\.current = /g)?.length ?? 0
  chk('the sense is wired at EVERY site that syncs a stance, not just the load path',
    !built || anySet === resistSites, `set ${anySet} vs resist ${resistSites}`)
  chk('★ ...and every one of them READS THE SPEC — not one of them a hardcoded number',
    !built || fromSpec === resistSites, `from-spec ${fromSpec} of ${resistSites}`)

  // The component must stay dumb. Every coordinate it draws belongs to the tested module; the day
  // it grows its own trigonometry, that math leaves the oracle's reach without anyone deciding to.
  chk('★ the HUD does no geometry of its own — the math stays where it can be asserted',
    !/Math\.(atan2|sin|cos)\b/.test(hud), 'trigonometry has appeared in the component')
  // ⚠ EVERY layer, not "somewhere in the file" — also caught by mutation. This overlay is two nested
  // elements and the first version of this assert passed while the OUTER one was set to 'auto',
  // because the inner still said 'none'. A HUD that eats a click is a world you cannot shoot into.
  const pe = hud.match(/pointerEvents: '(\w+)'/g) ?? []
  chk('...and no layer of it ever eats a click meant for the world',
    pe.length >= 2 && pe.every((m) => m.endsWith("'none'")), pe.join(' '))

  // ── the voxel world, which is the one Alex plays (proxy.ts:45 makes play3d legacy) ───────────
  // ⚠ ASSERTED IN ITS OWN SHAPE, NOT play3d's. This host keeps the whole worn spec in `stance`, so
  // it reads `senseRadius` off it directly instead of mirroring the field into a ref. Demanding
  // play3d's pattern here would be asserting a house style; what matters is that the sense is
  // resolved, drawn, and given the ARGUMENT that carries the canon limitation.
  const vox = readFileSync(new URL('../voxel3d/VoxelWorld.tsx', import.meta.url), 'utf8')

  chk('voxel3d resolves the sense', !built || /senseGround\(/.test(vox))
  chk('voxel3d draws it', !built || /<TremorSenseHud\b/.test(vox))
  chk('voxel3d reads the reach off the worn spec, not a copy of it',
    !built || /stance\.current\?\.senseRadius \?\? 0/.test(vox))

  // ★★★ THE ONE THAT MATTERS MOST IN THIS WHOLE FILE. `hover` is the entire canon limitation, and
  // this is the only world with a body that floats. A host that passes a literal 0 turns Tremor
  // Sense into a wallhack that reveals the ONE form canon says it cannot feel — and nothing on
  // screen would look wrong, because a ring with an extra tick on it is just a ring.
  // ⚠⚠ SCOPED TO THE CALL, NOT SCANNED OVER THE FILE — AND THE FIRST VERSION OF THIS ASSERT WENT
  // RED ON ITSELF. A bare /hover:\s*.../ sweep matched every Tailwind `hover:` utility in the HUD
  // *and the comment three lines above it that quotes `hover: 0` to explain the danger*. That is
  // this repo's 2026-08-22 canon-gate bug exactly: documenting a marker created a marker, and the
  // prose was accurate — accuracy is not the property that saves you. So this reads the ONE object
  // literal that feeds the sense, which no comment and no className can impersonate.
  const push = vox.match(/tremorBodies\.push\(\{[\s\S]*?\}\)/)?.[0] ?? ''
  chk('the sense is fed from a body literal the guard can actually find',
    !built || push.length > 0, 'tremorBodies.push({...}) not located')
  chk('★★★ voxel3d passes the body\'s REAL hover — a literal 0 here would be a silent wallhack',
    !built || /hover:\s*formOf\(\w+\)\.hover/.test(push), push.replace(/\s+/g, ' '))
  chk('★ ...and not a hardcoded one',
    !built || !/hover:\s*0\b/.test(push), push.replace(/\s+/g, ' '))
  chk('...and a dispersing body is excluded, or the ring keeps announcing a corpse',
    !built || /present:\s*st\.hp > 0 && st\.gutter < 1/.test(push), push.replace(/\s+/g, ' '))

  // The sense must agree with the ambusher about which way the keeper looks, or the ring points one
  // way while the strike resolves off another. `hollowFwd` is the vector `keeperLooking` reads.
  chk('★ voxel3d takes its facing from hollowFwd — the SAME vector the stalker\'s blind spot reads',
    !built || /r\.fx = hollowFwd\.current\.x; r\.fz = hollowFwd\.current\.z/.test(vox))

  // Canon says WHERE, not WHO. `Contact` carries no identity; this stops one being smuggled in.
  chk('the readout still carries no identity — canon says "know where everyone stands"',
    !/\bhp\b|\bform\b|\bname\b/.test(hud.slice(hud.indexOf('export interface Contact')) || ''))
}

console.log(`\ntremor-sense oracle: ${ok} passed, ${bad} failed`)
process.exit(bad ? 1 : 0)
