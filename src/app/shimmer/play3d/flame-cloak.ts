// flame-cloak.ts — heat built across the skin, released the instant something presses into it.
//
// ★ PURE. No react, no three, no DOM. Same rule as `tremor-sense.ts` and `engine/cast-dispatch.ts`:
// both worlds must be able to run it, and a test must be able to sit at an exact charge.
//
// ── CANON, `CANON/game/runes.md:500` (Flame Cloak — Star + Static) ──────────────────────────────
//   "Let heat build across your skin (Static accumulation), release as a burning aura the moment
//    someone touches you (Star ignition). Punishes grapplers and melee rushers. Advanced users
//    maintain it passively — hug them and regret it."
//
// ★★ THE MOVE IS NOT A RETALIATION MULTIPLIER, AND READING IT AS ONE THROWS AWAY THE CANON. Canon
// names TWO runes doing TWO jobs: Static ACCUMULATES and Star IGNITES. So the cloak is a CHARGE —
// it builds while nothing touches you and dumps in one release when something does. A flat "reflect
// N damage" would be a simpler thing wearing the same name, and it would read identically in a
// changelog while playing completely differently: spacing would stop mattering, and a swarm would
// be punished exactly as hard as the one rusher canon says this move is FOR.
//
// ── ★★★ WHAT COUNTS AS A TOUCH, AND IT IS THE WHOLE DESIGN ──────────────────────────────────────
// ⚠⚠ THE OBVIOUS WIRING IS WRONG IN A WAY THAT LOOKS RIGHT. The host's contact event is a landed
// strike, and `hollowTouching` gates that on the form's **`reach`** — warden 1.25, stalker 0.8,
// **caster 7.5**. Igniting on "took a hit" would therefore burn the CASTER from seven metres away,
// which is the exact opposite of *"punishes grapplers and melee rushers"* and of *"hug them and
// regret it"*. Nothing on screen would look wrong; the caster would simply start dying to a move
// that cannot reach it.
//
// The sim already has the right word and it is **`body`** — the form's contact line, and
// `hollows.ts` says of the caster's `body: 0` that *"a thing made of absence at seven metres has no
// surface to bump into."* So the cloak asks for a SURFACE, and the caster has none. It can never
// ignite the cloak, and that is not a special case: it falls out of the same table that makes the
// caster the one form a wall cannot answer, and the one form Tremor Sense cannot feel.
//
// ⚠ ASK FOR THE SURFACE, NEVER FOR THE FORM'S NAME. `form === 'caster'` would read identically
// today and mean something else the day a fourth form lands or the caster is given a body.
//
// ── EDGE-TRIGGERED, NOT LEVEL-TRIGGERED, AND THAT IS A CHOICE WORTH STATING ─────────────────────
// Canon says *"the moment someone touches you"* — a MOMENT, not a duration. Igniting every frame a
// body overlaps you would drain the charge instantly and turn the move into a small damage aura,
// which is the flat-retaliation failure again by another road. So ignition is driven by the host's
// already-edge-triggered contact event (a body's strike, gated by its own cooldown), and between
// those moments the cloak rebuilds. `cloakBuild` and `cloakIgnite` are separate for that reason.

/**
 * A full release, in damage.
 *
 * ★ SIZED AGAINST THE THING CANON SAYS THIS MOVE IS FOR. The stalker is the melee rusher — 18 hp,
 * the heaviest single hit in the game, and it only strikes when you are not looking. A cloak at
 * full charge takes two thirds of it, so an ambush that lands is an ambush the ambusher regrets,
 * and a second one kills it. Against the warden (60 hp, pressing every 1.6s) the charge is nowhere
 * near full between presses, so the cloak chips a wall rather than beating it — which is the shape
 * canon asks for: a punish for rushers, not an answer to everything.
 */
export const CLOAK_BURN = 12

/** Damage-equivalent of heat regained per second. Full charge in `CLOAK_BURN / CLOAK_REBUILD` = 4s. */
export const CLOAK_REBUILD = 3

/** The heat currently held across the skin. */
export interface Cloak {
  /** 0..cap. Damage a release would deal right now. */
  charge: number
}

export const freshCloak = (): Cloak => ({ charge: 0 })

/**
 * Static accumulation. Builds toward `cap` and stops there.
 *
 * ⚠ Starts EMPTY rather than full, and clamps rather than wrapping: a cloak that began charged
 * would make donning it an instant burst, and canon's verb is *build*.
 */
export function cloakBuild(c: Cloak, dt: number, cap: number, rate: number): Cloak {
  if (!(cap > 0) || !(rate > 0) || !(dt > 0)) return c
  const charge = Math.min(cap, c.charge + rate * dt)
  return charge === c.charge ? c : { charge }
}

/** What a contact did. `burn` is 0 whenever the cloak did not fire, for any reason. */
export interface Ignition {
  burn: number
  cloak: Cloak
}

/**
 * Star ignition. Something with a surface pressed into the skin; the held heat goes into it.
 *
 * `contactRadius` is the toucher's contact line — `hollows.ts` › `HollowFormDef.body`. A body of
 * zero has no surface, so it cannot ignite the cloak however close it gets or however hard it hits.
 *
 * Releases EVERYTHING and leaves the cloak empty. A partial release would need a second magnitude
 * with no canon behind it, and would blunt the one thing that makes the move legible: the pause
 * before it can punish again.
 */
export function cloakIgnite(c: Cloak, contactRadius: number): Ignition {
  if (!(contactRadius > 0)) return { burn: 0, cloak: c }
  if (!(c.charge > 0)) return { burn: 0, cloak: c }
  return { burn: c.charge, cloak: { charge: 0 } }
}
