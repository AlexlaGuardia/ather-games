// collar-foes.ts — the collared Moglins you meet ON THE ROAD, and the collar you break to free them.
//
// ★ PURE. No react, no three, no grid. Fourth module on the extraction seam (weapons, cast-dispatch,
// vitals): the rules travel between worlds, the state does not.
//
// ── ★ THE ONE FACT THAT SHAPES EVERYTHING: THERE IS NO HEALTH BAR HERE ──────────────────────────
// Alex specced these as "melee 175, mage 125, assassin 100". Grepping canon first changed what those
// numbers mean, and it changed them for the better.
//
// A collared Moglin is a PERSON. `CANON/glossary.md` and the Hollows ruling together draw the line:
// the Ather's two hostile classes are answered by opposite verbs — a Hollow is absence, so you
// DISPERSE it, and that is why it is legal to shoot; a collared Moglin is a sweet creature wearing
// someone else's cruelty, so you FREE him, and guns are forbidden to answer that class at all.
// `collar-raid.ts` already encodes the payoff: at zero integrity the collar breaks and *"there is no
// wounded state and no second phase, because canon does not describe one: he is simply the sweet
// creature again."*
//
// So these numbers are COLLAR INTEGRITY, not hit points. Nothing here dies. The bar you empty is the
// collar's, the win is a deflate, and the reward is a freed spirit rather than a drop. **And that is
// precisely why "runes ARE the combat" (#294) in the regions: a bullet cannot free anyone.** Canon
// even names the move — `moves.md` › Still-Breath, *"offers a collared spirit a moment of calm — and
// a way out. The Reach-encounter move: honest calm, no harm."*
//
// ── ★ WHY THIS IS NOT `TIER_DIALS`, AND WHY IT MUST NOT MULTIPLY WITH IT ────────────────────────
// `collar-raid.ts` already tiers collar integrity — base 70 / second 120 / awakened 200 — but that
// axis is WHAT IS AT STAKE (the tier of the spirit being collared), and it is canon-anchored:
// Thornlords take one collared spirit each, Hemlock keeps multiple. This file is a different axis —
// HOW ONE FIGHTS — and the two describe different encounters, not one encounter with two dials:
//
//   a RAID   is an event: he is collaring a wild spirit and you interrupt   → collar-raid.ts
//   a PATROL is a meeting: he is pressing through a burrow and you are here → this file
//
// Multiplying them would give nine variants and count difficulty twice. They stay separate tables,
// and a raid keeps its own tuned numbers untouched.
//
// ── ⚠ THE NAMES ARE BUILD-SIDE PLACEHOLDERS AND THE CANON GAP IS LOGGED ─────────────────────────
// Alex's "assassin" and "mage" cannot ship as canon. `hollows.ts` already had to rule this once:
// *"a job implies someone who chose it"* — and the whole thesis of the collar-Moglins is that the
// species is not the sin, the collar is. They are teddy-soft folk made brave by a collar, not
// killers by trade. Canon names collar-Moglins as CHARACTERS (Brack, Vetch, Thistle), never as a
// role triangle, so whether a role triangle exists at all is Magii's to rule. These three ids are
// build-side and neutral until it does; see CANON_GAPS.md.
//
// ★ AND THE TRIANGLE HAS TO BE A TRIANGLE — the same rule hollows.ts fought for. Three foes that
// differ only in integrity are one foe with three bars. Each must break a different habit, and the
// oracle asserts they stay distinct on their own axis so a balance pass cannot quietly converge them.

/** Build-side ids. Canon owns whether these are a thing and what they are called — see the header. */
export type FoePosture = 'bulwark' | 'channeler' | 'skirmisher'

export interface CollarFoeDef {
  /**
   * Collar integrity — Alex's numbers, verbatim. NOT health: see the header. This is how much
   * frequency it takes to put a collar back down, and the only bar this class has.
   */
  integrity: number
  /** Metres/sec closing. */
  speed: number
  /** How close it must be to apply borrowed pressure. */
  reach: number
  /** Solid half-width. A body you can walk through is scenery, not a blockade. */
  body: number
  /** Borrowed-power pressure per second while it has you. Comes from the bound spirit, never from him. */
  pressureDps: number
  /** How far out it stops closing. The channeler holds this line; the other two come all the way. */
  standoff: number
  /** Relative frequency on a patrol. */
  weight: number
}

/**
 * ⚠ SPEEDS ARE BOUNDED ABOVE by the same rule the Hollows carry: nothing may out-run a keeper, or
 * "walk away" stops being an answer and a road becomes a wall. These are PEOPLE pressing a plot,
 * not predators — leaving should always work, and the cost of leaving is that the collar stays on.
 */
export const COLLAR_FOES: Record<FoePosture, CollarFoeDef> = {
  // "melee 175" — the one that plants himself in the road. Slowest, solid, heaviest collar, so
  // going THROUGH him is a real commitment rather than a formality. Punishes walking straight in.
  bulwark:    { integrity: 175, speed: 1.9, reach: 1.30, body: 0.90, pressureDps: 6,  standoff: 0,   weight: 3 },
  // "mage 125" — never closes, presses from across the clearing on borrowed frequency. Punishes
  // solving the other two by backing away.
  channeler:  { integrity: 125, speed: 1.4, reach: 8.0,  body: 0,    pressureDps: 9,  standoff: 7.0, weight: 2 },
  // "assassin 100" — the lightest collar and the fastest feet. Punishes standing still to work on
  // someone else's. Frail BY DESIGN: it is the one you can free quickly, which is what makes
  // choosing whom to free first a decision rather than a queue.
  skirmisher: { integrity: 100, speed: 3.6, reach: 0.85, body: 0.36, pressureDps: 4,  standoff: 0,   weight: 4 },
}

export const POSTURE_ORDER: FoePosture[] = ['bulwark', 'channeler', 'skirmisher']

export const foeDef = (p: FoePosture): CollarFoeDef => COLLAR_FOES[p]

/** Pick a posture by weight. `roll` is 0..1 — injected so the oracle can pin the distribution. */
export function pickPosture(roll: number): FoePosture {
  const total = POSTURE_ORDER.reduce((a, p) => a + COLLAR_FOES[p].weight, 0)
  const target = Math.min(0.999999, Math.max(0, roll)) * total
  let acc = 0
  for (const p of POSTURE_ORDER) {
    acc += COLLAR_FOES[p].weight
    if (target < acc) return p
  }
  return POSTURE_ORDER[POSTURE_ORDER.length - 1]
}

export interface CollarFoe {
  id: string
  posture: FoePosture
  x: number
  z: number
  /** `null` = freed. Canon: a Moglin without a collar is never hostile and never a target. */
  collar: { integrity: number; max: number } | null
}

export function spawnFoe(id: string, posture: FoePosture, x: number, z: number): CollarFoe {
  const max = COLLAR_FOES[posture].integrity
  return { id, posture, x, z, collar: { integrity: max, max } }
}

export interface FreeResult {
  foe: CollarFoe
  /** The collar came off THIS strike — fire the deflate once, here and nowhere else. */
  freed: boolean
}

/**
 * Put frequency back into a collar. The only way this class is ever answered.
 *
 * ⚠ A FREED MOGLIN IS PERMANENTLY DONE, and re-striking one must be a no-op rather than a re-arm.
 * Canon gives no wounded state and no second phase, so there is nothing here to model but the
 * moment it comes off. `freed` is true on exactly the strike that breaks it, so a caller can fire
 * the deflate without tracking edges itself — the same shape `strikeCollar` uses in collar-raid.ts.
 */
export function strike(foe: CollarFoe, amount: number): FreeResult {
  if (!foe.collar) return { foe, freed: false }
  const integrity = Math.max(0, foe.collar.integrity - Math.max(0, amount))
  if (integrity > 0) return { foe: { ...foe, collar: { ...foe.collar, integrity } }, freed: false }
  return { foe: { ...foe, collar: null }, freed: true }
}

/** Is this foe still a threat? Freed ones never are — canon, not balance. */
export const hostile = (foe: CollarFoe): boolean => foe.collar !== null

/** 0..1 for a collar bar. A freed foe reads 0 and should draw no bar at all. */
export const collarFrac = (foe: CollarFoe): number =>
  foe.collar ? foe.collar.integrity / foe.collar.max : 0
