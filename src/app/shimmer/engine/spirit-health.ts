// Spirit wounds that OUTLIVE a fight.
//
// Before this, every arena fight built its fighters at full HP and threw the result away, so a
// battle cost nothing but time. Now damage sticks: you walk out of the meadow with a half-dead
// party and you either brew something or you wait. That is the intended pressure — it is what
// turns gathering and alchemy from a side loop into the thing that funds the next fight.
//
// ── Why a FRACTION and not an absolute HP number ──
// A spirit's maxHp is derived (`derivePartyStats`), grows with level, and the arena scales it
// again by HP_MULT — a live pacing knob that has already moved once (1.8 -> 2.4 when base spirits
// gained real kits). If we stored "47 HP", the next pacing retune would silently wound or heal
// every spirit in every existing save, and a level-up would quietly change how hurt you are.
// A fraction is immune to both. Same reasoning as storing logical zone+tile instead of world px.
//
// The fraction is also arena-scale-free on the way IN: hp/maxHp inside a fight is the same ratio
// in either space, so HP_MULT cancels and the write-back needs no knowledge of it.
import type { Spirit } from '../spirits/spirit'
import { derivePartyStats } from './party-stats'

// ── Recovery dials ──────────────────────────────────────────────────────────
// The trickle is the ANTI-SOFTLOCK VALVE, not a strategy. A player who is broke, out of
// ingredients and holding a wrecked party must always have a way back, or the save is dead.
// It is deliberately slow enough that brewing is always the better answer.
export const REGEN_FRAC_PER_MIN = 0.02   // wounded: 2% of a bar per minute out of combat (0 -> full = 50 min)
// The wipe valve runs on its OWN clock, deliberately not a multiple of the trickle above. Setting
// REGEN_FRAC_PER_MIN to 0 is a legitimate "wounds only heal with potions" configuration, and if the
// valve were scaled off it, that setting would make a total wipe UNRECOVERABLE. It must never be 0.
export const WIPE_REVIVE_FRAC_PER_MIN = 0.01
export const REVIVE_FRAC = 0.15          // how far the valve (and a salve's revive) lifts a downed spirit
// A spirit left resting at the Home Plot is safe and tended, so it knits back faster than one
// trudging around a zone with you. This is what makes leaving a hurt spirit home a real decision
// rather than a shelf: you trade a body in the lineup for a quicker mend.
export const REST_REGEN_MULT = 3

/** hpFrac with the default applied. Old saves and any spirit built before this existed read as 1. */
export function hpFracOf(spirit: Spirit): number {
  const f = spirit.hpFrac
  if (typeof f !== 'number' || Number.isNaN(f)) return 1
  return clamp01(f)
}

export function maxHpOf(spirit: Spirit): number {
  return derivePartyStats(spirit).maxHp
}

/** Absolute current HP in party-stat space — for display ("47 / 120"), not for the arena. */
export function currentHpOf(spirit: Spirit): number {
  const max = maxHpOf(spirit)
  const hp = hpFracOf(spirit) * max
  // Never round a live spirit down to 0 — that would read as downed in the UI while it can still fight.
  return hp > 0 ? Math.max(1, Math.round(hp)) : 0
}

/** Downed: out of the fight until healed. Distinct from "nearly dead", which can still be fielded. */
export function isDowned(spirit: Spirit): boolean {
  return hpFracOf(spirit) <= 0
}

/** Can this spirit be sent into a battle at all? */
export function canFight(spirit: Spirit): boolean {
  return !isDowned(spirit)
}

// ── active party vs the ones resting at home ────────────────────────────────
// `inParty` shipped on the Spirit type long ago and was never once written or read in play3d —
// the walker treated "every spirit you own" and "your party" as the same list. These two helpers
// are the seam that separates them; everything that means "who fights" goes through them.
export function activeSpirits(owned: Spirit[]): Spirit[] {
  return owned.filter(s => s.inParty !== false)
}
export function restingSpirits(owned: Spirit[]): Spirit[] {
  return owned.filter(s => s.inParty === false)
}

/** The fieldable members of a party, in order. Empty = the player cannot start a fight. */
export function fieldableSpirits(party: Spirit[]): Spirit[] {
  return party.filter(canFight)
}

export function partyAllDowned(party: Spirit[]): boolean {
  return party.length > 0 && party.every(isDowned)
}

// ── Write-back ──────────────────────────────────────────────────────────────
/**
 * Record what a fight left of a spirit. `hp`/`maxHp` are the ARENA's numbers (already scaled by
 * HP_MULT); the ratio is scale-free so nothing here needs to know that constant.
 * A fighter that ends a fight at 0 is downed, and that is the only way to reach 0.
 */
export function applyFightResult(spirit: Spirit, hp: number, maxHp: number): void {
  if (!(maxHp > 0)) return          // guard a malformed fighter rather than writing NaN into a save
  spirit.hpFrac = clamp01(hp / maxHp)
}

// ── Healing ─────────────────────────────────────────────────────────────────
/**
 * Heal by an absolute HP amount (what a potion is denominated in). Returns HP actually restored,
 * so a caller can refuse to spend the item when it would do nothing.
 * Does NOT raise the downed — reviving is a separate, deliberately more expensive act.
 */
export function healSpirit(spirit: Spirit, amount: number): number {
  if (isDowned(spirit) || amount <= 0) return 0
  const max = maxHpOf(spirit)
  const before = hpFracOf(spirit)
  const after = clamp01(before + amount / max)
  spirit.hpFrac = after
  return Math.round((after - before) * max)
}

/** Heal by a fraction of the spirit's own bar — for percentage-based effects. */
export function healSpiritFrac(spirit: Spirit, frac: number): number {
  if (isDowned(spirit) || frac <= 0) return 0
  return healSpirit(spirit, frac * maxHpOf(spirit))
}

/** Bring a downed spirit back up. Returns false if it was not actually downed (don't burn the item). */
export function reviveSpirit(spirit: Spirit, frac = REVIVE_FRAC): boolean {
  if (!isDowned(spirit)) return false
  spirit.hpFrac = clamp01(Math.max(frac, 0.01))
  return true
}

/**
 * Who a mend potion should go to, with no target UI in the way.
 * A downed spirit outranks everything — getting a body back on its feet is always worth more than
 * topping one up — then the most wounded. Returns null when the whole party is untouched, so the
 * caller can refuse the drink instead of wasting the item.
 */
export function pickMendTarget(party: Spirit[]): Spirit | null {
  const downed = party.filter(isDowned)
  if (downed.length > 0) return downed[0]
  let worst: Spirit | null = null
  let worstFrac = 1
  for (const s of party) {
    const f = hpFracOf(s)
    if (f < worstFrac) { worst = s; worstFrac = f }
  }
  return worst
}

// ── roster moves ────────────────────────────────────────────────────────────
/**
 * How many spirits a keeper may field at once.
 *
 * ── ⚠⚠ IT LIVES HERE BECAUSE IT WAS ABOUT TO BE COPIED A THIRD TIME (2026-08-27) ───────────────
 * It was a PRIVATE const in `play3d/Shimmer3D.tsx` and a bare literal `4` in `voxel3d`'s spar
 * roster, and the voxel world was about to grow a third copy the day anything wired the cap there.
 * Two worlds, one rule. Every helper below already takes `maxParty` as a parameter — the number had
 * a home shaped for it and no number in it.
 *
 * ★ AND A CONST IN A WORLD COMPONENT IS INVISIBLE TO THE OTHER WORLD BY CONSTRUCTION, which is how
 * `voxel3d` ended up with no cap at all: `potOps.gain` appended to the party unbounded, so blooming
 * ten spirits fielded ten. Same shape as the seam that froze at `DEFAULT_PLOT` the same night — a
 * fact one consumer owns privately while another consumer needs it.
 */
export const MAX_PARTY = 4

/**
 * Send a spirit to rest at the Home Plot, or call one back into the active party.
 * Returns null on success, or a reason string the caller can surface.
 *
 * The cap has only ever been enforced at FIGHT time (`slice(0, MAX_PARTY)`), which meant a fifth
 * spirit silently became a permanent non-combatant — owned, fed, levelled, and never fielded, with
 * nothing anywhere saying why. Enforcing it on the roster is what makes that state impossible.
 */
export function setSpiritActive(owned: Spirit[], spirit: Spirit, active: boolean, maxParty: number): string | null {
  if (active && spirit.inParty !== false) return null
  if (!active && spirit.inParty === false) return null
  if (active && activeSpirits(owned).length >= maxParty) return 'Your party is full'
  // Refusing to empty the party outright: an empty lineup is a legal state (a new game has one),
  // but walking into it by accident mid-run means every encounter refuses you with no clue why.
  if (!active && activeSpirits(owned).length <= 1) return 'Keep at least one spirit with you'
  spirit.inParty = active
  return null
}

/** Existing saves predate the active/resting split — everyone loaded as active, however many.
 *  Keep the first `maxParty` and rest the overflow, so a legacy roster lands in a legal shape. */
export function normalizeRoster(owned: Spirit[], maxParty: number): void {
  let active = 0
  for (const s of owned) {
    if (s.inParty === false) continue
    active += 1
    if (active > maxParty) s.inParty = false
  }
}

/** Full party restore — the rest/sleep path, if one is ever wired to a bed or a healer. */
export function restoreParty(party: Spirit[]): void {
  for (const s of party) s.hpFrac = 1
}

// ── The trickle ─────────────────────────────────────────────────────────────
/**
 * Out-of-combat recovery. Call with real elapsed seconds while the player is walking the world.
 *
 * Wounded spirits creep back on their own. Downed ones do NOT — with one exception: if the WHOLE
 * party is down, the lead crawls back to REVIVE_FRAC so the save can never dead-end. That single
 * carve-out is the difference between "grinding is the fast path" and "grinding is the only path,
 * and if you can't, the game is over."
 */
export function tickRecovery(owned: Spirit[], dtSeconds: number): void {
  if (dtSeconds <= 0 || owned.length === 0) return
  const perMin = dtSeconds / 60

  // Anyone still standing knits back together on the ordinary clock — faster if they're resting
  // at home rather than out walking a zone with you.
  for (const s of owned) {
    if (isDowned(s)) continue       // a downed spirit whose party still has legs stays down
    const f = hpFracOf(s)
    if (f >= 1) continue
    const rate = REGEN_FRAC_PER_MIN * (s.inParty === false ? REST_REGEN_MULT : 1)
    s.hpFrac = clamp01(f + rate * perMin)
  }

  // ── the anti-softlock valve ──
  // Keyed on EVERY SPIRIT YOU OWN, not on the active four. A healthy spirit resting at home means
  // there was never a dead end: the player just swaps it in. Firing the valve then would hand out
  // a free revive to someone who didn't need rescuing — and would do it constantly, since a party
  // wipe with reserves on the bench is the ordinary outcome of a hard fight, not an emergency.
  // Rescue the lead of the active party — the one the player actually fields — falling back to the
  // first owned spirit if nothing is marked active.
  const lead = activeSpirits(owned)[0] ?? owned[0]
  // Gated on "everyone EXCEPT the lead is down, and the lead is still under the sliver", never on
  // "everyone is down": the latter stops being true the instant the lead ticks off zero, so the cap
  // would never hold and the lead would heal free to full. This is the same trap the oracle caught
  // the first time the valve was written — it is easy to re-introduce, hence the assert.
  const othersAllDown = owned.every(s => s === lead || isDowned(s))
  if (othersAllDown && hpFracOf(lead) < REVIVE_FRAC) {
    lead.hpFrac = Math.min(REVIVE_FRAC, hpFracOf(lead) + WIPE_REVIVE_FRAC_PER_MIN * perMin)
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0
  return v < 0 ? 0 : v > 1 ? 1 : v
}
