// statuses.ts — SYSTEM 3 of 3: what a cast DOES to a mind, rather than to a body.
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// Shackle "binds metal against its bearer — clamp a foe in iron, or jam a manalic weapon mid-draw."
// Enlighten is "a flash-bang, not a blade." Cordon locks "all metal to the caster." None of these
// remove HP; every one of them removes an OPTION. That is the category a gun cannot reach, and the
// reason the rune kit stops being a worse gun once this exists.
//
// ── THE MODEL ──────────────────────────────────────────────────────────────────
// A flat bag of `target → kind → expiry(ms)`. Targets are opaque string ids ('hunter',
// 'guard:seren'), so this module never learns what an enemy is. Re-applying a status EXTENDS it
// rather than stacking it — stacking statuses is how a crowd-control system becomes a stun-lock.
//
// ── BOUNDARY ───────────────────────────────────────────────────────────────────
// The three kinds are read straight off canon's effect lines. Durations and radii are Jin's and
// live on the move's CastSpec. No move names in this module.
//
// ── ★ MOVED play3d/ → engine/ 2026-08-15 — THE 14th BOTH-WORLDS SYSTEM, AND IT COST NOTHING ─────
// The last dark archetype. `voxel3d` declared `supports` = SELF + projectile + field + terrain, so
// all 7 status casts (Enlighten · Shackle · Fog Bank · Lava Stride · Quake Step · Static Field ·
// Vein Puppet) refused with "not in this world yet" — honest, and still 7 keys that do nothing in
// the world Alex actually plays.
//
// ★ NOT ONE LINE OF THIS FILE CHANGED IN THE MOVE, and that is the design paying out rather than
// luck. The header above already promised it: *"targets are opaque string ids, so this module never
// learns what an enemy is."* play3d's targets are `'hunter'` / `'guard:seren'`; the voxel world's
// are Hollow ids. A module that had reached for a hunter's fields — the way `field-effects` once
// reached for a tile grid — would have needed the rewrite this one did not.
//
// ⚠ AND THE SYMMETRY HOLDS ON THE OTHER SIDE TOO: `hollows.ts` does not import this file. It takes
// two booleans (`rooted`, `blinded`) and never learns what a status system is, for exactly the
// reason stated above in reverse. The host is the only thing that knows both.

// ── ★ THE STATUS TABLE (2026-09-28, Alex: "do we have an established table of statuses..? this might be
// something to keep track of") ──────────────────────────────────────────────────────────────────────────
// There was none: three kinds lived in a type and nowhere else. The move-jobs pass (Alex marked all 64
// tacticals + signatures, guns carry the damage) needs ten, so the table is HERE, in the one module every
// world already imports, and `statuses.test.ts` fails if any CastSpec names a status the table lacks. The
// readable page is generated from `STATUS_TABLE`, never kept by hand beside it (a hand-kept mirror reads as
// corroboration and rots; PATTERNS.md).
//
// HARD statuses take an option away outright (move, fire, aim, cast). SOFT ones shade it. The difference is
// the lock rule below, which exists because two keepers chaining hard statuses could hold a third until
// they die (Alex's PvP concern on Enlighten, 09-28).
//
// ⚠ Labels are plain UI words on purpose. Whether keeper statuses should share the spirit battles' canon
// names (Ignition, Crystallize in `shimmer-battles.md`) is Magii's call; until it is ruled, a player reads
// "Burning" at a glance mid-fight. Numbers (slow %, vulnerable %) are Jin's.

export type StatusKind =
  | 'rooted'       // cannot move (Shackle: clamped in iron)
  | 'disarmed'     // cannot fire (Shackle jamming a weapon mid-draw; Cordon locking all metal)
  | 'blinded'      // cannot aim — moves and fires wildly (Enlighten: disorients)
  | 'silenced'     // cannot cast or sprint (Drowning Grasp: no breath)
  | 'slowed'       // moves slower (Ice Dart, Pressure Drop, Squall)
  | 'staggered'    // footing lost: a brief stop (Quake Step, Wind Shear, Riptide)
  | 'revealed'     // shows through walls to the caster's party (Enlighten, Bolt Snipe, Waymark)
  | 'burning'      // damage over time, from Amp shots only (Flame Infusion, Flashpoint, Emberglass)
  | 'vulnerable'   // takes more gun damage (Grindstone, Shatterfield)
  | 'shieldBroken' // shield gone and not regenerating (Crystal Barrage, Volcano Spike)

export interface StatusDef {
  label: string
  /** what it does, in one line a player reads */
  effect: string
  /** takes an option away outright: subject to the lock rule */
  hard: boolean
  /** the marker's colour above an affected foe */
  color: number
}

export const STATUS_TABLE: Record<StatusKind, StatusDef> = {
  rooted:       { label: 'Rooted',        hard: true,  color: 0xc79a6b, effect: 'Cannot move.' },
  disarmed:     { label: 'Disarmed',      hard: true,  color: 0xe2b84f, effect: 'Cannot fire.' },
  blinded:      { label: 'Blinded',       hard: true,  color: 0xf2efe6, effect: 'Aim scatters; loses track of you.' },
  silenced:     { label: 'Silenced',      hard: true,  color: 0x6fb7e8, effect: 'Cannot cast or sprint.' },
  slowed:       { label: 'Slowed',        hard: false, color: 0x8fd3f0, effect: 'Moves slower.' },
  staggered:    { label: 'Staggered',     hard: false, color: 0xd9a0ff, effect: 'Footing lost: a brief stop.' },
  revealed:     { label: 'Revealed',      hard: false, color: 0xff6a5a, effect: 'Shows through walls to your party.' },
  burning:      { label: 'Burning',       hard: false, color: 0xe8894a, effect: 'Takes damage over time.' },
  vulnerable:   { label: 'Vulnerable',    hard: false, color: 0xd9695b, effect: 'Takes more gun damage.' },
  shieldBroken: { label: 'Shield broken', hard: false, color: 0x7fc2ff, effect: 'Shield gone, not regenerating.' },
}

export const STATUS_KINDS: readonly StatusKind[] = Object.keys(STATUS_TABLE) as StatusKind[]

/** How much a slowed body keeps of its speed. */
export const SLOW_MULT = 0.6
/** How much more gun damage a vulnerable body takes. */
export const VULNERABLE_MULT = 1.25

// ── ★ THE LOCK RULE (Alex's PvP concern, 09-28) ────────────────────────────────────────────────────────
// No stacking was already the rule (a re-apply extends to the later expiry, never adds). That alone does
// not stop a CHAIN: a second keeper's Shackle landing as the first's Static Field runs out keeps the target
// locked indefinitely. So hard statuses share one WINDOW per target:
//   · the first hard status opens it; any hard status landing inside it is CAPPED at its end (it may add a
//     second kind, never more time);
//   · when the window closes, the target is IMMUNE to hard statuses for `HARD_IMMUNITY_SECS`.
// Soft statuses ignore the window. A LINGERING zone (a fog you are standing in) applies with
// `{ zone: true }` and also ignores it: walking out is the counter, and a fog that flickered every few
// seconds because of an immunity timer would read as a broken cloud.
export const HARD_IMMUNITY_SECS = 3
/** per target: when its current (or last) hard window ends, in ms */
const HARD_END = '_hardEnd'

type TargetEntry = Partial<Record<StatusKind, number>> & { [HARD_END]?: number }
/** target id → kind → ms timestamp it expires (plus the target's hard window end) */
export type StatusBag = Record<string, TargetEntry>

export const emptyBag = (): StatusBag => ({})

export interface ApplyOpts {
  /** applied by a lingering zone the target can walk out of: the lock rule does not apply */
  zone?: boolean
}

/** Is this target currently immune to hard statuses (its last window closed under 3s ago)? */
export function hardImmune(bag: StatusBag, target: string, now: number): boolean {
  const end = bag[target]?.[HARD_END] ?? 0
  return end > 0 && now >= end && now < end + HARD_IMMUNITY_SECS * 1000
}

/**
 * Apply a status for `secs`. EXTENDS an existing one to the later expiry rather than stacking —
 * two Shackles never mean double the root, they mean the longer of the two. Hard kinds obey the lock
 * rule above unless `opts.zone`.
 */
export function applyStatus(bag: StatusBag, target: string, kind: StatusKind, secs: number, now: number, opts: ApplyOpts = {}): StatusBag {
  let until = now + secs * 1000
  const entry: TargetEntry = { ...bag[target] }
  if (STATUS_TABLE[kind].hard && !opts.zone) {
    const end = entry[HARD_END] ?? 0
    if (now < end) until = Math.min(until, end)                       // inside a window: never more time
    else if (hardImmune(bag, target, now)) return bag                 // just freed: immune
    else entry[HARD_END] = until                                      // opens a new window
  }
  const cur = entry[kind] ?? 0
  entry[kind] = Math.max(cur, until)
  return { ...bag, [target]: entry }
}

/** Apply several kinds at once — Shackle is root AND disarm, one cast. */
export function applyStatuses(bag: StatusBag, target: string, kinds: readonly StatusKind[], secs: number, now: number, opts: ApplyOpts = {}): StatusBag {
  // the window is opened by the FIRST hard kind of this cast, so its partner (root + disarm) lands whole
  return kinds.reduce((b, k) => applyStatus(b, target, k, secs, now, opts), bag)
}

export function hasStatus(bag: StatusBag, target: string, kind: StatusKind, now: number): boolean {
  return (bag[target]?.[kind] ?? 0) > now
}

/** Seconds left on a status — the render uses it for the tell above an affected enemy. */
export function remaining(bag: StatusBag, target: string, kind: StatusKind, now: number): number {
  return Math.max(0, ((bag[target]?.[kind] ?? 0) - now) / 1000)
}

/** Every kind currently on a target, in table order (hard first). */
export function statusesOn(bag: StatusBag, target: string, now: number): StatusKind[] {
  return STATUS_KINDS.filter((k) => hasStatus(bag, target, k, now))
}

/**
 * What a foe's brain needs, in one read: the host passes this, never the bag. `speedMult` folds slowed
 * and staggered (a stagger is a brief full stop) so every mover applies ONE number.
 */
export interface FoeMods { rooted: boolean; disarmed: boolean; blinded: boolean; silenced: boolean; speedMult: number; vulnerable: boolean }
export function foeMods(bag: StatusBag, target: string, now: number): FoeMods {
  const e = bag[target]
  const on = (k: StatusKind) => (e?.[k] ?? 0) > now
  const rooted = on('rooted'), staggered = on('staggered')
  return {
    rooted, disarmed: on('disarmed'), blinded: on('blinded'), silenced: on('silenced'),
    speedMult: rooted || staggered ? 0 : on('slowed') ? SLOW_MULT : 1,
    vulnerable: on('vulnerable'),
  }
}
export const NO_MODS: FoeMods = { rooted: false, disarmed: false, blinded: false, silenced: false, speedMult: 1, vulnerable: false }

/**
 * Drop expired entries. Returns the SAME object when nothing changed, so the frame loop can skip
 * the write and this never churns garbage at 60fps. A target's hard-window end is kept until its
 * immunity has run out, or the lock rule would forget a target it just freed.
 */
export function pruneStatuses(bag: StatusBag, now: number): StatusBag {
  let dirty = false
  const out: StatusBag = {}
  for (const [target, kinds] of Object.entries(bag)) {
    const live: TargetEntry = {}
    for (const [k, until] of Object.entries(kinds)) {
      const keep = k === HARD_END ? (until ?? 0) + HARD_IMMUNITY_SECS * 1000 > now : (until ?? 0) > now
      if (keep) (live as Record<string, number>)[k] = until as number
      else dirty = true
    }
    if (Object.keys(live).length > 0) out[target] = live
    else dirty = true
  }
  return dirty ? out : bag
}

/** Clear everything on one target — an enemy that dies must not carry a root into its respawn. */
export function clearTarget(bag: StatusBag, target: string): StatusBag {
  if (!bag[target]) return bag
  const out = { ...bag }
  delete out[target]
  return out
}
