// collar-raid.ts — real-time Moglin raiders for the Ather regions (#294).
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────────
// The rune kit has been a worse gun for as long as the only PvE was turn-based. The fix is NOT
// to move enemies onto the gun-legal side — that re-creates the redundancy (a coloured bolt is a
// worse bullet). It is to put real-time enemies where guns cannot go: the Ather. `realm: 'ather'`
// holsters weapons by construction, so in a region the rune kit is not *an* answer, it is the
// only one. That is the whole point of #294 and the reason this module is region-side.
//
// ── CANON, transcribed — `design-briefs/moglins.md` ────────────────────────────
// The design was already written; almost nothing here is invented.
//   · **"The species is not the sin, the collar is."**
//   · Collared: puffed chest, up on tiptoe, borrowed swagger — *"feels ten feet tall," "gains a
//     spine."* The collared spirit looms beside them AS the borrowed power.
//   · Deflated: *"the swagger drains the moment the spirit is freed"* — instantly slumps round,
//     the sweet harmless creature he always was. The visual payoff of every book.
//   · The collar binds **spirits only**; a collared spirit's *"glow is extinguished, body drained
//     grey."* Freeing it returns the colour — the greying, run backwards, at cozy scale.
//   · Moglins take spirits as **stock** (Hemlock's inventory-ledger). Theft is the threat.
//
// ── THE MECHANICAL CONSEQUENCE — a raider has NO HP AND CANNOT BE KILLED ───────
// The collar is the only resource in this module. There is deliberately no `hp` field: you cannot
// shoot a teddy bear, and the game should not let you try. Break the collar and the fight is over,
// because canon says the swagger was never his. **That single omission is the whole moral engine
// of the cozy line expressed as a data structure**, and it is why a gun could not fight this even
// if one existed here.
//
// The stakes are theft, not death. A raider does not come for the player's HP — it comes for a
// wild spirit, and losing means it walks away with one. You cannot shoot an abduction.
//
// ── WHAT'S MINE (build) ────────────────────────────────────────────────────────
// Every number, the mode machine, integrity as a resource, and the disarm-is-a-window call.
// Canon fixes what a Moglin IS and what the collar MEANS; how it plays is this file's business.
//
// Pure step function — no THREE, no React, no clock of its own. Same discipline as
// puppet-guards.ts and crucible-phases.ts, so the whole thing is provable headless.

import { type StatusBag, hasStatus } from './statuses'

export type RaidMode =
  | 'patrol'    // walking its loop, hasn't noticed anything
  | 'stalk'     // has a quarry (a wild spirit) and is closing on it
  | 'collaring' // stopped, working the collar onto the quarry — the window to interrupt
  | 'loom'      // aware of the player, using borrowed power to keep them off
  | 'deflated'  // collar broken. Harmless, permanently. Canon's payoff.

/**
 * What a raid is ABOUT — the tier of the spirit at stake. Alex's call 2026-08-05, and it costs
 * almost nothing because every point of pressure in this module already comes from the bound
 * spirit: raise the tier of the thing collared and the whole fight scales with it.
 *
 * Canon tiers the MOGLINS to match, so difficulty reads twice — once off the spirit, once off who
 * came for it (`design-briefs/moglins.md`): **Thornlords** are *"the small end of the collar-
 * culture… one collared spirit each"*; **Hemlock** is *"bigger, colder, better-kept… multiple
 * collars."* The middle class has no canon name, so this enum tiers by the SPIRIT (canon-neutral)
 * and leaves naming the moglin class to Magii.
 *
 * ★ 'awakened' IS DELIBERATELY NOT A REPEATABLE RAID. Only ONE awakened form is named in canon —
 * **Hibernyx**, the awakened Dewbear — and canon says outright that Hemlock's *"great empty cage
 * was built for"* one and *"the cage is empty because he has hunted one for years and never caught
 * it."* So an awakened raid MUST NOT be losable into a capture: a raid that ends with Hemlock
 * collaring a Hibernyx contradicts a fact already printed in Benji's books. See `canTake` below —
 * that rule is enforced in code, not left to a designer's memory.
 */
export type RaidTier = 'base' | 'second' | 'awakened'

export const TIER_DIALS: Record<RaidTier, {
  /** how many spirits are at stake — groups at the low tier, a single prize at the top */
  quarries: number
  /** collar integrity: how long the fight lasts */
  integrity: number
  /** borrowed-power pressure while looming */
  loomDps: number
  /** seconds to fit a collar — a bigger spirit does not go quietly */
  collarSecs: number
  /** ★ can this raid END with the spirit taken? Canon says no at the top. */
  canTake: boolean
}> = {
  base:     { quarries: 3, integrity: 70,  loomDps: 5,  collarSecs: 3.0, canTake: true },
  second:   { quarries: 1, integrity: 120, loomDps: 9,  collarSecs: 5.0, canTake: true },
  // Hemlock-class. It cannot be won BY him — you are always racing to stop something that,
  // in the books, never actually happened.
  awakened: { quarries: 1, integrity: 200, loomDps: 14, collarSecs: 8.0, canTake: false },
}

export const RAID_TUNING = {
  /** how close a raider must be to notice the player at all */
  noticeRange: 7,
  /** it breaks off looming and returns to its quarry beyond this */
  loseRange: 11,
  /** metres/sec closing on a quarry */
  stalkSpeed: 1.6,
  /** metres/sec while looming — slower; it is posturing, not charging */
  loomSpeed: 0.9,
  /** how close it needs to be to start working a collar on */
  collarRange: 1.2,
  /** seconds between borrowed-power pushes while looming */
  loomCadence: 1.4,
  // NOTE: collar integrity, collar time and loom damage moved to TIER_DIALS when difficulty
  // tiers landed (2026-08-05). They are NOT duplicated here on purpose — a second copy of a
  // tuning value is a lie waiting to be read by whoever edits the wrong one.
} as const

export interface RaiderSpec {
  id: string
  /** where its patrol loop is anchored — it returns here when it loses interest */
  homeX: number
  homeY: number
}

export interface Raider {
  id: string
  tier: RaidTier
  x: number
  y: number
  mode: RaidMode
  /**
   * The collar. `null` = a FREE moglin (Jimbo, the warren) — never hostile, never a target.
   * Canon is explicit that the free ones are the same creature without the collar, so the type
   * carries that: no collar, no fight, and the same entity covers both.
   */
  collar: { integrity: number; max: number } | null
  /**
   * The spirit currently bound — the source of every point of pressure this raider applies.
   * `greyed` is canon's drained state; freeing flips it and the colour returns.
   */
  bound: { quarryId: string; greyed: boolean } | null
  /** the wild spirit it is currently hunting (opaque id — this module never learns what a spirit is) */
  quarryId: string | null
  /** seconds of collar work banked on the current quarry; resets if interrupted */
  collarProgress: number
  /** cooldown on the next borrowed-power push */
  pushCd: number
}

export interface Quarry {
  id: string
  x: number
  y: number
}

export interface RaidContext {
  playerX: number
  playerY: number
  /** wild spirits available to be taken. A raider with no quarry just patrols. */
  quarries: readonly Quarry[]
  statuses: StatusBag
  nowMs: number
}

export interface RaidStep {
  raiders: Raider[]
  /** damage to apply to the player this step (borrowed power only — never a raider's own) */
  playerDamage: number
  /** quarries taken this step. The loss state: it walked away with one. */
  taken: string[]
  /** quarries freed this step — colour returns. The payoff. */
  freed: string[]
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)

/** status target id for a raider — matches the opaque-id contract in statuses.ts */
export const raidTarget = (id: string) => `raid:${id}`

export function spawnRaider(spec: RaiderSpec, collared = true, tier: RaidTier = 'base'): Raider {
  const dial = TIER_DIALS[tier]
  return {
    id: spec.id,
    tier,
    x: spec.homeX,
    y: spec.homeY,
    mode: 'patrol',
    collar: collared ? { integrity: dial.integrity, max: dial.integrity } : null,
    bound: null,
    quarryId: null,
    collarProgress: 0,
    pushCd: 0,
  }
}

/**
 * Strike a raider's collar. THE only way to affect a raider, and the only reason a rune beats a
 * bullet here: you are not damaging a creature, you are breaking an object it is using.
 *
 * Returns the raider plus whether this strike broke it, so the caller can fire the payoff.
 */
export function strikeCollar(r: Raider, amount: number): { raider: Raider; broke: boolean; freedQuarry: string | null } {
  if (!r.collar || r.mode === 'deflated') return { raider: r, broke: false, freedQuarry: null }
  const integrity = Math.max(0, r.collar.integrity - amount)
  if (integrity > 0) return { raider: { ...r, collar: { ...r.collar, integrity } }, broke: false, freedQuarry: null }

  // ── the deflate. Canon: "the swagger drains the MOMENT the spirit is freed" ──
  // Everything goes at once — collar, bound spirit, quarry, progress. There is no wounded state
  // and no second phase, because canon does not describe one: he is simply the sweet creature
  // again. Permanent for this raider; nothing in this module can re-arm it.
  return {
    raider: { ...r, collar: null, bound: null, quarryId: null, collarProgress: 0, mode: 'deflated' },
    broke: true,
    freedQuarry: r.bound?.quarryId ?? null,
  }
}

/** One step of the whole raid. Pure: same inputs, same outputs, no clock of its own. */
export function stepRaid(raiders: readonly Raider[], dt: number, ctx: RaidContext): RaidStep {
  const out: Raider[] = []
  const taken: string[] = []
  const freed: string[] = []
  let playerDamage = 0

  for (const prev of raiders) {
    let r = { ...prev }

    // A deflated or free moglin is done — no collar, no fight, no upkeep. Canon's whole point.
    if (r.mode === 'deflated' || !r.collar) { out.push(r); continue }

    const target = raidTarget(r.id)
    const rooted = hasStatus(ctx.statuses, target, 'rooted', ctx.nowMs)
    const disarmed = hasStatus(ctx.statuses, target, 'disarmed', ctx.nowMs)
    const blinded = hasStatus(ctx.statuses, target, 'blinded', ctx.nowMs)

    r.pushCd = Math.max(0, r.pushCd - dt)

    // ── pick a quarry: the nearest wild spirit not already bound ──
    if (!r.quarryId) {
      let best: Quarry | null = null
      let bestD = Infinity
      for (const q of ctx.quarries) {
        const d = dist(r.x, r.y, q.x, q.y)
        if (d < bestD) { bestD = d; best = q }
      }
      r.quarryId = best?.id ?? null
    }
    const quarry = ctx.quarries.find((q) => q.id === r.quarryId) ?? null
    if (!quarry) r.quarryId = null

    // ── does it see the player? blinded raiders do not. ──
    const dPlayer = dist(r.x, r.y, ctx.playerX, ctx.playerY)
    const sees = !blinded && dPlayer <= RAID_TUNING.noticeRange

    // ── MODE ──
    // Looming outranks collaring: canon's collared moglin is a poser, and a poser turns to face
    // whoever is watching. It also gives the player a reliable way to pull a raider OFF a spirit
    // by walking at it — a rescue by presence, before a single cast.
    if (sees && dPlayer <= RAID_TUNING.loseRange) r.mode = 'loom'
    else if (quarry) r.mode = dist(r.x, r.y, quarry.x, quarry.y) <= RAID_TUNING.collarRange ? 'collaring' : 'stalk'
    else r.mode = 'patrol'

    // Interrupting resets the work. The collar is never half-on.
    if (r.mode !== 'collaring') r.collarProgress = 0

    // ── ACT ──
    if (r.mode === 'loom') {
      // ★ DISARM IS A WINDOW, NOT A WIN. Canon's Shackle "jams a manalic weapon mid-draw" — so a
      // disarmed raider keeps its collar and keeps its nerve, it just cannot spend the borrowed
      // power. That buys the seconds to break the collar; it does not end anything by itself.
      // Making disarm a kill would collapse the fight into one button.
      const hasPower = !!r.bound && !disarmed
      if (!rooted) {
        const step = RAID_TUNING.loomSpeed * dt
        const away = dPlayer < 2.5 ? -1 : 1   // it postures at a distance rather than hugging you
        if (dPlayer > 0.001) {
          r.x += ((ctx.playerX - r.x) / dPlayer) * step * away
          r.y += ((ctx.playerY - r.y) / dPlayer) * step * away
        }
      }
      if (hasPower && r.pushCd <= 0) {
        playerDamage += TIER_DIALS[r.tier].loomDps
        r.pushCd = RAID_TUNING.loomCadence
      }
    } else if (r.mode === 'stalk' && quarry && !rooted) {
      const d = dist(r.x, r.y, quarry.x, quarry.y)
      const step = RAID_TUNING.stalkSpeed * dt
      if (d > 0.001) {
        r.x += ((quarry.x - r.x) / d) * step
        r.y += ((quarry.y - r.y) / d) * step
      }
    } else if (r.mode === 'collaring' && quarry) {
      // Rooted still lets it work — its hands are free, canon's clamp is on the feet. Disarmed
      // does not: you cannot fit a collar you cannot hold.
      if (!disarmed) {
        r.collarProgress += dt
        // ★ At the top tier the bar fills and then simply RESETS: canon has Hemlock hunting one
        // for years and never catching it, so the pressure is real and the capture never lands.
        // Enforced here rather than trusted to a level designer — the failure state at this tier
        // is that you lose the CHANCE, never that the books get contradicted.
        if (r.collarProgress >= TIER_DIALS[r.tier].collarSecs && !TIER_DIALS[r.tier].canTake) {
          r.collarProgress = 0
          r.quarryId = null
        } else if (r.collarProgress >= TIER_DIALS[r.tier].collarSecs) {
          // It landed one. The loss state — and note it is a LOSS OF RESCUE, not of your own
          // party: cozy stakes are "did you save it", never "did you lose yours".
          taken.push(quarry.id)
          r.bound = { quarryId: quarry.id, greyed: true }
          r.collarProgress = 0
          r.quarryId = null
        }
      }
    }

    out.push(r)
  }

  return { raiders: out, playerDamage, taken, freed }
}

/**
 * Break a collar from a cast. Wraps `strikeCollar` for the whole array and reports the freed
 * spirit so the renderer can run the payoff: grey draining back to colour.
 */
export function strikeRaider(raiders: readonly Raider[], id: string, amount: number): RaidStep {
  const out: Raider[] = []
  const freed: string[] = []
  for (const r of raiders) {
    if (r.id !== id) { out.push(r); continue }
    const res = strikeCollar(r, amount)
    out.push(res.raider)
    if (res.broke && res.freedQuarry) freed.push(res.freedQuarry)
  }
  return { raiders: out, playerDamage: 0, taken: [], freed }
}

/** Is this raid over? Used to retire the encounter and let the zone go quiet again. */
export const raidSettled = (raiders: readonly Raider[]) =>
  raiders.every((r) => r.mode === 'deflated' || !r.collar)
