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

import { RUNES, type Rune } from './birth/runes.data'

export type RuneId = string
export type MoveTier = 'passive' | 'tactical' | 'ultimate' | 'combo'

export interface KeeperMove {
  /** build-side id, stable. Canon owns the name, not this. */
  id: string
  /** VERBATIM from CANON/game/moves.md. Never localise, never re-word. */
  name: string
  tier: MoveTier
  /** every rune the move requires — you need ALL of them to run it */
  runes: RuneId[]
  /** short effect line, condensed from the registry entry */
  effect: string
  /**
   * A requirement canon states that is NOT a rune (manatech, a second mage in sync).
   * Present = the move needs something the rune inventory alone can't satisfy.
   */
  needs?: string
  /**
   * Held passives PAUSE MANA RECOVERY while active (runes.md, the mana economy) — the double
   * edge that makes a passive a stance, not a permanent state.
   */
  pausesRecovery?: boolean
}

// ── The registry (keeper moves from CANON/game/moves.md) ───────────────────────
// Order mirrors the canon file so a diff against it stays readable.

export const KEEPER_MOVES: KeeperMove[] = [
  // Passives — held or innate. Holding one pauses mana recovery.
  { id: 'barrier', name: 'Barrier', tier: 'passive', runes: ['barrier'], pausesRecovery: true,
    effect: 'A held defensive shell that disperses impact — the answer to manalic weapons.' },
  { id: 'bulwark', name: 'Bulwark', tier: 'passive', runes: ['barrier'], pausesRecovery: true,
    effect: 'The mastered tier of the shell — a full standing wall, held as sustained defense.' },
  { id: 'flame-manipulation', name: 'Flame Manipulation', tier: 'passive', runes: ['star'], pausesRecovery: true,
    effect: 'Innate fire-shaping — bends, holds and splits flame by instinct.' },
  { id: 'moisture-gathering', name: 'Moisture Gathering', tier: 'passive', runes: ['fluid'], pausesRecovery: true,
    effect: "Draws water from the air's moisture over time, refilling mana-rich vials." },
  { id: 'iron-skin', name: 'Iron Skin', tier: 'passive', runes: ['metalergy'], pausesRecovery: true,
    effect: 'Metal bound over the body — armor you ARE. Refuses to move under a hit.' },
  { id: 'bind-mastery', name: 'Bind Mastery', tier: 'passive', runes: ['enchant', 'metalergy', 'illuminate'], pausesRecovery: true,
    effect: "Command of all three Bind runes — the foundation of gatecraft and manatech. A scholar's mastery." },
  { id: 'herbal-knowledge', name: 'Herbal Knowledge', tier: 'passive', runes: [],
    effect: 'Decades of practical medicine — mends, sets bone, purges infection without a drop of mana.',
    needs: 'no rune — a craft, not magic' },
  { id: 'flame-cloak', name: 'Flame Cloak', tier: 'passive', runes: ['star', 'static'], pausesRecovery: true,
    effect: 'Heat built across the skin and released as a burning aura the instant someone makes contact.' },
  { id: 'molten-shell', name: 'Molten Shell', tier: 'passive', runes: ['magma', 'barrier'], pausesRecovery: true,
    effect: 'A barrier that punishes contact — the shield ripples like lava and burns what touches it.' },
  { id: 'storm-cloak', name: 'Storm Cloak', tier: 'passive', runes: ['static', 'barrier'], pausesRecovery: true,
    effect: 'Electricity dancing across a protective shell. Sustained contact builds charge, so pressing it is worse.' },
  { id: 'ice-armor', name: 'Ice Armor', tier: 'passive', runes: ['freeze', 'barrier'], pausesRecovery: true,
    effect: 'A crystalline shell of scales that shift, crack and regrow — every hit feeds the next defense.' },
  { id: 'tremor-sense', name: 'Tremor Sense', tier: 'passive', runes: ['stone', 'enchant'], pausesRecovery: true,
    effect: 'Awareness bound to the ground underfoot — footsteps, weight, where everyone stands. Ambush becomes impossible.' },

  // Tactical — active, moment-to-moment.
  { id: 'static-burst', name: 'Static Burst', tier: 'tactical', runes: ['static'],
    effect: 'A burst of speed and evasion — gap-close or escape.' },
  { id: 'firewall', name: 'Firewall', tier: 'tactical', runes: ['star'],
    effect: 'A wall of flame thrown between you and a threat — escape, area-denial, cover.' },
  { id: 'flame-infusion', name: 'Flame Infusion', tier: 'tactical', runes: ['star'],
    effect: 'Sheathes a weapon or strike in fire — melee enhancement.' },
  { id: 'mend', name: 'Mend', tier: 'tactical', runes: ['life'],
    effect: 'A Life-infused heal — accelerates recovery, mends tissue, purges infection.' },
  { id: 'ice-dart', name: 'Ice Dart', tier: 'tactical', runes: ['freeze'],
    effect: 'Compacts water into a frozen dart — precise, punishing.' },
  { id: 'enlighten', name: 'Enlighten', tier: 'tactical', runes: ['illuminate'],
    effect: 'A burst of blinding light — disorients, and reveals what is hidden. A flash-bang, not a blade.' },
  { id: 'stonewall', name: 'Stonewall', tier: 'tactical', runes: ['stone'],
    effect: 'Tear rock from the ground into a wall — terrain you impose. Close the gap, do not chase.' },
  { id: 'shackle', name: 'Shackle', tier: 'tactical', runes: ['metalergy'],
    effect: "Bind metal against its bearer — clamp a foe in iron, or jam a manalic weapon mid-draw." },
  { id: 'living-architecture', name: 'Living Architecture', tier: 'tactical', runes: ['life', 'barrier'],
    effect: 'Grow living wood into structure — Barrier used to SHAPE, not to defend.' },
  { id: 'tidal-arms', name: 'Tidal Arms', tier: 'tactical', runes: ['fluid'],
    effect: 'Ribbons of water worn as extensions of yourself — they move like limbs, strike like whips, grab like hands.' },
  { id: 'flash-freeze', name: 'Flash Freeze', tier: 'tactical', runes: ['fluid', 'freeze'],
    effect: 'Shape water, then crystallize it instantly — walls, weapons, restraints. Costs the water it uses.' },
  { id: 'pressure-lance', name: 'Pressure Lance', tier: 'tactical', runes: ['hydro'],
    effect: 'Water compressed to a cutting stream — pure focus, no combination. A needle of water harder than steel.' },
  { id: 'fog-bank', name: 'Fog Bank', tier: 'tactical', runes: ['mist', 'breeze'],
    effect: 'Vapor expanded and steered to fill a space with blinding white. Masters anchor it in zones.' },
  { id: 'drowning-grasp', name: 'Drowning Grasp', tier: 'tactical', runes: ['fluid', 'mist'],
    effect: 'Water wraps the face and expands into the airways. No visible flood, just a thin film and no breath.' },
  { id: 'glacial-path', name: 'Glacial Path', tier: 'tactical', runes: ['freeze', 'stone'],
    effect: 'Ice anchored into earth — bridges, ramps, terrain that did not exist a second ago, fused to bedrock.' },
  { id: 'lava-stride', name: 'Lava Stride', tier: 'tactical', runes: ['magma', 'stone'],
    effect: 'Soften the ground under them, harden it under you. They sink into molten rock while you keep your footing.' },
  { id: 'flashpoint', name: 'Flashpoint', tier: 'tactical', runes: ['star', 'lightning'],
    effect: "Ignition delivered at lightning's speed — the fire appears THERE rather than travelling to it." },
  { id: 'forge-fist', name: 'Forge Fist', tier: 'tactical', runes: ['magma', 'metalergy'],
    effect: 'A weapon heated to glowing and held stable — strikes that cauterize, blades that cut and burn at once.' },
  { id: 'heat-mirage', name: 'Heat Mirage', tier: 'tactical', runes: ['star', 'mist'],
    effect: 'Superheated air bent into distortion — they see you three feet from where you stand.' },
  { id: 'volcano-spike', name: 'Volcano Spike', tier: 'tactical', runes: ['magma', 'gem'],
    effect: 'Molten earth compressed into crystalline shot. Slower than fire but it PIERCES barriers and shatters inside.' },
  { id: 'ember-trail', name: 'Ember Trail', tier: 'tactical', runes: ['star', 'dust'],
    effect: 'Burning particles scattered in your wake — a corridor of floating embers that burn from the inside when breathed.' },
  { id: 'crystal-barrage', name: 'Crystal Barrage', tier: 'tactical', runes: ['gem', 'breeze'],
    effect: 'Mineral shards held mid-air and launched on precise wind. Slower than an arrow, punches through shields.' },
  { id: 'grindstone', name: 'Grindstone', tier: 'tactical', runes: ['dust', 'metalergy'],
    effect: 'Metal particles suspended and spinning — a cloud that shreds what walks through it.' },
  { id: 'dust-lung', name: 'Dust Lung', tier: 'tactical', runes: ['dust', 'breeze'],
    effect: 'Fine particles carried on directed wind and breathed in before they are noticed.' },
  { id: 'quake-step', name: 'Quake Step', tier: 'tactical', runes: ['stone', 'static'],
    effect: 'Charge built with every step and released into the ground — tremors, splitting floor, lost footing.' },
  { id: 'shard-grenade', name: 'Shard Grenade', tier: 'tactical', runes: ['gem', 'static'],
    effect: 'A crystallized sphere packed with charge; on impact it bursts and every fragment carries an electric bite.' },
  { id: 'sandstorm-veil', name: 'Sandstorm Veil', tier: 'tactical', runes: ['dust', 'mist'],
    effect: 'Particles suspended in expanding vapor — a choking fog that scours and blinds.' },
  { id: 'overcharge', name: 'Overcharge', tier: 'tactical', runes: ['static', 'lightning'],
    effect: 'Charge built through movement and released as propulsion — not an attack, a launch, the body the projectile.' },
  { id: 'gale-cutter', name: 'Gale Cutter', tier: 'tactical', runes: ['breeze'],
    effect: 'Wind compressed to a razor edge — pure focus, no combination. Masters cleave stone, the blades invisible.' },
  { id: 'updraft', name: 'Updraft', tier: 'tactical', runes: ['breeze', 'stone'],
    effect: 'Wind against earth to launch debris, allies or yourself — high ground on demand, attacks arriving from above.' },
  { id: 'thunder-step', name: 'Thunder Step', tier: 'tactical', runes: ['lightning', 'mist'],
    effect: 'Vanish into vapor, return on a crack of lightning. Masters leave afterimages and strike from behind the fog.' },
  { id: 'bolt-snipe', name: 'Bolt Snipe', tier: 'tactical', runes: ['lightning', 'illuminate'],
    effect: 'Light finds the target and the bolt follows the beam — distance barely matters. Masters mark through walls.' },
  { id: 'static-field', name: 'Static Field', tier: 'tactical', runes: ['static', 'dust'],
    effect: 'Charged particles hung in the air. Step in and muscles twitch, manatech sputters, focus breaks. Disabling, not lethal.' },
  { id: 'pressure-drop', name: 'Pressure Drop', tier: 'tactical', runes: ['tempest', 'freeze'],
    effect: 'Violent storm meeting sudden cold — pressure plummets, ears pop, lungs strain. Masters make a blizzard out of clear sky.' },

  // Ultimates — signature, high pool cost.
  { id: 'chain-lightning', name: 'Chain Lightning', tier: 'ultimate', runes: ['lightning'],
    effect: 'Arcs between every target and conductor in range, jumping through groups.' },
  { id: 'flame-barrage', name: 'Flame Barrage', tier: 'ultimate', runes: ['star', 'breeze'],
    effect: 'A volley of fire that independently tracks and curves mid-flight — a flock of burning birds.' },
  { id: 'gate', name: 'Gate', tier: 'ultimate', runes: ['enchant'],
    effect: 'Bind two points into one and step through. Utility, not damage — the founded craft.' },
  { id: 'healing-grove', name: 'Healing Grove', tier: 'ultimate', runes: ['life', 'barrier'],
    effect: 'A living sanctuary grown and tended — everyone within is steadily restored.' },
  { id: 'cordon', name: 'Cordon', tier: 'ultimate', runes: ['stone', 'metalergy'],
    effect: 'Seal an area entirely — stone rises on every side and all metal locks to the caster. Containment, not a kill.' },
  { id: 'grey-arena', name: 'Grey Arena', tier: 'ultimate', runes: ['barrier'],
    effect: 'A dome that DRAINS the mana of everyone inside, feeding the caster. A self-refueling trap.',
    needs: 'manatech — a drain-engine' },
  { id: 'healing-stream', name: 'Healing Stream', tier: 'ultimate', runes: ['fluid', 'life'],
    effect: 'Water carrying restoration, guided through the body. Masters split one stream and mend a line of people at once.' },
  { id: 'vein-puppet', name: 'Vein Puppet', tier: 'ultimate', runes: ['fluid', 'enchant'],
    effect: 'Water bound to a body through a link — not healing, CONTROL: their blood answers to you. Forbidden.' },
  { id: 'firestorm', name: 'Firestorm', tier: 'ultimate', runes: ['star', 'tempest'],
    effect: 'Burn wedded to chaos — a surgical inferno that takes one side of a street and leaves the other untouched.' },
  { id: 'cyclone-cage', name: 'Cyclone Cage', tier: 'ultimate', runes: ['breeze', 'tempest'],
    effect: 'Controlled wind walling in violent wind — shredding within, unreachable from without. Containment in a different element.' },
  { id: 'pillar-tomb', name: 'Pillar Tomb', tier: 'ultimate', runes: ['stone'],
    effect: 'Pure Stone depth, no combination — pillars from below, walls from the sides, ceiling above. Sealed on all six faces.' },
  { id: 'living-fortress', name: 'Living Fortress', tier: 'ultimate', runes: ['stone', 'metalergy', 'barrier'],
    effect: 'Stone walls on a bonded metal frame, humming with protective mana. Not a shield, A BUILDING, and good against siege.' },
  { id: 'monsoon-veil', name: 'Monsoon Veil', tier: 'ultimate', runes: ['mist', 'vapor', 'life'],
    effect: 'Expanding fog saturated with moisture and carrying Life — wounds close, fatigue lifts, poison purges. A battlefield hospital.' },

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
