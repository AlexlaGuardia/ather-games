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
// ── ★ POSTURE IS THE COLLARED SPIRIT'S, NOT THE MOGLIN'S — AND CANON SAYS SO OUTRIGHT ──────────
// The first cut of this file attached posture to the Moglin and then had to tiptoe around Alex's
// "assassin", because a job implies someone who chose it (`hollows.ts` ruled that once already).
// That was solving the wrong problem. Canon states the subject plainly, in two places:
//
//   `spirit-tales-bible.md:155` — "A meek little Moglin with a collared spirit at his back suddenly
//   feels ten feet tall. The power is borrowed and the bravery is fake… they gain a spine the
//   instant there's a spirit between them and the world, and lose it the instant it's gone."
//   `design-briefs/moglins.md:18` — "The **collared spirit looms behind/beside** as the borrowed power."
//
// **The Moglin is not the threat. The thing he brought is.** So a fighting posture was never his
// job — it is the shape of the spirit on the end of the collar, and **a spirit cannot have chosen a
// profession**, which dissolves the naming objection instead of working around it. Alex's frame is
// *"the Team Rocket of this universe"*: you do not fight the grunt, you fight what they brought.
//
// It also makes `win = free` mechanically obvious rather than a rule bolted on — breaking the collar
// removes the threat AND deflates the Moglin in the same beat, which is the books' own image.
//
// ⚠ The three ids stay build-side pending `CANON_GAPS.md` › *Do collared Moglins come in FIGHTING
// ROLES*, but only the NAMES are open now; the subject is settled. Rank is a separate, already-half-
// ruled axis measured in collars (Thornlord = one → unnamed middle → Hemlock = many) and it does not
// belong in this table — see the two-axes note above, which now applies three ways.
//
// ★ AND THE TRIANGLE HAS TO BE A TRIANGLE — the same rule hollows.ts fought for. Three foes that
// differ only in integrity are one foe with three bars. Each must break a different habit, and the
// oracle asserts they stay distinct on their own axis so a balance pass cannot quietly converge them.

import { mulberry32 } from './arena'

/**
 * How the COLLARED SPIRIT fights — not the Moglin's job. See the header; canon is explicit.
 * Build-side ids: canon owns what these are called, not whether they exist.
 */
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
  /**
   * Pressure per second while it has you.
   * ⚠ BORROWED, ALWAYS. Canon: "the power is borrowed and the bravery is fake." Every point of this
   * comes from the collared spirit, which is exactly why breaking the collar ends the fight outright
   * rather than starting a second phase — there is nothing of his own underneath it.
   */
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

/**
 * ── ★★ A PAIR, NOT A PERSON — CORRECTED 2026-08-16 (/magii + Alex, `game/shimmer-storyline.md`) ──
 * This file was built as *"a collared Moglin is a person wearing someone else's cruelty."* **Canon
 * does not have that anywhere.** The collar is a Moglin invention and *"its power works on spirits
 * only"* — it does not bite on a Moglin, an Alkin or a Mana'mal. Every canon instance is the same
 * shape: **the Moglin holding the leash**, with a dimmed spirit dragging behind him.
 *
 * ★ THE HEADER OF THIS FILE WAS ALREADY RIGHT AND THE TYPE WAS WRONG. It has said *"how the
 * COLLARED SPIRIT fights — not the Moglin's job"* and *"the posture belongs to the spirit"* since it
 * was written. The three postures were the spirit's all along; only the bar was on the wrong body.
 * The mistake was an ambiguous compound: **`collar-Moglin` means a Moglin OF the collar — a
 * collarer** — and the build read it as a Moglin wearing one.
 *
 * ⚠ THE ORDERING IS THE PAYOFF AND MUST NOT BE COLLAPSED: you defeat the SPIRIT, its collar breaks,
 * it leaves — and the Moglin deflates **as the consequence**, because his bravery was borrowed and
 * the loan has been called. A Moglin who wore the collar himself would have nothing to lose and no
 * swagger to drain, and the beat the whole cozy line rests on stops working.
 */
export interface CollarFoe {
  id: string
  /** How the COLLARED SPIRIT fights — the thing the keeper actually contests. Never the Moglin's. */
  posture: FoePosture
  /** Where the pair stands. The Moglin leads; the spirit drags behind him on the leash. */
  x: number
  z: number
  /**
   * The SPIRIT's collar. `null` = the contest is won: the spirit is free and gone, and the Moglin
   * holding the leash is just the sweet harmless folk he always was.
   */
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
 * ── ★★ THE NUMBER BELONGS TO THE COLLAR (ruled 2026-08-16) ──────────────────────────────────────
 * `integrity` is **the collar's grip**, never the spirit's health, and that single sentence is what
 * makes a cutting projectile tonally safe on a cozy line. Breaking it is dispossession — *"no wound,
 * no death"* — and the freed spirit *"returns to its freedom (it is not caught or kept)."* **A freed
 * spirit walks away whole. You are not damaging anyone; you are out-contesting a hold.**
 *
 * ⚠ SO THIS MUST NEVER BE RENAMED `hp`/`damage`/`health`, and no future move may reduce it as a side
 * effect of hurting someone. The moment the number means injury, a dart stops being allowed to be
 * the answer and the whole 08-16 ruling has to be re-fought.
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

// ── ★ THE APPROACH (2026-08-16, #294 — the half that was missing when the wiring started) ────────
//
// Everything above describes what a collared foe IS and what breaking its collar DOES. Nothing here
// moved one, so a host had defs, a strike and no encounter: the four modules were "done and green"
// with no live caller, which is the same shape `bubbleSwallows` was found in this morning.
//
// ⚠ THIS IS DELIBERATELY NOT `hunter-ai.ts`'s `stepHunter`, AND THE REASON IS CANON, NOT TASTE.
// That module is the right SHAPE — pure, intent-returning, `blocked()` injected so a voxel world and
// a tile grid can both answer — and it was explicitly lifted out of the range "so more than one thing
// can use it". But its tuning is a GUNFIGHT: `fireCd`, `firstShotCd`, `hp`, and an intent whose verb
// is `fire`. Guns are forbidden against this class — a bullet cannot free anyone — so routing these
// three postures through it would mean carrying three dead fields and reinterpreting `fire` as
// "press", which is a lie at the type level and the kind a later reader would believe. What the two
// genuinely share is one line ("close to a standoff and hold"), and that line is cheaper to write
// twice than to abstract into a brain that has to explain which half applies.
//
// ★ AND THE BEHAVIOUR IS SIMPLER THAN A HUNTER'S ON PURPOSE. A hunter orbit-strafes so it is not a
// static turret. These PRESS: canon's threat is being held, not being shot at, so the bulwark plants
// himself in the road, the channeler holds a line and leans on you from it, and the skirmisher runs
// you down. Orbiting would make all three read as the same evasive gunfighter wearing three speeds.

/**
 * How fast a freed Moglin walks off, in blocks/sec. Slower than any posture's fighting speed on
 * purpose: he is leaving, not fleeing, and canon's beat is deflation rather than panic.
 */
export const LEAVING_SPEED = 1.4

export interface FoeStepCtx {
  /** Where the keeper is standing. */
  px: number
  pz: number
  /**
   * Is a walker blocked at this spot? The one thing that cannot travel between worlds — a tile
   * lookup in the range, a voxel probe here. Omit it and the foe walks as if the ground were open,
   * which is the right default for a pure test.
   */
  blocked?: (x: number, z: number) => boolean
  /** Half-width of the keeper, so a foe closing to standoff 0 stops AT them, never inside them. */
  keeperRadius?: number
}

export interface FoeIntent {
  /** Where the foe wants to be. The host applies it, or refuses — see `blocked`. */
  moveTo: { x: number; z: number } | null
  /** Within reach this frame: the host bills `vitals.pressure()` for `pressureDps * dt`. */
  pressing: boolean
}

/**
 * One frame of a collared foe's approach. Pure: it MOVES NOTHING and returns what it wants.
 *
 * ⚠ A FREED MOGLIN IS INERT, AND THIS IS THE FIRST LINE FOR A REASON. Canon gives him no wounded
 * state and no second phase — he is simply the sweet creature again — so a freed foe must not walk
 * toward you, must not press, and must not be re-armed by anything downstream. Every other rule in
 * this function is balance; this one is the ruling.
 */
export function stepFoe(
  foe: CollarFoe, ctx: FoeStepCtx, dt: number, def: CollarFoeDef = foeDef(foe.posture),
): FoeIntent {
  // ── ★★ HE CAN GO, AND CANON SAYS SO IN AS MANY WORDS (2026-08-16) ──────────────────────────
  // *"The only thing that separates this from a nicer collar is that he can go… the exit is not a
  // courtesy feature. It is the canon. Build it and never hide it."*
  //
  // The first version returned `{ moveTo: null }` here and left a freed Moglin standing on the road
  // forever — inert, which I filed as a placeholder and canon has now refused. A deflated Moglin
  // WALKS AWAY. He never presses and he is never a target again; he simply leaves, which is the
  // entire difference between this and the thing he was doing to the spirit.
  if (!hostile(foe)) {
    const ax = foe.x - ctx.px, az = foe.z - ctx.pz
    const d = Math.hypot(ax, az)
    // Standing exactly on the keeper has no away-direction; he will have one next frame.
    if (d < 1e-6) return { moveTo: null, pressing: false }
    const step = LEAVING_SPEED * dt
    return { moveTo: { x: foe.x + (ax / d) * step, z: foe.z + (az / d) * step }, pressing: false }
  }

  const dx = ctx.px - foe.x, dz = ctx.pz - foe.z
  const dist = Math.hypot(dx, dz)
  // Standing exactly on the keeper has no direction to move along, and normalising it is a divide by
  // zero that would send the foe to NaN and out of the world for the rest of the session.
  if (dist < 1e-6) return { moveTo: null, pressing: true }

  const ux = dx / dist, uz = dz / dist
  // ★ THE LINE THIS FOE HOLDS. `standoff` is the posture's own (7 for the channeler, 0 for the two
  // that come all the way), but 0 does not mean "occupy the keeper" — a body has width, and so does
  // a keeper. The floor keeps the bulwark a blockade you walk around rather than a shape you stand
  // inside, which is the whole point of his `body`.
  const hold = Math.max(def.standoff, def.body + (ctx.keeperRadius ?? 0.35))
  const want = dist - hold
  // Already at or inside the line: hold it. Pressing is decided by REACH, never by the line — the
  // channeler's reach (8) is deliberately longer than its standoff (7) so holding still presses.
  if (want <= 0) return { moveTo: null, pressing: dist <= def.reach }

  const step = Math.min(def.speed * dt, want)
  const tx = foe.x + ux * step, tz = foe.z + uz * step

  // ⚠ SLIDE, DO NOT STOP. A foe that refuses to move when its straight line is blocked parks itself
  // on the first tree between it and the keeper and the encounter quietly ends — indistinguishable,
  // from the player's side, from the spawn having failed. Try the full step, then each axis alone.
  const free = (x: number, z: number) => !ctx.blocked || !ctx.blocked(x, z)
  const moveTo = free(tx, tz) ? { x: tx, z: tz }
    : free(tx, foe.z) ? { x: tx, z: foe.z }
    : free(foe.x, tz) ? { x: foe.x, z: tz }
    : null

  // ★ REACH IS MEASURED FROM WHERE IT IS NOW, NOT FROM WHERE IT WANTS TO BE. Billing pressure for a
  // step the host may refuse would let a foe press you through a wall it never got around.
  return { moveTo, pressing: dist <= def.reach }
}

// ── ★★ WHO IS STILL STANDING THERE (2026-08-16, the send-back pass) ──────────────────────────────
//
// The host used to roll a patrol inline and mark the hold spent the moment it did. That flag was
// written at SPAWN and read as *"this encounter is over"*, and persisted — so the encounter's own
// LOSING state, being sent back, consumed the hold exactly as permanently as freeing everybody. The
// nearest hold is 1237 blocks from the glade. Lose once and #294's content was gone from that save.
//
// ★ THE RULE THAT REPLACES IT: **freeing is permanent, failing is not.** A spirit that went free is
// free and no reload may re-collar it; a Moglin still holding a leash is still holding it, and
// meeting him again on the road is the world working, not a respawn. Canon spends the REWARD once —
// it says nothing about an unresolved meeting, and there is nothing here to farm: the free path
// gives the keeper nothing they can hold, which it says out loud.
//
// ★ SO THE STATE IS A COUNT, AND THE PATROL IS A PREFIX. The roll is deterministic from the hold's
// own coordinates, so "3 of them, 2 freed" re-rolls the identical 3 and drops the first 2 — the
// survivor is the same Moglin, same posture, same spot. Storing ids would be a second source of
// truth about something the seed already knows, and it would drift the first time the roll changed.
//
// ⚠ IT LIVES HERE, NOT IN THE HOST, FOR THE REASON THIS FILE KEEPS LEARNING: a rule that can only be
// checked by walking 1237 blocks and losing a fight is a rule nobody will check. The host keeps the
// geometry (which way the road faces, where the ground is); the seed math travels.

/** One Moglin's slot in a hold's patrol, before the host decides which way the road faces. */
export interface PatrolSlot {
  /** Index in the full patrol. The freed are the low ones — see the prefix rule above. */
  n: number
  posture: FoePosture
  /** Radians either side of the bearing the keeper is approaching from. Host adds the bearing. */
  spread: number
  /** Blocks from the hold's centre. */
  rad: number
}

/**
 * Roll a hold's patrol, minus whoever the keeper already freed.
 *
 * ⚠ THE SKIPPED SLOTS STILL CONSUME THEIR ROLLS. Advance past a freed Moglin without drawing his
 * numbers and the survivor inherits them — the keeper walks back to a patrol of the right size
 * standing in the wrong places wearing the wrong postures, which reads as the fight being re-rolled
 * and is exactly what determinism is here to prevent.
 */
export function rollPatrol(holdX: number, holdZ: number, half: number, alreadyFreed = 0): {
  /** How many the hold sends when nobody has been freed. `alreadyFreed >= size` means never again. */
  size: number
  /** Only those still wearing a collar. Empty once the whole patrol has been freed. */
  slots: PatrolSlot[]
} {
  // Deterministic from the hold, not `Math.random()`: two keepers meeting the same hold must meet
  // the same patrol, and a reload must not reroll it into a different fight.
  const roll = mulberry32((holdX * 73856093) ^ (holdZ * 19349663))
  const size = 2 + Math.floor(roll() * 2)                     // 2-3: a patrol, not a raid
  const freed = Math.max(0, Math.min(size, Math.floor(alreadyFreed)))
  const slots: PatrolSlot[] = []
  for (let n = 0; n < size; n++) {
    const posture = pickPosture(roll())
    const spread = (roll() - 0.5) * 0.9
    const rad = half + 3 + roll() * 6
    if (n < freed) continue                                   // gone, and staying gone
    slots.push({ n, posture, spread, rad })
  }
  return { size, slots }
}

/** 0..1 for a collar bar. A freed foe reads 0 and should draw no bar at all. */
export const collarFrac = (foe: CollarFoe): number =>
  foe.collar ? foe.collar.integrity / foe.collar.max : 0

// ── ★★ WHAT A ROUND DOES TO A COLLAR (2026-08-16, #294) ─────────────────────────────────────────
//
// This lived inline in the voxel host's shot sweep, which meant the one rule the whole region-combat
// design rests on — *a bullet cannot free anyone* — could only be checked by driving a browser,
// aiming a camera through a mouse-delta API, and hoping the shot connected. Five runs of that proved
// only that my aim was bad. **A rule that can only be tested by hitting something is a rule nobody
// will test.** Pulled out here, it is three lines and an oracle, and the host keeps the geometry.
//
// ★ THE HOST STILL OWNS THE HIT. Whether a round reaches a body is a question about capsules and
// segments in a particular world; whether reaching one MEANS anything is a question about canon, and
// canon travels. Same seam as everything else in this file.

/**
 * ── ★★ WHAT A THING IS MADE OF, AS FAR AS A COLLAR CARES (ruled 2026-08-16, /magii) ─────────────
 * `game/shimmer-storyline.md` › *WHICH MOVES THE GUARD CATCHES*. **Delivery is agnostic; the guard
 * is not.** A collar opens to whatever WINS THE CONTEST — canon's verb is *"freed by **defeating**
 * it in battle"* — and refuses two separate classes for two different reasons.
 *
 * ⚠ **UNCLASSIFIED IS REFUSED.** A move that has never been classified must never open a collar,
 * because the failure direction matters: a wrongly-refused move is a rune that feels thin, and a
 * wrongly-accepted one puts described cruelty on a cozy line's page. Same fail-closed shape as
 * `WILDS_SWALLOW_EXEMPT` and `focus_active`'s allowlist — never let an unrecognised value land in
 * the band that grants permission.
 */
export type CollarDelivery =
  /** A move that strikes the collar. Canon: it is *"a loop of metal"* — an object, and things can be struck. */
  | 'opens'
  /** CLASS 1 — Rule 3. The body IS the described mechanism, so it cannot be aimed at an object. */
  | 'cruelty'
  /** CLASS 2 — thematic. The move IS the line's named evil: *"the evil is force-control."* */
  | 'control'
  /** Restores, launches, surges. Legitimate, and never the thing that opens a collar. */
  | 'no-contest'
  /** A gun round. Canon forbids this class outright — a bullet cannot free anyone. */
  | 'lead'

export type CollarAnswer =
  /** Frequency reached the collar: strike it. */
  | 'opens'
  /** Lead reached a person. Absorbed, opens nothing, and the world should say why. */
  | 'refused-lead'
  /** ★ CLASS 1. Canon will not put it on the page: *"takes and pressures; he does not injure."* */
  | 'refused-cruelty'
  /** ★ CLASS 2. A move that takes someone's choice cannot be the thing that gives a choice back. */
  | 'refused-control'
  /** Never entered the contest, so it cannot have won it. Not a refusal of the keeper — of the verb. */
  | 'no-contest'
  /** Already free. Not a target, not a hitbox, not a thing to shoot at. */
  | 'not-a-target'

/**
 * What this round does to this foe, given only what the round is made of.
 *
 * ⚠ `refused-lead` IS NOT `not-a-target`, and collapsing them is the mistake worth guarding against.
 * A freed Moglin should let rounds through as though he were scenery, because he is no longer in the
 * fight. A COLLARED one must STOP the round and say why — letting lead pass through him would read
 * as a broken hitbox, and the player would conclude the game is buggy rather than that they are
 * reaching for the wrong verb. One is "nothing here"; the other is "this is the wrong tool", and
 * they must look different to the host and to the keeper.
 */
export function answerCollar(foe: CollarFoe, delivery: CollarDelivery | undefined): CollarAnswer {
  if (!hostile(foe)) return 'not-a-target'
  switch (delivery) {
    case 'opens': return 'opens'
    case 'cruelty': return 'refused-cruelty'
    case 'control': return 'refused-control'
    case 'no-contest': return 'no-contest'
    case 'lead': return 'refused-lead'
    // ⚠ `undefined` LANDS HERE ON PURPOSE. A move nobody has classified is a move nobody has
    // checked against Rule 3, and the cheap failure is the one that refuses it.
    default: return 'refused-cruelty'
  }
}


