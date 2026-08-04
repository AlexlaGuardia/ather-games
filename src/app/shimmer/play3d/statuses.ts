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

export type StatusKind =
  | 'rooted'    // cannot move (Shackle: clamped in iron)
  | 'disarmed'  // cannot fire (Shackle jamming a weapon mid-draw; Cordon locking all metal)
  | 'blinded'   // cannot aim — moves and fires wildly (Enlighten: disorients)

export const STATUS_KINDS: readonly StatusKind[] = ['rooted', 'disarmed', 'blinded'] as const

/** target id → kind → ms timestamp it expires */
export type StatusBag = Record<string, Partial<Record<StatusKind, number>>>

export const emptyBag = (): StatusBag => ({})

/**
 * Apply a status for `secs`. EXTENDS an existing one to the later expiry rather than stacking —
 * two Shackles never mean double the root, they mean the longer of the two.
 */
export function applyStatus(bag: StatusBag, target: string, kind: StatusKind, secs: number, now: number): StatusBag {
  const until = now + secs * 1000
  const cur = bag[target]?.[kind] ?? 0
  return { ...bag, [target]: { ...bag[target], [kind]: Math.max(cur, until) } }
}

/** Apply several kinds at once — Shackle is root AND disarm, one cast. */
export function applyStatuses(bag: StatusBag, target: string, kinds: readonly StatusKind[], secs: number, now: number): StatusBag {
  return kinds.reduce((b, k) => applyStatus(b, target, k, secs, now), bag)
}

export function hasStatus(bag: StatusBag, target: string, kind: StatusKind, now: number): boolean {
  return (bag[target]?.[kind] ?? 0) > now
}

/** Seconds left on a status — the render uses it for the tell above an affected enemy. */
export function remaining(bag: StatusBag, target: string, kind: StatusKind, now: number): number {
  return Math.max(0, ((bag[target]?.[kind] ?? 0) - now) / 1000)
}

/** Every kind currently on a target. */
export function statusesOn(bag: StatusBag, target: string, now: number): StatusKind[] {
  return STATUS_KINDS.filter((k) => hasStatus(bag, target, k, now))
}

/**
 * Drop expired entries. Returns the SAME object when nothing changed, so the frame loop can skip
 * the write and this never churns garbage at 60fps.
 */
export function pruneStatuses(bag: StatusBag, now: number): StatusBag {
  let dirty = false
  const out: StatusBag = {}
  for (const [target, kinds] of Object.entries(bag)) {
    const live: Partial<Record<StatusKind, number>> = {}
    for (const [k, until] of Object.entries(kinds)) {
      if ((until ?? 0) > now) live[k as StatusKind] = until
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
