// cast.ts — the cast layer: LOADOUT SLOT → MOVE → ARCHETYPE.
//
// ── THE CORRECTION THIS FILE IMPLEMENTS (Alex, 2026-08-03) ─────────────────────
// v2 mapped `birthRune → bolt archetype`: your rune WAS your attack. Alex killed that — "the birth
// rune sets the tone, the innate passive. It doesn't decide the tactical or the special." It also
// explained why casting felt redundant next to a gun: a coloured bolt is a worse gun, while
// Stonewall / Shackle / Cordon do what a gun cannot.
//
// The chain is now:
//   rune-inventory (runes you hold) → keeper-moves (the book, derived by inverting rune requirements)
//   → a LOADOUT SLOT (this file) → a cast archetype the sim can run.
//
// ── ★★ WHAT "THE INNATE PASSIVE" IN THAT QUOTE MEANT (RULED 2026-08-25, Alex + /magii) ─────────
// The quote above is Alex's, verbatim, and stays that way — a record of what was said is not
// something a later ruling gets to rewrite. But the words "the innate passive" read as a passive
// MOVE, and they never meant one. They meant the always-on **affinity LEAN**: canon at
// `shimmer-birth-rune.md:27`, shipped in `birth-affinity.ts`, read every frame through
// `engine/vitals.ts`.
//
// ⚠ THE DISTINCTION IS LOAD-BEARING, NOT PEDANTRY. A passive MOVE in canon is learned, advanced
// and elite (`runes.md:253-257`, "Eyuun teaches this technique"), it occupies one of three innate
// sockets, and **holding it pauses mana recovery** — the double edge the mana economy rests on.
// The lean is none of those things: it is permanent, free, costless to recovery, and covers all 20
// runes. Reading the quote the other way would have meant authoring up to 13 new passive moves
// (only 4 of 17 birthable runes have a passive in that rune alone; 8 have none at all) and either
// taxing every keeper's regen from birth or deleting the double edge. Alex ruled it stays a
// background mechanic. See `CANON/CANON_GAPS.md` — the birth-rune equip-gate entry.
//
//
// ── BOUNDARY ──────────────────────────────────────────────────────────────────
// Move NAMES + EFFECTS + rune requirements are canon (CANON/game/moves.md, transcribed in
// keeper-moves.ts). Which build archetype realises a move, and every number below, are Jin's.
//
// ★ COLOUR IS NOT HERE, ON PURPOSE. moves.md:5 — "Colour is never part of a move. Colour is the
//   mage's own — their soul-frequency — applied when they cast it." v2's CastSpec carried the RUNE's
//   glow, which is drift: two Storm-mages would have run the same Chain Lightning in two colours
//   because of their rune rather than their soul. The caster supplies the colour (SOUL_COLOR in
//   Shimmer3D), so no colour field exists on a CastSpec.
//
// ── HONESTY RULE ──────────────────────────────────────────────────────────────
// Every registered move gets an entry here. A move the sim cannot yet run is archetype 'unbuilt'
// WITH a reason — it is labelled as unbuilt in the HUD rather than silently doing nothing. A silent
// no-op is how the old ward/restore/surge tags read as "cast does nothing, must be a bug." The test
// asserts full coverage, so a newly authored canon move cannot slip through unclassified.

import { KEEPER_MOVES, type KeeperMove, type MoveTier, knownMoves } from './keeper-moves'
import { SENSE_RADIUS } from './tremor-sense'
import { CLOAK_BURN, CLOAK_REBUILD } from './flame-cloak'
import { RUNES } from './birth/runes.data'
import { hasLearned, type Book } from './scroll-market'
import type { ConjureShape } from '../engine/conjured-terrain'
import type { StatusKind } from '../engine/statuses'

/** The archetypes the sim can actually run today, plus the honest 'unbuilt' tag. */
export type CastArchetype =
  | 'projectile'  // a travelling bolt: damage on contact (chains if `chain` > 0)
  | 'restore'     // instant self-heal
  | 'stance'      // a passive — always-on and DERIVED since 2026-08-26 (derivePassive), no key; MOST cost nothing
  | 'surge'       // a short self-buff burst (speed / evasion)
  | 'field'       // SYSTEM 1 — a persistent area entity placed at the aim point (field-effects.ts)
  | 'terrain'     // SYSTEM 2 — runtime terrain raised at the aim point (conjured-terrain.ts)
  | 'status'      // SYSTEM 3 — removes an OPTION from every enemy near the aim point (statuses.ts)
  | 'impulse'     // SYSTEM 4 — the cast moves the KEEPER: a launch or a blink (locomotion.ts)
  | 'infusion'    // a timed multiplier on the WEAPON, not the cast (Flame Infusion)
  | 'channel'     // SYSTEM 7 — a cast that is HELD: press, hold, release, billed per second (sustain.ts)
  | 'unbuilt'     // registered in canon, no sim behaviour yet — labelled, never a silent no-op

export interface CastSpec {
  /** keeper-moves id this spec realises */
  moveId: string
  /** canon move name, for the HUD */
  label: string
  tier: MoveTier
  archetype: CastArchetype
  manaCost: number
  cooldownMs: number
  // projectile
  damage: number
  projSpeed: number
  projLife: number
  /** extra targets a projectile jumps to on impact (Chain Lightning). 0 = no chain. */
  chain: number
  /** world-unit radius the chain searches from the struck target */
  chainRange: number
  // restore
  heal: number
  // stance
  /** fraction of incoming damage the held stance absorbs (0–1) */
  resist: number
  /**
   * Movement multiplier while held (Iron Skin refuses to move under a hit).
   * ★ For Iron Skin this IS its double edge — canon's *"binds your footing"*, the cost that replaced
   * the retired blanket recovery pause. A cost you cannot feel is a cost that was deleted, so this
   * is tuned to be legible in the hand, not decorative.
   */
  moveMult: number
  /** cast damage multiplier while held (Flame Manipulation shapes fire by instinct) */
  castMult: number
  /**
   * ── THE ONE MANA-ECONOMY AXIS OF A WORN PASSIVE (2026-08-26) ──────────────────────────────────
   * A MULTIPLIER on whatever the world's own base mana regen is, while this passive is worn.
   *   `1` = free (the overwhelming majority) · `<1` = a drain · `>1` = it feeds you · `0` = the old
   *   full pause, still expressible and still honoured.
   *
   * ★ IT REPLACED AN ABSOLUTE `manaPerSec` + A `pausesRecovery` FLAG, AND THE REASON IS A MEASURED
   * BUG, NOT TIDINESS. The two hosts do not share a mana scale: play3d regenerates **1/60 per sec**
   * (`MANA_REGEN_PER_SEC` — "1 mana per minute by design", mana is a real budget) and the voxel world
   * **1 per sec**. That is a **60× difference**, so one absolute number cannot mean the same thing in
   * both: Moisture Gathering's 0.8/s was ~0.8× base in the voxel world and ~48× base in play3d, which
   * is not a trickle, it is infinite mana. It never showed up because the value was unreachable until
   * today (it was only ever read where a passive PAUSED, and nothing paused). A multiplier is scale-free
   * and lands correctly in both.
   *
   * ⚠ AND A HARD PAUSE CANNOT SURVIVE THE 08-26 REDESIGN AS-WRITTEN. Canon keeps the drain on
   * Barrier/Bulwark, but a passive is now ALWAYS-ON, derived and undroppable — so "pauses recovery"
   * would mean a Barrier keeper never regenerates mana again, with no way to take it off. Canon's own
   * word is **drain**, not stop (novel Ch04/07/15/18: *"the slow ebb, the turtle running out of air"*),
   * and Ch04's premise is the enemy USING UP the man inside the shell over time — which is a keeper
   * who still recovers, just far too slowly to outlast the pressure. A value below 1 says exactly
   * that; a 0 would say something canon does not. Magnitudes are Jin's (ruled), the drain is canon's.
   */
  regenMult: number
  // surge / infusion — both are a timed multiplier on the caster
  /** seconds the surge (or weapon infusion) lasts */
  surgeSecs: number
  /** speed multiplier during a surge; weapon-damage multiplier during an infusion */
  surgeMult: number
  // ── placed casts (field / terrain / status) ────────────────────────────────
  /** how far down the reticle the cast lands, in world units */
  castRange: number
  /** field/status: effect radius. terrain: wall length, ring radius or block side. */
  areaSize: number
  /** seconds the placed thing persists */
  areaSecs: number
  /** field: damage per tick to enemies inside */
  fieldDps: number
  /** field: healing per tick to the player inside */
  fieldHps: number
  /** field: does it eat projectiles crossing it? (Firewall is cover; a grove is not) */
  fieldStopsShots: boolean
  /**
   * field: hit points of the cover — 0 = it does not break (fire, wind), >0 = a SHELL that eats
   * rounds until it has dispersed all it can. See `field-effects.ts` › `FieldDef.hp`. Only Threshold
   * carries one today; Alex ruled shield HP for placed fields 2026-09-02.
   */
  fieldHp: number
  /** terrain: which shape is raised */
  shape: ConjureShape
  /**
   * terrain: how tall the raised shape stands.
   * ⚠ WAS "render only — collision is binary", and that stopped being true on 2026-08-14: in the
   * voxel world this is a count of REAL stacked blocks, so height is collision. play3d still reads
   * it the old way, which is fine — it is the host's business how a cell becomes a wall.
   */
  shapeHeight: number
  /** status: which options this cast removes from enemies in the area */
  statuses: readonly StatusKind[]
  // ── impulse (SYSTEM 4) — the cast moves the CASTER ─────────────────────────
  /**
   * How the keeper is moved.
   *
   * ★ TWO MOTIONS UNDER ONE ARCHETYPE, because canon writes them as one idea (a Skirmisher's escape)
   * and the host dispatches them at one place. A `launch` hands velocity to the walker and lets
   * physics finish the sentence; a `blink` sets position outright. Keeping them separate archetypes
   * would put the same "which world can move a keeper" question in two `supports` entries.
   */
  motion: 'launch' | 'blink'
  /** launch: speed along the aim direction, world units/sec. Canon's *"body as the projectile"*. */
  impulseFwd: number
  /** launch: speed straight up, world units/sec. Updraft is almost all of this and no forward. */
  impulseUp: number
  // ── sense (SYSTEM 5) — the cast tells the keeper where the world IS ────────
  /**
   * How far a ground-bound awareness reaches, in world units. 0 = this move senses nothing, which
   * is every move but one.
   *
   * ★★ IT IS A RADIUS AND NOT A BOOLEAN BECAUSE CANON WRITES A LADDER, NOT A SWITCH.
   * `runes.md:558` — *"Novices detect nearby movement. Masters read an entire battlefield through
   * the soles of their feet."* A flag could only ever express the master. The magnitude is Jin's
   * (the boundary: canon owns that the awareness exists and what it is bound to, the build owns how
   * far it carries), and the number chosen is not taste — see the `tremor-sense` build below.
   *
   * ⚠⚠ THIS IS A SENSE, NOT A REVEAL, AND THE HOST MUST NOT WIDEN IT. Canon binds the awareness to
   * *"the ground beneath you"*, so what it can feel is what STANDS ON the ground — see
   * `tremor-sense.ts`, which owns that predicate and is where the limitation is asserted. A host
   * that surfaces every body inside the radius has not implemented this move, it has implemented a
   * wallhack that happens to share its name, and the difference is invisible on screen until the
   * one form the sense is supposed to miss shows up in the readout.
   */
  senseRadius: number
  // ── cloak (SYSTEM 6) — the cast answers a touch by itself ─────────────────
  /**
   * A full Flame Cloak release, in damage. 0 = this move holds no heat, which is every move but one.
   *
   * ★ TWO FIELDS BECAUSE CANON NAMES TWO RUNES DOING TWO JOBS — Static ACCUMULATES, Star IGNITES.
   * A single "reflect N" number would be a different, simpler move wearing the same name: spacing
   * would stop mattering and a swarm would be punished as hard as the lone rusher canon says the
   * move is for. `flame-cloak.ts` owns the charge; these are only its magnitudes.
   */
  cloakBurn: number
  /** Damage-equivalent of heat regained per second while nothing is touching you. */
  cloakRebuild: number
  // ── sustain (SYSTEM 7) — the cast is HELD and bills by the second ─────────
  /**
   * Mana per second while the key is down. 0 = this is not a sustained cast, which is every move
   * today — the hook exists before its first user on purpose (see `sustain.ts`).
   *
   * ⚠ IT IS A RATE, NOT A TOTAL, AND `manaCost` STILL MEANS THE PRESS. A channel that charged its
   * whole price up front would be a normal cast with a long animation: releasing early would refund
   * nothing and holding longer would cost nothing, so the resource canon actually spends — TIME,
   * continuously — would not be spent at all.
   */
  sustainDrain: number
  /** why this move has no sim behaviour yet — only set on 'unbuilt' */
  why?: string
}

const BASE: Omit<CastSpec, 'moveId' | 'label' | 'tier' | 'archetype'> = {
  manaCost: 0, cooldownMs: 0,
  damage: 0, projSpeed: 0, projLife: 0, chain: 0, chainRange: 0,
  heal: 0,
  resist: 0, moveMult: 1, castMult: 1, regenMult: 1,
  surgeSecs: 0, surgeMult: 1,
  castRange: 0, areaSize: 0, areaSecs: 0,
  fieldDps: 0, fieldHps: 0, fieldStopsShots: false, fieldHp: 0,
  shape: 'wall', shapeHeight: 1, statuses: [],
  motion: 'launch', impulseFwd: 0, impulseUp: 0,
  senseRadius: 0,
  cloakBurn: 0, cloakRebuild: 0,
  sustainDrain: 0,
}

/** per-move build spec, keyed by keeper-moves id. Numbers are Jin's and free to tune. */
type Build = Partial<CastSpec> & { archetype: CastArchetype }

const BUILDS: Record<string, Build> = {
  // ── Passives → stances. Worn, always-on. The COST is per-move now, not per-tier (2026-08-26). ──
  // The shell pair is where canon put the drain, so they are the two that pay in mana.
  // The shell pair is where canon put the drain. Worn and undroppable, so these are sized as a slow
  // ebb rather than a stop: you still recover, too slowly to outlast sustained pressure. That IS Ch04.
  barrier:   { archetype: 'stance', resist: 0.35, cooldownMs: 500, regenMult: 0.4 },
  bulwark:   { archetype: 'stance', resist: 0.55, moveMult: 0.9, cooldownMs: 500, regenMult: 0.15 },
  // ⊕ birth-exclusive (Star-born). Free — Veyra shapes fire by instinct; instinct costs nothing.
  'flame-manipulation': { archetype: 'stance', castMult: 1.3, cooldownMs: 500 },
  // ⊕ birth-exclusive (Fluid-born). The one passive that FEEDS you: canon has it drawing water from
  // the air over time. Free AND always-on since 08-26, so it now LIFTS ordinary regen instead of
  // replacing it — the first time this number has ever reached the game (see `regenMult`).
  'moisture-gathering': { archetype: 'stance', regenMult: 1.6, cooldownMs: 500 },
  // Pays in FOOTING, not mana — canon's "binds your footing", and Alex named it one of the one or two
  // passives that change how the player moves. Deepened 0.85 → 0.7 the day it became the whole cost:
  // at 0.85 the drawback was inside the noise floor of ordinary movement, so it was a cost on paper only.
  'iron-skin': { archetype: 'stance', resist: 0.45, moveMult: 0.7, cooldownMs: 500 },
  // Canon-blocked, and canon says so itself — see the `needs` now carried in `keeper-moves.ts`.
  'bind-mastery': { archetype: 'unbuilt', why: 'canon: gatecraft + manatech, a scholar\'s mastery — the world has no manatech' },
  'herbal-knowledge': { archetype: 'unbuilt', why: 'out-of-combat medicine; no combat behaviour' },

  // ── ★ THE CONTACT-PUNISH SHELLS, and why three ship and one does not (the Great Registration) ──
  // Canon writes four passives that hurt whoever touches you. The sim has no retaliation hook: a
  // stance carries resist / moveMult / castMult / manaPerSec, and nothing that damages an attacker
  // back. So the line is drawn on canon's own NOUN. Molten Shell, Storm Cloak and Ice Armor are each
  // a *shell* first ("a barrier that punishes contact", "a protective shell", "a crystalline shell")
  // — they ship as shells, and their burn-back is the half still owed. Flame Cloak is retaliation
  // ONLY, an aura with no shell underneath, so shipping it as a stance would be a stance that does
  // nothing its canon line describes. It stays unbuilt and names the hook.
  //
  // ⚠ ONE hook (damage-taken → damage the attacker) finishes all four at once. Until then these three
  // are deliberately incomplete rather than deliberately absent, and they differ on the axes that DO
  // exist: Molten Shell is the heaviest and slowest, Storm Cloak the lightest, Ice Armor the middle.
  'molten-shell': { archetype: 'stance', resist: 0.5, moveMult: 0.8, cooldownMs: 500 },
  'storm-cloak': { archetype: 'stance', resist: 0.3, cooldownMs: 500 },
  'ice-armor': { archetype: 'stance', resist: 0.42, moveMult: 0.95, cooldownMs: 500 },
  // ★★★ BUILT 2026-08-31. Its reason read *'needs a contact-retaliation hook'*, and the hook had
  // already arrived: `hollowStrike` returns a `HollowHit` at the moment a body lands on the keeper.
  // Found by the unbuilt-premise audit, not by anyone remembering — which is the whole argument for
  // `unbuilt-premise.test.ts` existing.
  //
  // ⚠ NO `resist`, ON PURPOSE, AND THE OLD REASON'S SECOND HALF IS WHY: *'it is aura only, with no
  // shell to fall back on.'* That was never a blocker, it is the move's IDENTITY. Molten Shell is a
  // BARRIER canon calls *'draining to maintain'* and it carries resist 0.5; Flame Cloak is skin. It
  // buys nothing defensively and answers only what actually touches you — so wearing it instead of a
  // shell is a real trade rather than a strictly better one.
  //
  // Free to hold, like the other non-shell passives: canon states no cost, and the drain is the
  // shell pair's (see `regenMult`). Its cost is the defence it does not give you.
  'flame-cloak': { archetype: 'stance', cloakBurn: CLOAK_BURN, cloakRebuild: CLOAK_REBUILD, cooldownMs: 500 },
  // ★★★ BUILT 2026-08-31, AND THE INTERESTING PART IS WHY IT WAS UNBUILT UNTIL TODAY. Its reason
  // read *"needs a perception layer — enemy positions surfaced to the HUD"*, and that was true the
  // day it was written: there was nothing in the world to perceive. There is now. The voxel world
  // runs real-time bodies with positions, hp and a hunt (`voxel3d/hollows.ts`), and `supports`
  // already declares every archetype. ⚠ THE BLOCKER LIFTED AND THE NOTE DID NOT, which is this
  // house's most expensive recurring bug — an accurate sentence that quietly expires and keeps
  // being believed. The guard against a repeat is in `tremor-sense.test.ts`: it asserts the move is
  // BUILT while a hunting body exists, so the claim cannot rot in the other direction either.
  //
  // ── FREE, AND THAT IS A READING OF CANON RATHER THAN A BALANCE CALL ─────────
  // `runes.md:557` states no cost. The shell pair is where canon put the drain (see `regenMult`), so
  // inventing a mana ebb here would be writing a canon cost from the build side. It pays the way
  // Flame Manipulation pays: it doesn't. What limits it is what canon BOUND it to — the ground.
  //
  // ── THE RADIUS IS DERIVED, NOT PICKED ──────────────────────────────────────
  // `SENSE_RADIUS` is `hollows.PLAYER_EXCLUSION` — the ring inside which the night is forbidden to
  // form a body. Making the sense exactly that wide means a pack is felt in the same instant it is
  // allowed to exist, which is canon's *"ambush becomes impossible"* stated in the world's own
  // numbers instead of in mine. `tremor-sense.test.ts` asserts the two are equal, so if the night's
  // exclusion is ever retuned this number moves with it or the suite goes red.
  'tremor-sense': { archetype: 'stance', senseRadius: SENSE_RADIUS, cooldownMs: 500 },

  // ── Tacticals ────────────────────────────────────────────────────────────────────────────────
  'static-burst': { archetype: 'surge', manaCost: 10, cooldownMs: 4500, surgeSecs: 2.5, surgeMult: 1.7 },
  // "A wall of flame thrown BETWEEN you and a threat — escape, area-denial, cover." All three verbs
  // are in the canon line, so it burns what stands in it AND eats shots crossing it.
  firewall:  { archetype: 'field', manaCost: 18, cooldownMs: 7000, castRange: 9, areaSize: 3.2, areaSecs: 6, fieldDps: 12, fieldStopsShots: true },
  // "Sheathes a weapon or strike in fire — melee ENHANCEMENT." The only cast that makes the gun
  // better rather than doing something the gun can't: an infusion window, not a new attack.
  'flame-infusion': { archetype: 'infusion', manaCost: 14, cooldownMs: 8000, surgeSecs: 6, surgeMult: 1.5 },
  mend:      { archetype: 'restore', manaCost: 22, cooldownMs: 6000, heal: 35 },
  'ice-dart': { archetype: 'projectile', manaCost: 7, cooldownMs: 650, damage: 18, projSpeed: 52, projLife: 1.4 },
  // "A flash-bang, not a blade" — it takes aim away, never HP. Wide radius, short, no damage.
  enlighten: { archetype: 'status', manaCost: 12, cooldownMs: 9000, castRange: 11, areaSize: 6, areaSecs: 3.5, statuses: ['blinded'] },
  // "Terrain you impose. Close the gap, do not chase." A short-lived barricade across your sightline.
  stonewall: { archetype: 'terrain', manaCost: 16, cooldownMs: 8000, castRange: 7, areaSize: 5, areaSecs: 10, shape: 'wall', shapeHeight: 2 },
  // "Clamp a foe in iron, OR jam a manalic weapon mid-draw" — canon names both, so it does both.
  shackle:   { archetype: 'status', manaCost: 15, cooldownMs: 10000, castRange: 10, areaSize: 3, areaSecs: 3, statuses: ['rooted', 'disarmed'] },
  // "Grow living wood into structure — Barrier used to SHAPE, not to defend." Small, and the one
  // that LASTS: it is architecture, not a barricade.
  'living-architecture': { archetype: 'terrain', manaCost: 20, cooldownMs: 12000, castRange: 6, areaSize: 3, areaSecs: 45, shape: 'block', shapeHeight: 3 },

  // ── The Great Registration's tacticals (2026-08-13) ──────────────────────────────────────────
  // Each one is classified off the VERB in its canon line, not off its element: "a cutting stream" is
  // a projectile, "fill a space with blinding white" is a status, "terrain that did not exist a second
  // ago" is terrain. Where the verb has no hook in the sim it is unbuilt and says which hook.
  'tidal-arms': { archetype: 'projectile', manaCost: 8, cooldownMs: 900, damage: 16, projSpeed: 40, projLife: 0.9 },
  'flash-freeze': { archetype: 'terrain', manaCost: 15, cooldownMs: 7000, castRange: 8, areaSize: 4, areaSecs: 8, shape: 'wall', shapeHeight: 2 },
  // "Pure focus, no combination... a needle of water harder than steel." Hydro's ONE keeper move, and
  // the starter a Hydro-born keeper now gets — so it has to feel like the rune: fast, thin, punishing.
  'pressure-lance': { archetype: 'projectile', manaCost: 12, cooldownMs: 1100, damage: 30, projSpeed: 85, projLife: 1.6 },
  // "Fill a space with blinding white" — obscurement, no damage. The widest, longest blind in the book.
  'fog-bank': { archetype: 'status', manaCost: 18, cooldownMs: 12000, castRange: 10, areaSize: 8, areaSecs: 8, statuses: ['blinded'] },
  // "No visible flood, just a thin film and no breath." Canon aims it at ONE face; the sim's smallest
  // radius is the closest honest reading, so it is a tight, nasty area rather than a true single target.
  'drowning-grasp': { archetype: 'field', manaCost: 16, cooldownMs: 9000, castRange: 9, areaSize: 2, areaSecs: 4, fieldDps: 18 },
  // "Fused to bedrock" — the one conjured wall that LASTS, because canon anchors it. ⚠ The bridges and
  // ramps half is not here: conjured collision is binary, so this raises a wall you cannot walk on.
  'glacial-path': { archetype: 'terrain', manaCost: 14, cooldownMs: 6500, castRange: 9, areaSize: 6, areaSecs: 20, shape: 'wall', shapeHeight: 2 },
  // "They sink into molten rock while you walk on solid footing" — the ground takes their feet, so it
  // is a root that costs them nothing else. Rooted, never damage: canon's verb is sinking, not burning.
  'lava-stride': { archetype: 'status', manaCost: 17, cooldownMs: 10000, castRange: 8, areaSize: 4, areaSecs: 3.5, statuses: ['rooted'] },
  // "The fire appears THERE rather than travelling to it" — so it is NOT a projectile. The longest
  // cast range in the book, the shortest burn: ignition delivered, not a fire tended.
  flashpoint: { archetype: 'field', manaCost: 15, cooldownMs: 5000, castRange: 14, areaSize: 2.2, areaSecs: 2, fieldDps: 26 },
  'forge-fist': { archetype: 'infusion', manaCost: 16, cooldownMs: 9000, surgeSecs: 6, surgeMult: 1.7 },
  'heat-mirage': { archetype: 'unbuilt', why: 'needs a self-centred status — enemies mis-aim at the CASTER, not at a placed point' },
  // "Slower than fire but it pierces barriers." Slowest projectile, hardest hit.
  'volcano-spike': { archetype: 'projectile', manaCost: 14, cooldownMs: 1400, damage: 34, projSpeed: 34, projLife: 2 },
  'ember-trail': { archetype: 'unbuilt', why: "needs fields spawned along the caster's PATH — every field today lands at the aim point" },
  'crystal-barrage': { archetype: 'projectile', manaCost: 11, cooldownMs: 800, damage: 20, projSpeed: 46, projLife: 1.5 },
  'grindstone': { archetype: 'field', manaCost: 17, cooldownMs: 8000, castRange: 8, areaSize: 3, areaSecs: 7, fieldDps: 15 },
  'dust-lung': { archetype: 'field', manaCost: 13, cooldownMs: 8000, castRange: 10, areaSize: 2.5, areaSecs: 6, fieldDps: 11 },
  'quake-step': { archetype: 'status', manaCost: 14, cooldownMs: 8000, castRange: 6, areaSize: 5, areaSecs: 2.5, statuses: ['rooted'] },
  // "Every fragment carries an electric bite" — fragmentation IS the chain the sim already has, just
  // at a short hop instead of Chain Lightning's long one. Same field, different reach.
  'shard-grenade': { archetype: 'projectile', manaCost: 13, cooldownMs: 1600, damage: 22, projSpeed: 38, projLife: 1.8, chain: 3, chainRange: 4 },
  // Canon says it "scours AND blinds" and only ONE of those has a home: a field carries damage, a
  // status carries the blind, and no field carries statuses today. Shipping the scour keeps it
  // distinct from Fog Bank (which is the pure blind) instead of making two identical blind clouds.
  // ⚠ One hook (a field applying statuses on tick, as terrain already does at cast) finishes it.
  'sandstorm-veil': { archetype: 'field', manaCost: 16, cooldownMs: 11000, castRange: 9, areaSize: 5, areaSecs: 6, fieldDps: 13 },
  // ── ★ SYSTEM 4: THE SKIRMISHER VERBS (2026-08-15) ───────────────────────────────────────────
  // The 08-14 Apex cross-reference measured the table at **1 mobility cast in 47** and found canon
  // had already written the whole missing role — these three plus Gate, all registered, all unbuilt.
  // Nothing here is a new name, effect or rune requirement, so none of it needed a canon ruling;
  // the moves existed and the engine did not.
  //
  // ⚠ EACH IS BUILT AGAINST ITS OWN CANON LINE, NOT AGAINST ONE SHARED "DASH". `game/moves.md`
  // describes three different motions and flattening them into one launch with different numbers is
  // exactly the mistake the cross-reference caught ("I picked the mechanism on the shelf over the
  // one in the sentence").
  //
  // ★ OVERCHARGE IS HORIZONTAL, AND IT IS THE ONE THAT MUST NOT BECOME A SPEED BUFF. Canon: *"charge
  // built through movement and released as propulsion — NOT AN ATTACK, A LAUNCH, with the body as
  // the projectile."* The old `why` on this row already said it: a speed multiplier is Static Burst
  // by another name. So it hands the walker real velocity and lets ballistics finish — you commit to
  // a direction and ride it, which is what makes it a decision rather than a held button.
  // ⚠ Kael's signature and Scatter-locked in canon; the rune gate lives in keeper-moves, not here.
  'overcharge': { archetype: 'impulse', motion: 'launch', manaCost: 16, cooldownMs: 9000,
                  impulseFwd: 17, impulseUp: 4.2 },
  // Breeze's one solo keeper move, so it is a Breeze-born keeper's whole opening kit: cheapest cast
  // in the book, near-instant, invisible.
  'gale-cutter': { archetype: 'projectile', manaCost: 6, cooldownMs: 600, damage: 17, projSpeed: 78, projLife: 1.1 },
  // ★ UPDRAFT IS VERTICAL AND BARELY MOVES YOU SIDEWAYS. Canon: *"wind against earth to launch
  // debris, allies or yourself… masters build vertical highways — HIGH GROUND ON DEMAND."* So the
  // forward component is a nudge, not a leap: the whole point is that it answers a wall rather than
  // crossing a field, which is the axis Overcharge already owns. JUMP_V0 is 7.4 for ~1.24 blocks;
  // 13.5 clears roughly four, so a keeper reaches a roof and not the skybox.
  'updraft': { archetype: 'impulse', motion: 'launch', manaCost: 12, cooldownMs: 8000,
               impulseFwd: 2.5, impulseUp: 13.5 },
  // ★ THUNDER STEP IS A BLINK, NOT A FAST LAUNCH. Canon: *"vanish into vapor, return on a crack of
  // lightning."* A launch that merely travelled quickly would be Overcharge with a shorter cooldown;
  // vanishing means the distance between is never crossed — no ballistics, no wall to clip, and it
  // goes exactly as far as the reticle says. Shorter range than Overcharge's ride on purpose: it is
  // precise where the other is committed.
  'thunder-step': { archetype: 'impulse', motion: 'blink', manaCost: 14, cooldownMs: 7000,
                    castRange: 12 },
  // "Distance barely matters." Fastest and hardest-hitting bolt, on the longest fuse.
  'bolt-snipe': { archetype: 'projectile', manaCost: 16, cooldownMs: 2200, damage: 40, projSpeed: 120, projLife: 2.4 },
  // "Muscles twitch, manatech sputters. DISABLING, NOT LETHAL" — canon forbids damage here. Same pair
  // as Shackle, but thrown wide and held long instead of clamped on one target.
  'static-field': { archetype: 'status', manaCost: 15, cooldownMs: 10000, castRange: 9, areaSize: 4.5, areaSecs: 5, statuses: ['rooted', 'disarmed'] },
  'pressure-drop': { archetype: 'field', manaCost: 19, cooldownMs: 10000, castRange: 10, areaSize: 5, areaSecs: 6, fieldDps: 14 },

  // ── The doubled-focus seven (canon 2026-08-15, built 2026-08-17) ─────────────────────────────
  // ★ QUICKFORM IS THE ONE THAT MATTERS AND IT IS THE CHEAPEST THING IN THIS FILE. Manalic was the
  // last rune with an empty book, so this entry is the difference between a Manalic keeper having a
  // cast layer and having a menu of nothing. Canon: *"brittle and short-lived, but it exists a breath
  // after you decide it should… masters build the bridge they are already running across."* Every
  // number below is that sentence: least mana, shortest fuse, smallest and shortest-lived terrain in
  // the game. Stonewall is the considered barricade; this is the plank you throw down mid-stride.
  quickform: { archetype: 'terrain', manaCost: 8, cooldownMs: 3000, castRange: 6, areaSize: 2.6, areaSecs: 4, shape: 'wall', shapeHeight: 2 },
  // ⚠ UNBUILT, AND NOT FOR WANT OF A SYSTEM — for want of the RIGHT one. A waymark is a place bound
  // *"until you feel it like a limb"*, and canon ruled it the craft behind Gregory's passage business
  // (`moves.md`: what Greg sells is a waymark). The build already HAS waymarks — `voxel/waymark.ts`,
  // placed blocks with their own persistence. Realising this as a combat slot would ship the name on
  // top of something that is not it; realising it properly is the *"develop Enchant → cast your own
  // Waymark → outgrow Greg"* arc, which is a feature, not a number. Same call as `gate`.
  // ⚠ CORRECTED 2026-08-31 — the old reason said it *"wants voxel/waymark.ts and the passage arc"*.
  // Both now exist (`voxel/waymark.ts` ships `Waymark`/`WaymarkNet` and VoxelWorld imports them), so
  // the sentence named a hook that had already arrived. **The surviving half is the DESIGN half and
  // it is unchanged:** binding a place is not a thing you put in a cast slot and press. Rewritten to
  // the reason that is still true rather than deleted, because the move is still correctly unbuilt.
  waymark:   { archetype: 'unbuilt', why: 'a place-binding, not a combat cast — it belongs to the passage arc, never a slot' },
  // "Splitting ONCE when it finds a second… the floor Chain Lightning is the ceiling of." So it is
  // literally the ultimate with `chain` turned down to one and the price turned down with it: a
  // tactical you throw constantly, against an ultimate you spend a pool on.
  'forked-bolt': { archetype: 'projectile', manaCost: 12, cooldownMs: 900, damage: 19, projSpeed: 72, projLife: 1.2, chain: 1, chainRange: 6 },
  // "It does not aim, which is the point: you spoil a space rather than strike into it. Feeds on the
  // caster's temper and BURNS MANA FAST." So: the widest field in the game, the lowest damage in it,
  // and the highest cost of any tactical. A Squall that hurt would be a worse Firewall.
  squall:    { archetype: 'field', manaCost: 24, cooldownMs: 9000, castRange: 10, areaSize: 6.5, areaSecs: 5, fieldDps: 9, fieldStopsShots: false },
  // "One shard, no spread — it pierces where a thrown stone would only break." The fastest and hardest
  // single bolt a tactical gets; Gale Cutter is cheaper and quicker, Crystal Barrage throws more.
  // Paying for one perfect shard is the Gem keeper's whole posture.
  keenshard: { archetype: 'projectile', manaCost: 9, cooldownMs: 900, damage: 24, projSpeed: 84, projLife: 1.3 },
  // ⚠ UNBUILT ON PURPOSE, AND THE `why` NAMES THE MISSING VERB. Meltbore is a CHANNEL held on one
  // spot *"until the spot stops existing"* — the breach move, whose point is opening what refuses to
  // open. The cast layer can RAISE terrain (conjured-terrain) and has no way to open any; and there
  // is no held-cast verb, so the honest realisations are both lies: a field is "set it and walk away"
  // and a projectile is "a hot bolt". Either would ship the name on the wrong mechanic — which is the
  // one thing this file's `unbuilt` tag exists to refuse.
  // ⚠ HALF ITS BLOCKER LIFTED 2026-08-31 and the reason was narrowed the same hour rather than left
  // to rot — which is the failure mode this whole roster was audited for. `sustain.ts` now gives the
  // sim a held channel that bills by the second, so the first half of the old reason ("no sustained
  // cast") is retired. The BREACH half stands: `moves.md:82` — *"held against one spot until the
  // spot stops existing"* — and nothing in either world lets a cast open terrain.
  // ⚠ SECOND NARROWING IN ONE DAY, and the reason is worth reading because the move is now one step
  // from built. BOTH mechanisms it named exist: `sustain.ts` holds a channel and bills by the second,
  // `breach.ts` spends those seconds against a block's hardness and ignores the TOOL gates the way
  // canon's *"nothing refuses it forever"* requires. What is missing is neither of them — it is that
  // **no host holds a key down for a cast**. Every cast in both worlds is edge-triggered on a press;
  // a channel needs a press, a hold and a release, which is a new INPUT path rather than a new rule.
  // ★ Left unbuilt deliberately: marking it built with no host is exactly the silent no-op this
  // file's honesty rule exists to forbid, and the temptation is strongest when the hard part is done.
  // ✅ BUILT 2026-08-31 (hub) — THE THIRD NARROWING WAS THE LAST ONE. The reason above expired
  // exactly the way this file's honesty rule wants a reason to expire: it named ONE missing thing,
  // that thing was built, and the premise guard went red the moment `VoxelWorld.tsx` called
  // `sustainStep(` — it did not have to be remembered. Nothing here was widened to fit.
  //
  // ★ THE MAGNITUDES ARE JIN'S, THE SHAPE IS CANON'S, and they are sized against real numbers
  // rather than picked: stone is hardness 1.6, so at `BORE_PATIENCE` 1.6 a bore costs 2.56s of
  // channel; deep stone 3.84s; the hardest block in the registry 10.4s. A fresh keeper's pool is
  // 100 at 1.0/s regen (`engine/mana.ts`), so at 8/s the whole pool buys 12.5 seconds — enough for
  // one hard block and not two. That IS canon's *"burns mana fast"* (runes.md:85) meeting *"slow,
  // undramatic ... the reason a Magma mage is patient"* (moves.md:82) in one pair of numbers.
  //
  // ⚠ `manaCost` IS THE PRESS AND `sustainDrain` IS THE HOLD — the two are not alternatives, and
  // `sustain.ts` is emphatic about why: a channel that charged its whole price up front would be a
  // normal cast with a long animation. The press is deliberately cheap (4) because the press buys
  // nothing on its own; every block this move opens is bought by the seconds after it.
  meltbore:  { archetype: 'channel', manaCost: 4, cooldownMs: 3000, sustainDrain: 8 },
  // "Sight goes soft, edges stop agreeing on where they are. Confrontation DECLINED rather than won."
  // ⚠ It lands on `blinded` — the same option Enlighten removes — and that is not the two converging:
  // the sim's three statuses are what a move can take, and both of these take sight. The geometry is
  // where they part. Enlighten is a flash thrown FAR at a point (range 11, size 6, 3.5s); Hush is a
  // bank of vapor you pull over the ground around you (range 10, size 8, 4s) so you can leave.
  // Blinding everyone nearby IS concealment realised, with no concealment status to model it.
  hush:      { archetype: 'status', manaCost: 14, cooldownMs: 10000, castRange: 10, areaSize: 8, areaSecs: 4, statuses: ['blinded'] },
  // ── Barrier's doubled focus (canon 2026-09-02, built the same day) ─────────────────────────
  // "Paid at the cast and then it holds itself: it does not drain you, does not follow you." So it
  // is a PLACED field, never a stance — the passives own the held shell and its drain. "A novice
  // covers one door for a few breaths": door-sized, a handful of seconds, cheaper than Firewall
  // because it carries no fire. It is cover and only cover: `fieldStopsShots` on, `fieldDps` 0 —
  // the first zero-damage field in the file, which is the whole point of a shield you give away.
  // "Gone at the first hard blow" — `fieldHp` 20 (ruled by Alex 2026-09-02, the same evening the row
  // shipped without it): one Keenshard (24) or Forked Bolt (19, nearly) takes the door; a Hollow's
  // light rounds need several. Firewall and Cyclone Cage stay 0 — a round does not shatter fire.
  threshold: { archetype: 'field', manaCost: 14, cooldownMs: 8000, castRange: 6, areaSize: 2.4, areaSecs: 5, fieldDps: 0, fieldStopsShots: true, fieldHp: 20 },

  // ── Ultimates ────────────────────────────────────────────────────────────────────────────────
  'chain-lightning': { archetype: 'projectile', manaCost: 34, cooldownMs: 9000, damage: 26, projSpeed: 70, projLife: 1.2, chain: 3, chainRange: 9 },
  'flame-barrage': { archetype: 'unbuilt', why: 'needs independently tracking projectiles' },
  // ⚠ GATE STAYS UNBUILT AND IS NOT AN IMPULSE. Thunder Step goes where you are LOOKING; a gate is
  // a two-point bind — you place an anchor, leave, and return to it later. That is a persistent
  // placed entity with its own lifetime, closer to conjured terrain than to a blink, and folding it
  // in here would have shipped it as 'a blink with extra words'. Its `why` is unchanged on purpose.
  gate:      { archetype: 'unbuilt', why: 'needs a two-point bind + warp on a placed anchor' },
  // "A living sanctuary grown and tended — everyone within is steadily restored." Wide, long, and
  // NOT cover: a grove you can shoot through is a place you choose to stand, not a place to hide.
  'healing-grove': { archetype: 'field', manaCost: 40, cooldownMs: 22000, castRange: 7, areaSize: 5.5, areaSecs: 14, fieldHps: 14, fieldStopsShots: false },
  // "Stone rises on EVERY side and all metal locks to the caster. Containment, not a kill." A sealed
  // ring — it traps you too if you stand in it, which is what makes casting it a real decision.
  // Cordon is the one move that is BOTH systems at once — canon writes stone AND the metal lock in a
  // single sentence, so the dispatcher applies a terrain cast's `statuses` too when it carries any.
  cordon:    { archetype: 'terrain', manaCost: 45, cooldownMs: 25000, castRange: 10, areaSize: 4, areaSecs: 8, shape: 'ring', shapeHeight: 3, statuses: ['disarmed'] },
  'grey-arena': { archetype: 'unbuilt', why: 'canon requires manatech (a drain-engine) the player has no access to' },
  // ⚠ UNBUILT ON PURPOSE, AND NOT FOR WANT OF EFFORT. Canon's mechanic is a shell that BANKS what
  // it stops and pays it back out as more shell — "a defence funded by the attack on it". None of
  // the ten archetypes expresses absorb-and-convert: a 'field' that stops shots would be a plain
  // bubble, which is precisely the "shipped it as a blink with extra words" mistake the `gate` note
  // above warns about. Registered, labelled, never a silent no-op.
  // ⚠ CORRECTED 2026-08-31 — the old reason said it needed *"a damage-to-shield bank"*, and one
  // exists: `engine/vitals.ts` carries shields with a ruled damage ORDER (resist → shield → spill).
  // What is actually missing is narrower and worth naming precisely, because the wide version reads
  // as a much bigger job than it is: the shield must MEND ITSELF out of what it absorbs, and nothing
  // feeds absorbed damage back into the pool.
  overpressure: { archetype: 'unbuilt', why: 'the shield bank exists; nothing feeds ABSORBED damage back into it — the layer cannot yet mend itself out of what it stops' },

  // ── The Great Registration's ultimates (2026-08-13) ──────────────────────────────────────────
  // "Samantha's signature" — the biggest heal in the book, and the first ultimate a Water keeper can
  // reach at all (Fluid had none before this pass).
  'healing-stream': { archetype: 'restore', manaCost: 36, cooldownMs: 16000, heal: 60 },
  // "Not healing, CONTROL: their blood answers to you." Locked joints = rooted + disarmed, no damage —
  // canon is explicit that the horror is the control, not the wound.
  'vein-puppet': { archetype: 'status', manaCost: 38, cooldownMs: 20000, castRange: 10, areaSize: 3.5, areaSecs: 5, statuses: ['rooted', 'disarmed'] },
  // "Takes one side of a street and leaves the other untouched" — wide and hot, and NOT cover: an
  // inferno you can shoot through is a place you deny, not a place you hide.
  'firestorm': { archetype: 'field', manaCost: 44, cooldownMs: 24000, castRange: 12, areaSize: 7, areaSecs: 10, fieldDps: 22, fieldStopsShots: false },
  // "Shredding within, UNREACHABLE FROM WITHOUT" — the only damaging field that also eats shots, which
  // is what makes it containment rather than a bigger Firestorm.
  'cyclone-cage': { archetype: 'field', manaCost: 42, cooldownMs: 24000, castRange: 10, areaSize: 5, areaSecs: 9, fieldDps: 18, fieldStopsShots: true },
  // "Sealed on all six faces" — a solid block, deliberately. This one BURIES where Cordon contains,
  // and it is Stone's own ultimate, needing no second rune.
  'pillar-tomb': { archetype: 'terrain', manaCost: 38, cooldownMs: 20000, castRange: 9, areaSize: 3, areaSecs: 12, shape: 'block', shapeHeight: 4 },
  // "Not a shield, A BUILDING... the answer to 'protect everyone'" — so a RING, not a block: walls with
  // an inside, because a solid lump protects nobody. The longest-lived cast in the book.
  'living-fortress': { archetype: 'terrain', manaCost: 48, cooldownMs: 30000, castRange: 7, areaSize: 5, areaSecs: 60, shape: 'ring', shapeHeight: 4 },
  // The green answer to Cyclone Cage's teeth. Registered though no keeper can reach it: canon needs
  // Vapor, a Scatter rune the birth screen does not offer — the emptiness IS the canon (runes.data.ts).
  'monsoon-veil': { archetype: 'field', manaCost: 46, cooldownMs: 26000, castRange: 8, areaSize: 7, areaSecs: 16, fieldHps: 16, fieldStopsShots: false },

  // ── Combos — never solo-castable. Canon requires a second mage in sync. ──────────────────────
  counterpoint: { archetype: 'unbuilt', why: 'needs a second same-frequency mage running Barrier' },
  vaporscreen:  { archetype: 'unbuilt', why: 'needs a second mage supplying the other rune' },
}

const MOVE_BY_ID = new Map<string, KeeperMove>(KEEPER_MOVES.map((m) => [m.id, m]))

export const NO_CAST: CastSpec = { ...BASE, moveId: '', label: '', tier: 'tactical', archetype: 'unbuilt', why: 'empty slot' }

/** Resolve a move id to its cast spec. Unknown id → an empty spec (never throws in the frame loop). */
export function castForMove(moveId: string | null | undefined): CastSpec {
  if (!moveId) return NO_CAST
  const move = MOVE_BY_ID.get(moveId)
  const build = BUILDS[moveId]
  if (!move || !build) return { ...NO_CAST, moveId: moveId ?? '', label: move?.name ?? moveId, why: 'no build spec' }
  return { ...BASE, ...build, moveId, label: move.name, tier: move.tier }
}

/** Does the sim actually do something with this move today? */
export function isBuilt(moveId: string | null | undefined): boolean {
  return castForMove(moveId).archetype !== 'unbuilt'
}

// ── The loadout ────────────────────────────────────────────────────────────────
//
// The slots ARE canon's tiers — the loadout is typed, not N interchangeable holes, and the input maps
// to canon's own vocabulary (a held stance behaves nothing like a signature).
//
// ── ⚠ CORRECTED 2026-08-25 (play lane): THIS BLOCK CITED THE WRONG KIND OF NUMBER ──────────────
// It used to read "Shape mirrors the authoring target the canon pass is aimed at: each keeper-reachable
// rune should own 1 passive + 2 tacticals + 1 ultimate. So the slots ARE those tiers." That sentence
// took `moves.md`'s **REGISTRY AUTHORING TARGET** — how many moves each rune should HAVE WRITTEN FOR IT —
// and read it as a **LOADOUT SLOT COUNT**: how many a keeper may EQUIP. They are different questions and
// canon only answers the first. Canon fixes exactly one equip cap, `runes.md:256` **passives ≤ 3**, and
// states no cap on the other two bands; its own cast contradicts a 1-tactical ceiling (Veyra runs
// "Firewall · Flame Infusion", `veyra.md:174`; Samantha "Mend · Ice Dart", `samantha.md:112`) and
// Samantha runs "no ultimate, by choice" (`samantha.md:106`), which is why an empty slot is legal here.
// ★ The correction matters in the direction of FREEDOM: the slot count is JIN'S, tunable at will, and
// nobody has to defend it to canon. The old sentence made a build number look like a canon obligation —
// the same lying-provenance shape this repo keeps filing, one step upstream of a value being wrong.
//
// 'combo' is not a slot kind: canon requires a second mage in sync, so it can never be a solo bind.

export type SlotKind = Exclude<MoveTier, 'combo'>

/**
 * ── THE CAST BAR — what a button press throws (RULED 2026-08-23, collapsed 2026-08-25) ─────────
 *
 * Exactly Tactical + Signature. `moves.md:85` makes *Signature* the Ultimate band, so the mage's four
 * bands are Passives / Tactical / Ultimates / Combos — **passives are not cast and combos are
 * pair-casting, which leaves precisely these two.** The build's original four slots were the drift.
 *
 * ⚠ THIS LIST IS LOAD-BEARING FAR BEYOND THE HUD. `resolveCast()` in `engine/cast-dispatch.ts` is the
 * ONLY writer of `stanceChange` in the build, and a CAST move's only route into the game is a band
 * whose kind matches its tier. So REMOVING A KIND FROM A BAND REMOVES THOSE MOVES — silently, with
 * no error and no fallback. That is why passives are NOT a band: they would have been orphaned by the
 * collapse, so they reach the game a different way — `derivePassive` surfaces the one always-on
 * passive, off the bar entirely. `cast.test.ts` guards both halves by name (no built CAST move is
 * bandless; every built passive is reachable via `derivePassive`); read those asserts before editing.
 */
export const CAST_SLOTS: readonly SlotKind[] = ['tactical', 'ultimate'] as const
/** keyboard bind per cast slot, in slot order. Z throws the tactical; C is the signature. */
export const SLOT_KEYS: readonly string[] = ['z', 'c'] as const

/**
 * ── THE STANCE SOCKETS — what you HOLD, and it is not on the cast bar (RULED 2026-08-25, Alex) ──
 *
 * A held passive is not cast, so it does not belong on a bar whose premise is that it is. It gets its
 * own band, keeping **G** — the key it already had, so nothing a player's hands know changes.
 *
 * ★ WHY THIS BAND EXISTS AT ALL, because the reason is easy to lose. GBOARD step 6 authorised the
 * collapse with *"the passive becomes INNATE, always-on, no key"*, citing the birth-rune block. That
 * block was AMENDED on 2026-08-25: the always-on thing a birth rune grants is the affinity LEAN
 * (`birth-affinity.ts`), and canon's learned/elite/**held** passive band stands exactly as written
 * (`runes.md:253-257`). Nothing in the build makes a learned passive always-on. Dropping its slot
 * would not have made it innate — it would have made it unreachable.
 *
 * ⚠ SIZED 1, AND THE 1 IS JIN'S WHILE THE CEILING IS CANON'S. `runes.md:256` fixes **passives ≤ 3**,
 * the only equip cap canon states anywhere. One socket is a starting number, tunable at will; three is
 * the wall. Widen this array and the HUD, the binds, the migration and the oracles all follow it,
 * because every one of them reads its length rather than assuming it.
 */
/**
 * ── THE PASSIVE IS DERIVED AND ALWAYS-ON, NOT A BOUND SLOT (RULED 2026-08-26, Alex) ────────────
 *
 * A held stance socket shipped 2026-08-25 (G, one slot, `pausesRecovery`). Alex reversed it the next
 * day: the passive is not something you equip, toggle or key — it is a TRAIT the loadout menu shows
 * and explains, always on, capped at one. So there is no passive BAND any more: `ALL_BANDS` is the
 * cast bar alone, and `derivePassive` (below, beside `eligibleMoves`) is how the passive reaches the
 * game instead of a slot. Nothing here is keyed to it — `BAND_KEYS` is the cast keys, full stop.
 *
 * ⚠ `ALL_BANDS` STILL EXISTS AND STILL EQUALS `CAST_SLOTS` ON PURPOSE. Every loadout-positional
 * consumer (the migration, `canSlot`, `setSlot`, `saveLoadout`, both HUDs) reads `ALL_BANDS` for
 * "the bound bands". Keeping the name means those call sites did not have to learn that the passive
 * left; it simply has one fewer entry. The day a second bound band returns, they follow it for free.
 */
export const ALL_BANDS: readonly SlotKind[] = CAST_SLOTS

/** The key for a slot number. Only the cast bar is keyed — the passive is always-on and holds no key. */
export const BAND_KEYS: readonly string[] = SLOT_KEYS


/**
 * ── ★★★ THE LANE LAW — WHICH MOVES YOUR BIRTH RUNE LETS YOU EQUIP (canon 2026-08-03, built 08-26) ──
 *
 * `runes.md` § *What "compatible" MEANS*: a rune is **Element × State**, and a birth rune opens two
 * natural lanes — the same substance behaving differently, and the same behaviour in a different
 * substance. Canon assigns each band to one of them, and Alex CONFIRMED the assignment on review
 * (he floated the reverse in the design pass, then kept canon's):
 *
 *   · **tactical → your ELEMENT lane** — breadth. Storm is 5 runes wide.
 *   · **signature → your STATE lane**  — scarcity, canon's word. 2–3 runes.
 *   · **passive → NO LANE.** Ruled explicitly: passives are reached by TRAINED rune, not birth lane
 *     (`CANON_GAPS.md`, the birth-rune equip-gate entry). A lane filter here would be invention.
 *
 * ⚠ CANON'S OWN TWO FILES DISAGREE ON THE WORDS "ROW" AND "COLUMN" — `runes.md` says *element row /
 * state column* while the gap entry says *"the storm column"* for the same grouping, because the
 * matrix is drawn with elements as headers. The MEANING never wavers (Eyuun walks all three **Bind**
 * runes; Kael goes Static → Lightning across **Storm**), so this code says `element` / `state` and
 * never `row` / `column`. Naming the axis instead of its picture is what stops the two docs' argument
 * from reaching the build.
 */
export type Lane = 'element' | 'state'

/**
 * ⚠ EXHAUSTIVE OVER `MoveTier`, so a new canon tier is a COMPILE ERROR here rather than silently
 * defaulting to unscoped. `null` means "this band has no lane", which is a DECISION for passive and
 * a non-question for trait/combo — and it must stay a stated null, never an absent key.
 */
export const LANE_FOR_KIND: Record<MoveTier, Lane | null> = {
  tactical: 'element',
  ultimate: 'state',
  passive: null,
  trait: null,
  combo: null,
}

/** The runes on one of a birth rune's two lanes. Empty when the keeper has no birth rune. */
export function laneRunes(birth: string | null, lane: Lane): Set<string> {
  const b = RUNES.find((r) => r.id === birth)
  if (!b) return new Set()
  const axis = lane === 'element' ? 'element' : 'state'
  return new Set(RUNES.filter((r) => r[axis] === b[axis]).map((r) => r.id))
}

/**
 * Is this move on the lane its band draws from?
 *
 * ── ★★ EVERY RUNE, NOT ANY RUNE, AND THE DIFFERENCE IS CANON'S OFF-LANE RULE ──────────────────
 * A runeword names more than one rune. `some()` would put **Fog Bank** — mist (water/Expanding) +
 * breeze (storm/Flow), which holds NEITHER axis constant — on a Mist-born keeper's natural lane,
 * while `runes.md` calls exactly that combination **off-lane: "possible, costly, and it must be
 * DRIVEN."** `every()` is the reading that agrees with the paragraph two sections down from the one
 * being implemented. Measured before choosing, not after: `some()` leaves no birth rune short of a
 * signature, which is the comfortable answer, and it gets there by handing out combinations canon
 * says have to be earned.
 *
 * ⚠ A move with NO runes is a trait and never reaches a band; `knownMoves` drops it first.
 */
function onLane(m: KeeperMove, lane: Set<string>): boolean {
  return m.runes.length > 0 && m.runes.every((r) => lane.has(r))
}

/**
 * Moves the keeper can run right now that fit a slot kind. Built ones first — the rest are honest
 * but dead.
 *
 * ── ★ THE BOOK IS REQUIRED, AND IT IS REQUIRED ON PURPOSE (2026-08-13) ────────────────────────
 * This used to ask the runes alone, which quietly asserted that holding a rune teaches you every
 * technique ever written in it. Canon rules the opposite (`game/moves.md` › "How a Move Is
 * OBTAINED"): a rune is identity, a move is somebody's application of it, and the rune is the
 * FILTER on a scroll rather than the source of the move. `scroll-market.ts` has the full argument.
 *
 * The parameter is NOT optional. An optional book would default every un-updated call site back to
 * the old, wrong answer — silently, and only in the places nobody remembered to change. Required
 * means the compiler walks the call sites for me, which is the whole reason to take the churn.
 *
 * ── ★ AND `birth` IS REQUIRED FOR EXACTLY THE SAME REASON (2026-08-26) ────────────────────────
 * The BIRTH-EXCLUSIVE BAND gates who may hold a move (`KeeperMove.birthExclusive`). It is enforced
 * HERE, in the one filter every band passes through, rather than in `derivePassive` — today both
 * members are passives and `derivePassive` would cover them, but Alex ruled the band also carries
 * *"unique hidden tacticals and or signatures"*, and a gate placed where only today's members live
 * is a guard that cannot see its own next member.
 *
 * ⚠ IT IS DELIBERATELY NOT DERIVED FROM `owned[0]`. `rune-inventory.ts` does guarantee
 * `owned[0] === birth`, so reading position would work — and would make an ORDERING contract
 * load-bearing inside a function that otherwise treats `owned` as a SET. Every hand-built array in
 * a test and every call site that filters or concats runes would silently start deciding
 * birth-exclusivity by accident. An explicit null is a keeper with no birth rune, which is a real
 * state (the ritual is unfinished) and correctly holds nothing in the band.
 */
export function eligibleMoves(owned: string[], birth: string | null, kind: SlotKind, book: Book): KeeperMove[] {
  const lane = LANE_FOR_KIND[kind]
  // ⚠ Built ONCE per call, never inside the filter — `laneRunes` walks all 20 runes, and a keeper
  // with a wide book would pay that per move for an answer that cannot change mid-filter.
  const onIt = lane ? laneRunes(birth, lane) : null
  const known = knownMoves(owned).filter(
    (m) =>
      m.tier === kind &&
      hasLearned(book, m.id) &&
      (!m.birthExclusive || m.birthExclusive === birth) &&
      (!onIt || onLane(m, onIt)),
  )
  return [...known].sort((a, b) => Number(isBuilt(b.id)) - Number(isBuilt(a.id)))
}

/**
 * The one passive a keeper runs, always-on — or null if their runes have taught them none.
 *
 * ★ DERIVED, CAPPED AT ONE, NEVER CHOSEN (RULED 2026-08-26, Alex). The passive is not a bound slot;
 * it is a trait the loadout menu surfaces and explains. This is where it comes from: the first
 * passive the keeper's runes make eligible, built ones first — the exact ordering `eligibleMoves`
 * already gives, so a built passive wins over an honest-but-dead one, and the pick is stable.
 *
 * Canon (`runes.md:256`, "most run 0-1") makes one the common case. The `[0]` is the cap; widen it
 * to `.slice(0, N)` if canon's ≤3 ceiling ever opens, and the menu readout follows because it reads
 * this, not a literal. Requires the book for the same reason `eligibleMoves` does — a rune is
 * identity, a move is learned.
 */
export function derivePassive(owned: string[], birth: string | null, book: Book): KeeperMove | null {
  return eligibleMoves(owned, birth, 'passive', book)[0] ?? null
}

/**
 * The loadout a keeper starts with: the first ELIGIBLE move per slot, preferring ones the sim can
 * actually run, and never the same move twice. Slots with nothing to put in them stay null — an
 * empty ultimate slot is the coverage gap rendered, not a bug.
 */
export function defaultLoadout(owned: string[], birth: string | null, book: Book): (string | null)[] {
  const used = new Set<string>()
  return ALL_BANDS.map((kind) => {
    const pick = eligibleMoves(owned, birth, kind, book).find((m) => !used.has(m.id))
    if (pick) used.add(pick.id)
    return pick?.id ?? null
  })
}

/**
 * Legal in this slot? The tier must match, you must own its runes, AND you must have learned it.
 *
 * ⚠ Indexed over `ALL_BANDS`, not `CAST_SLOTS` — a stored loadout spans the cast bar AND the stance
 * sockets in one positional array, so a slot number past the cast bar is a stance socket, not an
 * out-of-range read. Narrowing this back to `CAST_SLOTS` silently makes every stance bind illegal.
 */
export function canSlot(owned: string[], birth: string | null, slot: number, moveId: string, book: Book): boolean {
  const kind = ALL_BANDS[slot]
  if (!kind) return false
  return eligibleMoves(owned, birth, kind, book).some((m) => m.id === moveId)
}
