// Base-form learnset — what a spirit learns between blooming (lv3) and evolving (lv34).
//
// WHY THIS FILE EXISTS: element moves were gated behind `element !== 'base'`, and a spirit
// only gains an element at level 34. The shipped continent bands at levels 2-22, so EVERY
// spirit in the playable game held exactly two moves (Mana Pulse + Spirit Ward) and 73 of
// the 75 moves in moves.ts were unreachable. That is why fights read samey.
//
// THE RULE — raw vs runed (canon: CANON/game/moves.md, the one registry, ruled 2026-07-22):
//   Moves are caster-agnostic — name + runes + effect — and "the caster supplies medium,
//   colour, and potency". A BASE spirit cannot hold a rune yet, so it channels these moves
//   RAW: full power, but forced to `neutral` element, which means no STAB and no matchup
//   multiplier. On evolution the SAME moves express their true rune — real element, real
//   matchup cycle, STAB when the spirit's own element matches. Evolution does not hand you
//   a new list, it IGNITES the list you built. That is the prestige beat, and it is why the
//   kit carries over instead of resetting.
//
//   The move's rune is the MOVE's, not the caster's: a Water-evolved spirit that carried
//   Stone Throw casts real Earth Stone Throw (full matchup, no STAB). Attuning a carried
//   move to the caster's element instead would rename it into nonsense.
//
// LANE: this is progression, which CANON/game/moves.md explicitly hands to the build —
//   "the 4-move kit a spirit carries is progression (build-side), not canon". Every move
//   named here is already registered. NO new move names are invented in this file, and none
//   may be: a new name must be registered in CANON/game/moves.md first (Magii rules it).
//
// TUNING: levels and picks are the feel surface — edit freely. The one thing you may NOT
//   break is the damage floor asserted in base-learnset.test.ts (a species whose late kit is
//   all utility cannot finish a fight, and a high-guard mirror of it stalemates outright —
//   that failure already cost a session, see GBOARD's arena-pacing block).

import type { Species } from '../spirits/spirit'
import { EVOLUTION_THRESHOLDS } from '../spirits/evolution-config'
import { ALL_MOVES, type Move } from './moves'

// NOTE: entries name moves by ID, not by const reference, and IDs are resolved lazily inside
// baseLearnedBy(). moves.ts imports this file, so a const reference here would be read at
// module-eval time while moves.ts is still initializing — a TDZ crash on import order.
// base-learnset.test.ts asserts every ID resolves, which is the check the const gave us.

// ── Progression levels ─────────────────────────────────
// Bloom is when a spirit first arrives — it is born knowing the raw-mana pair.

export const BLOOM_LEVEL = EVOLUTION_THRESHOLDS.bloomLevel  // 3 — one source of truth
export const STILL_BREATH_LEVEL = 5   // the Reach move — holds are early-game content
export const KIT_SIZE = 4             // canon-registered: a spirit carries a 4-move kit

/** A single learnset entry: at `level`, the move with this id joins the spirit's known pool. */
export interface LearnEntry {
  level: number
  id: string
}

// ── State affinities (documentation for the tables below) ──
// Each species leans on two of the seven states, drawn from its canon runewords
// (evolution-config.ts RUNEWORDS). This is flavour, not a constraint the code enforces.
//
//   fox          scatter + solid     Veil / Bolt / Burrow / Current — chips and vanishes
//   axolotl      flow + compact      Restore / Pulse / Silt / Flow — the mender
//   owl          expanding + bind    Oracle / Gale / Root / Dive — reach and pin
//   frog         bind + scatter      Toxin / Crackle / Clay / Swim — locks you down
//   firefly      expanding + bind    Lumina / Spark / Ember / Gleam — pins and pops
//   rabbit       expanding + flow    Fortune / Dash / Warren / Paddle — sets up, then runs
//   water-bear   compact + flow      Endure / Resist / Micro / Suspend — outlasts
//   hummingbird  flow + scatter      Siphon / Flutter / Gem / Mist — drains
//   turtle       compact + bind      Barrier / Static / Metalergy / Hydro — the wall
//   bat          scatter + bind      Shroud / Sonar / Cavern / Skim — blinds and holds

// NOT IN THE BASE POOL, deliberately: mana_seal / static_cage / root_grip all proc anchor at
// 100%. Guaranteed lockdown every cooldown is evolution-tier control, not something a lv19
// spirit should hold — with them in, the arena's 3v3 party baseline fell from 38% to ~10%
// because the enemy roster happened to hold the control tools. Chance-based anchors
// (Enchant Lock 30%, Shackle 35%, Enlighten 25%) carry the same flavour without the lock.
//
// ── The tables ─────────────────────────────────────────
// Shape per species: lv5 first real strike (always damage — the floor), then four picks off its
// affinities, with a damage capstone at 29 so the final kit can always close a fight.
//
// WHY THE CURVE STARTS AT 5 AND NOT 9: the shipped continent bands at levels 2-22, so the early
// window IS the game. With the first strike at 9, a lv5 spirit fought with Mana Pulse and Spirit
// Ward — one useful move in two — and the arena's lv5 tank mirror burned 58s of a 60s cap. Kit
// size now varies with level in a way it never did when everyone had two moves, and flat HP
// scaling cannot serve both ends: tuning HP up for 4-move fights drags the 2-move ones badly.
// Getting a real strike into the kit early is what closes that gap.

export const BASE_LEARNSET: Record<Species, LearnEntry[]> = {
  // Chips away and slips out of reach. Erosion stacked on stat drops.
  fox: [
    { level: 5,   id: 'mana_shard' },             // 55 — Veil, its mana runeword
    { level: 10, id: 'vapor_drain' },            // 45, erosion
    { level: 15, id: 'illuminate' },             // 45 Enlighten, anchor — the veil-flash
    { level: 22, id: 'quake_dust' },             // 55, pwr- agi-
    { level: 29, id: 'storm_scatter' },          // 60, erosion + grd-
  ],

  // Outlasts by mending faster than it is hit, then presses.
  axolotl: [
    { level: 5,   id: 'aqua_stream' },            // 50, regen — Flow, its water runeword
    { level: 10, id: 'ice_spike' },              // 55 Ice Dart
    { level: 15, id: 'hydro_armor' },            // grd+, regen — the one utility pick
    { level: 22, id: 'tide_pulse' },             // 55, surge
    { level: 29, id: 'iron_crush' },             // 70 — Silt
  ],

  // Sees the opening, then holds you in it.
  owl: [
    { level: 5,   id: 'bolt_rush' },              // 50, always strikes first — Gale
    { level: 10, id: 'mana_shard' },             // 55 — Oracle
    { level: 15, id: 'enchant_lock' },           // 50, anchor — Root
    { level: 22, id: 'tide_pulse' },             // 55, surge — Dive
    { level: 29, id: 'metal_snare' },            // 55 Shackle, anchor
  ],

  // Locks a foe down and saps what is left.
  frog: [
    { level: 5,   id: 'ice_spike' },              // 55 — Swim
    { level: 10, id: 'enchant_lock' },           // 50, anchor 30% — Toxin
    { level: 15, id: 'fog_sap' },                // 50, erosion + pwr-
    { level: 22, id: 'quake_dust' },             // 55, pwr- agi- — Clay
    { level: 29, id: 'iron_crush' },             // 70
  ],

  // Pins you in the light, then flares.
  firefly: [
    { level: 5,   id: 'illuminate' },             // 45 Enlighten — Lumina, its literal rune
    { level: 10, id: 'mana_shard' },             // 55
    { level: 15, id: 'bolt_rush' },              // 50, strikes first — Spark
    { level: 22, id: 'tide_pulse' },             // 55, surge
    { level: 29, id: 'enchant_lock' },           // 50, anchor 30% — Gleam
  ],

  // Buffs itself and outruns the answer.
  rabbit: [
    { level: 5,   id: 'stone_throw' },            // 55 — Warren
    { level: 10, id: 'bolt_rush' },              // 50, strikes first — Dash
    { level: 15, id: 'breeze_lift' },            // agi+ pwr+ — Fortune, the one utility pick
    { level: 22, id: 'aqua_stream' },            // 50, regen — Paddle
    { level: 29, id: 'tide_pulse' },             // 55, surge
  ],

  // Refuses to fall over, and grinds you down while it waits.
  'water-bear': [
    { level: 5,   id: 'tide_pulse' },             // 55, surge — Suspend
    { level: 10, id: 'stone_throw' },            // 55
    { level: 15, id: 'gem_shell' },              // grd++ — Resist, the one utility pick
    { level: 22, id: 'ice_spike' },              // 55 Ice Dart — Micro. NOT a pwr-debuff: this is the
                                                 // species the ally party tanks with, and a debuff here
                                                 // meets its own mirror, where both sides floor each
                                                 // other's power behind stacked guard and nothing dies
    { level: 29, id: 'iron_crush' },             // 70 — Endure. A CLEAN capstone on purpose: a pwr-debuff here, on the kit the ally party tanks with, stalemated the L50 mirror outright
  ],

  // Takes what it needs and leaves you emptier.
  hummingbird: [
    { level: 5,   id: 'vapor_drain' },            // 45, erosion — Siphon
    { level: 10, id: 'ice_spike' },              // 55 — Mist
    { level: 15, id: 'breeze_lift' },            // agi+ pwr+ — Flutter, the one utility pick
    { level: 22, id: 'aqua_stream' },            // 50, regen
    { level: 29, id: 'fog_sap' },                // 50, erosion + pwr-
  ],

  // The wall that eventually clamps shut.
  turtle: [
    { level: 5,   id: 'stone_throw' },            // 55
    { level: 10, id: 'metal_snare' },            // 55 Shackle, anchor — Metalergy
    { level: 15, id: 'gem_shell' },              // grd++ — Barrier, the one utility pick. Sits at 19,
                                                 // not 14: Still-Breath still occupies a kit slot until
                                                 // then, so a lv14 utility pick leaves one real strike
    { level: 22, id: 'tide_pulse' },             // 55, surge — Hydro
    { level: 29, id: 'manalic_lance' },          // 70 — Static
  ],

  // Blinds, holds, and eats the guard.
  bat: [
    { level: 5,   id: 'enchant_lock' },           // 50, anchor — Sonar, the pin it hears you into
    { level: 10, id: 'illuminate' },             // 45 Enlighten, anchor
    { level: 15, id: 'vapor_drain' },            // 45, erosion — Shroud
    { level: 22, id: 'metal_snare' },            // 55 Shackle, anchor 35% — Cavern
    { level: 29, id: 'storm_scatter' },          // 60, erosion + grd-
  ],
}

/** Every base-learnset move a spirit of this species has reached by `level`, in learn order.
 *  Ids resolve through ALL_MOVES here (not at module scope) — see the import note above. */
export function baseLearnedBy(species: Species, level: number): Move[] {
  const out: Move[] = []
  for (const entry of BASE_LEARNSET[species] ?? []) {
    if (level < entry.level) continue
    const move = ALL_MOVES[entry.id]
    if (move) out.push(move)
  }
  return out
}
