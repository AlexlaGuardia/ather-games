// tremor-sense.ts — what a keeper standing on the ground can feel through it.
//
// ★ PURE. No react, no three, no DOM, no refs — same rule as `voxel/` and `engine/cast-dispatch.ts`,
// for the same reason: both worlds must be able to run this, and a test must be able to sit at an
// exact arrangement of bodies without building one.
//
// ── WHAT THIS FILE IS FOR ───────────────────────────────────────────────────────────────────────
// Canon, `CANON/game/runes.md:557` (Tremor Sense — Stone + Enchant):
//
//   "Bind your awareness to the ground beneath you (Stone linked through Enchant). Feel footsteps,
//    sense weight, know where everyone stands. Novices detect nearby movement. Masters read an
//    entire battlefield through the soles of their feet — ambush becomes impossible."
//
// `cast.ts` decides that the move is a worn stance and how far it carries. This file decides the one
// thing that makes it Tremor Sense and not a radar: WHAT IT CAN FEEL.
//
// ── ★★★ THE LIMITATION IS THE FEATURE, AND CANON WROTE IT, NOT ME ───────────────────────────────
// The awareness is bound to *"the ground beneath you"* and reads *"footsteps"* and *"weight"*. A
// body that does not touch the ground leaves neither. So this sense is blind to anything hovering,
// and that is not a nerf bolted on to keep the move fair — it is the sentence, implemented.
//
// ⚠⚠ IT LANDS ON THE VOXEL WORLD'S THREE HOLLOW FORMS IN A WAY NOBODY DESIGNED AND EVERYBODY SHOULD
// CHECK BEFORE CHANGING EITHER SIDE. `voxel3d/hollows.ts` gives `warden` and `stalker` `hover: 0`
// and `caster` `hover: HOLLOW_HOVER` (1.15), and its own comment on the caster says *"The ONLY form
// that floats — and the only one a wall cannot answer. That pairing is the point."* So:
//
//   · the STALKER — the ambusher, whose whole design is the strike you can only deny by turning
//     around — is felt. Canon's "ambush becomes impossible", aimed at the one thing that ambushes.
//   · the WARDEN — the wall — is felt. You know which way around it is cheaper before you commit.
//   · the CASTER — the floater, the form whose job is to make backing away not work — is NOT felt,
//     and cannot be. The move therefore never solves the night; it solves being SURPRISED by it.
//
// That is a real trade written entirely out of two files that were not written together, and it is
// the reason the predicate below is `hover`, not a form name. ⚠ Keying on `form === 'caster'` would
// read identically today, pass every test here, and silently mean something else the day a fourth
// form arrives or the caster is put on the ground: it would be asserting a ROSTER where canon
// asserts a RELATIONSHIP TO THE FLOOR. Ask the property, never the name.
//
// ── ⚠ WHAT THIS DELIBERATELY DOES NOT DO ────────────────────────────────────────────────────────
// It reports CONTACTS, never identities: a position and a distance, no form, no hp, no name. Canon
// says *"know where everyone stands"* — where, not who. A host that wants a labelled health bar
// floating over a Hollow is welcome to build one, but it is not this move and must not be fed from
// this function, or the label arrives through a sense that canon says reads footsteps.
//
// It also ignores VERTICAL separation on purpose, and that is a decision worth stating rather than
// leaving as an omission: this is a floor plan. A body in a cave two dozen blocks below you is
// standing on ground, so it is felt, and it should be — "the ground beneath you" is the whole
// medium. If that ever needs a band, the band is canon's call, not a quiet clamp added here.

/**
 * The ring inside which the night is forbidden to form a body, and therefore exactly how far this
 * sense reaches.
 *
 * ★★ DERIVED, NOT PICKED. It is `voxel3d/hollows.ts`'s `PLAYER_EXCLUSION` — Minecraft's rule, kept
 * verbatim there: a pack *"forms out of sight, never in your lap"*. Setting the sense to precisely
 * that radius means a body is felt in the same instant it is permitted to exist, which is canon's
 * *"ambush becomes impossible"* expressed in the world's own number instead of in a taste value.
 *
 * ⚠ IT IS A LITERAL HERE AND A DERIVATION IN THE GUARD, AND THAT IS THE ONLY HONEST SHAPE AVAILABLE.
 * This file is pure and lane-local; importing `voxel3d/` into it would drag a world into a module
 * both worlds have to run. So `tremor-sense.test.ts` imports BOTH and asserts they are equal — the
 * house rule about a hand-kept mirror (compare the derivations, never trust that two numbers still
 * agree) applied to the one number that would otherwise rot in silence.
 */
export const SENSE_RADIUS = 24

/**
 * A body as this sense needs to see it. Deliberately not `HollowState`: a host maps its own bodies
 * into this shape, the same way `CastEnv` refuses to know what a host's hp ref looks like.
 */
export interface SensedBody {
  x: number
  y: number
  z: number
  /** How far this body floats above the surface it belongs to. `> 0` = it leaves no footstep. */
  hover: number
  /** `false` for a body that is dead, dispersing or otherwise not standing on anything. */
  present: boolean
}

/** Where something stands. No identity — see the header. */
export interface Contact {
  x: number
  z: number
  /** Horizontal distance from the keeper, world units. */
  dist: number
}

/**
 * Everything the keeper can feel, nearest first.
 *
 * `radius <= 0` means the keeper is not wearing the sense, and returns empty — the neutral value,
 * so a host can call this unconditionally every frame and branch on nothing.
 */
export function senseGround(
  bodies: readonly SensedBody[],
  px: number,
  pz: number,
  radius: number,
): Contact[] {
  if (!(radius > 0)) return []
  const out: Contact[] = []
  for (const b of bodies) {
    if (!b.present) continue
    // THE canon predicate. See the header before touching it.
    if (b.hover > 0) continue
    const dx = b.x - px
    const dz = b.z - pz
    const dist = Math.hypot(dx, dz)
    // Inclusive: a body at exactly the exclusion ring is one the sense is meant to catch, and that
    // equality is the whole reason the radius is this number.
    if (dist > radius) continue
    out.push({ x: b.x, z: b.z, dist })
  }
  out.sort((a, b) => a.dist - b.dist)
  return out
}

/**
 * Bearing of a contact relative to where the keeper is FACING, in radians, wrapped to (-PI, PI].
 * Negative is to the left, positive to the right, 0 dead ahead, ±PI directly behind.
 *
 * ★ IT LIVES HERE RATHER THAN IN THE HUD BECAUSE THE ONE READING THAT MATTERS IS "BEHIND ME". The
 * stalker's entire mechanic is the strike you deny by turning around, so the number a player acts on
 * is the sign and size of this angle, and a compass drawn from a hand-rolled `atan2` in a component
 * is exactly the kind of arithmetic that gets its sign flipped and looks plausible either way.
 *
 * `fx`/`fz` are the keeper's facing as a direction (it need not be normalised). A zero-length facing
 * has no bearing to give and returns 0 rather than NaN — ⚠ NaN would propagate into a transform and
 * make a HUD element vanish with no error, which reads as "the sense found nothing".
 */
export function bearingOf(c: Contact, px: number, pz: number, fx: number, fz: number): number {
  if (fx === 0 && fz === 0) return 0
  // ⚠⚠⚠ THE ORDER OF THESE TWO TERMS IS THE WHOLE FUNCTION, AND THE FIRST VERSION HAD IT MIRRORED —
  // green under four asserts that each pinned a convention I had CHOSEN rather than one the world
  // uses. The world's answer: `hollowFwd` is `camera.getWorldDirection()`, and for a camera looking
  // along `fwd` with world up +y, screen-right is `cross(fwd, up)` = `(-fz, 0, fx)`. So with `fwd`
  // pointing at +z, the keeper's RIGHT is −x — the opposite of what the mirrored form claimed.
  // A mirrored compass is not a wrong number, it is a cue that confidently points the wrong way,
  // which is worse than no cue: it would send a keeper turning AWAY from the stalker it exists to
  // announce. The oracle now DERIVES right from that cross product instead of restating a choice.
  const a = Math.atan2(fx, fz) - Math.atan2(c.x - px, c.z - pz)
  return Math.atan2(Math.sin(a), Math.cos(a))
}

// ── the readout's geometry ──────────────────────────────────────────────────────────────────────
// ★ THE MATH LIVES HERE AND NOT IN THE COMPONENT, for the same reason `bearingOf` does: a tick
// placed on the wrong side of a ring looks completely plausible, and a component is the one place in
// this codebase nothing can assert against. `TremorRing.tsx` is a dumb `map` over these; every
// number it draws is under the oracle.

/** One contact drawn on the ring, in UNIT-RING space: centre (0,0), the ring itself at r = 1. */
export interface RingTick {
  x1: number
  y1: number
  x2: number
  y2: number
  /** 0..1 — nearer reads brighter. */
  opacity: number
}

/**
 * Where a contact's tick sits on the ring, and how loud it is.
 *
 * ★ SCREEN CONVENTION, STATED BECAUSE IT IS THE HALF THAT SILENTLY INVERTS: bearing 0 is dead ahead
 * and draws at the TOP, +bearing is to the keeper's right and draws CLOCKWISE, and ±PI is directly
 * behind and draws at the BOTTOM. SVG's y grows downward, which is exactly why `y` is negated here
 * and why the oracle asserts ahead/behind/left/right as four separate facts rather than one round
 * trip — a y-flip and a sign flip cancel, and the ring then reads correctly for a contact in front
 * of you and backwards for the one behind, which is the only one that matters.
 *
 * ⚠ PROXIMITY IS CLAMPED AT BOTH ENDS AND NEVER REACHES ZERO. A contact exactly on the rim is the
 * one the sense exists to announce — a tick that fades to nothing at the edge would mean the night
 * arrives invisibly and brightens only once it is already on you, which is the opposite of *"ambush
 * becomes impossible"*. The floor is a real, visible mark.
 */
export function ringTick(bearing: number, dist: number, radius: number): RingTick {
  const p = radius > 0 ? 1 - Math.min(1, Math.max(0, dist / radius)) : 0
  const len = 0.10 + 0.14 * p
  const sx = Math.sin(bearing)
  const sy = -Math.cos(bearing)
  return {
    x1: sx,
    y1: sy,
    x2: sx * (1 + len),
    y2: sy * (1 + len),
    opacity: 0.3 + 0.7 * p,
  }
}
