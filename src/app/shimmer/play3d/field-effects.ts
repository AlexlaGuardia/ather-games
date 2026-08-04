// field-effects.ts — SYSTEM 1 of 3: the persistent area entity.
//
// ── WHY ────────────────────────────────────────────────────────────────────────
// A third of canon's unbuilt keeper moves are not projectiles at all — they are a PLACE that keeps
// being true for a while. Firewall is a wall of flame you throw between yourself and a threat;
// Healing Grove is a sanctuary that steadily restores everyone within. Neither is expressible as a
// bolt, which is exactly why they were the moves a gun cannot answer.
//
// So this module owns "a volume in the world, for a while". It is deliberately ignorant of THREE,
// of the player, and of enemies: it stores fields, expires them, and answers containment. The sim
// applies the consequences, so the rules stay provable headless.
//
// ── BOUNDARY ───────────────────────────────────────────────────────────────────
// WHAT a field does is canon (moves.md effect lines). Radius, duration, tick rate and damage are
// Jin's, and live on the move's CastSpec — never here. This module has no move names in it.

export interface FieldDef {
  /** the move that conjured it, for the HUD + debugging */
  moveId: string
  x: number
  z: number
  /** world-unit radius */
  radius: number
  /** seconds it persists */
  secs: number
  /** damage per tick applied to enemies inside (0 = harmless to them) */
  dps: number
  /** healing per tick applied to the player inside (0 = no restore) */
  hps: number
  /** does it stop projectiles crossing it? Firewall is cover; a grove is not. */
  stopsShots: boolean
}

export interface Field extends FieldDef {
  /** monotonic id — stable for the render pool */
  id: number
  /** ms timestamp this field expires */
  until: number
  /** ms timestamp of the next effect tick */
  nextTick: number
}

/** one effect application per second — slow enough to read, fast enough to matter */
export const FIELD_TICK_MS = 1000

/** Fields are capped so a mashed key cannot unbounded-grow the pool or the render list. */
export const MAX_FIELDS = 8

let nextId = 1
/** test hook — keeps ids deterministic across oracle runs */
export function resetFieldIds(): void { nextId = 1 }

/**
 * Add a field. Returns the new list. If the cap is reached the OLDEST field is dropped, not the
 * new one — a player who just paid mana must always see their cast happen.
 */
export function spawnField(fields: Field[], def: FieldDef, now: number): Field[] {
  const f: Field = { ...def, id: nextId++, until: now + def.secs * 1000, nextTick: now + FIELD_TICK_MS }
  const kept = fields.length >= MAX_FIELDS ? fields.slice(1) : fields
  return [...kept, f]
}

/** Drop everything that has expired. */
export function expireFields(fields: Field[], now: number): Field[] {
  return fields.some((f) => f.until <= now) ? fields.filter((f) => f.until > now) : fields
}

/** Is this point inside the field? Flat/2D on purpose — the ground plane is the play surface. */
export function contains(f: Field, x: number, z: number): boolean {
  const dx = x - f.x, dz = z - f.z
  return dx * dx + dz * dz <= f.radius * f.radius
}

/** Every live field containing a point. */
export function fieldsAt(fields: Field[], x: number, z: number): Field[] {
  return fields.filter((f) => contains(f, x, z))
}

/** Does a shot crossing this point get eaten? Firewall is cover; a healing grove is not. */
export function blocksShotAt(fields: Field[], x: number, z: number): boolean {
  return fields.some((f) => f.stopsShots && contains(f, x, z))
}

/**
 * Advance the clocks and report which fields fire an effect tick this frame.
 *
 * Returns the fields whose tick came due (their `nextTick` is rolled forward in the returned list),
 * so the caller applies dps/hps exactly once per FIELD_TICK_MS regardless of frame rate. A field
 * that misses many ticks (tab backgrounded) does NOT burst-apply them — it resyncs to now, because
 * a stack of retroactive damage on unpause is a bug wearing a feature's clothes.
 */
export function tickFields(fields: Field[], now: number): { fields: Field[]; fired: Field[] } {
  const live = expireFields(fields, now)
  const fired: Field[] = []
  const next = live.map((f) => {
    if (now < f.nextTick) return f
    fired.push(f)
    const behind = now - f.nextTick
    // resync rather than replay: skip whole missed intervals
    return { ...f, nextTick: now + FIELD_TICK_MS - (behind % FIELD_TICK_MS) }
  })
  return { fields: next, fired }
}
