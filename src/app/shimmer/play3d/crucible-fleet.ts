// crucible-fleet.ts — the roster, given brains.
//
// ── THE THREE PIECES, AND WHY THIS IS THE JOIN ────────────────────────────────────────────────
// `crucible-bots.ts` fills the roster: 20 entrances x 3 challengers = 60, canon's own activation
// condition, deterministic from a seed. `engine/hunter-ai.ts` is one challenger's behaviour —
// close, orbit, return fire — extracted out of the firing range. Neither knows about the other:
// a roster is a list of names, and a brain has no idea it is one of sixty.
//
// This joins them. It owns exactly two things the other two cannot: **who each bot is fighting**,
// and **that sixty of them stay in lockstep across clients.**
//
// ── ★ DETERMINISM IS THE WHOLE CONTRACT, AND IT IS EASY TO LOSE HERE ──────────────────────────
// `fillRoster` is deterministic. `stepHunter` is deterministic *given its rng*. That guarantee dies
// the moment this file hands out a shared stream, because then a bot's draws depend on the ORDER
// every other bot happened to draw in — and order is exactly what diverges when one client drops a
// frame. So **every bot gets its own stream, seeded by its roster index**, and no bot ever reads
// another's. A fleet is deterministic only if each member is independently deterministic.
//
// ── ★ TARGETING IS NEAREST-ENEMY, AND "ENEMY" IS SQUAD-RELATIVE ───────────────────────────────
// Canon: 20 squads converge on a sealed portal and thin each other out. So a bot's enemy is anyone
// not in its own squad — which makes a squad a real unit rather than a spawn colour, and makes the
// arena converge on its own. Ties break on index, never on iteration order, or two clients pick
// different targets from an identically-ordered list and the whole match forks.

import { type Challenger, type Roster } from './crucible-bots'
import { defaultLoadout, isBuilt, laneRunes } from './cast'
import { KEEPER_MOVES } from './keeper-moves'
import { RUNES } from './birth/runes.data'
import { type Book } from './scroll-market'
import { mulberry32 } from '../engine/arena'
import {
  stepHunter, hunterRng, createHunter, RANGE_HUNTER,
  type HunterState, type HunterCtx, type HunterIntent, type HunterTuning,
} from '../engine/hunter-ai'

/**
 * ── ★★★ A CHALLENGER'S PREMADE LOADOUT (2026-08-26, row 294 — Alex: "ai run premade loadouts to
 * simulate the battle royal") ──────────────────────────────────────────────────────────────────
 *
 * A bot's kit is DERIVED, never authored: pick a birth rune, then run it through the same
 * `defaultLoadout` the player's own bag runs through. That means the Lane Law scopes a bot exactly
 * as it scopes a keeper — tacticals from its element lane, signature from its state lane — and a
 * bot cannot hold a kit no player could hold. **There is no second table to drift.**
 *
 * ⚠ THIS IS ALSO A LIVE TEST OF THE LANE LAW, WHICH IS WHY IT IS WORTH DOING THIS WAY ROUND. The
 * two starved state lanes (Compact and Bind, see `cast.test.ts`) mean some birth runes derive NO
 * signature — a bot born of Gem gets a tactical and an empty ultimate. That is the real coverage
 * debt showing up as a real fight, rather than as a number in a test nobody reads.
 *
 * ⚠ AND THE BOOK IS DELIBERATELY WIDE OPEN. A challenger answered a beacon broadcast across the
 * galaxy to enter a death tournament; they are not an apprentice with three scrolls. Giving them
 * every move LEARNED means their birth rune alone decides the kit, through the Lane Law — which is
 * the whole point. It is not a shortcut around the book; it is a statement about who these are.
 */
const BOT_BOOK: Book = { learned: KEEPER_MOVES.map((m) => m.id) }

/** Runes a challenger can be born of — `lostState` runes are never on the birth carousel. */
const BIRTHABLE = RUNES.filter((r) => !r.lostState)

/**
 * The birth rune for roster slot `index`, deterministic from the match seed.
 *
 * ⚠ NOT `Math.random`, and not the member's combat stream either. This is drawn from its own
 * derivation so that adding, removing or re-tuning a COMBAT draw can never shuffle who everybody
 * is — the identity of the roster has to be stable against changes to how they fight. Same
 * reasoning `crucible-bots.ts` gives for its own seeding, one layer along.
 */
export function botBirthRune(seed: number, index: number): string {
  const r = mulberry32((seed * 0x27d4eb2d + index * 0x165667b1 + 0x9e3779b9) >>> 0)
  return BIRTHABLE[Math.floor(r() * BIRTHABLE.length) % BIRTHABLE.length].id
}

/**
 * The bands this challenger will actually cast from — its default loadout with the empty slots
 * dropped, so an index into it is always a real move.
 *
 * ⚠ COMPACTED ON PURPOSE. `defaultLoadout` returns one entry per band and leaves a band it cannot
 * fill as `null` ("the coverage gap rendered, not a bug"). Handing `stepHunter` that length would
 * have it choose empty bands and simply not cast on those ticks — a bot born on a starved lane
 * would look like it had a broken cast rather than a narrower kit.
 */
export function botLoadout(birth: string): string[] {
  return defaultLoadout(botRunes(birth), birth, BOT_BOOK)
    .filter((id): id is string => id !== null)
    // ⚠⚠ BUILT MOVES ONLY, AND THIS IS A CORRECTNESS FILTER, NOT A TUNING ONE. `defaultLoadout`
    // prefers built moves and then falls back to registered-but-unbuilt ones on purpose: in a
    // PLAYER's bag that is the honesty rule working — the move is there, labelled `unbuilt` in the
    // HUD, and the coverage gap is visible instead of hidden. A BOT has no HUD and no label. It
    // would wind up, the host would resolve an archetype the sim cannot run, and nothing would
    // happen — an enemy that appears to cast and does not, which reads as a broken fight rather
    // than as an authoring gap. Measured before adding: without this, 15 of 59 challengers held an
    // unbuilt move, and a Barrier-born bot's ENTIRE kit was one unbuilt ultimate.
    .filter((id) => isBuilt(id))
}

/**
 * The runes a challenger actually holds: the one they were born of, and usually one they developed.
 *
 * ★ THE SECOND RUNE IS DRAWN FROM THEIR OWN LANES, WHICH IS CANON'S ORDINARY PATH, NOT A CHOICE I
 * MADE. `runes.md`: *"trained through focused practice using your birth rune"*, and everything on
 * your element and state lanes is *"naturally compatible — the growth a mage falls into with
 * practice, no teacher required."* Drawing off-lane would be inventing a costly, driven development
 * for sixty strangers, which canon says has to be DRIVEN and is nobody's default.
 *
 * ⚠ NOT EVERY CHALLENGER GETS ONE — canon: *"Not everyone develops a 2nd; fewer develop a 3rd."*
 * A roster where all sixty are two-rune mages would quietly make the rare thing ordinary, which is
 * the same drift the `lostState` runes are kept off the birth carousel to avoid. Most of a beacon-
 * answering tournament field being developed is defensible; all of it is not.
 */
export function botRunes(birth: string): string[] {
  const r = mulberry32((hashRune(birth) * 0x2545f491 + 0x94d049bb) >>> 0)
  if (r() > SECOND_RUNE_CHANCE) return [birth]
  const lanes = [...laneRunes(birth, 'element'), ...laneRunes(birth, 'state')].filter((id) => id !== birth)
  if (lanes.length === 0) return [birth]
  return [birth, lanes[Math.floor(r() * lanes.length) % lanes.length]]
}

/** How many challengers have developed a second rune. Jin's number; canon only says "not everyone". */
const SECOND_RUNE_CHANCE = 0.7

/** A stable integer for a rune id, so a challenger's development is a function of who they are. */
function hashRune(id: string): number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

export interface FleetMember {
  challenger: Challenger
  state: HunterState
  /** this member's private stream — never shared, never reseeded mid-match */
  rng: () => number
  /** roster index, and the tie-break for targeting */
  index: number
  /** what this challenger IS — drives their kit, and what a cast of theirs counts as */
  birth: string
  /** their premade kit, already compacted so every index is a real move */
  loadout: string[]
}

export interface Fleet {
  members: FleetMember[]
  /** the match seed every member's stream descends from */
  seed: number
}

/**
 * Give every BOT in the roster a brain. Humans are skipped — they have a player.
 *
 * Spawn positions are left at the origin deliberately: `stepHunter` places a member on its own
 * spawn ring on the first tick it is alive, so the host decides where "out" is by supplying the
 * target and fallback. A fleet that pre-placed its members would need to know the map.
 */
export function createFleet(roster: Roster, seed: number, tuning: HunterTuning = RANGE_HUNTER): Fleet {
  const members: FleetMember[] = []
  roster.challengers.forEach((c, i) => {
    if (!c.bot) return
    const state = createHunter(tuning)
    state.alive = false
    state.respawn = 0
    const birth = botBirthRune(seed, i)
    members.push({ challenger: c, state, rng: hunterRng(seed, i), index: i, birth, loadout: botLoadout(birth) })
  })
  return { members, seed }
}

/** A live body a bot can aim at — a fleet member, or the player standing in for one. */
export interface FleetTarget {
  x: number
  z: number
  /** squad 0..19, or -1 for the player (who is nobody's squadmate for targeting purposes) */
  squad: number
  alive: boolean
  /** stable tie-break so two clients never pick different targets from equal distances */
  index: number
}

/**
 * Nearest living body outside your own squad.
 *
 * ⚠ Distance ties break on `index`, deliberately. Two bodies at identical range is not a rare edge
 * in a symmetric arena — squads spawn on a ring, so mirrored distances are the NORMAL case at the
 * opening convergence, which is exactly when a fork would be invisible and permanent.
 */
export function pickTarget(self: FleetMember, bodies: FleetTarget[]): FleetTarget | null {
  let best: FleetTarget | null = null
  let bestD = Infinity
  for (const b of bodies) {
    if (!b.alive) continue
    if (b.index === self.index) continue
    if (b.squad >= 0 && b.squad === self.challenger.squad) continue
    const dx = b.x - self.state.x, dz = b.z - self.state.z
    const d = dx * dx + dz * dz
    if (d < bestD || (d === bestD && best !== null && b.index < best.index)) { bestD = d; best = b }
  }
  return best
}

export interface FleetStepResult {
  member: FleetMember
  intent: HunterIntent
  target: FleetTarget
}

/**
 * Step every living member one tick.
 *
 * `ctx` is a single object the caller mutates per member — one allocation for the whole fleet
 * rather than 60 per frame, the same discipline the range's own ctx follows. The caller supplies
 * `blocked` and the fallback; this fills in the target and the member's private rng.
 *
 * A member with nobody to fight is stepped with itself as a still target, which keeps its cooldowns
 * and orbit phase advancing — a bot that freezes when the arena thins reads as a hung game.
 */
export function stepFleet(
  fleet: Fleet,
  bodies: FleetTarget[],
  ctx: HunterCtx,
  dt: number,
  tuning: HunterTuning = RANGE_HUNTER,
): FleetStepResult[] {
  const out: FleetStepResult[] = []
  for (const m of fleet.members) {
    const t = pickTarget(m, bodies)
    ctx.targetX = t ? t.x : m.state.x
    ctx.targetZ = t ? t.z : m.state.z
    ctx.rng = m.rng
    // ⚠ PER MEMBER, and it must be re-set every member because `ctx` is one shared object. Leaving
    // a previous member's count here would let a bot with an empty kit cast from a band it does not
    // have — the shared-ctx hazard this function's own header calls out, in the newest field.
    ctx.castBands = m.loadout.length
    const intent = stepHunter(m.state, ctx, dt, tuning)
    if (t) out.push({ member: m, intent, target: t })
  }
  return out
}

/** Living bot count — the match-over read the host needs without walking the fleet itself. */
export function aliveCount(fleet: Fleet): number {
  let n = 0
  for (const m of fleet.members) if (m.state.alive) n++
  return n
}
