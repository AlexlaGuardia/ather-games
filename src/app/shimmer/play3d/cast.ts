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
import { hasLearned, type Book } from './scroll-market'
import type { ConjureShape } from '../engine/conjured-terrain'
import type { StatusKind } from '../engine/statuses'

/** The archetypes the sim can actually run today, plus the honest 'unbuilt' tag. */
export type CastArchetype =
  | 'projectile'  // a travelling bolt: damage on contact (chains if `chain` > 0)
  | 'restore'     // instant self-heal
  | 'stance'      // a HELD passive — toggled on, pauses mana recovery while up (runes.md economy)
  | 'surge'       // a short self-buff burst (speed / evasion)
  | 'field'       // SYSTEM 1 — a persistent area entity placed at the aim point (field-effects.ts)
  | 'terrain'     // SYSTEM 2 — runtime terrain raised at the aim point (conjured-terrain.ts)
  | 'status'      // SYSTEM 3 — removes an OPTION from every enemy near the aim point (statuses.ts)
  | 'impulse'     // SYSTEM 4 — the cast moves the KEEPER: a launch or a blink (locomotion.ts)
  | 'infusion'    // a timed multiplier on the WEAPON, not the cast (Flame Infusion)
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
  /** movement multiplier while held (Iron Skin refuses to move under a hit) */
  moveMult: number
  /** cast damage multiplier while held (Flame Manipulation shapes fire by instinct) */
  castMult: number
  /** mana per second the stance itself produces — the one thing that survives the recovery pause */
  manaPerSec: number
  /** canon: holding a passive PAUSES mana recovery. The double edge that makes it a stance. */
  pausesRecovery: boolean
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
  /** why this move has no sim behaviour yet — only set on 'unbuilt' */
  why?: string
}

const BASE: Omit<CastSpec, 'moveId' | 'label' | 'tier' | 'archetype'> = {
  manaCost: 0, cooldownMs: 0,
  damage: 0, projSpeed: 0, projLife: 0, chain: 0, chainRange: 0,
  heal: 0,
  resist: 0, moveMult: 1, castMult: 1, manaPerSec: 0, pausesRecovery: false,
  surgeSecs: 0, surgeMult: 1,
  castRange: 0, areaSize: 0, areaSecs: 0,
  fieldDps: 0, fieldHps: 0, fieldStopsShots: false,
  shape: 'wall', shapeHeight: 1, statuses: [],
  motion: 'launch', impulseFwd: 0, impulseUp: 0,
}

/** per-move build spec, keyed by keeper-moves id. Numbers are Jin's and free to tune. */
type Build = Partial<CastSpec> & { archetype: CastArchetype }

const BUILDS: Record<string, Build> = {
  // ── Passives → stances. Held; each pauses mana recovery (runes.md's mana economy). ────────────
  barrier:   { archetype: 'stance', resist: 0.35, pausesRecovery: true, cooldownMs: 500 },
  bulwark:   { archetype: 'stance', resist: 0.55, moveMult: 0.9, pausesRecovery: true, cooldownMs: 500 },
  'flame-manipulation': { archetype: 'stance', castMult: 1.3, pausesRecovery: true, cooldownMs: 500 },
  // The one stance that FEEDS you: canon has it drawing water from the air over time. It still pauses
  // ordinary recovery (it is a passive) but produces its own slower trickle — held, you gain less than
  // standing idle would give you, which is the honest reading of both lines at once.
  'moisture-gathering': { archetype: 'stance', manaPerSec: 0.8, pausesRecovery: true, cooldownMs: 500 },
  'iron-skin': { archetype: 'stance', resist: 0.45, moveMult: 0.85, pausesRecovery: true, cooldownMs: 500 },
  'bind-mastery': { archetype: 'unbuilt', why: 'gatecraft + manatech — no runtime system yet' },
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
  'molten-shell': { archetype: 'stance', resist: 0.5, moveMult: 0.8, pausesRecovery: true, cooldownMs: 500 },
  'storm-cloak': { archetype: 'stance', resist: 0.3, pausesRecovery: true, cooldownMs: 500 },
  'ice-armor': { archetype: 'stance', resist: 0.42, moveMult: 0.95, pausesRecovery: true, cooldownMs: 500 },
  'flame-cloak': { archetype: 'unbuilt', why: 'needs a contact-retaliation hook — it is aura only, with no shell to fall back on' },
  'tremor-sense': { archetype: 'unbuilt', why: 'needs a perception layer — enemy positions surfaced to the HUD' },

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
  waymark:   { archetype: 'unbuilt', why: 'a place-binding, not a combat cast — it wants voxel/waymark.ts and the passage arc, not a slot' },
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
  meltbore:  { archetype: 'unbuilt', why: 'a held channel that BREACHES — the sim has no sustained cast and nothing that opens terrain' },
  // "Sight goes soft, edges stop agreeing on where they are. Confrontation DECLINED rather than won."
  // ⚠ It lands on `blinded` — the same option Enlighten removes — and that is not the two converging:
  // the sim's three statuses are what a move can take, and both of these take sight. The geometry is
  // where they part. Enlighten is a flash thrown FAR at a point (range 11, size 6, 3.5s); Hush is a
  // bank of vapor you pull over the ground around you (range 10, size 8, 4s) so you can leave.
  // Blinding everyone nearby IS concealment realised, with no concealment status to model it.
  hush:      { archetype: 'status', manaCost: 14, cooldownMs: 10000, castRange: 10, areaSize: 8, areaSecs: 4, statuses: ['blinded'] },

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
export const CAST_SLOTS: readonly SlotKind[] = ['passive', 'tactical', 'tactical', 'ultimate'] as const
/** keyboard bind per slot, in slot order. G holds the stance; Z/X throw tacticals; C is the signature. */
export const SLOT_KEYS: readonly string[] = ['g', 'z', 'x', 'c'] as const

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
 */
export function eligibleMoves(owned: string[], kind: SlotKind, book: Book): KeeperMove[] {
  const known = knownMoves(owned).filter((m) => m.tier === kind && hasLearned(book, m.id))
  return [...known].sort((a, b) => Number(isBuilt(b.id)) - Number(isBuilt(a.id)))
}

/**
 * The loadout a keeper starts with: the first ELIGIBLE move per slot, preferring ones the sim can
 * actually run, and never the same move twice. Slots with nothing to put in them stay null — an
 * empty ultimate slot is the coverage gap rendered, not a bug.
 */
export function defaultLoadout(owned: string[], book: Book): (string | null)[] {
  const used = new Set<string>()
  return CAST_SLOTS.map((kind) => {
    const pick = eligibleMoves(owned, kind, book).find((m) => !used.has(m.id))
    if (pick) used.add(pick.id)
    return pick?.id ?? null
  })
}

/** Legal in this slot? The tier must match, you must own its runes, AND you must have learned it. */
export function canSlot(owned: string[], slot: number, moveId: string, book: Book): boolean {
  const kind = CAST_SLOTS[slot]
  if (!kind) return false
  return eligibleMoves(owned, kind, book).some((m) => m.id === moveId)
}
