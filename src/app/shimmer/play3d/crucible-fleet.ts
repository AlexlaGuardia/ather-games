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
import {
  stepHunter, hunterRng, createHunter, RANGE_HUNTER,
  type HunterState, type HunterCtx, type HunterIntent, type HunterTuning,
} from '../engine/hunter-ai'

export interface FleetMember {
  challenger: Challenger
  state: HunterState
  /** this member's private stream — never shared, never reseeded mid-match */
  rng: () => number
  /** roster index, and the tie-break for targeting */
  index: number
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
    members.push({ challenger: c, state, rng: hunterRng(seed, i), index: i })
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
