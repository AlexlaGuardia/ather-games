// keeper-moves.ts — the KEEPER's move registry + the per-rune book index.
//
// ── ★ THE GREAT REGISTRATION (canon 2026-08-13, adopted here 2026-08-14): 24 → 61 ───────────────
// `runes.md` Part III had carried 40 named School techniques WITH full effect text all along, and a
// machine diff found exactly 2 of them registered in `moves.md`. Magii registered the missing 37;
// this file now ships them. Nothing here was invented — every name, rune requirement and tier below
// is a transcription, and `npm run canon` was the worklist.
//
// The lesson is the one the canon session wrote down four times in a row: **the drift is never in
// what the world says, it is in WHERE the world says it.** Nothing was unwritten. It was unplaced.
//
// ── THE LAW ────────────────────────────────────────────────────────────────────
// CANON/game/moves.md is the ONE registry (ruled 2026-07-22) — mages and spirits draw from the
// same list; a move is registered ONCE, caster-agnostic (name + runes + effect). This file is the
// keeper-side transcription of it, the sibling of engine/moves.ts (which holds the spirit battle
// kits off the same registry). Names here are canon and are NOT Jin's to edit or invent.
// **A new move registers in moves.md FIRST, then lands here.**
//
// ★ Colour is never part of a move (moves.md). Colour is the mage's own soul-frequency, applied
//   when they cast it. Nothing in this file carries a colour — that comes from SOUL_COLOR.
//
// ── WHAT'S BUILD-SIDE ──────────────────────────────────────────────────────────
// Ids, tiers-as-data, and the derived indexes are Jin's. Numbers (cost/cooldown/power) are Jin's
// and deliberately absent here — this module is the *catalogue*, not the sim. Wire numbers where
// the cast layer lives, so the registry stays a pure reading of canon.
//
// ── THE BOOK MODEL (Alex, 2026-08-02) ──────────────────────────────────────────
// A keeper's moves are indexed BY RUNE, not by tier: you open your book and see your rune's list.
// The index is DERIVED by inverting each move's rune requirement — there is no second hand-kept
// list to drift. A move naming two runes appears under both and unlocks only when you own both,
// which is canon's runeword compatibility rule ("the combination must become one") for free.

import type { CollarDelivery } from '../engine/collar-foes'
import { RUNES, type Rune } from './birth/runes.data'

export type RuneId = string
/**
 * ★ `'trait'` IS NOT A WEAKER PASSIVE — IT IS THE OTHER SIDE OF CANON'S ONE TEST (RULED 2026-08-26).
 * `runes.md` § *Traits*: **no rune → Trait. A rune → Passive.** The test is a derivation over the
 * move's OWN source, never a hand-kept list, so no build tuning can void it — which is exactly why
 * the earlier definition (always-on / no socket / never pauses recovery) had to be struck: the
 * 08-26 passive redesign gave a passive that same shape, so it defined nothing.
 * A trait moves no mana: always on, no socket, no rune gate, never a recovery cost.
 */
export type MoveTier = 'passive' | 'trait' | 'tactical' | 'ultimate' | 'combo'

export interface KeeperMove {
  /** build-side id, stable. Canon owns the name, not this. */
  id: string
  /** VERBATIM from CANON/game/moves.md. Never localise, never re-word. */
  name: string
  tier: MoveTier
  /** every rune the move requires — you need ALL of them to run it */
  runes: RuneId[]
  /**
   * ── THE BIRTH-EXCLUSIVE BAND (RULED 2026-08-26, Alex + /magii) ────────────────────────────────
   * The birth rune you must have been BORN with to hold this move at all. Owning the rune is not
   * enough and never becomes enough — it cannot be bought at the Passage or taught by a master.
   * This is canon's answer to *"can't be taught quickly, earned through living"*: the trait section
   * was right about HOW these are gotten and wrong about WHAT they are.
   *
   * ⚠ ORTHOGONAL TO SLOTS AND COSTS ON PURPOSE. This asks WHO MAY HOLD a move; `drainsWhileWorn`
   * asks WHAT IT COSTS to hold. The 08-26 passive redesign moved the cost and did not touch this,
   * which is the test that the two really are separate axes.
   *
   * ⚠ AND IT IS NOT A PASSIVE-ONLY FIELD. Alex ruled the band carries *"unique hidden tacticals and
   * or signatures that other birthrunes cant use"* — only two members are written today, both
   * passives. It is gated in `eligibleMoves`, the one filter EVERY band goes through, so a tactical
   * joining the band needs no new gate. Authoring debt is declared: 2 of 17 exist, and the other 15
   * get derived from each rune's essence when a character or chapter needs one — never bulk-invented.
   */
  birthExclusive?: RuneId
  /** short effect line, condensed from the registry entry */
  effect: string
  /**
   * A requirement canon states that is NOT a rune (manatech, a second mage in sync).
   * Present = the move needs something the rune inventory alone can't satisfy.
   */
  needs?: string
  /**
   * ── ★★ HOW THIS MOVE ANSWERS A COLLAR (ruled 2026-08-16, /magii) ──────────────────────────────
   * `game/shimmer-storyline.md` › *WHICH MOVES THE GUARD CATCHES*. The PRINCIPLE is canon; the
   * classification **travels with the move and is decided when the move is written**, which is the
   * anti-rot half of the ruling: a frozen roster kept anywhere else goes stale the first time
   * anyone authors a move, and then someone has to go back to Magii for a list.
   *
   * ⚠ **OMITTED MEANS REFUSED.** `answerCollar` treats `undefined` as cruelty-refused, and
   * `keeper-moves.test.ts` fails if any castable move leaves this blank — so a new move cannot
   * quietly become a way to free someone without a human deciding that it should be.
   *
   * **THREE tells, applied in order, and each catches moves the ones before it clear:**
   *  1. **Rule 3 / cruelty** — *"peril stays in-world, no real cruelty on the page."* ⚠ THE TEST IS
   *     WHAT THE MOVE **RENDERS**, NOT WHAT ITS MECHANISM IS MADE OF. "Can it be aimed at an object"
   *     is a good proxy and it is why cutting projectiles clear — but it is only a proxy, and when
   *     proxy and law disagree the LAW wins. *"Stone, water, wind and light are not a licence;
   *     they're just what the cruelty is made of."* (Amended 2026-08-16 after `pillar-tomb`.)
   *  2. **Thematic / control** — IS the move the line's named evil? *"The evil is force-control."*
   *     A move that takes someone's choice cannot be the thing that gives a choice back — true even
   *     of a perfectly gentle move.
   *  3. **★ CAN HE STILL LEAVE?** The ruled win-state is **dispossession** — sent back, no wound, no
   *     death — and *"he can go"* is what canon calls the one thing separating this from a nicer
   *     collar. **A foe sealed on all six faces has not been sent back; he has been put somewhere.**
   *     So a move whose outcome leaves the foe UNABLE TO LEAVE cannot open a collar: it cannot
   *     produce the outcome canon requires. ⚠ This is why `cordon` and `shackle` still clear —
   *     **containment leaves a person present in the world; a tomb removes them from it.**
   * Otherwise: does it enter the CONTEST at all (canon's verb is *defeating*)? A heal or a launch is
   * a legitimate part of winning and never the key — `no-contest`. Everything else `opens`.
   *
   * ★ **AND WHEN IT IS GENUINELY A JUDGMENT CALL, REFUSE — ratified as canon 2026-08-16.** The costs
   * are not symmetric: *a wrongly-refused move is a build note; a wrongly-cleared one is a cruelty
   * shipped inside the cozy line.* Doubt resolves one way.
   */
  collar?: CollarDelivery
  /**
   * ── THE COST MOVED FROM THE BAND ONTO THE MOVE (RULED 2026-08-26, Alex) ───────────────────────
   * The blanket law *"holding any passive pauses recovery"* is **RETIRED, world-wide** — a passive
   * is a layer you wear, not a switch you feed. The double edge did NOT vanish; it stopped being a
   * property of the TIER and became a property of the individual move.
   *
   * **Most passives set nothing here.** The ones that do, canon had already written:
   *   · **Barrier / Bulwark** — drain while held. On the page in the novel at Ch04, Ch07, Ch15 and
   *     Ch18 (*"the slow ebb, the turtle running out of air"*); Ch04's whole premise is the enemy
   *     declining to break the shell and using up the man inside it instead. Reading Barrier as one
   *     of the costed few retcons zero shipped prose, which is why it kept its cost.
   *   · **Iron Skin** — pays in FOOTING, not mana (`moveMult`), so it leaves this false.
   *
   * ⚠ A trait may never set this. A trait moves no mana — see `MoveTier`.
   *
   * ⚠ THIS IS THE CANON FACT ONLY — *"wearing this costs mana"*. HOW MUCH is Jin's, and lives in
   * `cast.ts` › `CastSpec.regenMult`. It is deliberately not a number here: canon writes a drain on
   * the page, never a rate, and a rate transcribed into the canon registry would be build tuning
   * wearing canon's authority.
   */
  drainsWhileWorn?: boolean
  /**
   * Canon says wearing this PRODUCES mana. Moisture Gathering only, today: *"draws water from the
   * air's moisture over time, refilling mana-rich vials."*
   *
   * ⚠ THE FACT, NEVER THE RATE — same boundary as `drainsWhileWorn`. It exists so the oracle can
   * assert that a move canon calls a source actually feeds you in the build, WITHOUT restating the
   * number: a test pinned to `1.6` would be a mirror of the constant and could only fail by being
   * edited. Pinned to this flag, it fails when the BEHAVIOUR stops matching canon, which is the event.
   */
  feedsWhileWorn?: boolean
}

// ── The registry (keeper moves from CANON/game/moves.md) ───────────────────────
// Order mirrors the canon file so a diff against it stays readable.

export const KEEPER_MOVES: KeeperMove[] = [
  // Passives — worn, always-on. Most cost nothing; the costed few say so on their own row.
  { id: 'barrier', name: 'Barrier', tier: 'passive', runes: ['barrier'], drainsWhileWorn: true,
    effect: 'A held defensive shell that disperses impact — the answer to manalic weapons.' },
  { id: 'bulwark', name: 'Bulwark', tier: 'passive', runes: ['barrier'], drainsWhileWorn: true,
    effect: 'The mastered tier of the shell — a full standing wall, held as sustained defense.' },
  // ⊕ BIRTH-EXCLUSIVE — Veyra is Star-born, Samantha is Fluid-born, and no keeper of another birth
  // rune may hold either at any price. Owning Star is NOT enough; you had to be born holding it.
  { id: 'flame-manipulation', name: 'Flame Manipulation', tier: 'passive', runes: ['star'],
    birthExclusive: 'star',
    effect: 'Innate fire-shaping — bends, holds and splits flame by instinct.' },
  { id: 'moisture-gathering', name: 'Moisture Gathering', tier: 'passive', runes: ['fluid'],
    birthExclusive: 'fluid', feedsWhileWorn: true,
    effect: "Draws water from the air's moisture over time, refilling mana-rich vials." },
  { id: 'iron-skin', name: 'Iron Skin', tier: 'passive', runes: ['metalergy'],
    effect: 'Metal bound over the body — armor you ARE. Refuses to move under a hit.' },
  { id: 'bind-mastery', name: 'Bind Mastery', tier: 'passive', runes: ['enchant', 'metalergy', 'illuminate'],
    effect: "Command of all three Bind runes — the foundation of gatecraft and manatech. A scholar's mastery." ,
    // ⚠ TRANSCRIBED FROM CANON, NOT DECIDED HERE. `moves.md:28` — *"the foundation of
    // gatecraft and manatech. A scholar's mastery, not a fighter's."* This requirement lived in
    // `cast.ts`'s build prose until 2026-08-31, where no guard could read it, so the move looked
    // BUILD-blocked (a hook we owe) when it is CANON-blocked (a world that has no manatech).
    needs: 'gatecraft and manatech — a scholar\'s mastery, not a fighter\'s'},
  // ★ A TRAIT, NOT A PASSIVE, AND THE `runes: []` IS WHAT SAYS SO. Canon's test reads the move's own
  // source: no rune → Trait. The empty rune list was right all along; `tier: 'passive'` was the wrong
  // half, and it put a runeless craft in the one band a rune is supposed to gate. Helga's, and
  // Kael's Network alongside it, now sit on `runes.md`'s trait shelf — the runeless shelf, nothing else.
  { id: 'herbal-knowledge', name: 'Herbal Knowledge', tier: 'trait', runes: [],
    effect: 'Decades of practical medicine — mends, sets bone, purges infection without a drop of mana.',
    needs: 'no rune — a craft, not magic' },
  { id: 'flame-cloak', name: 'Flame Cloak', tier: 'passive', runes: ['star', 'static'],
    effect: 'Heat built across the skin and released as a burning aura the instant someone makes contact.' },
  { id: 'molten-shell', name: 'Molten Shell', tier: 'passive', runes: ['magma', 'barrier'],
    effect: 'A barrier that punishes contact — the shield ripples like lava and burns what touches it.' },
  { id: 'storm-cloak', name: 'Storm Cloak', tier: 'passive', runes: ['static', 'barrier'],
    effect: 'Electricity dancing across a protective shell. Sustained contact builds charge, so pressing it is worse.' },
  { id: 'ice-armor', name: 'Ice Armor', tier: 'passive', runes: ['freeze', 'barrier'],
    effect: 'A crystalline shell of scales that shift, crack and regrow — every hit feeds the next defense.' },
  { id: 'tremor-sense', name: 'Tremor Sense', tier: 'passive', runes: ['stone', 'enchant'],
    effect: 'Awareness bound to the ground underfoot — footsteps, weight, where everyone stands. Ambush becomes impossible.' },

  // Tactical — active, moment-to-moment.
  { id: 'static-burst', name: 'Static Burst', tier: 'tactical', runes: ['static'],
    effect: 'A burst of speed and evasion — gap-close or escape.', collar: 'no-contest' },
  { id: 'firewall', name: 'Firewall', tier: 'tactical', runes: ['star'],
    effect: 'A wall of flame thrown between you and a threat — escape, area-denial, cover.', collar: 'cruelty' },
  { id: 'flame-infusion', name: 'Flame Infusion', tier: 'tactical', runes: ['star'],
    effect: 'Sheathes a weapon or strike in fire — melee enhancement.', collar: 'cruelty' },
  { id: 'mend', name: 'Mend', tier: 'tactical', runes: ['life'],
    effect: 'A Life-infused heal — accelerates recovery, mends tissue, purges infection.', collar: 'no-contest' },
  { id: 'ice-dart', name: 'Ice Dart', tier: 'tactical', runes: ['freeze'],
    effect: 'Compacts water into a frozen dart — precise, punishing.', collar: 'opens' },
  { id: 'enlighten', name: 'Enlighten', tier: 'tactical', runes: ['illuminate'],
    effect: 'A burst of blinding light — disorients, and reveals what is hidden. A flash-bang, not a blade.', collar: 'opens' },
  { id: 'stonewall', name: 'Stonewall', tier: 'tactical', runes: ['stone'],
    effect: 'Tear rock from the ground into a wall — terrain you impose. Close the gap, do not chase.', collar: 'opens' },
  { id: 'shackle', name: 'Shackle', tier: 'tactical', runes: ['metalergy'],
    effect: "Bind metal against its bearer — clamp a foe in iron, or jam a manalic weapon mid-draw.", collar: 'opens' },
  { id: 'living-architecture', name: 'Living Architecture', tier: 'tactical', runes: ['life', 'barrier'],
    effect: 'Grow living wood into structure — Barrier used to SHAPE, not to defend.', collar: 'opens' },
  { id: 'tidal-arms', name: 'Tidal Arms', tier: 'tactical', runes: ['fluid'],
    effect: 'Ribbons of water worn as extensions of yourself — they move like limbs, strike like whips, grab like hands.', collar: 'opens' },
  { id: 'flash-freeze', name: 'Flash Freeze', tier: 'tactical', runes: ['fluid', 'freeze'],
    effect: 'Shape water, then crystallize it instantly — walls, weapons, restraints. Costs the water it uses.',
    // Terrain and restraint, the family canon cleared (`stonewall`/`glacial-path`/`cordon`, and
    // `shackle` — *"clamp a foe in iron"*). No body is the mechanism; ice is.
    collar: 'opens' },
  { id: 'pressure-lance', name: 'Pressure Lance', tier: 'tactical', runes: ['hydro'],
    effect: 'Water compressed to a cutting stream — pure focus, no combination. A needle of water harder than steel.', collar: 'opens' },
  { id: 'fog-bank', name: 'Fog Bank', tier: 'tactical', runes: ['mist', 'breeze'],
    effect: 'Vapor expanded and steered to fill a space with blinding white. Masters anchor it in zones.', collar: 'opens' },
  { id: 'drowning-grasp', name: 'Drowning Grasp', tier: 'tactical', runes: ['fluid', 'mist'],
    effect: 'Water wraps the face and expands into the airways. No visible flood, just a thin film and no breath.', collar: 'cruelty' },
  { id: 'glacial-path', name: 'Glacial Path', tier: 'tactical', runes: ['freeze', 'stone'],
    effect: 'Ice anchored into earth — bridges, ramps, terrain that did not exist a second ago, fused to bedrock.', collar: 'opens' },
  { id: 'lava-stride', name: 'Lava Stride', tier: 'tactical', runes: ['magma', 'stone'],
    effect: 'Soften the ground under them, harden it under you. They sink into molten rock while you keep your footing.', collar: 'cruelty' },
  { id: 'flashpoint', name: 'Flashpoint', tier: 'tactical', runes: ['star', 'lightning'],
    effect: "Ignition delivered at lightning's speed — the fire appears THERE rather than travelling to it.", collar: 'cruelty' },
  { id: 'forge-fist', name: 'Forge Fist', tier: 'tactical', runes: ['magma', 'metalergy'],
    effect: 'A weapon heated to glowing and held stable — strikes that cauterize, blades that cut and burn at once.', collar: 'cruelty' },
  { id: 'heat-mirage', name: 'Heat Mirage', tier: 'tactical', runes: ['star', 'mist'],
    effect: 'Superheated air bent into distortion — they see you three feet from where you stand.' },
  { id: 'volcano-spike', name: 'Volcano Spike', tier: 'tactical', runes: ['magma', 'gem'],
    effect: 'Molten earth compressed into crystalline shot. Slower than fire but it PIERCES barriers and shatters inside.', collar: 'cruelty' },
  { id: 'ember-trail', name: 'Ember Trail', tier: 'tactical', runes: ['star', 'dust'],
    effect: 'Burning particles scattered in your wake — a corridor of floating embers that burn from the inside when breathed.' },
  { id: 'crystal-barrage', name: 'Crystal Barrage', tier: 'tactical', runes: ['gem', 'breeze'],
    effect: 'Mineral shards held mid-air and launched on precise wind. Slower than an arrow, punches through shields.', collar: 'opens' },
  { id: 'grindstone', name: 'Grindstone', tier: 'tactical', runes: ['dust', 'metalergy'],
    effect: 'Metal particles suspended and spinning — a cloud that shreds what walks through it.', collar: 'cruelty' },
  { id: 'dust-lung', name: 'Dust Lung', tier: 'tactical', runes: ['dust', 'breeze'],
    effect: 'Fine particles carried on directed wind and breathed in before they are noticed.', collar: 'cruelty' },
  { id: 'quake-step', name: 'Quake Step', tier: 'tactical', runes: ['stone', 'static'],
    effect: 'Charge built with every step and released into the ground — tremors, splitting floor, lost footing.', collar: 'opens' },
  { id: 'shard-grenade', name: 'Shard Grenade', tier: 'tactical', runes: ['gem', 'static'],
    effect: 'A crystallized sphere packed with charge; on impact it bursts and every fragment carries an electric bite.', collar: 'opens' },
  { id: 'sandstorm-veil', name: 'Sandstorm Veil', tier: 'tactical', runes: ['dust', 'mist'],
    effect: 'Particles suspended in expanding vapor — a choking fog that scours and blinds.', collar: 'cruelty' },
  { id: 'overcharge', name: 'Overcharge', tier: 'tactical', runes: ['static', 'lightning'],
    effect: 'Charge built through movement and released as propulsion — not an attack, a launch, the body the projectile.', collar: 'no-contest' },
  { id: 'gale-cutter', name: 'Gale Cutter', tier: 'tactical', runes: ['breeze'],
    effect: 'Wind compressed to a razor edge — pure focus, no combination. Masters cleave stone, the blades invisible.', collar: 'opens' },
  { id: 'updraft', name: 'Updraft', tier: 'tactical', runes: ['breeze', 'stone'],
    effect: 'Wind against earth to launch debris, allies or yourself — high ground on demand, attacks arriving from above.', collar: 'no-contest' },
  { id: 'thunder-step', name: 'Thunder Step', tier: 'tactical', runes: ['lightning', 'mist'],
    effect: 'Vanish into vapor, return on a crack of lightning. Masters leave afterimages and strike from behind the fog.', collar: 'no-contest' },
  { id: 'bolt-snipe', name: 'Bolt Snipe', tier: 'tactical', runes: ['lightning', 'illuminate'],
    effect: 'Light finds the target and the bolt follows the beam — distance barely matters. Masters mark through walls.', collar: 'opens' },
  { id: 'static-field', name: 'Static Field', tier: 'tactical', runes: ['static', 'dust'],
    effect: 'Charged particles hung in the air. Step in and muscles twitch, manatech sputters, focus breaks. Disabling, not lethal.', collar: 'opens' },
  { id: 'pressure-drop', name: 'Pressure Drop', tier: 'tactical', runes: ['tempest', 'freeze'],
    effect: 'Violent storm meeting sudden cold — pressure plummets, ears pop, lungs strain. Masters make a blizzard out of clear sky.', collar: 'cruelty' },

  // ── ★ THE DOUBLED-FOCUS SEVEN (canon 2026-08-15, adopted here 2026-08-17) ──────────────────────
  // Seven SINGLE-RUNE tacticals, registered so that *"every keeper-reachable rune owns at least one
  // move written in that rune alone"*. Canon has said that since 08-15; the BUILD said otherwise for
  // two days, and `npm run canon` had been printing the seven names as a NOTE on every single run.
  //
  // ⚠ THAT NOTE WAS THE ONLY THING KEEPING THE GATE FROM CLEAN, WHICH IS ITS OWN HAZARD. A gate that
  // always warns is a gate people stop reading — and this one is what a Jin window runs at boot to
  // find out what is true. Adopting these is as much about the gate staying loud as about the moves.
  //
  // ★ AND MANALIC WAS THE LAST EMPTY BOOK — verified by counting, not taken from the board: 61 moves
  // across 20 runes, `manalic: 0`. A keeper born to Manalic opened their book on nothing. Quickform
  // is the entry that closes it, which is why it is BUILT below and not parked as `unbuilt`.
  { id: 'quickform', name: 'Quickform', tier: 'tactical', runes: ['manalic'],
    effect: 'Mana pushed until it clicks into shape — a plank, a rung, a blade, a thrown wedge. Brittle and short-lived, but it exists a breath after you decide it should.', collar: 'opens' },
  // ★ CANON'S OWN WORDS DECIDE IT: *"no force in it at all."* It never enters the contest, so it is
  // no more the key to a collar than a heal is — and unlike a heal it is not even part of winning.
  { id: 'waymark', name: 'Waymark', tier: 'tactical', runes: ['enchant'],
    effect: 'Mana bound to a place or an object until you feel it like a limb — you know where it is, whether it has moved, and whether anyone has touched it.', collar: 'no-contest' },
  { id: 'forked-bolt', name: 'Forked Bolt', tier: 'tactical', runes: ['lightning'],
    effect: 'One arc thrown at the nearest path of least resistance, splitting once when it finds a second. The floor Chain Lightning is the ceiling of.', collar: 'opens' },
  // ⚠ SQUALL vs PRESSURE DROP IS TELL 1 DONE PROPERLY, and the two rows sit next to each other on
  // purpose. Pressure Drop is `cruelty` because it renders on the BODY — *"ears pop, lungs strain."*
  // Squall renders on the SPACE — rain, pressure, footing — and a foe standing in it is inconvenienced,
  // not injured. The test is what a move RENDERS, and weather is not a licence either way.
  { id: 'squall', name: 'Squall', tier: 'tactical', runes: ['tempest'],
    effect: 'Weather called down with nothing shaping it — sideways rain, ugly pressure, footing gone. You spoil a space rather than strike into it.', collar: 'opens' },
  { id: 'keenshard', name: 'Keenshard', tier: 'tactical', runes: ['gem'],
    effect: 'Every ounce of pressure driven to one crystalline point and loosed. One shard, no spread — it pierces where a thrown stone would only break.', collar: 'opens' },
  // ⚠ `cruelty`, and the mechanism is not the reason — the RENDER is. *"Molten focus held against one
  // spot until the spot stops existing"* is a door when aimed at a door and a hole through a person
  // when aimed at a person, slowly and on purpose. This is the `pillar-tomb` amendment exactly:
  // stone, water, wind and light are not a licence, and neither is magma.
  { id: 'meltbore', name: 'Meltbore', tier: 'tactical', runes: ['magma'],
    effect: 'Molten focus held against one spot until the spot stops existing. Slow, undramatic, and nothing refuses it forever — the breach move.', collar: 'cruelty' },
  // ★ THE NON-CRUEL SIBLING OF `sandstorm-veil`, and the pair is the cleanest illustration of the
  // rule in this file. Both are fog. That one SCOURS AND CHOKES, so it is `cruelty`; this one carries
  // *"nothing but itself"* and canon calls it *"confrontation declined rather than won"* — declining
  // is not defeating, so it never opens a collar and it is not trying to.
  { id: 'hush', name: 'Hush', tier: 'tactical', runes: ['mist'],
    effect: 'Vapor spread wide and carrying nothing but itself — sight goes soft, sound goes flat, edges stop agreeing on where they are.', collar: 'no-contest' },
  // ── ★ THE EIGHTH — BARRIER'S DOUBLED FOCUS (canon 2026-09-02, name locked by Alex the same day) ──
  // The 08-15 pass said *"every keeper-reachable rune now has a move written in itself"* and it was
  // one short: Barrier's one-rune entries were two passives, an ultimate and a combo, so a
  // Barrier-born keeper was the one keeper in the game born holding NO tactical. Found by measuring
  // what a fresh keeper of each carousel rune actually seats (`birth-tactical.test.ts`), not by
  // reading the coverage tables, which called Barrier COMPLETE by counting Living Architecture.
  // Magii derived it by subtraction from Part I — the held shell and the standing wall are the
  // passives, flare-and-disperse is Backlash, protecting-many is Overpressure — leaving *"blocking
  // doorways"*: the shell with nobody inside it. `no-contest` for the Waymark reason: a shield set
  // down declines the contest rather than winning it, and it renders on a DOORWAY, not a body.
  { id: 'threshold', name: 'Threshold', tier: 'tactical', runes: ['barrier'],
    effect: 'The shell set down instead of worn — across a doorway, over a companion, wherever you are not. Paid once at the cast, then it holds itself where it was put until it has dispersed all it can.', collar: 'no-contest' },

  // Ultimates — signature, high pool cost.
  { id: 'chain-lightning', name: 'Chain Lightning', tier: 'ultimate', runes: ['lightning'],
    effect: 'Arcs between every target and conductor in range, jumping through groups.', collar: 'opens' },
  { id: 'flame-barrage', name: 'Flame Barrage', tier: 'ultimate', runes: ['star', 'breeze'],
    effect: 'A volley of fire that independently tracks and curves mid-flight — a flock of burning birds.' },
  // ── ★★★ ALL THREE BIND RUNES, CORRECTED ON PROOF 2026-08-27 (canon RULED 08-26) ──────────────
  // This read `runes: ['enchant']` because one summary cell in `moves.md` read `Gate | Enchant`.
  // Canon says the trifecta FOUR separate times — `runes.md:211` (the lane law's own worked
  // example), `:679` (Eyuun's loadout table), `:684` (*"all three Bind runes combine to create
  // gates into the Ather"*), and moves.md's own prose four sections below that table. **The cell
  // was the outlier, and the build read the cell.**
  //
  // ★ AND IT IS NOT A JUDGEMENT CALL, because the one-rune reading MAKES CANON'S FLAGSHIP
  // GATE-MAGE ILLEGAL. Eyuun is Enchant-born and Gate is his Ultimate; if Gate were Enchant alone
  // his signature would be his birth rune, which `moves.md` forbids in as many words — *"Nobody's
  // signature is their birth rune."* The trifecta is the only reading under which the character
  // the law was derived from obeys it.
  //
  // ⚠ BUILD CONSEQUENCE, NAMED IN THE RULING RATHER THAN BURIED: widening this REMOVES Gate from
  // an Enchant-only keeper's book. That population is small by construction — ultimates are won at
  // the Crucible, never bought — and a lone Enchant keeper still holds Waymark, which is the craft
  // Greg's whole passage business runs on. Alex can overturn it in one line if the cost is worse
  // than it looks from here.
  //
  // ⚠ DELIBERATELY NOT THE SAME CALL AS `Iron Skin`, which canon leaves OPEN on the sound ground
  // that changing a registered move's requirements retroactively removes it from every keeper's
  // book. That reasoning stands; there is simply nothing FORCING Iron Skin and something forcing
  // this one.
  { id: 'gate', name: 'Gate', tier: 'ultimate', runes: ['enchant', 'illuminate', 'metalergy'],
    effect: 'Bind two points into one and step through. Utility, not damage — the founded craft.' },
  { id: 'healing-grove', name: 'Healing Grove', tier: 'ultimate', runes: ['life', 'barrier'],
    effect: 'A living sanctuary grown and tended — everyone within is steadily restored.', collar: 'no-contest' },
  { id: 'cordon', name: 'Cordon', tier: 'ultimate', runes: ['stone', 'metalergy'],
    effect: 'Seal an area entirely — stone rises on every side and all metal locks to the caster. Containment, not a kill.', collar: 'opens' },
  { id: 'grey-arena', name: 'Grey Arena', tier: 'ultimate', runes: ['barrier'],
    effect: 'A dome that DRAINS the mana of everyone inside, feeding the caster. A self-refueling trap.',
    needs: 'manatech — a drain-engine' },
  { id: 'healing-stream', name: 'Healing Stream', tier: 'ultimate', runes: ['fluid', 'life'],
    effect: 'Water carrying restoration, guided through the body. Masters split one stream and mend a line of people at once.', collar: 'no-contest' },
  { id: 'vein-puppet', name: 'Vein Puppet', tier: 'ultimate', runes: ['fluid', 'enchant'],
    effect: 'Water bound to a body through a link — not healing, CONTROL: their blood answers to you. Forbidden.', collar: 'control' },
  { id: 'firestorm', name: 'Firestorm', tier: 'ultimate', runes: ['star', 'tempest'],
    effect: 'Burn wedded to chaos — a surgical inferno that takes one side of a street and leaves the other untouched.', collar: 'cruelty' },
  { id: 'cyclone-cage', name: 'Cyclone Cage', tier: 'ultimate', runes: ['breeze', 'tempest'],
    effect: 'Controlled wind walling in violent wind — shredding within, unreachable from without. Containment in a different element.', collar: 'cruelty' },
  { id: 'pillar-tomb', name: 'Pillar Tomb', tier: 'ultimate', runes: ['stone'],
    effect: 'Pure Stone depth, no combination — pillars from below, walls from the sides, ceiling above. Sealed on all six faces.',
    // ── ★★ REFUSED, AND CANON RATIFIED IT WITH A BETTER REASON THAN MINE (2026-08-16, `c772036`) ──
    // I flagged this as a tonal edge case: stone mechanism, buried-alive image. Magii's answer was
    // that it is not an edge case at all — **it is a hole in the "aim it at an object" proxy.** Rule
    // 3 asks what a move RENDERS, not what it is made of, and this is exactly where the two come
    // apart. *"Stone, water, wind and light are not a licence; they're just what the cruelty is
    // made of."*
    //
    // ★ AND THE REASON THAT NEEDS NO TASTE JUDGMENT, WHICH IS THE ONE TO BUILD AGAINST: it
    // contradicts the ruled WIN-STATE. The win is dispossession — sent back, collar still on him —
    // and a freed Moglin *"can go"*. **Sealed on all six faces, he has not been sent back; he has
    // been put somewhere.** That is the line between this and `cordon`: containment leaves a person
    // present in the world, a tomb removes them from it. The move cannot produce the outcome canon
    // requires, so it fails before tone is even reached.
    collar: 'cruelty' },
  { id: 'living-fortress', name: 'Living Fortress', tier: 'ultimate', runes: ['stone', 'metalergy', 'barrier'],
    effect: 'Stone walls on a bonded metal frame, humming with protective mana. Not a shield, A BUILDING, and good against siege.',
    // A building. It shelters; it never enters the contest — the same standing as a heal, and a
    // legitimate part of winning rather than the thing that opens a collar.
    collar: 'no-contest' },
  // ── ★★ THE COMPACT COLUMN'S SIGNATURE, REGISTERED 2026-08-27 (canon `moves.md:101`, name
  // approved by Alex 2026-08-26) ────────────────────────────────────────────────────────────────
  // Compact (Barrier/Gem/Hydro) was GENUINELY starved — canon measured it two ways and found no
  // file pairing two Compact runes anywhere, and every registered technique naming Barrier, Gem or
  // Hydro reaching OFF the column. This is the only technique that walks it.
  //
  // ★ `no-contest` FOR THE SAME REASON `living-fortress` IS: it shelters, it never enters the
  // contest. Canon calls it "a defence funded by the attack on it" — the third face of Barrier's
  // triad beside Grey Arena and Healing Grove — and a collar is out-contested, never sheltered
  // against.
  { id: 'overpressure', name: 'Overpressure', tier: 'ultimate', runes: ['barrier', 'gem', 'hydro'],
    effect: 'A shell over the keeper and everyone near them that mends itself out of what it stops — impact is banked into the crystalline layer and paid back out as shell. Its cost is Gem\'s own law: one flaw and it shatters.',
    collar: 'no-contest' },
  { id: 'monsoon-veil', name: 'Monsoon Veil', tier: 'ultimate', runes: ['mist', 'vapor', 'life'],
    effect: 'Expanding fog saturated with moisture and carrying Life — wounds close, fatigue lifts, poison purges. A battlefield hospital.', collar: 'no-contest' },

  // Combos — require two or more mages in sync.
  { id: 'counterpoint', name: 'Counterpoint', tier: 'combo', runes: ['barrier'],
    effect: "Two same-frequency mages catch an incoming attack for a beat and return it fused. Finisher-tier.",
    needs: "a second same-frequency mage running Barrier + the pair's attack runes" },
  { id: 'vaporscreen', name: 'Vaporscreen', tier: 'combo', runes: ['fluid', 'star'],
    effect: "One mage's water flashed to steam by another's fire — a rolling screen that breaks line of sight.",
    needs: 'a second mage supplying the other rune' },
]

// ── Derived indexes (never hand-maintained) ────────────────────────────────────

const RUNE_BY_ID = new Map<RuneId, Rune>(RUNES.map((r) => [r.id, r]))

/**
 * A move by id. ⚠ A MAP, NOT A `.find`, because the Crucible host resolves a challenger's cast
 * inside the frame loop — sixty challengers scanning a 68-entry array is exactly the shape
 * `render-audit` exists to catch, and it would only show up once the roster was full.
 */
const MOVE_BY_ID = new Map<string, KeeperMove>(KEEPER_MOVES.map((m) => [m.id, m]))
export function moveById(id: string): KeeperMove | undefined { return MOVE_BY_ID.get(id) }

/** Every registered move that names this rune. THE BOOK PAGE. Derived by inversion. */
export function movesForRune(runeId: RuneId): KeeperMove[] {
  return KEEPER_MOVES.filter((m) => m.runes.includes(runeId))
}

/** The full book index: rune id → its moves. Includes runes with an empty list (see CANON_GAPS). */
export const MOVES_BY_RUNE: Record<RuneId, KeeperMove[]> = Object.fromEntries(
  RUNES.map((r) => [r.id, movesForRune(r.id)]),
)

/** Runes that currently have NO registered keeper move — the coverage gap, surfaced not hidden. */
export const RUNES_WITHOUT_MOVES: RuneId[] = RUNES.filter((r) => MOVES_BY_RUNE[r.id].length === 0).map((r) => r.id)

// ── Lanes: element row + state column ──────────────────────────────────────────
//
// ⚠ PROVISIONAL — the compatibility law is an OPEN canon gap (CANON_GAPS.md, flagged 2026-08-03).
// Canon rules THAT compatibility matters (runes.md §Developed Runes) but never says WHICH runes are
// compatible. Alex's proposed law: your birth rune's element row + state column are the natural
// path. It holds for 5 of the 7 canon developed runes (Eyuun = all three Bind runes; Samantha
// demonstrates both lanes; Kael same element) and breaks on Veyra (Star→Breeze) and Lazerin
// (Life→Illuminate), both purpose-driven acquisitions.
//
// So: these functions COMPUTE the lanes, and nothing in the build gates progression on them yet.
// When Magii rules, wire `learnableMoves` into the progression layer and delete this notice.

export interface Lanes {
  /** the other runes sharing this rune's ELEMENT (canon: breadth / tactical lean) */
  element: RuneId[]
  /** the other runes sharing this rune's STATE (canon: the signature lean) */
  state: RuneId[]
  /** element ∪ state ∪ the rune itself — everything reachable from it */
  reach: RuneId[]
}

export function lanesFor(runeId: RuneId): Lanes {
  const r = RUNE_BY_ID.get(runeId)
  if (!r) return { element: [], state: [], reach: [] }
  const element = RUNES.filter((o) => o.element === r.element).map((o) => o.id)
  const state = RUNES.filter((o) => o.state === r.state).map((o) => o.id)
  return { element, state, reach: [...new Set([runeId, ...element, ...state])] }
}

/** Union of the lanes of every rune the keeper owns. A 2nd rune opens a cross-hatch, not a list. */
export function reachableRunes(owned: RuneId[]): RuneId[] {
  return [...new Set(owned.flatMap((r) => lanesFor(r).reach))]
}

/** Moves the keeper can run RIGHT NOW — every required rune owned. */
export function knownMoves(owned: RuneId[]): KeeperMove[] {
  const have = new Set(owned)
  return KEEPER_MOVES.filter((m) => m.runes.length > 0 && m.runes.every((r) => have.has(r)))
}

/**
 * Moves on the keeper's lanes — what they could reach by developing along the row/column.
 * PROVISIONAL (see the notice above). Shows the book's future, which is the whole point of
 * indexing by rune: your identity has somewhere to go.
 */
export function learnableMoves(owned: RuneId[]): KeeperMove[] {
  const reach = new Set(reachableRunes(owned))
  const known = new Set(knownMoves(owned).map((m) => m.id))
  return KEEPER_MOVES.filter(
    (m) => m.runes.length > 0 && !known.has(m.id) && m.runes.every((r) => reach.has(r)),
  )
}
